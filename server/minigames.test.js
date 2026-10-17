'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const g = require('./game');
const { GAMES } = require('./minigames');

/** Crée une salle d'un mini-jeu avec n joueurs connectés (le premier est l'hôte). */
function makeRoom(type, n) {
  const res = g.createRoom(() => false, 'Hôte', type);
  assert.ok(res.ok, res.error);
  const room = res.room;
  res.player.connected = true;
  for (let i = 1; i < n; i++) g.addPlayer(room, `J${i}`).player.connected = true;
  return room;
}

function start(type, n) {
  const room = makeRoom(type, n);
  const res = g.startGame(room, room.hostId);
  assert.ok(res.ok, res.error);
  assert.equal(room.phase, 'playing');
  return room;
}

const act = (room, who, type, payload = {}) => g.miniAct(room, typeof who === 'number' ? room.players[who] : who, { type, ...payload });

// ---------------------------------------------------------------------------
// Général
// ---------------------------------------------------------------------------

test('hub : la liste des jeux est cohérente (2 à 13 joueurs, durées de 5 à 20 minutes)', () => {
  assert.equal(GAMES[0].id, 'undercover');
  const ids = new Set();
  for (const meta of GAMES) {
    assert.ok(!ids.has(meta.id));
    ids.add(meta.id);
    assert.ok(meta.min >= 2 && meta.max <= 13 && meta.min <= meta.max, meta.id);
    assert.ok(meta.maxMinutes >= 5 && meta.maxMinutes <= 20, meta.id);
    assert.ok(meta.label && meta.emoji && meta.tagline, meta.id);
  }
  assert.ok(GAMES.some((m) => m.min === 2), 'au moins un jeu pour deux');
  assert.ok(GAMES.some((m) => m.max === 13), 'au moins un jeu pour 13');
});

test('hub : jeu inconnu refusé, limites de joueurs respectées, démarrage réservé à l’hôte', () => {
  assert.equal(g.createRoom(() => false, 'Hôte', 'nimportequoi').ok, false);
  const room = makeRoom('puissance4', 2);
  assert.equal(g.addPlayer(room, 'Troisième').ok, false, 'puissance 4 : 2 joueurs maximum');
  assert.equal(g.addGuest(room, room.hostId, 'Léo').ok, false, 'pas d’invité à puissance 4');
  const small = makeRoom('susceptible', 2);
  assert.equal(g.startGame(small, small.hostId).ok, false, 'il faut 3 joueurs');
  const room3 = makeRoom('susceptible', 3);
  assert.equal(g.startGame(room3, room3.players[1].id).ok, false, 'réservé à l’hôte');
  const big = makeRoom('susceptible', 13);
  assert.equal(g.addPlayer(big, 'De trop').ok, false, '13 joueurs maximum');
  assert.ok(g.startGame(big, big.hostId).ok);
});

test('hub : rejouer ramène au salon, et une action sans partie est refusée', () => {
  const room = makeRoom('telepathie', 2);
  assert.equal(act(room, 0, 'word', { word: 'x' }).ok, false);
  g.startGame(room, room.hostId);
  room.phase = 'end';
  assert.ok(g.rematch(room, room.hostId).ok);
  assert.equal(room.phase, 'lobby');
  assert.equal(room.mg, null);
});

test('hub : un invité joue sur l’écran de son propriétaire et reçoit sa propre vue', () => {
  const room = makeRoom('telepathie', 2);
  const guest = g.addGuest(room, room.hostId, 'Léo').player;
  g.startGame(room, room.hostId);
  assert.ok(act(room, guest, 'word', { word: 'chat' }).ok);
  const hostView = g.viewFor(room, room.hostId);
  assert.equal(hostView.mgGuests[guest.id].myWord, 'chat');
  assert.equal(hostView.mg.myWord, null);
  assert.equal(g.viewFor(room, room.players[1].id).mgGuests, undefined);
});

// ---------------------------------------------------------------------------
// Qui est le plus susceptible de…
// ---------------------------------------------------------------------------

test('susceptible : 8 manches, vote, gagnant, classement', () => {
  const room = start('susceptible', 4);
  const [a, b, c, d] = room.players;
  assert.equal(act(room, a, 'vote', { targetId: a.id }).ok, false, 'pas pour soi');
  assert.ok(act(room, a, 'vote', { targetId: b.id }).ok);
  assert.ok(act(room, b, 'vote', { targetId: c.id }).ok);
  assert.ok(act(room, c, 'vote', { targetId: b.id }).ok);
  assert.equal(room.mg.phase, 'vote');
  assert.ok(act(room, d, 'vote', { targetId: b.id }).ok);
  assert.equal(room.mg.phase, 'result');
  assert.deepEqual(room.mg.result.winners, [b.id]);
  assert.equal(room.mg.totals[b.id], 1);
  assert.equal(act(room, b, 'next').ok, false, 'réservé à l’hôte');
  for (let round = 1; round < 8; round++) {
    assert.ok(act(room, a, 'next').ok);
    assert.equal(room.mg.round, round + 1);
    assert.equal(room.mg.votes[a.id], undefined, 'les votes repartent de zéro');
    for (const p of room.players) act(room, p, 'vote', { targetId: room.players.find((x) => x.id !== p.id).id });
  }
  assert.ok(act(room, a, 'next').ok);
  assert.equal(room.phase, 'end');
  assert.equal(g.viewFor(room, a.id).mg.ranking.length, 4);
});

test('susceptible : l’hôte peut forcer le résultat, mais pas sans aucun vote', () => {
  const room = start('susceptible', 3);
  assert.equal(act(room, 0, 'force').ok, false);
  act(room, 1, 'vote', { targetId: room.players[2].id });
  assert.ok(act(room, 0, 'force').ok);
  assert.equal(room.mg.phase, 'result');
});

// ---------------------------------------------------------------------------
// Télépathie
// ---------------------------------------------------------------------------

test('télépathie : mots identiques (accents et majuscules ignorés) = victoire', () => {
  const room = start('telepathie', 3);
  act(room, 0, 'word', { word: 'Éléphant' });
  act(room, 1, 'word', { word: 'elephant' });
  assert.equal(g.viewFor(room, room.players[2].id).mg.history.length, 0, 'mots en cours cachés');
  act(room, 2, 'word', { word: ' ÉLÉPHANT ' });
  assert.equal(room.phase, 'end');
  assert.equal(room.mg.won, true);
});

test('télépathie : manches suivantes, historique, défaite après 8 manches', () => {
  const room = start('telepathie', 2);
  for (let round = 1; round <= 8; round++) {
    assert.ok(act(room, 0, 'word', { word: `a${round}` }).ok);
    assert.ok(act(room, 1, 'word', { word: `b${round}` }).ok);
    if (round < 8) {
      assert.equal(room.mg.phase, 'reveal');
      assert.equal(act(room, 1, 'next').ok, false, 'réservé à l’hôte');
      assert.ok(act(room, 0, 'next').ok);
    }
  }
  assert.equal(room.phase, 'end');
  assert.equal(room.mg.won, false);
  assert.equal(room.mg.history.length, 8);
});

test('télépathie : mot vide refusé, on ne peut pas écrire deux fois la même manche en changeant la phase', () => {
  const room = start('telepathie', 2);
  assert.equal(act(room, 0, 'word', { word: '   ' }).ok, false);
  assert.ok(act(room, 0, 'word', { word: 'un' }).ok);
  assert.ok(act(room, 0, 'word', { word: 'deux' }).ok, 'on peut corriger son mot avant la révélation');
  assert.equal(room.mg.words[room.players[0].id], 'deux');
});

// ---------------------------------------------------------------------------
// 20 questions
// ---------------------------------------------------------------------------

test('20 questions : seul le penseur voit le mot, les autres posent des questions', () => {
  const room = start('vingtq', 3);
  const thinker = room.players.find((p) => p.id === room.mg.thinkerId);
  const other = room.players.find((p) => p.id !== thinker.id);
  assert.equal(g.viewFor(room, other.id).mg.word, null);
  assert.equal(g.viewFor(room, thinker.id).mg.word, room.mg.word);
  assert.equal(act(room, thinker, 'ask', { text: 'Est-ce vivant ?' }).ok, false);
  assert.ok(act(room, other, 'ask', { text: 'Est-ce vivant ?' }).ok);
  assert.equal(act(room, other, 'ask', { text: 'Et ça ?' }).ok, false, 'une seule question à la fois');
  assert.equal(act(room, other, 'answer', { answer: 'oui' }).ok, false, 'seul le penseur répond');
  assert.equal(act(room, thinker, 'answer', { answer: 'bof' }).ok, false);
  assert.ok(act(room, thinker, 'answer', { answer: 'oui' }).ok);
  assert.equal(room.mg.used, 1);
  assert.equal(act(room, thinker, 'change').ok, false, 'trop tard pour changer de mot');
});

test('20 questions : bonne réponse = victoire des devineurs, 20 essais ratés = victoire du penseur', () => {
  const win = start('vingtq', 2);
  const guesser = win.players.find((p) => p.id !== win.mg.thinkerId);
  assert.ok(act(win, guesser, 'guess', { text: 'zzz' }).ok);
  assert.equal(win.mg.used, 1);
  win.mg.word = 'Éléphant';
  assert.ok(act(win, guesser, 'guess', { text: 'elephants' }).ok);
  assert.equal(win.phase, 'end');
  assert.equal(win.mg.winner, 'guessers');

  const lose = start('vingtq', 2);
  const g2 = lose.players.find((p) => p.id !== lose.mg.thinkerId);
  lose.mg.word = 'Banane';
  for (let i = 0; i < 20; i++) assert.ok(act(lose, g2, 'guess', { text: `faux${i}` }).ok);
  assert.equal(lose.phase, 'end');
  assert.equal(lose.mg.winner, 'thinker');
  assert.equal(g.viewFor(lose, g2.id).mg.word, 'Banane', 'le mot est révélé à la fin');
});

// ---------------------------------------------------------------------------
// Le Dictionnaire
// ---------------------------------------------------------------------------

test('dictionnaire : écriture, vote, points, interdiction de voter pour soi ou de copier la vraie définition', () => {
  const room = start('dictionnaire', 3);
  const [a, b, c] = room.players;
  const real = room.mg.deck[0][1];
  assert.equal(act(room, a, 'define', { text: real }).ok, false, 'copie de la vraie définition');
  assert.equal(act(room, a, 'define', { text: 'ab' }).ok, false, 'trop court');
  act(room, a, 'define', { text: 'Une fausse définition de A' });
  act(room, b, 'define', { text: 'Une fausse définition de B' });
  assert.equal(room.mg.phase, 'write');
  assert.equal(g.viewFor(room, a.id).mg.options.length, 0, 'définitions cachées pendant l’écriture');
  act(room, c, 'define', { text: 'Une fausse définition de C' });
  assert.equal(room.mg.phase, 'vote');
  const view = g.viewFor(room, a.id).mg;
  assert.equal(view.options.length, 4);
  assert.equal(view.options.filter((o) => o.mine).length, 1);
  assert.ok(!('authorId' in view.options[0]), 'les auteurs ne sont pas envoyés');
  const own = room.mg.options.find((o) => o.authorId === a.id);
  assert.equal(act(room, a, 'vote', { optionId: own.id }).ok, false, 'pas pour sa propre définition');
  const realOpt = room.mg.options.find((o) => o.authorId === null);
  const fakeB = room.mg.options.find((o) => o.authorId === b.id);
  act(room, a, 'vote', { optionId: realOpt.id }); // A trouve la vraie : +2
  act(room, b, 'vote', { optionId: realOpt.id }); // B aussi : +2
  act(room, c, 'vote', { optionId: fakeB.id }); // C est piégé par B : +1 pour B
  assert.equal(room.mg.phase, 'result');
  assert.equal(room.mg.scores[a.id], 2);
  assert.equal(room.mg.scores[b.id], 3);
  assert.equal(room.mg.scores[c.id], 0);
  assert.equal(room.mg.result.realId, realOpt.id);
});

test('dictionnaire : 5 manches puis fin de partie', () => {
  const room = start('dictionnaire', 3);
  for (let round = 1; round <= 5; round++) {
    room.players.forEach((p, i) => act(room, p, 'define', { text: `Définition inventée ${i} manche ${round}` }));
    room.players.forEach((p) => {
      const choice = room.mg.options.find((o) => o.authorId !== p.id);
      act(room, p, 'vote', { optionId: choice.id });
    });
    assert.equal(room.mg.phase, 'result');
    assert.ok(act(room, 0, 'next').ok);
  }
  assert.equal(room.phase, 'end');
});

// ---------------------------------------------------------------------------
// L'intrus
// ---------------------------------------------------------------------------

test('intrus : l’espion ne voit pas le lieu, les autres oui', () => {
  const room = start('intrus', 4);
  for (const p of room.players) {
    const v = g.viewFor(room, p.id).mg;
    if (p.id === room.mg.spyId) {
      assert.equal(v.isSpy, true);
      assert.equal(v.location, null);
    } else {
      assert.equal(v.location, room.mg.location);
    }
    assert.equal(v.spyId, null, 'l’identité de l’espion reste secrète');
  }
});

test('intrus : l’espion devine le lieu en cours de partie (juste = il gagne, faux = il perd)', () => {
  const win = start('intrus', 3);
  const spy = win.players.find((p) => p.id === win.mg.spyId);
  assert.equal(act(win, win.players.find((p) => p.id !== spy.id), 'spyGuess', { location: win.mg.location }).ok, false);
  assert.ok(act(win, spy, 'spyGuess', { location: win.mg.location }).ok);
  assert.equal(win.mg.winner, 'spy');

  const lose = start('intrus', 3);
  const spy2 = lose.players.find((p) => p.id === lose.mg.spyId);
  const wrong = require('./minigames/content').LOCATIONS.find((l) => l !== lose.mg.location);
  act(lose, spy2, 'spyGuess', { location: wrong });
  assert.equal(lose.mg.winner, 'civils');
  assert.equal(g.viewFor(lose, spy2.id).mg.location, lose.mg.location, 'lieu révélé à la fin');
});

test('intrus : l’hôte peut conclure si l’espion démasqué ne répond pas', () => {
  const room = start('intrus', 3);
  assert.equal(act(room, 0, 'giveUp').ok, false, 'seulement quand l’espion est démasqué');
  room.mg.phase = 'spyGuess';
  assert.equal(act(room, 1, 'giveUp').ok, false, 'réservé à l’hôte');
  assert.ok(act(room, 0, 'giveUp').ok);
  assert.equal(room.mg.winner, 'civils');
});

test('intrus : vote, espion démasqué puis dernière chance, innocent accusé, égalité', () => {
  const room = start('intrus', 4);
  const spy = room.players.find((p) => p.id === room.mg.spyId);
  const others = room.players.filter((p) => p.id !== spy.id);
  assert.equal(act(room, 1, 'vote', { targetId: spy.id }).ok, false, 'vote pas encore ouvert');
  assert.equal(act(room, others[0], 'openVote').ok, others[0].id === room.hostId);
  act(room, 0, 'openVote');
  assert.equal(room.mg.phase, 'vote');
  for (const p of room.players) act(room, p, 'vote', { targetId: p.id === spy.id ? others[0].id : spy.id });
  assert.equal(room.mg.phase, 'spyGuess');
  assert.equal(g.viewFor(room, others[0].id).mg.spyId, spy.id, 'espion démasqué : identité publique');
  const wrong = require('./minigames/content').LOCATIONS.find((l) => l !== room.mg.location);
  act(room, spy, 'spyGuess', { location: wrong });
  assert.equal(room.mg.winner, 'civils');

  const innocent = start('intrus', 4);
  const spy2 = innocent.players.find((p) => p.id === innocent.mg.spyId);
  const target = innocent.players.find((p) => p.id !== spy2.id);
  act(innocent, 0, 'openVote');
  for (const p of innocent.players) act(innocent, p, 'vote', { targetId: p.id === target.id ? spy2.id : target.id });
  assert.equal(innocent.mg.winner, 'spy');
  assert.equal(innocent.mg.reason, 'innocent');

  const tie = start('intrus', 4);
  act(tie, 0, 'openVote');
  const [p0, p1, p2, p3] = tie.players;
  act(tie, p0, 'vote', { targetId: p1.id });
  act(tie, p1, 'vote', { targetId: p0.id });
  act(tie, p2, 'vote', { targetId: p1.id });
  act(tie, p3, 'vote', { targetId: p0.id });
  assert.equal(tie.mg.phase, 'play');
  assert.match(tie.mg.notice, /Égalité/);
});

// ---------------------------------------------------------------------------
// Puissance 4
// ---------------------------------------------------------------------------

test('puissance 4 : tour par tour, colonne pleine refusée, alignement horizontal gagnant', () => {
  const room = start('puissance4', 2);
  const players = room.mg.ids.map((id) => room.players.find((p) => p.id === id));
  const first = room.mg.turn;
  const wrongPlayer = players[1 - first];
  assert.equal(act(room, wrongPlayer, 'drop', { col: 0 }).ok, false, 'pas ton tour');
  assert.equal(act(room, players[first], 'drop', { col: 9 }).ok, false);
  // Le premier joueur aligne 4 jetons en bas, l'autre joue au-dessus.
  for (let i = 0; i < 3; i++) {
    assert.ok(act(room, players[room.mg.turn], 'drop', { col: i }).ok);
    assert.ok(act(room, players[room.mg.turn], 'drop', { col: i }).ok);
  }
  assert.ok(act(room, players[room.mg.turn], 'drop', { col: 3 }).ok);
  assert.equal(room.phase, 'end');
  assert.equal(room.mg.winner, first);
  assert.equal(room.mg.line.length, 4);
});

test('puissance 4 : colonne pleine et match nul', () => {
  const room = start('puissance4', 2);
  const players = room.mg.ids.map((id) => room.players.find((p) => p.id === id));
  // On remplit la colonne 0 avec des jetons alternés.
  for (let i = 0; i < 6; i++) assert.ok(act(room, players[room.mg.turn], 'drop', { col: 0 }).ok);
  assert.equal(act(room, players[room.mg.turn], 'drop', { col: 0 }).ok, false, 'colonne pleine');

  // Plateau presque plein, sans alignement possible : le dernier coup donne match nul.
  const draw = start('puissance4', 2);
  const pattern = [[0, 0, 1, 1, 0, 0, 1], [1, 1, 0, 0, 1, 1, 0], [0, 0, 1, 1, 0, 0, 1], [1, 1, 0, 0, 1, 1, 0], [0, 0, 1, 1, 0, 0, 1], [1, 1, 0, 0, 1, 1, 0]];
  draw.mg.board = pattern.map((row) => [...row]);
  draw.mg.board[0][6] = null;
  draw.mg.turn = pattern[0][6];
  const dp = draw.mg.ids.map((id) => draw.players.find((p) => p.id === id));
  assert.ok(act(draw, dp[draw.mg.turn], 'drop', { col: 6 }).ok);
  assert.equal(draw.mg.draw, true);
  assert.equal(draw.phase, 'end');
});

// ---------------------------------------------------------------------------
// Bataille navale
// ---------------------------------------------------------------------------

test('bataille : flotte valide (5 bateaux, sans chevauchement), flotte adverse invisible', () => {
  const { randomFleet, FLEET, SIZE } = require('./minigames/bataille');
  for (let i = 0; i < 100; i++) {
    const ships = randomFleet();
    assert.deepEqual(ships.map((s) => s.length), FLEET);
    const seen = new Set();
    for (const ship of ships) {
      for (const [r, c] of ship) {
        assert.ok(r >= 0 && r < SIZE && c >= 0 && c < SIZE);
        assert.ok(!seen.has(`${r},${c}`), 'chevauchement');
        seen.add(`${r},${c}`);
      }
    }
  }
  const room = start('bataille', 2);
  const view = g.viewFor(room, room.players[0].id).mg;
  assert.equal(view.myShips.length, 5);
  assert.equal(view.enemyShips.length, 0);
});

test('bataille : placement, tirs alternés, touché, coulé et victoire', () => {
  const room = start('bataille', 2);
  const [a, b] = room.players;
  assert.equal(act(room, a, 'fire', { r: 0, c: 0 }).ok, false, 'pas avant la phase de tir');
  assert.ok(act(room, a, 'shuffle').ok);
  act(room, a, 'ready');
  assert.equal(act(room, a, 'shuffle').ok, false, 'flotte verrouillée une fois prête');
  act(room, b, 'ready');
  assert.equal(room.mg.phase, 'fire');
  const shooter = room.mg.turn === a.id ? a : b;
  const target = shooter === a ? b : a;
  const targetShips = room.mg.boards[target.id].ships;
  assert.equal(act(room, target, 'fire', { r: 0, c: 0 }).ok, false, 'pas ton tour');
  // Le tireur coule tout, le défenseur tire dans l'eau entre-temps.
  const water = [];
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) if (!room.mg.boards[shooter.id].ships.some((s) => s.some(([rr, cc]) => rr === r && cc === c))) water.push([r, c]);
  let wi = 0;
  let sunkSeen = false;
  for (const ship of targetShips) {
    for (const [r, c] of ship) {
      assert.ok(act(room, shooter, 'fire', { r, c }).ok);
      if (room.mg.lastShot.result === 'sunk') sunkSeen = true;
      if (room.phase === 'end') break;
      assert.equal(act(room, shooter, 'fire', { r, c }).ok, false, 'tour passé à l’adversaire');
      const [wr, wc] = water[wi++];
      assert.ok(act(room, target, 'fire', { r: wr, c: wc }).ok);
    }
  }
  assert.ok(sunkSeen);
  assert.equal(room.phase, 'end');
  assert.equal(room.mg.winner, shooter.id);
  assert.equal(g.viewFor(room, shooter.id).mg.enemyShips.length, 5, 'flotte révélée à la fin');
});

test('bataille : on ne peut pas tirer deux fois au même endroit, ni hors de la grille', () => {
  const room = start('bataille', 2);
  room.players.forEach((p) => act(room, p, 'ready'));
  const shooter = room.players.find((p) => p.id === room.mg.turn);
  const other = room.players.find((p) => p.id !== shooter.id);
  assert.equal(act(room, shooter, 'fire', { r: 10, c: 0 }).ok, false);
  assert.equal(act(room, shooter, 'fire', { r: 'a', c: 0 }).ok, false);
  act(room, shooter, 'fire', { r: 0, c: 0 });
  act(room, other, 'fire', { r: 0, c: 0 });
  assert.equal(act(room, shooter, 'fire', { r: 0, c: 0 }).ok, false, 'case déjà visée');
});

// ---------------------------------------------------------------------------
// Dés menteurs
// ---------------------------------------------------------------------------

function riggedDice(room, diceByIndex) {
  room.players.forEach((p, i) => { room.mg.dice[p.id] = diceByIndex[i]; });
}

test('dés : chacun ne voit que ses dés, les paris doivent monter', () => {
  const room = start('des', 3);
  for (const p of room.players) {
    const v = g.viewFor(room, p.id).mg;
    assert.equal(v.myDice.length, 5);
    assert.equal(v.total, 15);
  }
  const turn = (i) => room.players.find((p) => p.id === room.mg.turnId);
  assert.equal(act(room, room.players.find((p) => p.id !== room.mg.turnId), 'bid', { qty: 1, face: 2 }).ok, false, 'pas ton tour');
  assert.equal(act(room, turn(), 'liar').ok, false, 'rien à contester au début');
  assert.equal(act(room, turn(), 'bid', { qty: 99, face: 2 }).ok, false);
  assert.equal(act(room, turn(), 'bid', { qty: 2, face: 7 }).ok, false);
  assert.ok(act(room, turn(), 'bid', { qty: 3, face: 4 }).ok);
  assert.equal(act(room, turn(), 'bid', { qty: 3, face: 4 }).ok, false, 'même pari');
  assert.equal(act(room, turn(), 'bid', { qty: 2, face: 6 }).ok, false, 'moins de dés');
  assert.ok(act(room, turn(), 'bid', { qty: 3, face: 5 }).ok, 'même quantité, valeur plus haute');
  assert.ok(act(room, turn(), 'bid', { qty: 4, face: 1 }).ok, 'plus de dés');
});

test('dés : « menteur » : le bon camp est pénalisé et les dés sont révélés', () => {
  const room = start('des', 3);
  room.mg.turnId = room.players[0].id;
  riggedDice(room, [[3, 3, 1, 2, 4], [3, 5, 5, 6, 6], [1, 2, 4, 4, 6]]); // quatre « 3 » ? non : deux seulement
  act(room, 0, 'bid', { qty: 4, face: 3 }); // P0 annonce 4 trois : faux (il y en a 3)
  assert.equal(room.mg.turnId, room.players[1].id);
  assert.ok(act(room, 1, 'liar').ok);
  assert.equal(room.mg.result.found, 3);
  assert.equal(room.mg.result.loserId, room.players[0].id, 'le menteur perd un dé');
  assert.equal(room.mg.counts[room.players[0].id], 4);
  assert.equal(Object.keys(room.mg.result.dice).length, 3);
  assert.equal(act(room, 1, 'next').ok, false, 'réservé à l’hôte');
  assert.ok(act(room, 0, 'next').ok);
  assert.equal(room.mg.phase, 'bid');
  assert.equal(room.mg.turnId, room.players[0].id, 'le perdant ouvre la manche suivante');
  assert.equal(g.viewFor(room, room.players[1].id).mg.myDice.length, 5);
  assert.equal(g.viewFor(room, room.players[0].id).mg.myDice.length, 4);

  // Un pari vrai : c'est celui qui conteste qui perd.
  room.mg.turnId = room.players[0].id;
  riggedDice(room, [[3, 3, 1, 2], [3, 5, 5, 6, 6], [1, 2, 4, 4, 6]]);
  act(room, 0, 'bid', { qty: 3, face: 3 });
  act(room, 1, 'liar');
  assert.equal(room.mg.result.loserId, room.players[1].id);
});

test('dés : élimination et victoire du dernier joueur', () => {
  const room = start('des', 2);
  room.mg.counts[room.players[1].id] = 1;
  room.mg.turnId = room.players[0].id;
  riggedDice(room, [[2, 2, 2, 2, 2], [6]]);
  assert.equal(act(room, 0, 'bid', { qty: 9, face: 6 }).ok, false, 'plus de dés que sur la table');
  act(room, 0, 'bid', { qty: 6, face: 6 }); // faux : un seul six sur la table
  assert.equal(act(room, 1, 'liar').ok, true);
  assert.equal(room.mg.result.loserId, room.players[0].id, 'faux pari de 6 six');
  // On force le cas inverse : le joueur à un seul dé perd son dernier dé.
  const room2 = start('des', 2);
  room2.mg.counts[room2.players[1].id] = 1;
  room2.mg.turnId = room2.players[0].id;
  riggedDice(room2, [[1, 1, 1, 1, 1], [6]]);
  act(room2, 0, 'bid', { qty: 1, face: 2 }); // faux : aucun 2
  act(room2, 1, 'bid', { qty: 1, face: 3 });
  act(room2, 0, 'liar');
  assert.equal(room2.mg.result.loserId, room2.players[1].id);
  assert.equal(room2.mg.result.eliminated, true);
  assert.ok(act(room2, 0, 'next').ok);
  assert.equal(room2.phase, 'end');
  assert.equal(room2.mg.winner, room2.players[0].id);
});

// ---------------------------------------------------------------------------
// Simulations aléatoires : aucun jeu ne doit planter ni rester bloqué
// ---------------------------------------------------------------------------

test('simulation : chaque jeu se termine avec des joueurs aléatoires', () => {
  const rnd = (n) => Math.floor(Math.random() * n);
  for (const meta of GAMES.filter((m) => m.id !== 'undercover' && (!process.env.ONLY_GAME || m.id === process.env.ONLY_GAME))) {
    for (let run = 0; run < 20; run++) {
      const n = meta.min + rnd(meta.max - meta.min + 1);
      const room = start(meta.id, n);
      let guard = 0;
      while (room.phase === 'playing') {
        assert.ok(++guard < 3000, `${meta.id} : boucle infinie`);
        const host = room.players[0];
        const mg = room.mg;
        const any = room.players[rnd(room.players.length)];
        // Chaque jeu : un joueur au hasard essaie des actions plausibles (les refus sont normaux).
        const tries = {
          susceptible: () => { act(room, any, 'vote', { targetId: room.players[rnd(n)].id }); act(room, host, 'next'); },
          telepathie: () => { act(room, any, 'word', { word: `m${rnd(3)}` }); act(room, host, 'next'); },
          vingtq: () => {
            act(room, any, 'ask', { text: 'q' }); act(room, room.players.find((p) => p.id === mg.thinkerId), 'answer', { answer: 'non' });
            act(room, any, 'guess', { text: `x${rnd(100)}` });
          },
          dictionnaire: () => {
            act(room, any, 'define', { text: `def ${rnd(1000)}` });
            if (mg.options.length) act(room, any, 'vote', { optionId: mg.options[rnd(mg.options.length)].id });
            act(room, host, 'next');
          },
          intrus: () => {
            act(room, host, 'openVote'); act(room, any, 'vote', { targetId: room.players[rnd(n)].id }); act(room, host, 'closeVote');
            const spy = room.players.find((p) => p.id === mg.spyId);
            if (rnd(2)) act(room, spy, 'spyGuess', { location: require('./minigames/content').LOCATIONS[rnd(24)] });
            else act(room, host, 'giveUp');
          },
          puissance4: () => { act(room, room.players.find((p) => p.id === mg.ids[mg.turn]), 'drop', { col: rnd(7) }); },
          bataille: () => {
            room.players.forEach((p) => act(room, p, 'ready'));
            if (mg.turn) act(room, room.players.find((p) => p.id === mg.turn), 'fire', { r: rnd(10), c: rnd(10) });
          },
          des: () => {
            const turn = room.players.find((p) => p.id === mg.turnId);
            if (mg.phase === 'bid' && turn) {
              if (mg.bid && rnd(2)) act(room, turn, 'liar');
              else act(room, turn, 'bid', { qty: (mg.bid ? mg.bid.qty : 0) + 1, face: 1 + rnd(6) });
            }
            act(room, host, 'next');
          },
        };
        tries[meta.id]();
      }
      assert.equal(room.phase, 'end', meta.id);
      for (const p of room.players) assert.ok(g.viewFor(room, p.id).mg, meta.id);
    }
  }
});
