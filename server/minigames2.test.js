'use strict';

// Tests des jeux ajoutés ensuite : Just One, Quiz buzzer, Dessiner c'est gagné, Téléphone dessin, Loup-Garou express.

const test = require('node:test');
const assert = require('node:assert/strict');
const g = require('./game');
const { QUIZ } = require('./minigames/quizdata');
const { THEME_IDS } = require('./words');
const { composition } = require('./minigames/loupgarou');
const { stepsFor, chainOf } = require('./minigames/telephone');
const { roundsFor } = require('./minigames/dessin');

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
  return room;
}

const byId = (room, id) => room.players.find((p) => p.id === id);
const act = (room, who, type, payload = {}) =>
  g.miniAct(room, typeof who === 'number' ? room.players[who] : typeof who === 'string' ? byId(room, who) : who, { type, ...payload });
const view = (room, who) => g.viewFor(room, typeof who === 'number' ? room.players[who].id : who);

// ---------------------------------------------------------------------------
// Just One
// ---------------------------------------------------------------------------

test('just one : le devineur ne voit pas le mot, les autres oui', () => {
  const room = start('justone', 4);
  const mg = room.mg;
  const guesser = mg.order[0];
  const word = mg.deck[0];
  assert.equal(view(room, guesser).mg.word, null);
  for (const p of room.players.filter((q) => q.id !== guesser)) assert.equal(view(room, p.id).mg.word, word);
  assert.ok(!JSON.stringify(view(room, guesser).mg).includes(word), 'le mot ne doit nulle part apparaître chez le devineur');
});

test('just one : indices refusés (devineur, phrase, trop proche du mot) puis acceptés', () => {
  const room = start('justone', 4);
  const mg = room.mg;
  const guesser = mg.order[0];
  const other = room.players.find((p) => p.id !== guesser);
  assert.equal(act(room, guesser, 'clue', { text: 'chaud' }).ok, false, 'le devineur ne donne pas d’indice');
  assert.equal(act(room, other, 'clue', { text: 'deux mots' }).ok, false, 'un seul mot');
  assert.equal(act(room, other, 'clue', { text: '   ' }).ok, false);
  mg.deck[0] = 'Chocolat';
  assert.equal(act(room, other, 'clue', { text: 'chocolats' }).ok, false, 'même famille que la réponse');
  assert.equal(act(room, other, 'clue', { text: 'Choco' }).ok, false, 'fragment du mot');
  assert.ok(act(room, other, 'clue', { text: 'cacao' }).ok);
});

test('just one : les indices identiques (accents, majuscules, pluriel) s’annulent et le devineur ne les voit pas', () => {
  const room = start('justone', 5);
  const mg = room.mg;
  const guesser = mg.order[0];
  mg.deck[0] = 'Plage';
  const [a, b, c, d] = room.players.filter((p) => p.id !== guesser);
  act(room, a, 'clue', { text: 'Été' });
  act(room, b, 'clue', { text: 'ete' });
  act(room, c, 'clue', { text: 'sable' });
  assert.equal(mg.phase, 'write');
  act(room, d, 'clue', { text: 'vagues' });
  assert.equal(mg.phase, 'guess');
  const forGuesser = view(room, guesser).mg;
  assert.deepEqual(forGuesser.kept.map((x) => x.text).sort(), ['sable', 'vagues']);
  assert.equal(forGuesser.cancelledCount, 2);
  assert.deepEqual(forGuesser.cancelled, [], 'les indices annulés ne sont pas révélés au devineur');
  assert.ok(forGuesser.kept.every((x) => x.authorId === null), 'ni les auteurs');
  const forOther = view(room, a.id).mg;
  assert.equal(forOther.cancelled.length, 2);
  assert.ok(forOther.kept.every((x) => x.authorId));
});

test('just one : bonne réponse, mauvaise réponse, passer, et 7 manches', () => {
  const room = start('justone', 3);
  const mg = room.mg;
  let expected = 0;
  for (let round = 1; round <= 7; round++) {
    const guesser = mg.order[(round - 1) % 3];
    const word = mg.deck[round - 1];
    for (const p of room.players.filter((q) => q.id !== guesser)) act(room, p, 'clue', { text: `ind${p.name}${round}` });
    assert.equal(mg.phase, 'guess');
    assert.equal(act(room, room.players.find((p) => p.id !== guesser), 'guess', { text: word }).ok, false, 'seul le devineur répond');
    if (round % 3 === 0) {
      assert.ok(act(room, guesser, 'pass').ok);
    } else if (round % 3 === 1) {
      assert.ok(act(room, guesser, 'guess', { text: word.toUpperCase() }).ok);
      expected += 1;
    } else {
      assert.ok(act(room, guesser, 'guess', { text: 'zzzz' }).ok);
    }
    assert.equal(mg.phase, 'result');
    assert.equal(mg.score, expected);
    assert.ok(act(room, 0, 'next').ok);
  }
  assert.equal(room.phase, 'end');
  assert.equal(mg.history.length, 7);
});

// ---------------------------------------------------------------------------
// Quiz buzzer
// ---------------------------------------------------------------------------

test('quiz : chaque thème a au moins 10 questions valides', () => {
  for (const id of THEME_IDS) {
    assert.ok(QUIZ[id]?.length >= 10, `thème ${id}`);
    for (const [q, good, bad] of QUIZ[id]) {
      assert.equal(new Set([good, ...bad]).size, 4, q);
    }
  }
});

test('quiz : 10 questions, thèmes choisis par l’hôte respectés, bonne réponse cachée avant la révélation', () => {
  const room = makeRoom('quiz', 3);
  assert.ok(g.setOptions(room, room.hostId, { themes: ['genz'] }).ok);
  assert.equal(g.viewFor(room, room.hostId).themes.find((t) => t.id === 'genz').count, 10);
  assert.ok(g.startGame(room, room.hostId).ok);
  const mg = room.mg;
  assert.equal(mg.total, 10);
  assert.ok(mg.questions.every((q) => q.theme === 'genz'));
  const v = view(room, 1).mg;
  assert.equal(v.result, null);
  assert.ok(!('answer' in v) && !JSON.stringify(v).includes('"answer"'));
  assert.equal(v.choices.length, 4);
});

test('quiz : 3, 2, 1 points selon la rapidité, 0 pour une erreur, une seule réponse par joueur', () => {
  const room = start('quiz', 5);
  const mg = room.mg;
  const right = mg.questions[0].answer;
  const wrong = (right + 1) % 4;
  assert.ok(act(room, 3, 'answer', { choice: right }).ok);
  assert.equal(act(room, 3, 'answer', { choice: wrong }).ok, false, 'pas de seconde réponse');
  assert.ok(act(room, 0, 'answer', { choice: wrong }).ok);
  assert.ok(act(room, 1, 'answer', { choice: right }).ok);
  assert.equal(act(room, 2, 'answer', { choice: 9 }).ok, false, 'choix invalide');
  assert.ok(act(room, 2, 'answer', { choice: right }).ok);
  assert.equal(mg.phase, 'question');
  assert.ok(act(room, 4, 'answer', { choice: right }).ok);
  assert.equal(mg.phase, 'result');
  const id = (i) => room.players[i].id;
  assert.equal(mg.scores[id(3)], 3);
  assert.equal(mg.scores[id(1)], 2);
  assert.equal(mg.scores[id(2)], 1);
  assert.equal(mg.scores[id(4)], 1);
  assert.equal(mg.scores[id(0)], 0);
  assert.equal(view(room, 0).mg.result.answer, right);
});

test('quiz : fin du temps (seulement une fois le délai passé), réponse tardive refusée, fin après 10 questions', () => {
  const room = start('quiz', 2);
  const mg = room.mg;
  assert.equal(act(room, 1, 'timeup').ok, false, 'le temps n’est pas écoulé');
  mg.deadline = Date.now() - 10_000;
  assert.equal(act(room, 0, 'answer', { choice: 0 }).ok, false, 'trop tard');
  assert.ok(act(room, 1, 'timeup').ok, 'n’importe quel joueur peut clore la question');
  assert.equal(mg.phase, 'result');
  assert.equal(act(room, 1, 'next').ok, false, 'seul l’hôte');
  for (let i = 0; i < 9; i++) {
    assert.ok(act(room, 0, 'next').ok);
    act(room, 0, 'force');
  }
  assert.ok(act(room, 0, 'next').ok);
  assert.equal(room.phase, 'end');
});

// ---------------------------------------------------------------------------
// Dessiner c'est gagné
// ---------------------------------------------------------------------------

test('dessin : nombre de manches et dessinateur tournant', () => {
  assert.equal(roundsFor(3), 6);
  assert.equal(roundsFor(4), 8);
  assert.equal(roundsFor(6), 6);
  assert.equal(roundsFor(13), 6);
  const room = start('dessin', 4);
  assert.equal(room.mg.total, 8);
  assert.equal(new Set(room.mg.drawers).size, 4, 'chaque joueur dessine');
});

test('dessin : seul le dessinateur voit le mot, il ne peut pas deviner, on gagne en trouvant', () => {
  const room = start('dessin', 3);
  const mg = room.mg;
  const drawer = mg.drawers[0];
  const word = mg.deck[mg.wordIndex];
  assert.equal(view(room, drawer).mg.word, word);
  const others = room.players.filter((p) => p.id !== drawer);
  for (const p of others) assert.equal(view(room, p.id).mg.word, null);
  assert.equal(act(room, others[0], 'guess', { text: word }).ok, false, 'pas avant le début du dessin');
  const plain = others.find((p) => p.id !== room.hostId);
  assert.equal(act(room, plain, 'start').ok, false, 'seul le dessinateur ou l’hôte lance');
  assert.ok(act(room, drawer, 'start').ok);
  assert.equal(act(room, drawer, 'guess', { text: word }).ok, false, 'le dessinateur ne devine pas');
  assert.ok(act(room, others[0], 'guess', { text: 'faux' }).ok);
  assert.equal(mg.phase, 'draw');
  assert.ok(act(room, others[1], 'guess', { text: word.toLowerCase() }).ok);
  assert.equal(mg.phase, 'result');
  assert.equal(mg.scores[others[1].id], 2);
  assert.equal(mg.scores[drawer], 1);
  assert.equal(view(room, others[0].id).mg.word, word, 'le mot est révélé en fin de manche');
});

test('dessin : on peut changer de mot une fois, le temps écoulé termine la manche sans point', () => {
  const room = start('dessin', 3);
  const mg = room.mg;
  const drawer = mg.drawers[0];
  const first = mg.deck[mg.wordIndex];
  assert.ok(view(room, drawer).mg.canReroll);
  assert.equal(act(room, room.players.find((p) => p.id !== drawer), 'reroll').ok, false);
  assert.ok(act(room, drawer, 'reroll').ok);
  assert.notEqual(mg.deck[mg.wordIndex], first);
  assert.equal(act(room, drawer, 'reroll').ok, false, 'une seule fois');
  act(room, drawer, 'start');
  assert.equal(act(room, 1, 'timeup').ok, false);
  mg.deadline = Date.now() - 5_000;
  assert.equal(act(room, room.players.find((p) => p.id !== drawer), 'guess', { text: 'trop tard' }).ok, false);
  assert.ok(act(room, 2, 'timeup').ok);
  assert.equal(mg.phase, 'result');
  assert.ok(Object.values(mg.scores).every((x) => x === 0));
});

// ---------------------------------------------------------------------------
// Téléphone dessin
// ---------------------------------------------------------------------------

test('téléphone : 4 étapes jusqu’à 5 joueurs, 6 au-delà, et jamais deux fois le même joueur sur une chaîne', () => {
  assert.equal(stepsFor(4), 4);
  assert.equal(stepsFor(5), 4);
  assert.equal(stepsFor(6), 6);
  assert.equal(stepsFor(13), 6);
  for (const n of [4, 5, 6, 9, 13]) {
    const room = start('telephone', n);
    const mg = room.mg;
    for (let c = 0; c < n; c++) {
      const handlers = Array.from({ length: mg.steps }, (_, s) => mg.order[(c + s) % n]);
      assert.equal(new Set(handlers).size, mg.steps, `chaîne ${c} avec ${n} joueurs`);
      for (let s = 0; s < mg.steps; s++) assert.equal(chainOf(mg, (c + s) % n, s), c);
    }
  }
});

test('téléphone : déroulement complet, chaque joueur ne voit que sa tâche, révélation chaîne par chaîne', () => {
  const room = start('telephone', 4);
  const mg = room.mg;
  const starts = mg.chains.map((c) => c.start);
  // Étape 0 : chacun dessine son propre mot de départ, que lui seul connaît.
  mg.order.forEach((id, i) => {
    const t = view(room, id).mg.task;
    assert.equal(t.kind, 'draw');
    assert.equal(t.text, starts[i]);
    assert.equal(t.toId, mg.order[(i + 1) % 4]);
    const seen = JSON.stringify(view(room, id).mg);
    for (const other of starts.filter((w) => w !== starts[i])) assert.ok(!seen.includes(`"${other}"`), 'ne voit pas les mots des autres');
  });
  assert.equal(act(room, 0, 'describe', { text: 'x' }).ok, false, 'pas le moment de décrire');
  room.players.slice(0, 3).forEach((p) => assert.ok(act(room, p, 'drawn').ok));
  assert.equal(mg.step, 0);
  act(room, room.players[3], 'drawn');
  assert.equal(mg.step, 1);
  // Étape 1 : décrire le dessin du joueur précédent.
  assert.equal(act(room, 0, 'drawn').ok, false);
  assert.equal(act(room, 0, 'describe', { text: '  ' }).ok, false);
  mg.order.forEach((id, i) => {
    assert.equal(view(room, id).mg.task.kind, 'describe');
    assert.equal(view(room, id).mg.task.fromId, mg.order[(i - 1 + 4) % 4]);
    assert.ok(act(room, id, 'describe', { text: `desc1-${i}` }).ok);
  });
  assert.equal(mg.step, 2);
  // Étape 2 : on dessine la description reçue (celle de l'étape 1 sur la même chaîne).
  mg.order.forEach((id, i) => {
    const t = view(room, id).mg.task;
    assert.equal(t.kind, 'draw');
    assert.equal(t.text, `desc1-${(i - 1 + 4) % 4}`);
    act(room, id, 'drawn');
  });
  mg.order.forEach((id) => act(room, id, 'describe', { text: 'fin' }));
  assert.equal(mg.phase, 'reveal');
  // Révélation : rien n'est montré avant que l'hôte ne le décide.
  assert.deepEqual(view(room, 1).mg.stories, []);
  assert.ok(act(room, 0, 'next').ok);
  const first = view(room, 2).mg.stories;
  assert.equal(first.length, 1);
  assert.equal(first[0].length, 4);
  assert.equal(first[0][0].text, starts[0]);
  assert.equal(first[0][0].kind, 'draw');
  assert.equal(first[0][3].text, 'fin');
  assert.equal(act(room, 1, 'next').ok, false, 'seul l’hôte');
  for (let i = 0; i < 3; i++) act(room, 0, 'next');
  assert.equal(view(room, 0).mg.stories.length, 4);
  act(room, 0, 'next');
  assert.equal(room.phase, 'end');
});

test('téléphone : l’hôte peut passer à l’étape suivante, les descriptions manquantes deviennent « … »', () => {
  const room = start('telephone', 5);
  const mg = room.mg;
  assert.equal(act(room, 1, 'force').ok, false);
  assert.ok(act(room, 0, 'force').ok);
  assert.equal(mg.step, 1);
  act(room, mg.order[0], 'describe', { text: 'ok' });
  assert.ok(act(room, 0, 'force').ok);
  assert.equal(mg.step, 2);
  assert.equal(mg.chains.filter((c) => c.desc[1] === '…').length, 4);
});

// ---------------------------------------------------------------------------
// Loup-Garou express
// ---------------------------------------------------------------------------

/** Redistribue les rôles de façon connue : joueurs 0.. dans l'ordre de la liste donnée. */
function rig(room, list) {
  const mg = room.mg;
  room.players.forEach((p, i) => (mg.roles[p.id] = list[i]));
  return (role, k = 0) => room.players.filter((p) => mg.roles[p.id] === role)[k];
}

test('loup-garou : composition des rôles selon le nombre de joueurs', () => {
  for (let n = 5; n <= 13; n++) {
    const c = composition(n);
    assert.equal(Object.values(c).reduce((a, b) => a + b, 0), n);
    assert.ok(c.villager >= 1 && c.wolf >= 1 && c.seer === 1);
  }
  assert.deepEqual(composition(5), { wolf: 1, seer: 1, witch: 0, hunter: 0, villager: 3 });
  assert.equal(composition(8).hunter, 1);
  assert.equal(composition(13).wolf, 3);
  const room = start('loupgarou', 8);
  const count = {};
  Object.values(room.mg.roles).forEach((r) => (count[r] = (count[r] ?? 0) + 1));
  assert.deepEqual(count, composition(8));
});

test('loup-garou : chacun ne voit que son rôle (les loups voient leurs alliés), tout est révélé à la fin seulement', () => {
  const room = start('loupgarou', 7);
  const mg = room.mg;
  for (const p of room.players) {
    const v = view(room, p.id).mg;
    assert.equal(v.myRole, mg.roles[p.id]);
    assert.equal(v.roles, null);
    if (mg.roles[p.id] === 'wolf') assert.equal(v.mates.length, 2);
    else assert.deepEqual(v.mates, []);
    assert.deepEqual(v.seerLog, []);
  }
  const villager = room.players.find((p) => mg.roles[p.id] === 'villager');
  assert.ok(!JSON.stringify(view(room, villager.id).mg).includes('"role":"wolf"'), 'un villageois ne connaît aucun autre rôle');
});

test('loup-garou : nuit complète — loups, voyante, sorcière qui sauve la victime', () => {
  const room = start('loupgarou', 6);
  const who = rig(room, ['wolf', 'seer', 'witch', 'villager', 'villager', 'villager']);
  const mg = room.mg;
  assert.equal(act(room, 0, 'wolf', { targetId: who('villager').id }).ok, false, 'pas avant le début de la nuit');
  assert.ok(act(room, 0, 'start').ok);
  assert.equal(mg.phase, 'night');
  assert.equal(view(room, who('villager').id).mg.task.kind, 'sleep');
  assert.equal(view(room, who('wolf').id).mg.task.kind, 'wolf');
  const victim = who('villager', 1);
  assert.equal(act(room, who('wolf'), 'wolf', { targetId: who('wolf').id }).ok, false, 'un loup ne mord pas un loup');
  assert.equal(act(room, who('villager'), 'wolf', { targetId: victim.id }).ok, false, 'pas un loup');
  assert.ok(act(room, who('wolf'), 'wolf', { targetId: victim.id }).ok);
  // La sorcière apprend la victime seulement maintenant.
  const wt = view(room, who('witch').id).mg.task;
  assert.equal(wt.kind, 'witch');
  assert.equal(wt.victimId, victim.id);
  assert.ok(act(room, who('seer'), 'see', { targetId: who('wolf').id }).ok);
  assert.deepEqual(view(room, who('seer').id).mg.seerLog, [{ night: 1, id: who('wolf').id, role: 'wolf' }]);
  assert.equal(mg.phase, 'night', 'la sorcière n’a pas encore joué');
  assert.ok(act(room, who('witch'), 'witch', { heal: true }).ok);
  assert.equal(mg.phase, 'dawn');
  assert.equal(mg.alive[victim.id], true, 'victime sauvée');
  assert.equal(mg.potions.heal, false);
  assert.deepEqual(mg.events[0].deaths, []);
});

test('loup-garou : sans sauvetage, la victime meurt et son rôle est révélé ; le poison tue aussi', () => {
  const room = start('loupgarou', 6);
  const who = rig(room, ['wolf', 'seer', 'witch', 'villager', 'villager', 'villager']);
  const mg = room.mg;
  act(room, 0, 'start');
  const victim = who('villager', 0);
  const poisoned = who('villager', 1);
  act(room, who('wolf'), 'wolf', { targetId: victim.id });
  act(room, who('seer'), 'see', { targetId: victim.id });
  assert.equal(act(room, who('witch'), 'witch', { poisonId: who('witch').id }).ok, false, 'pas d’auto-empoisonnement');
  assert.ok(act(room, who('witch'), 'witch', { poisonId: poisoned.id }).ok);
  assert.equal(mg.phase, 'dawn');
  assert.equal(mg.alive[victim.id], false);
  assert.equal(mg.alive[poisoned.id], false);
  assert.deepEqual(mg.events[0].deaths.map((d) => d.role), ['villager', 'villager']);
  assert.equal(mg.potions.poison, false);
  assert.equal(mg.winner, null);
});

test('loup-garou : le vote élimine le plus voté ; en cas d’égalité personne ne sort', () => {
  const room = start('loupgarou', 7);
  const who = rig(room, ['wolf', 'wolf', 'seer', 'witch', 'villager', 'villager', 'villager']);
  const mg = room.mg;
  mg.phase = 'vote';
  mg.night = 1;
  const [w1, w2, seer, witch, v1, v2, v3] = room.players;
  act(room, w1, 'vote', { targetId: v1.id });
  act(room, w2, 'vote', { targetId: v2.id });
  assert.equal(act(room, v1, 'vote', { targetId: v1.id }).ok, false, 'pas pour soi-même');
  act(room, seer, 'vote', { targetId: v1.id });
  act(room, witch, 'vote', { targetId: v2.id });
  act(room, v1, 'vote', { targetId: v2.id });
  act(room, v2, 'vote', { targetId: v1.id });
  assert.equal(mg.phase, 'vote');
  act(room, v3, 'vote', { targetId: w1.id });
  assert.equal(mg.phase, 'verdict');
  assert.equal(mg.verdict.tie, true);
  assert.equal(mg.verdict.eliminated, null);
  assert.ok(Object.values(mg.alive).every(Boolean));
  assert.ok(act(room, 0, 'next').ok);
  assert.equal(mg.phase, 'night');
  // Nouveau vote : v3 est éliminé à la majorité.
  mg.phase = 'vote';
  mg.votes = {};
  for (const p of room.players) if (p !== v3) act(room, p, 'vote', { targetId: v3.id });
  act(room, v3, 'vote', { targetId: w1.id });
  assert.equal(mg.verdict.eliminated.id, v3.id);
  assert.equal(mg.verdict.eliminated.role, 'villager');
  assert.equal(mg.alive[v3.id], false);
  assert.equal(act(room, v3, 'vote', { targetId: w1.id }).ok, false, 'un éliminé ne vote plus');
  void who;
});

test('loup-garou : le chasseur éliminé tire avant la suite', () => {
  const room = start('loupgarou', 8);
  const who = rig(room, ['wolf', 'wolf', 'seer', 'witch', 'hunter', 'villager', 'villager', 'villager']);
  const mg = room.mg;
  mg.phase = 'vote';
  mg.night = 1;
  const hunter = who('hunter');
  for (const p of room.players) if (p !== hunter) act(room, p, 'vote', { targetId: hunter.id });
  act(room, hunter, 'vote', { targetId: who('villager').id });
  assert.equal(mg.phase, 'hunter');
  assert.equal(view(room, hunter.id).mg.canShoot, true);
  assert.equal(view(room, who('wolf').id).mg.canShoot, false);
  assert.equal(act(room, who('wolf'), 'shoot', { targetId: who('villager').id }).ok, false);
  assert.equal(act(room, hunter, 'shoot', { targetId: hunter.id }).ok, false, 'cible en vie uniquement');
  assert.ok(act(room, hunter, 'shoot', { targetId: who('wolf').id }).ok);
  assert.equal(mg.phase, 'verdict');
  assert.equal(mg.alive[who('wolf').id], false);
  assert.equal(mg.events.at(-1).kind, 'hunter');
});

test('loup-garou : victoire du village (plus de loup) et victoire des loups (aussi nombreux)', () => {
  const room = start('loupgarou', 5);
  const who = rig(room, ['wolf', 'seer', 'villager', 'villager', 'villager']);
  room.mg.phase = 'vote';
  for (const p of room.players) if (p !== who('wolf')) act(room, p, 'vote', { targetId: who('wolf').id });
  act(room, who('wolf'), 'vote', { targetId: who('seer').id });
  assert.equal(room.phase, 'end');
  assert.equal(room.mg.winner, 'village');
  assert.equal(view(room, 0).mg.roles[who('wolf').id], 'wolf', 'rôles révélés en fin de partie');

  const room2 = start('loupgarou', 5);
  const who2 = rig(room2, ['wolf', 'seer', 'villager', 'villager', 'villager']);
  room2.mg.alive[who2('villager', 0).id] = false;
  room2.mg.alive[who2('villager', 1).id] = false;
  room2.mg.phase = 'night';
  room2.mg.night = 1;
  room2.mg.ns = { wolfPicks: {}, victimId: null, wolvesDone: false, seerDone: true, witchStep: 'done', healed: false, poisonId: null };
  act(room2, who2('wolf'), 'wolf', { targetId: who2('villager', 2).id });
  assert.equal(room2.phase, 'end');
  assert.equal(room2.mg.winner, 'wolves', '1 loup contre 1 autre : les loups sont aussi nombreux');
});

test('loup-garou : l’hôte peut forcer la nuit et le vote', () => {
  const room = start('loupgarou', 5);
  rig(room, ['villager', 'wolf', 'seer', 'villager', 'villager']);
  act(room, 0, 'start');
  assert.equal(act(room, 1, 'force').ok, false);
  assert.ok(act(room, 0, 'force').ok);
  assert.equal(room.mg.phase, 'dawn');
  assert.deepEqual(room.mg.events[0].deaths, [], 'personne n’avait été désigné');
  act(room, 0, 'next');
  assert.equal(act(room, 0, 'force').ok, false, 'aucun vote');
  act(room, 0, 'vote', { targetId: room.players[1].id });
  assert.ok(act(room, 0, 'force').ok);
  assert.equal(room.mg.verdict.eliminated.id, room.players[1].id);
  assert.equal(room.phase, 'end');
});
