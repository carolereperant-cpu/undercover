'use strict';

// Tests : le bot des Quatre Couronnes (règles de la salle + qualité de jeu).

const test = require('node:test');
const assert = require('node:assert/strict');
const g = require('./game');
const { nextMove } = require('./minigames/couronnes-bot');
const { MAX_TURNS } = require('./minigames/couronnes');

function lobby() {
  const res = g.createRoom(() => false, 'Hôte', 'couronnes');
  res.player.connected = true;
  return { room: res.room, host: res.player };
}

test('bot : seul l’hôte l’ajoute, une seule fois, uniquement aux jeux qui le prévoient', () => {
  const { room, host } = lobby();
  assert.ok(!g.addBot(room, 'inconnu').ok);
  const added = g.addBot(room, host.id);
  assert.ok(added.ok);
  assert.equal(added.player.bot, true);
  assert.equal(added.player.token, null); // pas de jeton : personne ne peut « se reconnecter » en bot
  assert.ok(!g.addBot(room, host.id).ok); // déjà un bot
  const quiz = g.createRoom(() => false, 'Hôte', 'pendu');
  assert.ok(!g.addBot(quiz.room, quiz.player.id).ok); // jeu sans bot
});

test('bot : la salle devient complète, la partie démarre, le bot n’est jamais hôte', () => {
  const { room, host } = lobby();
  g.addBot(room, host.id);
  assert.equal(room.players.length, 2);
  assert.ok(!g.addPlayer(room, 'Intrus').ok); // plus de place
  const view = g.viewFor(room, host.id);
  assert.equal(view.canBot, true);
  assert.equal(view.players.find((p) => p.bot).connected, true);
  assert.ok(g.startGame(room, host.id).ok);
  assert.equal(room.phase, 'playing');
  assert.equal(room.hostId, host.id);
});

test('bot : retirer le bot, ou quitter la salle, ne laisse pas de salle fantôme', () => {
  const a = lobby();
  g.addBot(a.room, a.host.id);
  assert.ok(g.removeBot(a.room, a.host.id).ok);
  assert.equal(a.room.players.length, 1);
  const b = lobby();
  g.addBot(b.room, b.host.id);
  g.removePlayer(b.room, b.host.id); // l'hôte part : le bot ne reste pas seul
  assert.equal(b.room.players.length, 0);
  const c = lobby();
  g.addBot(c.room, c.host.id);
  const bot = c.room.players.find((p) => p.bot);
  assert.ok(g.kick(c.room, c.host.id, bot.id).ok); // l'hôte peut aussi le renvoyer
  assert.equal(c.room.players.length, 1);
});

/** Joue une partie complète avec le même cerveau des deux côtés (ou un joueur passif). */
function play(passiveSide = null) {
  const { room, host } = lobby();
  g.addPlayer(room, 'B').player.connected = true;
  g.startGame(room, host.id);
  const mg = room.mg;
  let steps = 0;
  while (room.phase === 'playing') {
    assert.ok(++steps < 5000, 'la partie ne se termine pas');
    const actor = room.players.find((p) => p.id === mg.ids[mg.turn]);
    const move = mg.turn === passiveSide ? { type: 'endTurn' } : nextMove(room, actor.id);
    const res = g.miniAct(room, actor, move);
    assert.ok(res.ok, `action refusée : ${JSON.stringify(move)} → ${res.error}`);
  }
  return mg;
}

test('bot : 200 parties bot contre bot, toutes terminées sans action refusée', () => {
  for (let i = 0; i < 200; i++) {
    const mg = play();
    assert.ok(mg.winner === 0 || mg.winner === 1 || mg.winner === null);
    assert.ok(mg.turns <= MAX_TURNS);
  }
});

test('bot : bat très largement un joueur qui passe son tour', () => {
  let wins = 0;
  const N = 100;
  for (let i = 0; i < N; i++) {
    const side = i % 2; // le joueur passif est tantôt premier, tantôt second
    const mg = play(side);
    if (mg.winner === 1 - side) wins++;
  }
  assert.ok(wins >= 98, `le bot n’a gagné que ${wins}/${N}`);
});

test('bot : ne joue pas quand ce n’est pas son tour et ne triche pas (aucune lecture de la main adverse)', () => {
  const { room, host } = lobby();
  g.addPlayer(room, 'B').player.connected = true;
  g.startGame(room, host.id);
  const waiting = room.players.find((p) => p.id !== room.mg.ids[room.mg.turn]);
  assert.equal(nextMove(room, waiting.id), null);
  const src = require('node:fs').readFileSync(require.resolve('./minigames/couronnes-bot'), 'utf8');
  assert.ok(!/foe\.hand/.test(src));
});
