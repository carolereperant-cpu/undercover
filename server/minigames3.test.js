'use strict';

// Tests : Pendu, Qui suis-je ?, Petit bac, Taboo, Codenames.

const test = require('node:test');
const assert = require('node:assert/strict');
const g = require('./game');
const { normalize } = require('./minigames/pendu');
const { evaluate } = require('./minigames/petitbac');
const { wordPool } = require('./minigames/codenames');
const { CHARACTERS, TABOO_CARDS } = require('./minigames/content2');

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
  assert.ok(g.startGame(room, room.hostId).ok);
  return room;
}
const byId = (room, id) => room.players.find((p) => p.id === id);
const act = (room, who, type, payload = {}) =>
  g.miniAct(room, typeof who === 'number' ? room.players[who] : typeof who === 'string' ? byId(room, who) : who, { type, ...payload });
const view = (room, who) => g.viewFor(room, typeof who === 'number' ? room.players[who].id : who);

test('contenus : personnages, cartes Taboo et mots de Codenames', () => {
  assert.ok(CHARACTERS.length >= 13 && new Set(CHARACTERS.map((c) => c[0])).size === CHARACTERS.length);
  assert.ok(TABOO_CARDS.every(([, forbidden]) => forbidden.length === 5));
  assert.ok(wordPool().length >= 100);
});

// --- Pendu -------------------------------------------------------------------

test('pendu : mots normalisés (accents) et refusés (chiffres, espaces, trop courts)', () => {
  assert.equal(normalize('Éléphant', 3, 20), 'ELEPHANT');
  assert.equal(normalize('cœur', 3, 20), 'COEUR');
  assert.equal(normalize('a b c', 3, 20), null);
  assert.equal(normalize('abc1', 3, 20), null);
  assert.equal(normalize('ab', 3, 20), null);
});

test('pendu : seul le maître voit le mot ; les lettres justes se dévoilent, les fausses comptent', () => {
  const room = start('pendu', 3);
  const mg = room.mg;
  const master = byId(room, mg.masters[0]);
  const others = room.players.filter((p) => p !== master);
  assert.equal(act(room, others[0], 'word', { text: 'chat' }).ok, false);
  assert.ok(act(room, master, 'word', { text: 'Chat' }).ok);
  assert.equal(view(room, master.id).mg.word, 'CHAT');
  assert.equal(view(room, others[0].id).mg.word, null);
  assert.deepEqual(view(room, others[0].id).mg.pattern, [null, null, null, null]);
  assert.equal(act(room, master, 'letter', { letter: 'a' }).ok, false, 'le maître ne joue pas');
  assert.ok(act(room, others[0], 'letter', { letter: 'a' }).ok);
  assert.deepEqual(view(room, others[1].id).mg.pattern, [null, null, 'A', null]);
  assert.equal(act(room, others[1], 'letter', { letter: 'A' }).ok, false, 'déjà essayée');
  act(room, others[1], 'letter', { letter: 'z' });
  assert.equal(mg.errors, 1);
  assert.deepEqual(view(room, 0).mg.wrong, ['Z']);
});

test('pendu : victoire (dernière lettre = bonus), défaite à 7 erreurs, mauvaise proposition = erreur', () => {
  const room = start('pendu', 3);
  const mg = room.mg;
  const master = byId(room, mg.masters[0]);
  const [a, b] = room.players.filter((p) => p !== master);
  act(room, master, 'word', { text: 'ami' });
  act(room, a, 'letter', { letter: 'a' });
  act(room, b, 'letter', { letter: 'm' });
  assert.ok(act(room, a, 'letter', { letter: 'i' }).ok);
  assert.equal(mg.phase, 'result');
  assert.equal(mg.outcome, 'won');
  assert.equal(mg.scores[a.id], 2);
  assert.equal(mg.scores[b.id], 1);
  assert.equal(mg.scores[master.id], 0);
  act(room, 0, 'next');
  const master2 = byId(room, mg.masters[1]);
  const [c] = room.players.filter((p) => p !== master2);
  const before = mg.scores[master2.id];
  act(room, master2, 'word', { text: 'ami' });
  assert.ok(act(room, c, 'solve', { text: 'amie' }).ok);
  assert.equal(mg.errors, 1);
  for (const l of 'bcdfg') act(room, c, 'letter', { letter: l });
  act(room, c, 'letter', { letter: 'h' });
  assert.equal(mg.outcome, 'lost');
  assert.equal(mg.scores[master2.id], before + 2);
  assert.equal(view(room, c.id).mg.word, 'AMI', 'mot révélé à la fin de la manche');
});

test('pendu : à 2 joueurs, chacun est maître une fois puis fin de partie', () => {
  const room = start('pendu', 2);
  const mg = room.mg;
  assert.equal(mg.total, 2);
  for (let r = 0; r < 2; r++) {
    const master = byId(room, mg.masters[r]);
    const other = room.players.find((p) => p !== master);
    act(room, master, 'word', { text: 'oui' });
    act(room, other, 'solve', { text: 'oui' });
    assert.equal(mg.phase, 'result');
    act(room, 0, 'next');
  }
  assert.equal(room.phase, 'end');
});

// --- Qui suis-je ? ------------------------------------------------------------

test('qui suis-je : on voit le personnage des autres, jamais le sien (avant de l’avoir trouvé)', () => {
  const room = start('quisuisje', 4);
  const mg = room.mg;
  const me = room.players[1];
  const v = view(room, me.id).mg;
  assert.equal(v.cards.find((c) => c.id === me.id).name, null);
  assert.ok(v.cards.find((c) => c.id === me.id).category, 'la catégorie est indiquée');
  for (const p of room.players.filter((q) => q !== me)) assert.equal(v.cards.find((c) => c.id === p.id).name, mg.cards[p.id][0]);
  assert.ok(!JSON.stringify(v).includes(mg.cards[me.id][0]));
});

test('qui suis-je : bonne réponse (alias, accents), mauvaises comptées, rangs et points, fin', () => {
  const room = start('quisuisje', 3);
  const mg = room.mg;
  const [a, b, c] = room.players;
  const nameOf = (p) => mg.cards[p.id][0];
  assert.ok(act(room, a, 'guess', { text: 'complètement faux' }).ok);
  assert.equal(mg.wrong[a.id], 1);
  assert.ok(act(room, b, 'guess', { text: nameOf(b).toUpperCase() }).ok);
  assert.equal(mg.solved[b.id], 1);
  assert.equal(act(room, b, 'guess', { text: nameOf(b) }).ok, false, 'déjà trouvé');
  assert.equal(view(room, b.id).mg.cards.find((x) => x.id === b.id).name, nameOf(b), 'il voit son personnage une fois trouvé');
  act(room, a, 'guess', { text: nameOf(a) });
  assert.equal(act(room, 1, 'end').ok, false, 'seul l’hôte');
  assert.ok(act(room, 0, 'end').ok);
  assert.equal(room.phase, 'end');
  const points = Object.fromEntries(view(room, 0).mg.ranking.map((r) => [r.id, r.points]));
  assert.equal(points[b.id], 3);
  assert.equal(points[a.id], 2);
  assert.equal(points[c.id], 0);
});

test('qui suis-je : la partie se termine quand tout le monde a trouvé', () => {
  const room = start('quisuisje', 3);
  for (const p of room.players) act(room, p, 'guess', { text: room.mg.cards[p.id][0] });
  assert.equal(room.phase, 'end');
});

// --- Petit bac -----------------------------------------------------------------

test('petit bac : réponses cachées pendant l’écriture, relecture et points (unique 2, partagé 1, mauvaise lettre 0)', () => {
  const room = start('petitbac', 3);
  const mg = room.mg;
  mg.letter = 'P';
  mg.cats = ['Prénom', 'Pays', 'Animal', 'Fruit ou légume', 'Métier', 'Sport'];
  const [a, b, c] = room.players;
  act(room, a, 'submit', { answers: ['Paul', 'Pérou', 'Panda', 'Poire', '', 'Pétanque'] });
  assert.equal(view(room, b.id).mg.review, null, 'pas de relecture');
  assert.ok(!JSON.stringify(view(room, b.id).mg).includes('Paul'), 'on ne voit pas les réponses des autres');
  assert.deepEqual(view(room, a.id).mg.myAnswers[0], 'Paul');
  act(room, b, 'submit', { answers: ['paul', 'Portugal', 'Poule', 'Banane', 'Pilote', 'Pétanque'] });
  assert.equal(mg.phase, 'write');
  act(room, c, 'submit', { answers: ['Pierre', 'Pérou', 'Panda', 'Poires', 'Plombier', 'Football'] });
  assert.equal(mg.phase, 'review');
  const { rows, roundPoints } = evaluate(room);
  assert.deepEqual(rows[0].entries.map((e) => e.points), [1, 1, 2], 'Paul / paul partagés, Pierre unique');
  assert.deepEqual(rows[1].entries.map((e) => e.points), [1, 2, 1], 'Pérou en double, Portugal unique');
  assert.deepEqual(rows[3].entries.map((e) => e.points), [1, 0, 1], 'poire / poires identiques, banane : mauvaise lettre');
  assert.deepEqual(rows[4].entries.map((e) => e.points), [0, 2, 2], 'réponse vide = 0');
  assert.deepEqual(rows[5].entries.map((e) => e.points), [1, 1, 0], 'football : mauvaise lettre');
  assert.equal(roundPoints[a.id], 1 + 1 + 1 + 1 + 0 + 1, 'Paul, Pérou, Panda, Poire et Pétanque partagés, métier vide');
  assert.equal(view(room, b.id).mg.review.length, 6, 'tout le monde voit la relecture');
});

test('petit bac : l’hôte refuse une réponse (ça change les points), puis manches suivantes et fin', () => {
  const room = start('petitbac', 2);
  const mg = room.mg;
  const [a, b] = room.players;
  mg.letter = 'M';
  mg.cats = ['Prénom', 'Pays', 'Animal', 'Fruit ou légume', 'Métier', 'Sport'];
  act(room, a, 'submit', { answers: ['Marie', 'Mali', '', '', '', ''] });
  act(room, b, 'submit', { answers: ['Marie', 'Maroc', '', '', '', ''] });
  assert.equal(act(room, b, 'reject', { playerId: a.id, index: 0 }).ok, false, 'seul l’hôte');
  assert.ok(act(room, 0, 'reject', { playerId: a.id, index: 0 }).ok);
  assert.deepEqual(evaluate(room).rows[0].entries.map((e) => e.points), [0, 2], 'refusée : l’autre devient unique');
  act(room, 0, 'reject', { playerId: a.id, index: 0 });
  assert.deepEqual(evaluate(room).rows[0].entries.map((e) => e.points), [1, 1]);
  assert.ok(act(room, 0, 'next').ok);
  assert.equal(mg.scores[a.id], 1 + 2);
  assert.equal(mg.round, 2);
  assert.equal(mg.phase, 'write');
  for (let r = 2; r <= 5; r++) {
    act(room, 0, 'force');
    act(room, 0, 'next');
  }
  assert.equal(room.phase, 'end');
});

test('petit bac : fin du temps seulement une fois le délai passé, envoi tardif refusé', () => {
  const room = start('petitbac', 2);
  const mg = room.mg;
  assert.equal(act(room, 1, 'timeup').ok, false);
  mg.deadline = Date.now() - 1000;
  assert.ok(act(room, 1, 'submit', { answers: ['a', 'b', 'c', 'd', 'e', 'f'] }).ok, 'dans la marge de grâce');
  mg.deadline = Date.now() - 10_000;
  assert.equal(act(room, 0, 'submit', { answers: ['a'] }).ok, false, 'trop tard');
  assert.ok(act(room, 0, 'timeup').ok);
  assert.equal(mg.phase, 'review');
});

// --- Taboo ---------------------------------------------------------------------

test('taboo : équipes, la carte est cachée aux coéquipiers du descripteur', () => {
  const room = start('taboo', 5);
  const mg = room.mg;
  assert.equal(mg.teams.A.length + mg.teams.B.length, 5);
  const { team, id: describerId } = mg.describers[0];
  assert.equal(act(room, describerId, 'found').ok, false, 'avant le début du tour');
  assert.ok(act(room, describerId, 'start').ok);
  assert.ok(view(room, describerId).mg.card.word);
  const mate = mg.teams[team].find((id) => id !== describerId);
  if (mate) assert.equal(view(room, mate).mg.card, null, 'ses coéquipiers ne voient pas la carte');
  const opponent = mg.teams[team === 'A' ? 'B' : 'A'][0];
  assert.ok(view(room, opponent).mg.card.forbidden.length === 5, 'l’équipe adverse voit les mots interdits');
});

test('taboo : trouvé +1, interdit −1 (adversaires seulement), passer 0, fin du temps, tours et fin', () => {
  const room = start('taboo', 4);
  const mg = room.mg;
  const { team, id: describerId } = mg.describers[0];
  const mate = mg.teams[team].find((id) => id !== describerId);
  const opponent = mg.teams[team === 'A' ? 'B' : 'A'][0];
  act(room, describerId, 'start');
  assert.ok(act(room, describerId, 'found').ok);
  assert.ok(act(room, describerId, 'pass').ok);
  assert.equal(act(room, mate, 'taboo').ok, false, 'un coéquipier ne peut pas dire « Interdit ! »');
  assert.equal(act(room, mate, 'found').ok, false, 'seul le descripteur valide');
  assert.ok(act(room, opponent, 'taboo').ok);
  assert.equal(mg.scores[team], 0);
  assert.ok(act(room, describerId, 'found').ok);
  assert.equal(mg.scores[team], 1);
  assert.equal(act(room, opponent, 'timeup').ok, false, 'le temps n’est pas écoulé');
  mg.deadline = Date.now() - 5000;
  assert.equal(act(room, describerId, 'found').ok, false, 'trop tard');
  assert.ok(act(room, opponent, 'timeup').ok);
  assert.equal(mg.phase, 'result');
  assert.deepEqual(view(room, 0).mg.log.map((l) => l.outcome), ['found', 'pass', 'taboo', 'found']);
  for (let t = 1; t < mg.totalTurns; t++) {
    assert.ok(act(room, 0, 'next').ok);
    assert.equal(mg.phase, 'ready');
    act(room, 0, 'start');
    act(room, 0, 'force');
  }
  assert.ok(act(room, 0, 'next').ok);
  assert.equal(room.phase, 'end');
});

// --- Codenames -----------------------------------------------------------------

const roles = (room) => {
  const mg = room.mg;
  const team = mg.turn;
  const spy = byId(room, mg.spymasters[team]);
  const ops = mg.teams[team].filter((id) => id !== spy.id).map((id) => byId(room, id));
  const otherTeam = team === 'rouge' ? 'bleu' : 'rouge';
  return { team, spy, ops, otherTeam, otherSpy: byId(room, mg.spymasters[otherTeam]) };
};

test('codenames : grille 9/8/7/1, chaque chef voit les couleurs, les équipiers non', () => {
  const room = start('codenames', 6);
  const mg = room.mg;
  const count = {};
  mg.board.forEach((c) => (count[c.color] = (count[c.color] ?? 0) + 1));
  assert.equal(mg.board.length, 25);
  assert.equal(count[mg.startTeam], 9);
  assert.equal(count[mg.startTeam === 'rouge' ? 'bleu' : 'rouge'], 8);
  assert.equal(count.neutre, 7);
  assert.equal(count.assassin, 1);
  assert.equal(new Set(mg.board.map((c) => c.word)).size, 25);
  const { spy, ops } = roles(room);
  assert.ok(view(room, spy.id).mg.board.every((c) => c.color));
  assert.ok(view(room, ops[0].id).mg.board.every((c) => c.color === null));
  assert.equal(view(room, ops[0].id).mg.isSpymaster, false);
});

test('codenames : indice valide (un mot, pas sur la grille), seul le chef de l’équipe qui joue', () => {
  const room = start('codenames', 4);
  const mg = room.mg;
  const { team, spy, ops, otherSpy } = roles(room);
  assert.equal(act(room, otherSpy, 'clue', { word: 'mer', number: 2 }).ok, false, 'pas son tour');
  assert.equal(act(room, ops[0], 'clue', { word: 'mer', number: 2 }).ok, false, 'pas le chef');
  assert.equal(act(room, spy, 'clue', { word: 'deux mots', number: 2 }).ok, false);
  assert.equal(act(room, spy, 'clue', { word: 'mer', number: 0 }).ok, false);
  assert.equal(act(room, spy, 'clue', { word: mg.board[3].word, number: 2 }).ok, false, 'mot de la grille');
  assert.ok(act(room, spy, 'clue', { word: 'zzzzzz', number: 2 }).ok);
  assert.equal(mg.phase, 'guess');
  assert.equal(mg.guessesLeft, 3);
  assert.equal(mg.turn, team);
  assert.equal(act(room, spy, 'guess', { index: 0 }).ok, false, 'le chef ne devine pas');
});

test('codenames : bonne carte = on continue, neutre ou adverse = fin du tour, arrêt volontaire', () => {
  const room = start('codenames', 4);
  const mg = room.mg;
  const { team, spy, ops, otherTeam } = roles(room);
  act(room, spy, 'clue', { word: 'zzzzzz', number: 3 });
  const own = mg.board.findIndex((c) => c.color === team);
  const neutral = mg.board.findIndex((c) => c.color === 'neutre');
  assert.equal(act(room, ops[0], 'endTurn').ok, false, 'au moins une carte avant d’arrêter');
  assert.ok(act(room, ops[0], 'guess', { index: own }).ok);
  assert.equal(mg.phase, 'guess');
  assert.equal(act(room, ops[0], 'guess', { index: own }).ok, false, 'déjà retournée');
  assert.ok(view(room, ops[0].id).mg.board[own].color === team, 'couleur visible une fois retournée');
  assert.ok(act(room, ops[0], 'endTurn').ok);
  assert.equal(mg.turn, otherTeam);
  const r2 = roles(room);
  act(room, r2.spy, 'clue', { word: 'yyyyyy', number: 1 });
  assert.ok(act(room, r2.ops[0], 'guess', { index: neutral }).ok);
  assert.equal(mg.turn, team, 'carte neutre : le tour passe');
});

test('codenames : l’assassin fait perdre, trouver toutes ses cartes fait gagner', () => {
  const room = start('codenames', 4);
  const mg = room.mg;
  const { team, spy, ops, otherTeam } = roles(room);
  act(room, spy, 'clue', { word: 'zzzzzz', number: 9 });
  const assassin = mg.board.findIndex((c) => c.color === 'assassin');
  assert.ok(act(room, ops[0], 'guess', { index: assassin }).ok);
  assert.equal(room.phase, 'end');
  assert.equal(mg.winner, otherTeam);
  assert.equal(mg.reason, 'assassin');
  assert.ok(view(room, ops[0].id).mg.board.every((c) => c.color), 'tout est révélé à la fin');

  const room2 = start('codenames', 4);
  const mg2 = room2.mg;
  const r = roles(room2);
  act(room2, r.spy, 'clue', { word: 'zzzzzz', number: 9 });
  mg2.board.forEach((c, i) => {
    if (c.color === r.team && mg2.phase === 'guess' && room2.phase === 'playing') act(room2, r.ops[0], 'guess', { index: i });
  });
  assert.equal(room2.phase, 'end');
  assert.equal(mg2.winner, r.team);
  assert.equal(team.length > 0, true);
});

test('codenames : l’hôte peut passer un tour', () => {
  const room = start('codenames', 4);
  const { team } = roles(room);
  assert.equal(act(room, room.players[1], 'pass').ok, false);
  assert.ok(act(room, 0, 'pass').ok);
  assert.notEqual(room.mg.turn, team);
});
