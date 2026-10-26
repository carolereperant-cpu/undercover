'use strict';

/** Test de bout en bout du bot : un vrai client, un vrai serveur, le bot joue seul son tour. */

process.env.BOT_DELAY_MS = '5'; // le bot joue vite pendant les tests

const test = require('node:test');
const assert = require('node:assert/strict');
const { io: connect } = require('socket.io-client');
const { server, io, rooms } = require('../server/index.js');

let port;
test.before(async () => {
  await new Promise((resolve) => server.listen(0, resolve));
  port = server.address().port;
});
test.after(() => {
  io.close();
  rooms.clear();
});

test('partie contre le bot : il joue ses tours tout seul et la partie va à son terme', async () => {
  const socket = connect(`http://localhost:${port}`, { transports: ['websocket'], forceNew: true });
  let state = null;
  const waiters = [];
  socket.on('state', (s) => {
    state = s;
    for (const w of [...waiters]) if (w.pred(s)) { waiters.splice(waiters.indexOf(w), 1); w.resolve(s); }
  });
  const emit = (event, payload = {}) =>
    new Promise((resolve) => socket.timeout(3000).emit(event, payload, (err, res) => resolve(err ? { ok: false, error: 'timeout' } : res)));
  const waitFor = (pred) =>
    state && pred(state)
      ? Promise.resolve(state)
      : new Promise((resolve, reject) => {
          waiters.push({ pred, resolve });
          setTimeout(() => reject(new Error('timeout waiting for state')), 5000).unref();
        });
  await new Promise((resolve) => socket.on('connect', resolve));

  assert.ok((await emit('room:create', { name: 'Carole', gameType: 'couronnes' })).ok);
  assert.ok((await emit('bot:add')).ok);
  assert.ok((await emit('host:start')).ok);
  const me = state.meId;

  // L'humain passe systématiquement son tour ; le bot doit jouer et finir par gagner (ou aller au bout des tours).
  let guard = 0;
  while (state.phase === 'playing') {
    assert.ok(++guard < 200, 'la partie ne se termine pas');
    const s = await waitFor((x) => x.phase !== 'playing' || x.mg.ids[x.mg.turn] === me);
    if (s.phase !== 'playing') break;
    assert.ok((await emit('game:act', { type: 'endTurn' })).ok);
  }
  assert.equal(state.phase, 'end');
  assert.equal(state.mg.winner, 1 - state.mg.mine);
  // Aucune main adverse dans ce que reçoit l'humain
  assert.ok(!('foeHand' in state.mg) && Array.isArray(state.mg.hand));
  socket.close();
});
