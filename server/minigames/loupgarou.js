'use strict';

/**
 * Loup-Garou express : le serveur est le narrateur.
 * La nuit, les loups choisissent une victime, la voyante inspecte quelqu'un, la sorcière peut sauver
 * ou empoisonner. Le jour, tout le monde discute puis vote pour éliminer un suspect.
 * Les villageois gagnent quand il n'y a plus de loup ; les loups gagnent quand ils sont au moins
 * aussi nombreux que les autres.
 */

const { ok, err, shuffle, pick } = require('../common');

const meta = {
  id: 'loupgarou',
  label: 'Loup-Garou express',
  emoji: '🐺',
  tagline: 'Le téléphone est le narrateur : démasquez les loups !',
  min: 5,
  max: 13,
  minutes: '15 à 20',
  maxMinutes: 20,
  rules: [
    'Chacun reçoit un rôle secret : loup-garou, villageois, voyante, sorcière ou chasseur.',
    'La nuit, tout le monde « ferme les yeux » : les rôles spéciaux jouent sur leur écran, les autres attendent.',
    'Le jour, on discute à voix haute puis on vote : le joueur le plus voté est éliminé et son rôle est révélé.',
    'Les villageois gagnent s’ils éliminent tous les loups. Les loups gagnent quand ils sont aussi nombreux que les autres.',
  ],
};

/** Composition des rôles selon le nombre de joueurs. */
function composition(n) {
  const wolf = n <= 6 ? 1 : n <= 9 ? 2 : 3;
  const seer = 1;
  const witch = n >= 6 ? 1 : 0;
  const hunter = n >= 8 ? 1 : 0;
  return { wolf, seer, witch, hunter, villager: n - wolf - seer - witch - hunter };
}

function init(room) {
  const comp = composition(room.players.length);
  const roles = shuffle(Object.entries(comp).flatMap(([role, count]) => Array(count).fill(role)));
  room.mg = {
    phase: 'role',
    night: 0,
    comp,
    roles: Object.fromEntries(room.players.map((p, i) => [p.id, roles[i]])),
    alive: Object.fromEntries(room.players.map((p) => [p.id, true])),
    potions: { heal: true, poison: true },
    ns: null,
    seerLog: [],
    hunterShot: false,
    hunterAfter: null,
    votes: {},
    verdict: null,
    events: [],
    winner: null,
  };
}

const isAlive = (mg, id) => mg.alive[id] === true;
const idsWith = (mg, role) => Object.keys(mg.roles).filter((id) => mg.roles[id] === role);
const aliveIds = (mg) => Object.keys(mg.alive).filter((id) => mg.alive[id]);
const aliveWith = (mg, role) => idsWith(mg, role).filter((id) => isAlive(mg, id));
const publicDeath = (mg, id) => ({ id, role: mg.roles[id] });

function beginNight(room) {
  const mg = room.mg;
  mg.night += 1;
  mg.phase = 'night';
  const witchAlive = aliveWith(mg, 'witch').length > 0 && (mg.potions.heal || mg.potions.poison);
  mg.ns = {
    wolfPicks: {},
    victimId: null,
    wolvesDone: false,
    seerDone: aliveWith(mg, 'seer').length === 0,
    witchStep: witchAlive ? 'wait' : 'done', // wait → ask (une victime est désignée) → done
    healed: false,
    poisonId: null,
  };
}

function checkWin(mg) {
  const wolves = aliveWith(mg, 'wolf').length;
  const others = aliveIds(mg).length - wolves;
  if (wolves === 0) return 'village';
  if (wolves >= others) return 'wolves';
  return null;
}

function endGame(room, winner) {
  room.mg.winner = winner;
  room.mg.phase = 'end';
  room.phase = 'end';
}

/** Après des morts : tir du chasseur éventuel, victoire éventuelle, sinon on continue vers `next`. */
function settle(room, next) {
  const mg = room.mg;
  const wolves = aliveWith(mg, 'wolf').length;
  const hunterId = idsWith(mg, 'hunter')[0];
  if (wolves === 0) return endGame(room, 'village');
  if (hunterId && !isAlive(mg, hunterId) && !mg.hunterShot) {
    mg.phase = 'hunter';
    mg.hunterAfter = next;
    return undefined;
  }
  const winner = checkWin(mg);
  if (winner) return endGame(room, winner);
  mg.phase = next;
  return undefined;
}

function resolveNight(room) {
  const mg = room.mg;
  const { ns } = mg;
  const deaths = [];
  if (ns.victimId && !ns.healed) deaths.push(ns.victimId);
  if (ns.poisonId && !deaths.includes(ns.poisonId)) deaths.push(ns.poisonId);
  for (const id of deaths) mg.alive[id] = false;
  mg.events.push({ kind: 'night', night: mg.night, deaths: deaths.map((id) => publicDeath(mg, id)) });
  mg.ns = null;
  settle(room, 'dawn');
}

function checkNightDone(room) {
  const { ns } = room.mg;
  if (ns.wolvesDone && ns.seerDone && ns.witchStep === 'done') resolveNight(room);
}

function wolvesDecide(room) {
  const { ns } = room.mg;
  const counts = {};
  for (const target of Object.values(ns.wolfPicks)) counts[target] = (counts[target] ?? 0) + 1;
  const best = Math.max(...Object.values(counts));
  ns.victimId = pick(Object.keys(counts).filter((id) => counts[id] === best));
  ns.wolvesDone = true;
  if (ns.witchStep === 'wait') ns.witchStep = 'ask';
}

function resolveVote(room) {
  const mg = room.mg;
  const tally = {};
  for (const target of Object.values(mg.votes)) tally[target] = (tally[target] ?? 0) + 1;
  const best = Math.max(0, ...Object.values(tally));
  const top = Object.keys(tally).filter((id) => tally[id] === best);
  const eliminated = top.length === 1 ? top[0] : null; // égalité : personne ne sort
  if (eliminated) mg.alive[eliminated] = false;
  mg.verdict = { eliminated: eliminated ? publicDeath(mg, eliminated) : null, tally, tie: top.length > 1 };
  mg.events.push({ kind: 'vote', night: mg.night, deaths: eliminated ? [publicDeath(mg, eliminated)] : [] });
  mg.votes = {};
  settle(room, 'verdict');
}

function act(room, actor, type, payload) {
  const mg = room.mg;
  if (room.phase !== 'playing') return err('La partie n’est pas en cours.');
  const role = mg.roles[actor.id];
  const living = isAlive(mg, actor.id);
  const target = payload.targetId;

  if (type === 'wolf') {
    if (mg.phase !== 'night' || mg.ns.wolvesDone) return err('Ce n’est pas le moment.');
    if (role !== 'wolf' || !living) return err('Tu n’es pas un loup en vie.');
    if (!isAlive(mg, target) || mg.roles[target] === 'wolf') return err('Choisis un joueur en vie qui n’est pas un loup.');
    mg.ns.wolfPicks[actor.id] = target;
    if (aliveWith(mg, 'wolf').every((id) => id in mg.ns.wolfPicks)) {
      wolvesDecide(room);
      checkNightDone(room);
    }
    return ok();
  }

  if (type === 'see') {
    if (mg.phase !== 'night' || mg.ns.seerDone) return err('Ce n’est pas le moment.');
    if (role !== 'seer' || !living) return err('Tu n’es pas la voyante.');
    if (!isAlive(mg, target) || target === actor.id) return err('Choisis un autre joueur en vie.');
    mg.seerLog.push({ night: mg.night, id: target, role: mg.roles[target] });
    mg.ns.seerDone = true;
    checkNightDone(room);
    return ok();
  }

  if (type === 'witch') {
    if (mg.phase !== 'night' || mg.ns.witchStep !== 'ask') return err('Ce n’est pas le moment.');
    if (role !== 'witch' || !living) return err('Tu n’es pas la sorcière.');
    const heal = payload.heal === true;
    const poisonId = payload.poisonId ?? null;
    if (heal && !mg.potions.heal) return err('Tu as déjà utilisé ta potion de vie.');
    if (poisonId !== null) {
      if (!mg.potions.poison) return err('Tu as déjà utilisé ta potion de mort.');
      if (!isAlive(mg, poisonId) || poisonId === actor.id) return err('Choisis un autre joueur en vie.');
    }
    if (heal) {
      mg.potions.heal = false;
      mg.ns.healed = true;
    }
    if (poisonId !== null) {
      mg.potions.poison = false;
      mg.ns.poisonId = poisonId;
    }
    mg.ns.witchStep = 'done';
    checkNightDone(room);
    return ok();
  }

  if (type === 'shoot') {
    if (mg.phase !== 'hunter') return err('Ce n’est pas le moment.');
    if (role !== 'hunter' || living) return err('Seul le chasseur éliminé peut tirer.');
    if (!isAlive(mg, target)) return err('Choisis un joueur en vie.');
    mg.alive[target] = false;
    mg.hunterShot = true;
    mg.events.push({ kind: 'hunter', night: mg.night, deaths: [publicDeath(mg, target)] });
    settle(room, mg.hunterAfter);
    return ok();
  }

  if (type === 'vote') {
    if (mg.phase !== 'vote') return err('Ce n’est pas le moment de voter.');
    if (!living) return err('Les éliminés ne votent pas.');
    if (!isAlive(mg, target) || target === actor.id) return err('Choisis un autre joueur en vie.');
    mg.votes[actor.id] = target;
    if (aliveIds(mg).every((id) => id in mg.votes)) resolveVote(room);
    return ok();
  }

  if (actor.id !== room.hostId) return err('Seul l’hôte peut faire ça.');

  if (type === 'start') {
    if (mg.phase !== 'role') return err('Ce n’est pas le moment.');
    beginNight(room);
    return ok();
  }

  if (type === 'force') {
    if (mg.phase === 'night') {
      const { ns } = mg;
      if (!ns.wolvesDone) {
        if (Object.keys(ns.wolfPicks).length > 0) wolvesDecide(room);
        else ns.wolvesDone = true; // pas de victime cette nuit
      }
      ns.seerDone = true;
      ns.witchStep = 'done';
      resolveNight(room);
      return ok();
    }
    if (mg.phase === 'vote') {
      if (Object.keys(mg.votes).length === 0) return err('Personne n’a encore voté.');
      resolveVote(room);
      return ok();
    }
    return err('Ce n’est pas le moment.');
  }

  if (type === 'next') {
    if (mg.phase === 'dawn') {
      mg.phase = 'vote';
      mg.votes = {};
      return ok();
    }
    if (mg.phase === 'verdict') {
      beginNight(room);
      return ok();
    }
    return err('Ce n’est pas le moment.');
  }

  return err('Action inconnue.');
}

function nightTask(mg, playerId) {
  const { ns } = mg;
  const role = mg.roles[playerId];
  if (!isAlive(mg, playerId)) return { kind: 'sleep' };
  if (role === 'wolf') {
    return {
      kind: 'wolf',
      done: ns.wolvesDone || playerId in ns.wolfPicks,
      pick: ns.wolfPicks[playerId] ?? null,
      mates: Object.fromEntries(aliveWith(mg, 'wolf').map((id) => [id, ns.wolfPicks[id] ?? null])),
    };
  }
  if (role === 'seer') return ns.seerDone ? { kind: 'sleep' } : { kind: 'seer' };
  if (role === 'witch' && ns.witchStep === 'ask') {
    return { kind: 'witch', victimId: ns.victimId, canHeal: mg.potions.heal && Boolean(ns.victimId), canPoison: mg.potions.poison };
  }
  return { kind: 'sleep' };
}

function view(room, playerId) {
  const mg = room.mg;
  const role = mg.roles[playerId];
  const ended = mg.phase === 'end';
  const v = {
    phase: mg.phase,
    night: mg.night,
    comp: mg.comp,
    alive: mg.alive,
    myRole: role,
    events: mg.events,
    verdict: mg.verdict,
    winner: mg.winner,
    voted: Object.keys(mg.votes),
    myVote: mg.votes[playerId] ?? null,
    task: mg.phase === 'night' ? nightTask(mg, playerId) : null,
    mates: role === 'wolf' ? idsWith(mg, 'wolf') : [],
    seerLog: role === 'seer' ? mg.seerLog : [],
    potions: role === 'witch' ? mg.potions : null,
    canShoot: mg.phase === 'hunter' && role === 'hunter' && !isAlive(mg, playerId) && !mg.hunterShot,
    roles: ended ? mg.roles : null,
  };
  return v;
}

module.exports = { meta, init, act, view, composition };
