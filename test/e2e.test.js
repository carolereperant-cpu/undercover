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

test('thèmes : l’hôte choisit les thèmes, les autres les voient, et une partie à 3 démarre', async () => {
  const clients = ['Hôte', 'Ami1', 'Ami2'].map(makeClient);
  await Promise.all(clients.map((c) => c.ready));
  const created = await clients[0].emit('room:create', { name: 'Hôte' });
  assert.ok(created.ok);
  for (const c of clients.slice(1)) assert.ok((await c.emit('room:join', { code: created.code, name: c.name })).ok);
  const [host, a1] = clients;

  const lobby = await host.waitFor((s) => s.players.length === 3);
  assert.ok(lobby.themes.length >= 9);
  assert.equal(lobby.options.themes.length, lobby.themes.length);

  // Un joueur ordinaire ne peut pas changer les thèmes ; l'hôte oui, mais pas une liste vide.
  assert.equal((await a1.emit('host:options', { themes: ['films'] })).ok, false);
  assert.equal((await host.emit('host:options', { themes: [] })).ok, false);
  assert.ok((await host.emit('host:options', { themes: ['films'], showTheme: true })).ok);
  const seen = await a1.waitFor((s) => s.options && s.options.themes.length === 1);
  assert.deepEqual(seen.options.themes, ['films']);

  // À 3 joueurs, la partie démarre et le thème est visible par tous.
  assert.ok((await host.emit('host:start')).ok);
  const started = await a1.waitFor((s) => s.phase === 'reveal');
  assert.equal(started.theme.label, 'Films');
  for (const c of clients) c.socket.close();
});

test('hub : la liste des jeux est servie, et un mini-jeu se joue en réseau (Puissance 4)', async () => {
  const list = await (await fetch(`http://localhost:${port}/api/games`)).json();
  assert.ok(list.length >= 9);
  assert.equal(list[0].id, 'undercover');

  const [a, b] = ['Ana', 'Ben'].map(makeClient);
  await Promise.all([a.ready, b.ready]);
  assert.equal((await a.emit('room:create', { name: 'Ana', gameType: 'nimportequoi' })).ok, false, 'jeu inconnu refusé');
  const created = await a.emit('room:create', { name: 'Ana', gameType: 'puissance4' });
  assert.ok(created.ok);
  assert.ok((await b.emit('room:join', { code: created.code, name: 'Ben' })).ok);
  const lobby = await a.waitFor((s) => s.players.length === 2);
  assert.equal(lobby.gameType, 'puissance4');
  assert.equal(lobby.limits.max, 2);
  assert.equal((await a.emit('guest:add', { name: 'Léo' })).ok, false, 'pas d’invité à Puissance 4');
  assert.ok((await a.emit('host:start')).ok);
  const started = await a.waitFor((s) => s.phase === 'playing');
  const first = started.mg.turn === started.mg.mine ? a : b;
  const second = first === a ? b : a;
  assert.equal((await second.emit('game:act', { type: 'drop', col: 0 })).ok, false, 'pas ton tour');
  assert.ok((await first.emit('game:act', { type: 'drop', col: 3 })).ok);
  const after = await second.waitFor((s) => s.mg && s.mg.board[5][3] !== null);
  assert.equal(after.mg.turn, after.mg.mine, 'c’est maintenant au second joueur');
  for (const c of [a, b]) c.socket.close();
});

test('quiz en réseau : thèmes dans la salle, un invité répond, les réponses des autres restent cachées', async () => {
  const list = await (await fetch(`http://localhost:${port}/api/games`)).json();
  for (const id of ['justone', 'quiz', 'dessin', 'telephone', 'loupgarou']) assert.ok(list.some((g) => g.id === id), id);

  const [a, b] = ['Ana', 'Ben'].map(makeClient);
  await Promise.all([a.ready, b.ready]);
  const created = await a.emit('room:create', { name: 'Ana', gameType: 'quiz' });
  assert.ok(created.ok);
  assert.ok((await b.emit('room:join', { code: created.code, name: 'Ben' })).ok);
  const lobby = await a.waitFor((s) => s.players.length === 2);
  assert.equal(lobby.themes.length, 9, 'les thèmes sont proposés aux hôtes du quiz');
  assert.ok((await a.emit('host:options', { themes: ['films', 'series'] })).ok);
  const chosen = await b.waitFor((s) => s.options && s.options.themes.length === 2);
  assert.deepEqual(chosen.options.themes, ['films', 'series']);
  assert.ok((await a.emit('guest:add', { name: 'Léo' })).ok);
  await a.waitFor((s) => s.players.length === 3);
  assert.ok((await a.emit('host:start')).ok);
  const started = await a.waitFor((s) => s.phase === 'playing' && s.mg);
  assert.equal(started.mg.total, 10);
  assert.ok(started.mgGuests, 'l’hôte reçoit aussi la vue de son invité');
  const guestId = Object.keys(started.mgGuests)[0];
  assert.ok((await a.emit('game:act', { type: 'answer', choice: 1, asId: guestId })).ok, 'répondre au nom de l’invité');
  assert.equal((await b.emit('game:act', { type: 'timeup', asId: guestId })).ok, false, 'on ne joue pas pour l’invité d’un autre');
  assert.equal((await b.emit('game:act', { type: 'timeup' })).ok, false, 'le temps n’est pas écoulé');
  const seenByB = await b.waitFor((s) => s.mg && s.mg.answered.length === 1);
  assert.equal(seenByB.mg.myChoice, null, 'Ben ne voit pas ce qu’a répondu l’invité');
  assert.equal(seenByB.mg.result, null);
  assert.ok((await b.emit('game:act', { type: 'answer', choice: 0 })).ok);
  assert.ok((await a.emit('game:act', { type: 'answer', choice: 2 })).ok);
  const result = await a.waitFor((s) => s.mg && s.mg.phase === 'result');
  assert.equal(result.mg.result.answers.length, 3);
  for (const c of [a, b]) c.socket.close();
});
