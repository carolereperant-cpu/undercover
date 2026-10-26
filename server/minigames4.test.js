'use strict';

// Tests : Les Quatre Couronnes (jeu de deck-building original).

const test = require('node:test');
const assert = require('node:assert/strict');
const g = require('./game');
const { MARKET, STARTERS, BY_ID, ALL } = require('./minigames/couronnes-cards');

function start() {
  const res = g.createRoom(() => false, 'Hôte', 'couronnes');
  const room = res.room;
  res.player.connected = true;
  g.addPlayer(room, 'Autre').player.connected = true;
  assert.ok(g.startGame(room, room.hostId).ok);
  return room;
}
const cur = (room) => room.players.find((p) => p.id === room.mg.ids[room.mg.turn]);
const other = (room) => room.players.find((p) => p.id !== cur(room).id);
const act = (room, who, type, payload = {}) => g.miniAct(room, who, { type, ...payload });
const give = (room, who, id) => {
  const p = room.mg.players[room.mg.ids.indexOf(who.id)];
  p.hand.push({ uid: `t${Math.random()}`, id });
  return p.hand[p.hand.length - 1];
};

test('cartes : 35 cartes, identifiants uniques, effets valides', () => {
  assert.equal(ALL.length, 35);
  assert.equal(new Set(ALL.map((c) => c.id)).size, 35);
  assert.equal(STARTERS.length, 3);
  for (const c of MARKET) {
    assert.ok(c.cost >= 1 && c.cost <= 7, c.id);
    assert.ok(c.prompt.length > 10, c.id);
    if (c.type === 'champion') assert.ok(c.def > 0 && c.act, c.id);
    else assert.ok(c.fx, c.id);
  }
});

test('couronnes : mise en place (10 cartes par joueur, 5 au marché, vie 40)', () => {
  const room = start();
  const mg = room.mg;
  assert.deepEqual(mg.life, [40, 40]);
  assert.equal(mg.market.length, 5);
  const total = (p) => p.deck.length + p.hand.length + p.discard.length;
  assert.equal(total(mg.players[0]), 10);
  assert.equal(total(mg.players[1]), 10);
  assert.equal(mg.players[mg.turn].hand.length, 3);
  assert.equal(mg.players[1 - mg.turn].hand.length, 5);
});

test('couronnes : la main adverse n’est jamais envoyée', () => {
  const room = start();
  const a = cur(room);
  const v = g.viewFor(room, a.id).mg;
  const foeUids = room.mg.players[1 - room.mg.turn].hand.map((c) => c.uid);
  const json = JSON.stringify(v);
  for (const uid of foeUids) assert.ok(!json.includes(uid), 'fuite de la main adverse');
  assert.equal(v.counts.foeHand, 5);
});

test('couronnes : seul le joueur dont c’est le tour peut agir', () => {
  const room = start();
  const res = act(room, other(room), 'endTurn');
  assert.equal(res.ok, false);
});

test('couronnes : jouer écu / bâton / amulette donne or, attaque, vie', () => {
  const room = start();
  const a = cur(room);
  const ecu = give(room, a, 'ecu');
  const baton = give(room, a, 'baton');
  assert.ok(act(room, a, 'play', { uid: ecu.uid }).ok);
  assert.ok(act(room, a, 'play', { uid: baton.uid }).ok);
  assert.equal(room.mg.pool.g, 1);
  assert.equal(room.mg.pool.a, 1);
  assert.equal(act(room, a, 'play', { uid: ecu.uid }).ok, false, 'une carte jouée ne se rejoue pas');
});

test('couronnes : acheter coûte de l’or et remplace la carte du marché', () => {
  const room = start();
  const a = cur(room);
  room.mg.market[0] = { uid: 'm0', id: 'dragonnet' }; // coût 5
  assert.equal(act(room, a, 'buy', { index: 0 }).ok, false, 'pas assez d’or');
  room.mg.pool.g = 5;
  assert.ok(act(room, a, 'buy', { index: 0 }).ok);
  assert.equal(room.mg.pool.g, 0);
  assert.equal(room.mg.market.length, 5);
  assert.notEqual(room.mg.market[0].uid, 'm0');
  const p = room.mg.players[room.mg.turn];
  assert.ok(p.discard.some((c) => c.uid === 'm0'));
});

test('couronnes : alliance, seulement si une autre carte de la faction est en jeu', () => {
  const room = start();
  const a = cur(room);
  const first = give(room, a, 'forgeron'); // a2, alliance g1
  act(room, a, 'play', { uid: first.uid });
  assert.equal(room.mg.pool.a, 2);
  assert.equal(room.mg.pool.g, 0, 'pas d’alliance pour la première');
  const second = give(room, a, 'forgeron');
  act(room, a, 'play', { uid: second.uid });
  assert.equal(room.mg.pool.a, 4);
  assert.equal(room.mg.pool.g, 1, 'alliance avec la première');
});

test('couronnes : champion posé, activé une fois par tour, remis à zéro au tour suivant', () => {
  const room = start();
  const a = cur(room);
  const c = give(room, a, 'druide'); // act g2
  act(room, a, 'play', { uid: c.uid });
  assert.ok(act(room, a, 'activate', { uid: c.uid }).ok);
  assert.equal(room.mg.pool.g, 2);
  assert.equal(act(room, a, 'activate', { uid: c.uid }).ok, false);
  const b = other(room);
  act(room, a, 'endTurn');
  act(room, b, 'endTurn');
  assert.ok(act(room, cur(room), 'activate', { uid: c.uid }).ok, 'de nouveau disponible');
});

test('couronnes : un champion garde doit être vaincu avant le joueur et les autres champions', () => {
  const room = start();
  const a = cur(room);
  const b = other(room);
  const bp = room.mg.players[room.mg.ids.indexOf(b.id)];
  bp.champions.push({ uid: 'g1', id: 'chene', tapped: false }); // garde, défense 4
  bp.champions.push({ uid: 'c1', id: 'sirene', tapped: false }); // défense 2
  room.mg.pool.a = 10;
  assert.equal(act(room, a, 'attack', { target: 'player' }).ok, false);
  assert.equal(act(room, a, 'attack', { target: 'c1' }).ok, false);
  assert.ok(act(room, a, 'attack', { target: 'g1' }).ok);
  assert.equal(room.mg.pool.a, 6);
  assert.ok(act(room, a, 'attack', { target: 'c1' }).ok);
  assert.ok(act(room, a, 'attack', { target: 'player' }).ok);
  assert.equal(room.mg.life[room.mg.ids.indexOf(b.id)], 40 - 4);
  assert.ok(bp.discard.some((c) => c.uid === 'g1'), 'le champion vaincu va à la défausse');
});

test('couronnes : l’attaque insuffisante est refusée', () => {
  const room = start();
  const a = cur(room);
  const bp = room.mg.players[room.mg.ids.indexOf(other(room).id)];
  bp.champions.push({ uid: 'k', id: 'kraken', tapped: false }); // défense 6
  room.mg.pool.a = 5;
  assert.equal(act(room, a, 'attack', { target: 'k' }).ok, false);
  assert.equal(room.mg.pool.a, 5);
});

test('couronnes : la défausse adverse retire une carte au hasard de sa main', () => {
  const room = start();
  const a = cur(room);
  const bp = room.mg.players[room.mg.ids.indexOf(other(room).id)];
  const before = bp.hand.length;
  const c = give(room, a, 'espion'); // x1
  act(room, a, 'play', { uid: c.uid });
  assert.equal(bp.hand.length, before - 1);
});

test('couronnes : soin plafonné à 60', () => {
  const room = start();
  const a = cur(room);
  const i = room.mg.ids.indexOf(a.id);
  room.mg.life[i] = 58;
  const c = give(room, a, 'reinefeuilles'); // h6
  act(room, a, 'play', { uid: c.uid });
  assert.equal(room.mg.life[i], 60);
});

test('couronnes : fin de tour = main défaussée, 5 nouvelles cartes, tour à l’autre', () => {
  const room = start();
  const a = cur(room);
  const first = room.mg.turn;
  assert.ok(act(room, a, 'endTurn').ok);
  assert.equal(room.mg.turn, 1 - first);
  assert.equal(room.mg.players[first].hand.length, 5);
  assert.equal(room.mg.pool.g + room.mg.pool.a, 0);
});

test('couronnes : la vie à 0 termine la partie, le survivant gagne', () => {
  const room = start();
  const a = cur(room);
  const bi = room.mg.ids.indexOf(other(room).id);
  room.mg.life[bi] = 3;
  room.mg.pool.a = 3;
  assert.ok(act(room, a, 'attack', { target: 'player' }).ok);
  assert.equal(room.phase, 'end');
  assert.equal(room.mg.winner, room.mg.ids.indexOf(a.id));
  assert.equal(act(room, a, 'endTurn').ok, false);
});

test('couronnes : limite de tours, le plus de vie gagne (ou égalité)', () => {
  const room = start();
  room.mg.turns = 39;
  room.mg.life = [30, 20];
  act(room, cur(room), 'endTurn');
  assert.equal(room.phase, 'end');
  assert.equal(room.mg.winner, 0);
  const r2 = start();
  r2.mg.turns = 39;
  act(r2, cur(r2), 'endTurn');
  assert.equal(r2.mg.winner, null);
  assert.equal(r2.mg.reason, 'turns');
});

test('couronnes : le paquet se remélange quand il est vide', () => {
  const room = start();
  const p = room.mg.players[0];
  p.discard.push(...p.deck);
  p.deck = [];
  const a = room.players[0];
  room.mg.turn = 0;
  assert.ok(act(room, a, 'endTurn').ok);
  assert.ok(p.hand.length >= 5);
});
