'use strict';

/**
 * Test de bout en bout : un vrai serveur, de vrais clients Socket.IO (comme des téléphones).
 * On joue une partie complète à 6 et on vérifie au passage qu'aucun joueur ne voit les secrets des autres.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { io: connect } = require('socket.io-client');
const { server, io, rooms } = require('../server/index.js');

let port;

test.before(async () => {
  await new Promise((resolve) => server.listen(0, resolve));
  port = server.address().port;
});

test.after(async () => {
  io.close();
  rooms.clear();
});

function makeClient(name) {
  const socket = connect(`http://localhost:${port}`, { transports: ['websocket'], forceNew: true });
  const client = { name, socket, state: null, token: null, code: null };
  const waiters = [];
  socket.on('state', (s) => {
    client.state = s;
    for (const w of [...waiters]) {
      if (w.pred(s)) {
        waiters.splice(waiters.indexOf(w), 1);
        w.resolve(s);
      }
    }
  });
  client.ready = new Promise((resolve) => socket.on('connect', resolve));
  client.emit = (event, payload = {}) =>
    new Promise((resolve) => socket.timeout(3000).emit(event, payload, (err, res) => resolve(err ? { ok: false, error: 'timeout' } : res)));
  client.waitFor = (pred) =>
    client.state && pred(client.state)
      ? Promise.resolve(client.state)
      : new Promise((resolve, reject) => {
          const w = { pred, resolve };
          waiters.push(w);
          setTimeout(() => reject(new Error(`timeout waiting for state (${name})`)), 3000).unref();
        });
  return client;
}

test('partie complète à 6 joueurs avec reconnexion', async () => {
  const names = ['Alice', 'Bob', 'Chloé', 'David', 'Emma', 'Farid'];
  const clients = names.map(makeClient);
  await Promise.all(clients.map((c) => c.ready));

  // Création et arrivée dans la salle
  const created = await clients[0].emit('room:create', { name: 'Alice' });
  assert.ok(created.ok);
  assert.match(created.code, /^[A-Z]{4}$/);
  clients[0].code = created.code;
  clients[0].token = created.token;

  const wrong = await clients[1].emit('room:join', { code: 'ZZZZ', name: 'Bob' });
  assert.equal(wrong.ok, false);

  for (const c of clients.slice(1)) {
    const res = await c.emit('room:join', { code: created.code.toLowerCase(), name: c.name });
    assert.ok(res.ok, res.error);
    c.code = res.code;
    c.token = res.token;
  }
  const dup = makeClient('Alice');
  await dup.ready;
  assert.equal((await dup.emit('room:join', { code: created.code, name: 'alice' })).ok, false, 'pseudo en double refusé');
  dup.socket.close();

  await clients[5].waitFor((s) => s.players.length === 6);

  // Seul l'hôte peut lancer
  assert.equal((await clients[1].emit('host:start')).ok, false);
  assert.ok((await clients[0].emit('host:start')).ok);
  await Promise.all(clients.map((c) => c.waitFor((s) => s.phase === 'reveal')));

  // Aucun joueur ne reçoit les secrets des autres
  const words = new Set(clients.map((c) => c.state.me.word).filter(Boolean));
  assert.ok(words.size <= 2);
  for (const c of clients) {
    const json = JSON.stringify(c.state);
    assert.ok(!json.includes('"token"'));
    assert.ok(!json.includes('"undercover"'), `${c.name} ne doit pas voir le rôle undercover`);
    for (const other of clients) {
      if (other !== c && other.state.me.word && other.state.me.word !== c.state.me.word) {
        assert.ok(!json.includes(other.state.me.word), `${c.name} voit le mot de ${other.name}`);
      }
    }
  }

  // Déconnexion d'un joueur puis reconnexion avec son jeton
  const victim = clients[3];
  const wordBefore = victim.state.me.word;
  victim.socket.close();
  await clients[0].waitFor((s) => s.players.find((p) => p.name === victim.name && !p.connected));
  const back = makeClient(victim.name);
  await back.ready;
  assert.equal((await back.emit('room:rejoin', { code: victim.code, token: 'faux-jeton' })).ok, false);
  assert.ok((await back.emit('room:rejoin', { code: victim.code, token: victim.token })).ok);
  await back.waitFor((s) => s.phase === 'reveal');
  assert.equal(back.state.me.word, wordBefore, 'le joueur retrouve son mot');
  clients[3] = Object.assign(back, { name: victim.name, token: victim.token, code: victim.code });

  // Tout le monde est prêt → discussion
  for (const c of clients) assert.ok((await c.emit('player:ready')).ok);
  await Promise.all(clients.map((c) => c.waitFor((s) => s.phase === 'discussion')));
  assert.equal(clients[0].state.order.length, 6);

  // Vote : tout le monde vote contre le premier joueur qui n'est pas lui
  assert.equal((await clients[1].emit('host:openVote')).ok, false);
  assert.ok((await clients[0].emit('host:openVote')).ok);
  await Promise.all(clients.map((c) => c.waitFor((s) => s.phase === 'vote')));
  const targetId = clients[5].state.meId;
  for (const c of clients) {
    if (c.state.meId === targetId) continue;
    assert.ok((await c.emit('player:vote', { targetId })).ok);
  }
  assert.equal((await clients[5].emit('player:vote', { targetId })).ok, false, 'on ne vote pas pour soi');
  assert.ok((await clients[5].emit('player:vote', { targetId: clients[0].state.meId })).ok);

  const after = await clients[0].waitFor((s) => s.phase !== 'vote');
  assert.ok(['result', 'whiteGuess', 'end'].includes(after.phase));
  assert.ok(after.result.tally.length >= 1);

  // Fin de partie éventuelle : tous les secrets sont révélés à la fin seulement
  if (after.phase === 'end') {
    assert.equal(after.end.players.length, 6);
  }

  for (const c of clients) c.socket.close();
});

test('un joueur ne peut pas rejoindre une partie commencée', async () => {
  const host = makeClient('Hôte');
  await host.ready;
  const res = await host.emit('room:create', { name: 'Hôte' });
  const others = [];
  for (let i = 0; i < 3; i++) {
    const c = makeClient(`J${i}`);
    await c.ready;
    assert.ok((await c.emit('room:join', { code: res.code, name: `J${i}` })).ok);
    others.push(c);
  }
  assert.ok((await host.emit('host:start')).ok);
  const late = makeClient('Retard');
  await late.ready;
  const lateRes = await late.emit('room:join', { code: res.code, name: 'Retard' });
  assert.equal(lateRes.ok, false);
  for (const c of [host, late, ...others]) c.socket.close();
});

test('limite de débit : un client qui spamme est freiné', async () => {
  const c = makeClient('Spam');
  await c.ready;
  const results = [];
  for (let i = 0; i < 40; i++) results.push(await c.emit('room:rejoin', { code: 'AAAA', token: 'x' }));
  assert.ok(results.some((r) => r.error && r.error.includes('trop de requêtes')), 'le limiteur doit se déclencher');
  c.socket.close();
});

test('en-têtes de sécurité et santé du serveur', async () => {
  const res = await fetch(`http://localhost:${port}/health`);
  assert.equal(res.status, 200);
  assert.ok(res.headers.get('content-security-policy'));
  assert.equal(res.headers.get('x-powered-by'), null);
  const page = await fetch(`http://localhost:${port}/?salle=ABCD`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<div id="root">/);
});

test('joueur invité : le propriétaire agit pour lui, les autres non', async () => {
  const clients = ['Hôte', 'Alice', 'Bob'].map(makeClient);
  await Promise.all(clients.map((c) => c.ready));
  const [host, alice, bob] = clients;
  const created = await host.emit('room:create', { name: 'Hôte' });
  for (const c of [alice, bob]) assert.ok((await c.emit('room:join', { code: created.code, name: c.name })).ok);

  // Alice fait jouer Léo sur son écran
  assert.ok((await alice.emit('guest:add', { name: 'Léo' })).ok);
  assert.equal((await alice.emit('guest:add', { name: 'léo' })).ok, false);
  const lobby = await host.waitFor((s) => s.players.length === 4);
  const leo = lobby.players.find((p) => p.name === 'Léo');
  assert.equal(leo.guest, true);
  assert.equal((await bob.emit('guest:remove', { guestId: leo.id })).ok, false, 'Bob ne peut pas retirer Léo');

  assert.ok((await host.emit('host:start')).ok);
  await Promise.all(clients.map((c) => c.waitFor((s) => s.phase === 'reveal')));
  await alice.waitFor((s) => s.guests && s.guests.length === 1);
  assert.ok(alice.state.guests[0].me.word !== undefined);
  assert.equal(host.state.guests, undefined, 'l’hôte ne voit pas les secrets de Léo');
  assert.equal(bob.state.guests, undefined);

  // Bob essaie d'agir à la place de Léo : refusé. Alice : acceptée.
  assert.equal((await bob.emit('player:ready', { asId: leo.id })).ok, false);
  assert.equal((await alice.emit('player:ready', { asId: 'inconnu' })).ok, false);
  assert.ok((await alice.emit('player:ready', { asId: leo.id })).ok);
  const seen = await host.waitFor((s) => s.players.find((p) => p.id === leo.id).ready);
  assert.ok(seen);

  for (const c of clients) c.socket.close();
});
