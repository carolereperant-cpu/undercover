'use strict';

// Tests : Les Terres d'Aldoria (jeu de conquête) et son bot.

const test = require('node:test');
const assert = require('node:assert/strict');
const g = require('./game');
const C = require('./minigames/conquete');
const { nextMove } = require('./minigames/conquete-bot');

const { TERRITORIES, REGIONS, NEIGHBORS, BY_ID } = C;

function room(n, bots = 0) {
  const res = g.createRoom(() => false, 'Hôte', 'conquete');
  res.player.connected = true;
  const r = res.room;
  for (let i = 1; i < n - bots; i++) g.addPlayer(r, `J${i}`).player.connected = true;
  for (let i = 0; i < bots; i++) assert.ok(g.addBot(r, r.hostId).ok);
  assert.ok(g.startGame(r, r.hostId).ok, 'démarrage');
  return r;
}
const cur = (r) => r.players.find((p) => p.id === r.mg.ids[r.mg.turn]);
const act = (r, who, type, payload = {}) => g.miniAct(r, who, { type, ...payload });

/** Remplace le hasard par une suite de valeurs (pour des dés connus). */
function withDice(values, fn) {
  const real = Math.random;
  let i = 0;
  Math.random = () => (values[i++ % values.length] - 1) / 6 + 0.01;
  try {
    return fn();
  } finally {
    Math.random = real;
  }
}

test('carte : 24 territoires, 6 régions, liens symétriques et carte connexe', () => {
  assert.equal(TERRITORIES.length, 24);
  assert.equal(new Set(TERRITORIES.map((t) => t.id)).size, 24);
  assert.equal(REGIONS.length, 6);
  for (const r of REGIONS) {
    assert.equal(TERRITORIES.filter((t) => t.region === r.id).length, 4, r.id);
    assert.ok(r.bonus >= 2 && r.bonus <= 5);
  }
  for (const [id, list] of Object.entries(NEIGHBORS)) {
    assert.ok(list.length >= 2, `${id} est trop isolé`);
    assert.ok(!list.includes(id));
    for (const n of list) assert.ok(NEIGHBORS[n].includes(id), `lien non symétrique ${id}-${n}`);
  }
  const seen = new Set([TERRITORIES[0].id]);
  const todo = [TERRITORIES[0].id];
  while (todo.length) for (const n of NEIGHBORS[todo.pop()]) if (!seen.has(n)) (seen.add(n), todo.push(n));
  assert.equal(seen.size, 24, 'toute la carte est atteignable');
});

test('mise en place : 2 à 6 joueurs, tout est distribué, armées conformes, territoires équilibrés', () => {
  for (let n = 2; n <= 6; n++) {
    const r = room(n);
    const mg = r.mg;
    assert.equal(mg.ids.length, n);
    assert.equal(mg.turn, 0);
    const counts = Array(n).fill(0);
    const armies = Array(n).fill(0);
    for (const t of TERRITORIES) {
      const s = mg.terr[t.id];
      assert.ok(s.armies >= 1 && s.owner >= 0 && s.owner < n);
      counts[s.owner] += 1;
      armies[s.owner] += s.armies;
    }
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `répartition ${counts}`);
    for (const a of armies) assert.equal(a, C.START_ARMIES[n]);
    assert.equal(mg.pending, C.reinforcements(mg, 0));
    assert.equal(mg.phase, 'reinforce');
  }
});

test('renforts : 1 par tranche de 3 territoires (3 au minimum) + bonus de région entière', () => {
  const r = room(2);
  const mg = r.mg;
  for (const t of TERRITORIES) mg.terr[t.id].owner = 1; // le joueur 1 possède tout
  mg.terr['givrebois'].owner = 0;
  assert.equal(C.reinforcements(mg, 0), 3); // 1 territoire : minimum 3
  assert.equal(C.reinforcements(mg, 1), 7 + 3 + 2 + 2 + 4 + 3, '23 territoires : 7, plus 5 régions entières (sylve 3, plaines 2, cœur 2, marais 4, côte 3)');
});

test('renforts : refus hors de son tour, mauvais territoire, trop de renforts, attaque avant d’avoir tout placé', () => {
  const r = room(3);
  const me = cur(r);
  const other = r.players.find((p) => p.id !== me.id);
  const mine = TERRITORIES.find((t) => r.mg.terr[t.id].owner === 0).id;
  const foe = TERRITORIES.find((t) => r.mg.terr[t.id].owner !== 0).id;
  assert.ok(!act(r, other, 'place', { territory: mine, count: 1 }).ok);
  assert.ok(!act(r, me, 'place', { territory: foe, count: 1 }).ok);
  assert.ok(!act(r, me, 'place', { territory: mine, count: r.mg.pending + 1 }).ok);
  assert.ok(!act(r, me, 'place', { territory: mine, count: 0 }).ok);
  assert.ok(!act(r, me, 'place', { territory: '__proto__', count: 1 }).ok);
  assert.ok(!act(r, me, 'endTurn').ok, 'impossible de finir sans placer');
  assert.ok(!act(r, me, 'blitz', { from: mine, to: foe }).ok);
  const before = r.mg.terr[mine].armies;
  const total = r.mg.pending;
  assert.ok(act(r, me, 'place', { territory: mine, count: total - 1 }).ok);
  assert.equal(r.mg.phase, 'reinforce');
  assert.ok(act(r, me, 'place', { territory: mine, count: 1 }).ok);
  assert.equal(r.mg.phase, 'attack');
  assert.equal(r.mg.terr[mine].armies, before + total);
});

/** Prépare un face-à-face contrôlé : A (joueur 0) attaque B (joueur 1) sur deux territoires voisins. */
function duel(aArmies, bArmies) {
  const r = room(2);
  const mg = r.mg;
  const [a, b] = ['givrebois', 'pic-du-corbeau'];
  for (const t of TERRITORIES) (mg.terr[t.id].owner = 1), (mg.terr[t.id].armies = 3);
  mg.terr[a] = { owner: 0, armies: aArmies };
  mg.terr[b] = { owner: 1, armies: bArmies };
  mg.terr['lac-muet'] = { owner: 0, armies: 2 };
  mg.pending = 0;
  mg.phase = 'attack';
  return { r, a, b, me: cur(r), mg };
}

test('combat : les égalités profitent au défenseur, chaque paire de dés coûte une armée', () => {
  // attaquant 6,3 contre défenseur 6,3 → égalités partout : l'attaquant perd 2 armées
  const { r, a, b, me, mg } = duel(5, 4);
  withDice([6, 3, 3, 6], () => assert.ok(act(r, me, 'attack', { from: a, to: b, dice: 2 }).ok));
  assert.equal(mg.terr[a].armies, 3);
  assert.equal(mg.terr[b].armies, 4);
  assert.deepEqual(mg.lastBattle.att, [6, 3]);
  assert.deepEqual(mg.lastBattle.def, [6, 3]);
});

test('combat : l’attaquant avec l’avantage fait perdre deux armées au défenseur', () => {
  const { r, a, b, me, mg } = duel(5, 4);
  withDice([6, 5, 2, 1], () => assert.ok(act(r, me, 'attack', { from: a, to: b, dice: 2 }).ok));
  assert.equal(mg.terr[a].armies, 5);
  assert.equal(mg.terr[b].armies, 2);
  assert.equal(mg.lastBattle.defLoss, 2);
});

test('combat : refus (non voisin, trop peu d’armées, trop de dés, son propre territoire)', () => {
  const { r, a, b, me, mg } = duel(3, 3);
  assert.ok(!act(r, me, 'attack', { from: a, to: 'port-ecume', dice: 1 }).ok, 'non voisin');
  assert.ok(!act(r, me, 'attack', { from: a, to: b, dice: 3 }).ok, '3 dés avec 3 armées');
  assert.ok(!act(r, me, 'attack', { from: a, to: b, dice: 0 }).ok);
  assert.ok(!act(r, me, 'attack', { from: a, to: 'lac-muet', dice: 1 }).ok, 'territoire à soi');
  mg.terr[a].armies = 1;
  assert.ok(!act(r, me, 'attack', { from: a, to: b, dice: 1 }).ok, '1 seule armée');
});

test('conquête : on installe au moins autant d’armées que de dés, puis on peut en amener d’autres', () => {
  const { r, a, b, me, mg } = duel(8, 1);
  withDice([6, 5, 4, 1], () => assert.ok(act(r, me, 'attack', { from: a, to: b, dice: 3 }).ok));
  assert.equal(mg.terr[b].owner, 0);
  assert.equal(mg.terr[b].armies, 3);
  assert.equal(mg.terr[a].armies, 5);
  assert.deepEqual(mg.lastConquest, { from: a, to: b });
  assert.ok(!act(r, me, 'occupy', { count: 5 }).ok, 'il faut laisser une armée');
  assert.ok(act(r, me, 'occupy', { count: 2 }).ok);
  assert.equal(mg.terr[b].armies, 5);
  assert.equal(mg.terr[a].armies, 3);
  assert.ok(!act(r, me, 'occupy', { count: 1 }).ok, 'une seule fois');
});

test('assaut : va jusqu’au bout, l’attaquant garde au moins une armée', () => {
  for (let i = 0; i < 50; i++) {
    const { r, a, b, me, mg } = duel(6, 5);
    assert.ok(act(r, me, 'blitz', { from: a, to: b }).ok);
    assert.ok(mg.terr[a].armies >= 1);
    assert.ok(mg.terr[b].armies > 0 || mg.terr[b].owner === 0);
    assert.ok(mg.lastBattle.blitz);
  }
});

test('fortification : voisins à soi seulement, une armée reste, et le tour passe', () => {
  const { r, a, me, mg } = duel(6, 3);
  assert.ok(!act(r, me, 'fortify', { from: a, to: 'pic-du-corbeau', count: 1 }).ok, 'cible ennemie');
  assert.ok(!act(r, me, 'fortify', { from: a, to: 'lac-muet', count: 6 }).ok, 'doit en laisser une');
  assert.ok(act(r, me, 'fortify', { from: a, to: 'lac-muet', count: 4 }).ok);
  assert.equal(mg.terr['lac-muet'].armies, 6);
  assert.equal(mg.terr[a].armies, 2);
  assert.equal(mg.turn, 1, 'le tour est passé');
  assert.equal(mg.phase, 'reinforce');
});

test('élimination : le dernier territoire pris met le joueur hors jeu, et le dernier survivant gagne', () => {
  const r = room(2);
  const mg = r.mg;
  for (const t of TERRITORIES) mg.terr[t.id] = { owner: 0, armies: 2 };
  mg.terr['pic-du-corbeau'] = { owner: 1, armies: 1 };
  mg.terr['givrebois'] = { owner: 0, armies: 5 };
  mg.pending = 0;
  mg.phase = 'attack';
  withDice([6, 5, 4, 1], () => assert.ok(act(r, cur(r), 'attack', { from: 'givrebois', to: 'pic-du-corbeau', dice: 3 }).ok));
  assert.equal(mg.alive[1], false);
  assert.equal(mg.winner, 0);
  assert.equal(mg.reason, 'ko');
  assert.equal(r.phase, 'end');
  assert.ok(!act(r, cur(r), 'endTurn').ok, 'plus d’action après la fin');
});

test('fin au bout de 10 tours de table : le plus de territoires gagne', () => {
  const r = room(3);
  const mg = r.mg;
  let steps = 0;
  while (r.phase === 'playing') {
    assert.ok(++steps < 1000);
    const p = cur(r);
    if (mg.phase === 'reinforce') {
      const mine = TERRITORIES.find((t) => mg.terr[t.id].owner === mg.turn).id;
      assert.ok(act(r, p, 'place', { territory: mine, count: mg.pending }).ok);
    } else assert.ok(act(r, p, 'endTurn').ok);
  }
  assert.equal(mg.reason, 'rounds');
  assert.equal(mg.round, C.MAX_ROUNDS + 1);
  const v = g.viewFor(r, r.players[0].id).mg;
  assert.equal(v.ranking.length, 3);
  assert.ok(v.ranking[0].territories >= v.ranking[1].territories);
});

test('vue : la carte est publique, chacun sait si c’est son tour, rien d’interne ne fuite', () => {
  const r = room(3);
  const v = g.viewFor(r, r.players[1].id).mg;
  assert.equal(Object.keys(v.terr).length, 24);
  assert.equal(v.ids[v.mine], r.players[1].id);
  assert.equal(v.scores.length, 3);
  assert.ok(!('marketDeck' in v));
});

// ---------------------------------------------------------------------------
// Bots
// ---------------------------------------------------------------------------

test('bots : jusqu’à 5, noms différents, le bot n’est jamais hôte, la salle se vide proprement', () => {
  const res = g.createRoom(() => false, 'Hôte', 'conquete');
  const r = res.room;
  res.player.connected = true;
  for (let i = 0; i < 5; i++) assert.ok(g.addBot(r, r.hostId).ok);
  assert.ok(!g.addBot(r, r.hostId).ok, 'salle pleine (6 joueurs)');
  assert.equal(new Set(r.players.map((p) => p.name)).size, 6);
  assert.ok(g.removeBot(r, r.hostId).ok);
  assert.equal(r.players.length, 5);
  assert.ok(g.startGame(r, r.hostId).ok);
  assert.equal(r.hostId, res.player.id);
});

function playAllBots(n, passiveFirst = false) {
  const res = g.createRoom(() => false, 'Hôte', 'conquete');
  const r = res.room;
  res.player.connected = true;
  for (let i = 1; i < n; i++) g.addPlayer(r, `Bot${i}`).player.connected = true;
  g.startGame(r, r.hostId);
  const mg = r.mg;
  let steps = 0;
  while (r.phase === 'playing') {
    assert.ok(++steps < 20000, 'la partie ne se termine pas');
    const p = cur(r);
    const move = nextMove(r, p.id);
    assert.ok(move, 'le bot doit toujours proposer une action');
    const out = g.miniAct(r, p, move);
    assert.ok(out.ok, `action refusée ${JSON.stringify(move)} : ${out.error}`);
  }
  return mg;
}

test('bots : 40 parties complètes pour chaque nombre de joueurs, sans action refusée ni blocage', () => {
  const stats = { ko: 0, rounds: 0 };
  for (let n = 2; n <= 6; n++) {
    for (let i = 0; i < 40; i++) {
      const mg = playAllBots(n);
      stats[mg.reason] += 1;
      assert.ok(mg.round <= C.MAX_ROUNDS + 1);
      if (mg.reason === 'ko') assert.equal(mg.alive.filter(Boolean).length, 1);
    }
  }
  assert.ok(stats.ko + stats.rounds === 200);
});

test('bots : un bot qui attaque bat nettement un joueur passif', () => {
  let wins = 0;
  const N = 60;
  for (let i = 0; i < N; i++) {
    const res = g.createRoom(() => false, 'Hôte', 'conquete');
    const r = res.room;
    res.player.connected = true;
    g.addPlayer(r, 'Passif').player.connected = true;
    g.startGame(r, r.hostId);
    const passive = r.mg.ids.indexOf(r.players[1].id);
    let steps = 0;
    while (r.phase === 'playing') {
      assert.ok(++steps < 20000);
      const p = cur(r);
      if (r.mg.turn === passive) {
        if (r.mg.phase === 'reinforce') {
          const mine = TERRITORIES.find((t) => r.mg.terr[t.id].owner === passive).id;
          act(r, p, 'place', { territory: mine, count: r.mg.pending });
        } else act(r, p, 'endTurn');
      } else assert.ok(g.miniAct(r, p, nextMove(r, p.id)).ok);
    }
    if (r.mg.winner === 1 - passive) wins += 1;
  }
  assert.ok(wins >= 57, `le bot n’a gagné que ${wins}/${N}`);
});
