'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const g = require('./game');

const { ROLE } = g;

/** Crée une salle de n joueurs, tous connectés, avec l'hôte en premier. */
function makeRoom(n, options) {
  const res = g.createRoom(() => false, 'Hôte');
  const room = res.room;
  if (options) Object.assign(room.options, options);
  res.player.connected = true;
  for (let i = 1; i < n; i++) {
    const added = g.addPlayer(room, `Joueur${i}`);
    added.player.connected = true;
  }
  return room;
}

/** Impose les rôles pour rendre les tests déterministes (civilWord = "A", undercoverWord = "B"). */
function rig(room, roles) {
  room.players.forEach((p, i) => {
    p.role = roles[i];
    p.word = p.role === ROLE.MRWHITE ? null : p.role === ROLE.UNDERCOVER ? 'B' : 'A';
  });
  room.game.civilWord = 'A';
  room.game.undercoverWord = 'B';
}

function startRigged(roles, options) {
  const room = makeRoom(roles.length, options);
  assert.ok(g.startGame(room, room.hostId).ok);
  rig(room, roles);
  g.beginDiscussion(room, room.hostId);
  return room;
}

const hostOf = (room) => room.hostId;
const voteAll = (room, targetId) => {
  for (const p of room.players.filter((x) => x.alive && x.id !== targetId)) g.castVote(room, p.id, targetId);
  // la cible vote pour quelqu'un d'autre
  const other = room.players.find((x) => x.alive && x.id !== targetId);
  if (room.phase === 'vote') g.castVote(room, targetId, other.id);
};

// ---------------------------------------------------------------------------

test('rolePlan : de 3 à 12 joueurs, les civils sont toujours plus nombreux que les infiltrés', () => {
  for (let n = 3; n <= 12; n++) {
    const plan = g.rolePlan(n);
    const total = Object.values(plan).reduce((a, b) => a + b, 0);
    assert.equal(total, n, `n=${n}`);
    assert.ok(plan.undercover >= 1, `n=${n}`);
    const infiltres = plan.undercover + plan.mrwhite;
    assert.ok(plan.civil + plan.bouclier + plan.detective > infiltres, `n=${n}`);
    assert.ok(plan.civil >= 1, `n=${n}`);
  }
});

test('rolePlan : à 12 joueurs les 5 rôles sont présents', () => {
  const plan = g.rolePlan(12);
  assert.deepEqual(plan, { civil: 7, undercover: 2, mrwhite: 1, bouclier: 1, detective: 1 });
});

test('rolePlan : les options désactivées sont respectées', () => {
  const plan = g.rolePlan(10, { mrwhite: false, shield: false, detective: false });
  assert.equal(plan.mrwhite + plan.bouclier + plan.detective, 0);
  assert.equal(plan.civil + plan.undercover, 10);
});

test('sameWord ignore accents, majuscules, articles, tirets et pluriel', () => {
  assert.ok(g.sameWord('  L’Éléphant ', 'elephant'));
  assert.ok(g.sameWord('week-end', 'Weekend'));
  assert.ok(g.sameWord('pâtes', 'pâte'));
  assert.ok(g.sameWord('Œuf', 'oeuf'));
  assert.ok(!g.sameWord('chat', 'chien'));
  assert.ok(!g.sameWord('', ''));
});

test('addPlayer : pseudo unique, salle limitée à 12, impossible après le début', () => {
  const room = makeRoom(1);
  assert.equal(g.addPlayer(room, 'hôte').ok, false);
  assert.equal(g.addPlayer(room, '   ').ok, false);
  for (let i = 1; i < 12; i++) assert.ok(g.addPlayer(room, `P${i}`).ok);
  assert.equal(g.addPlayer(room, 'Treizième').ok, false);
  g.startGame(room, room.hostId);
  assert.equal(g.addPlayer(room, 'Retardataire').ok, false);
});

test('startGame : réservé à l’hôte et à partir de 3 joueurs', () => {
  const small = makeRoom(2);
  assert.equal(g.startGame(small, small.hostId).ok, false);
  const room = makeRoom(5);
  const notHost = room.players[1].id;
  assert.equal(g.startGame(room, notHost).ok, false);
  assert.ok(g.startGame(room, room.hostId).ok);
  assert.equal(room.phase, 'reveal');
});

test('startGame : la répartition réelle correspond au plan', () => {
  for (let n = 3; n <= 12; n++) {
    const room = makeRoom(n);
    g.startGame(room, room.hostId);
    const counts = { civil: 0, undercover: 0, mrwhite: 0, bouclier: 0, detective: 0 };
    for (const p of room.players) counts[p.role]++;
    assert.deepEqual(counts, g.rolePlan(n), `n=${n}`);
  }
});

test('viewFor : aucun joueur ne reçoit le mot ou le rôle d’un autre', () => {
  const room = makeRoom(8);
  g.startGame(room, room.hostId);
  room.game.civilWord = 'MOTCIVIL';
  room.game.undercoverWord = 'MOTUNDER';
  for (const p of room.players) {
    p.word = p.role === ROLE.MRWHITE ? null : p.role === ROLE.UNDERCOVER ? 'MOTUNDER' : 'MOTCIVIL';
  }
  for (const p of room.players) {
    const json = JSON.stringify(g.viewFor(room, p.id));
    if (p.role === ROLE.UNDERCOVER) {
      assert.ok(!json.includes('MOTCIVIL'), 'l’undercover ne doit pas voir le mot des civils');
      assert.ok(!json.includes('"undercover"'), 'l’undercover ne doit pas savoir qu’il est undercover');
      assert.ok(json.includes('MOTUNDER'));
    } else if (p.role === ROLE.MRWHITE) {
      assert.ok(!json.includes('MOTCIVIL') && !json.includes('MOTUNDER'));
    } else {
      assert.ok(!json.includes('MOTUNDER'));
    }
    assert.ok(!json.includes('"token"'), 'les jetons de reconnexion ne sortent jamais');
  }
});

test('markReady : la discussion démarre quand tout le monde est prêt', () => {
  const room = makeRoom(4);
  g.startGame(room, room.hostId);
  for (const p of room.players.slice(0, 3)) g.markReady(room, p.id);
  assert.equal(room.phase, 'reveal');
  g.markReady(room, room.players[3].id);
  assert.equal(room.phase, 'discussion');
});

test('ordre de parole : Mr White ne commence jamais', () => {
  for (let i = 0; i < 100; i++) {
    const room = makeRoom(6);
    g.startGame(room, room.hostId);
    g.beginDiscussion(room, room.hostId);
    const first = g.getPlayer(room, room.game.order[0]);
    assert.notEqual(first.role, ROLE.MRWHITE);
    assert.equal(room.game.order.length, 6);
  }
});

test('vote : seul l’hôte l’ouvre, on ne vote pas pour soi, la majorité élimine', () => {
  const room = startRigged([ROLE.CIVIL, ROLE.CIVIL, ROLE.CIVIL, ROLE.CIVIL, ROLE.UNDERCOVER]);
  assert.equal(g.openVote(room, room.players[1].id).ok, false);
  assert.ok(g.openVote(room, hostOf(room)).ok);
  const [p0, p1, p2, p3, under] = room.players;
  assert.equal(g.castVote(room, p0.id, p0.id).ok, false);
  voteAll(room, under.id);
  assert.equal(under.alive, false);
  assert.equal(room.phase, 'end');
  assert.equal(room.game.winner, 'civils');
  assert.ok(p1 && p2 && p3);
});

test('vote : égalité → second tour entre les ex æquo, puis personne si nouvelle égalité', () => {
  const room = startRigged([ROLE.CIVIL, ROLE.CIVIL, ROLE.CIVIL, ROLE.CIVIL, ROLE.UNDERCOVER, ROLE.CIVIL]);
  g.openVote(room, hostOf(room));
  const [a, b, c, d, e, f] = room.players;
  // 3 votes contre a, 3 contre b
  g.castVote(room, a.id, b.id);
  g.castVote(room, b.id, a.id);
  g.castVote(room, c.id, a.id);
  g.castVote(room, d.id, b.id);
  g.castVote(room, e.id, a.id);
  g.castVote(room, f.id, b.id);
  assert.equal(room.phase, 'vote');
  assert.equal(room.game.tiebreak, true);
  assert.deepEqual([...room.game.candidates].sort(), [a.id, b.id].sort());
  assert.equal(g.castVote(room, c.id, d.id).ok, false, 'on ne peut voter que pour les ex æquo');
  // nouvelle égalité
  g.castVote(room, a.id, b.id);
  g.castVote(room, b.id, a.id);
  g.castVote(room, c.id, a.id);
  g.castVote(room, d.id, b.id);
  g.castVote(room, e.id, a.id);
  g.castVote(room, f.id, b.id);
  assert.equal(room.phase, 'result');
  assert.equal(room.game.result.type, 'tie');
  assert.ok(room.players.every((p) => p.alive));
  assert.ok(g.nextRound(room, hostOf(room)).ok);
  assert.equal(room.phase, 'discussion');
  assert.equal(room.game.round, 2);
});

test('closeVote : l’hôte peut clôturer avec les votes reçus', () => {
  const room = startRigged([ROLE.CIVIL, ROLE.CIVIL, ROLE.CIVIL, ROLE.CIVIL, ROLE.CIVIL, ROLE.UNDERCOVER]);
  g.openVote(room, hostOf(room));
  const target = room.players[5];
  g.castVote(room, room.players[0].id, target.id);
  g.castVote(room, room.players[1].id, target.id);
  assert.equal(room.phase, 'vote');
  assert.equal(g.closeVote(room, room.players[1].id).ok, false);
  assert.ok(g.closeVote(room, hostOf(room)).ok);
  assert.equal(target.alive, false);
});

test('Bouclier : sauvé une fois (rôle dévoilé), éliminable la fois suivante', () => {
  const room = startRigged([ROLE.CIVIL, ROLE.CIVIL, ROLE.CIVIL, ROLE.CIVIL, ROLE.UNDERCOVER, ROLE.SHIELD]);
  const shield = room.players[5];
  g.openVote(room, hostOf(room));
  voteAll(room, shield.id);
  assert.equal(room.phase, 'result');
  assert.equal(room.game.result.type, 'saved');
  assert.equal(shield.alive, true);
  assert.equal(shield.revealed, ROLE.SHIELD);
  g.nextRound(room, hostOf(room));
  g.openVote(room, hostOf(room));
  voteAll(room, shield.id);
  assert.equal(shield.alive, false);
});

test('Mr White : bonne réponse = victoire seul, mauvaise = la partie continue', () => {
  const roles = [ROLE.CIVIL, ROLE.CIVIL, ROLE.CIVIL, ROLE.CIVIL, ROLE.UNDERCOVER, ROLE.MRWHITE, ROLE.CIVIL];
  // bonne réponse
  let room = startRigged(roles);
  let white = room.players[5];
  g.openVote(room, hostOf(room));
  voteAll(room, white.id);
  assert.equal(room.phase, 'whiteGuess');
  assert.equal(g.submitGuess(room, room.players[0].id, 'A').ok, false, 'seul Mr White peut deviner');
  assert.ok(g.submitGuess(room, white.id, 'a').ok);
  assert.equal(room.phase, 'end');
  assert.equal(room.game.winner, 'mrwhite');
  // mauvaise réponse
  room = startRigged(roles);
  white = room.players[5];
  g.openVote(room, hostOf(room));
  voteAll(room, white.id);
  const res = g.submitGuess(room, white.id, 'zzz');
  assert.equal(res.correct, false);
  assert.equal(room.phase, 'result');
  assert.equal(room.game.result.guess.correct, false);
});

test('victoire des infiltrés : ils égalent les civils en nombre', () => {
  const room = startRigged([ROLE.CIVIL, ROLE.CIVIL, ROLE.CIVIL, ROLE.UNDERCOVER]);
  g.openVote(room, hostOf(room));
  voteAll(room, room.players[1].id); // un civil éliminé : 1 infiltré vs 2 civils
  assert.equal(room.phase, 'result');
  g.nextRound(room, hostOf(room));
  g.openVote(room, hostOf(room));
  voteAll(room, room.players[2].id); // un autre civil : 1 vs 1
  assert.equal(room.phase, 'end');
  assert.equal(room.game.winner, 'infiltres');
});

test('Détective : compare les mots, une seule fois, réservé au Détective', () => {
  const room = startRigged([ROLE.DETECTIVE, ROLE.CIVIL, ROLE.UNDERCOVER, ROLE.MRWHITE, ROLE.CIVIL, ROLE.CIVIL, ROLE.CIVIL]);
  const [det, civil, under, white] = room.players;
  assert.equal(g.investigate(room, civil.id, det.id).ok, false);
  assert.equal(g.investigate(room, det.id, det.id).ok, false);
  assert.ok(g.investigate(room, det.id, civil.id).ok);
  assert.equal(det.investigation.same, true);
  assert.equal(g.investigate(room, det.id, under.id).ok, false, 'une seule enquête par partie');
  const json = JSON.stringify(g.viewFor(room, det.id));
  assert.ok(json.includes('"same":true'));
  assert.ok(!JSON.stringify(g.viewFor(room, civil.id)).includes('"investigation":{'));
  assert.ok(under && white);
});

test('Détective : mot différent pour l’Undercover et pour Mr White', () => {
  for (const idx of [2, 3]) {
    const room = startRigged([ROLE.DETECTIVE, ROLE.CIVIL, ROLE.UNDERCOVER, ROLE.MRWHITE, ROLE.CIVIL, ROLE.CIVIL, ROLE.CIVIL]);
    g.investigate(room, room.players[0].id, room.players[idx].id);
    assert.equal(room.players[0].investigation.same, false);
  }
});

test('rematch : tout est réinitialisé et les joueurs hors ligne sont retirés', () => {
  const room = startRigged([ROLE.CIVIL, ROLE.CIVIL, ROLE.CIVIL, ROLE.CIVIL, ROLE.UNDERCOVER]);
  g.openVote(room, hostOf(room));
  voteAll(room, room.players[4].id);
  assert.equal(room.phase, 'end');
  room.players[1].connected = false;
  assert.equal(g.rematch(room, room.players[2].id).ok, false);
  assert.ok(g.rematch(room, hostOf(room)).ok);
  assert.equal(room.phase, 'lobby');
  assert.equal(room.players.length, 4);
  assert.ok(room.players.every((p) => p.alive && p.role === null && p.word === null));
});

test('passage de l’hôte : retrait de l’hôte dans le lobby', () => {
  const room = makeRoom(3);
  const oldHost = room.hostId;
  g.removePlayer(room, oldHost);
  assert.notEqual(room.hostId, oldHost);
  assert.ok(g.getPlayer(room, room.hostId));
});

test('simulation : 650 parties aléatoires de 3 à 12 joueurs se terminent toujours', () => {
  for (let n = 3; n <= 12; n++) {
    for (let run = 0; run < 50; run++) {
      const room = makeRoom(n);
      g.startGame(room, room.hostId);
      g.beginDiscussion(room, room.hostId);
      let guard = 0;
      while (room.phase !== 'end') {
        assert.ok(++guard < 200, `boucle infinie n=${n}`);
        if (room.phase === 'discussion') g.openVote(room, room.hostId);
        else if (room.phase === 'vote') {
          const alive = room.players.filter((p) => p.alive);
          for (const voter of alive) {
            if (room.phase !== 'vote') break;
            const pool = (room.game.candidates ? alive.filter((p) => room.game.candidates.includes(p.id)) : alive).filter(
              (p) => p.id !== voter.id,
            );
            g.castVote(room, voter.id, pool[Math.floor(Math.random() * pool.length)].id);
          }
        } else if (room.phase === 'whiteGuess') g.submitGuess(room, room.game.guessFor, Math.random() < 0.3 ? room.game.civilWord : 'x');
        else if (room.phase === 'result') g.nextRound(room, room.hostId);
      }
      assert.ok(['civils', 'infiltres', 'mrwhite'].includes(room.game.winner));
      const view = g.viewFor(room, room.hostId);
      assert.equal(view.end.players.length, n);
    }
  }
});

// ---------------------------------------------------------------------------
// Joueurs invités (jouent sur l'écran d'un autre joueur)
// ---------------------------------------------------------------------------

test('invités : ajout limité à 3 par joueur, prénom unique, salle pleine refusée', () => {
  const room = makeRoom(2);
  const owner = room.players[1];
  assert.ok(g.addGuest(room, owner.id, 'Léo').ok);
  assert.equal(g.addGuest(room, owner.id, 'léo').ok, false, 'prénom déjà pris');
  assert.equal(g.addGuest(room, owner.id, '  ').ok, false);
  assert.ok(g.addGuest(room, owner.id, 'Mia').ok);
  assert.ok(g.addGuest(room, owner.id, 'Noé').ok);
  assert.equal(g.addGuest(room, owner.id, 'Zoé').ok, false, 'trois invités maximum');
  const guest = room.players.find((p) => p.name === 'Léo');
  assert.equal(g.addGuest(room, guest.id, 'Petit').ok, false, 'un invité ne peut pas inviter');

  const full = makeRoom(12);
  assert.equal(g.addGuest(full, full.hostId, 'Trop').ok, false);
});

test('invités : retirer le propriétaire retire ses invités, et l’hôte n’est jamais un invité', () => {
  const room = makeRoom(3);
  const [host, p1] = room.players;
  const guest = g.addGuest(room, p1.id, 'Léo').player;
  assert.equal(g.removeGuest(room, host.id, guest.id).ok, false, 'seul le propriétaire retire son invité');
  g.removePlayer(room, p1.id);
  assert.ok(!room.players.some((p) => p.id === guest.id));

  // transfert d'hôte : on saute les invités
  const r2 = makeRoom(2);
  const other = r2.players[1];
  g.addGuest(r2, r2.hostId, 'Enfant');
  g.removePlayer(r2, r2.hostId);
  assert.equal(r2.hostId, other.id);
});

test('invités : le propriétaire reçoit leurs secrets, personne d’autre', () => {
  const room = makeRoom(3);
  const owner = room.players[1];
  const guest = g.addGuest(room, owner.id, 'Léo').player;
  g.addPlayer(room, 'Cinquième').player.connected = true;
  g.startGame(room, room.hostId);
  rig(room, [ROLE.CIVIL, ROLE.CIVIL, ROLE.CIVIL, ROLE.UNDERCOVER, ROLE.MRWHITE]);
  // l'invité Léo est le 4e joueur (index 3) : il a le mot B (undercover)
  assert.equal(room.players[3].id, guest.id);
  const ownerView = g.viewFor(room, owner.id);
  assert.equal(ownerView.guests.length, 1);
  assert.equal(ownerView.guests[0].me.word, 'B');
  assert.equal(ownerView.guests[0].me.role, ROLE.CIVIL, 'l’Undercover invité se croit civil');
  for (const p of room.players.filter((x) => !x.ownerId && x.id !== owner.id)) {
    const json = JSON.stringify(g.viewFor(room, p.id));
    assert.ok(!json.includes('"guests"'), 'les autres ne voient pas les secrets des invités');
    if (p.word !== 'B') assert.ok(!json.includes('"B"'));
  }
  const listed = ownerView.players.find((p) => p.id === guest.id);
  assert.equal(listed.guest, true);
  assert.equal(listed.ownerId, owner.id);
});

test('invités : un invité participe au vote et à la révélation, l’hôte ne l’est jamais', () => {
  const room = makeRoom(4);
  const owner = room.players[1];
  const guest = g.addGuest(room, owner.id, 'Léo').player;
  g.startGame(room, room.hostId);
  rig(room, [ROLE.CIVIL, ROLE.CIVIL, ROLE.CIVIL, ROLE.UNDERCOVER, ROLE.CIVIL]);
  assert.equal(room.players.length, 5);
  assert.equal(room.players[4].id, guest.id);
  for (const p of room.players.filter((x) => x.id !== guest.id)) g.markReady(room, p.id);
  assert.equal(room.phase, 'reveal', 'tant que l’invité n’est pas prêt, on attend');
  g.markReady(room, guest.id);
  assert.equal(room.phase, 'discussion');
  g.openVote(room, room.hostId);
  const under = room.players[3];
  voteAll(room, under.id);
  assert.equal(room.phase, 'end');
  assert.equal(room.game.winner, 'civils');
});

test('invités : un invité est hors ligne quand son propriétaire l’est', () => {
  const room = makeRoom(3);
  const owner = room.players[1];
  const guest = g.addGuest(room, owner.id, 'Léo').player;
  assert.equal(g.viewFor(room, room.hostId).players.find((p) => p.id === guest.id).connected, true);
  owner.connected = false;
  assert.equal(g.viewFor(room, room.hostId).players.find((p) => p.id === guest.id).connected, false);
});

test('simulation avec invités : 200 parties se terminent', () => {
  for (let run = 0; run < 200; run++) {
    const room = makeRoom(3 + (run % 6));
    const owner = room.players[1];
    g.addGuest(room, owner.id, 'Enfant1');
    if (room.players.length < 12) g.addGuest(room, room.hostId, 'Enfant2');
    if (room.players.length < 3) continue;
    g.startGame(room, room.hostId);
    g.beginDiscussion(room, room.hostId);
    let guard = 0;
    while (room.phase !== 'end') {
      assert.ok(++guard < 200);
      if (room.phase === 'discussion') g.openVote(room, room.hostId);
      else if (room.phase === 'vote') {
        const alive = room.players.filter((p) => p.alive);
        for (const voter of alive) {
          if (room.phase !== 'vote') break;
          const pool = (room.game.candidates ? alive.filter((p) => room.game.candidates.includes(p.id)) : alive).filter((p) => p.id !== voter.id);
          g.castVote(room, voter.id, pool[Math.floor(Math.random() * pool.length)].id);
        }
      } else if (room.phase === 'whiteGuess') g.submitGuess(room, room.game.guessFor, 'x');
      else if (room.phase === 'result') g.nextRound(room, room.hostId);
    }
    assert.ok(['civils', 'infiltres', 'mrwhite'].includes(room.game.winner));
  }
});

// ---------------------------------------------------------------------------
// Thèmes de mots
// ---------------------------------------------------------------------------

test('thèmes : chaque thème a au moins 15 paires, sans doublon ni mot identique', () => {
  const { THEMES } = require('./words');
  const seen = new Set();
  for (const t of THEMES) {
    assert.ok(t.pairs.length >= 15, `${t.id} : ${t.pairs.length} paires`);
    for (const [a, b] of t.pairs) {
      assert.notEqual(a.toLowerCase(), b.toLowerCase());
      const key = [a, b].map((w) => w.toLowerCase()).sort().join('|');
      assert.ok(!seen.has(key), `doublon : ${key}`);
      seen.add(key);
    }
  }
});

test('thèmes : options valides, au moins un thème, tout ou rien', () => {
  const room = makeRoom(4);
  const before = [...room.options.themes];
  assert.ok(before.length >= 9, 'tous les thèmes sont cochés par défaut');
  assert.equal(g.setOptions(room, room.players[1].id, { themes: ['films'] }).ok, false, 'réservé à l’hôte');
  assert.equal(g.setOptions(room, room.hostId, { themes: [] }).ok, false, 'au moins un thème');
  assert.equal(g.setOptions(room, room.hostId, { themes: 'films' }).ok, false, 'tableau obligatoire');
  assert.equal(g.setOptions(room, room.hostId, { themes: ['nimportequoi'] }).ok, false, 'thèmes inconnus seuls');
  // Un refus ne doit rien changer, même aux autres options envoyées en même temps.
  assert.equal(g.setOptions(room, room.hostId, { themes: [], mrwhite: false }).ok, false);
  assert.equal(room.options.mrwhite, true);
  assert.deepEqual(room.options.themes, before);
  assert.ok(g.setOptions(room, room.hostId, { themes: ['films', 'inconnu', 'genz'] }).ok);
  assert.deepEqual(room.options.themes, ['genz', 'films']);
});

test('thèmes : la paire tirée vient toujours d’un thème coché, sans répétition avant épuisement', () => {
  const { THEMES } = require('./words');
  const room = makeRoom(4);
  g.setOptions(room, room.hostId, { themes: ['musique'] });
  const musique = THEMES.find((t) => t.id === 'musique');
  const words = new Set(musique.pairs.flat());
  const seen = new Set();
  for (let i = 0; i < musique.pairs.length; i++) {
    g.startGame(room, room.hostId);
    assert.equal(room.game.theme, 'musique');
    assert.ok(words.has(room.game.civilWord) && words.has(room.game.undercoverWord));
    const key = [room.game.civilWord, room.game.undercoverWord].sort().join('|');
    assert.ok(!seen.has(key), `paire répétée : ${key}`);
    seen.add(key);
    room.phase = 'lobby'; // on relance une partie dans la même salle
  }
  // Après épuisement, le tirage repart sans planter.
  assert.ok(g.startGame(room, room.hostId).ok);
});

test('thèmes : le thème n’est visible que si l’hôte l’a demandé', () => {
  const room = makeRoom(4);
  g.setOptions(room, room.hostId, { themes: ['series'] });
  g.startGame(room, room.hostId);
  assert.equal(g.viewFor(room, room.hostId).theme, undefined);
  room.phase = 'lobby';
  g.setOptions(room, room.hostId, { showTheme: true });
  g.startGame(room, room.hostId);
  const view = g.viewFor(room, room.hostId);
  assert.equal(view.theme.label, 'Séries');
});
