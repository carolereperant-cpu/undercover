'use strict';

/**
 * Les Terres d'Aldoria : jeu de conquête (2 à 6 joueurs) sur une carte fantasy originale de 24 territoires.
 * À son tour : 1) on place ses renforts, 2) on attaque avec des dés, 3) on peut déplacer des armées une fois.
 * Tout est public (comme sur un plateau) : il n'y a aucun secret à protéger dans la vue.
 */

const { ok, err, shuffle } = require('../common');
const MAP = require('./conquete-map.json');

const MAX_ROUNDS = 10; // tours de table : après le dixième, le plus grand territoire gagne
const START_ARMIES = { 2: 40, 3: 30, 4: 24, 5: 20, 6: 16 };

const TERRITORIES = MAP.territories;
const REGIONS = MAP.regions;
const BY_ID = Object.fromEntries(TERRITORIES.map((t) => [t.id, t]));
const NEIGHBORS = Object.fromEntries(TERRITORIES.map((t) => [t.id, []]));
for (const [a, b] of MAP.links) {
  NEIGHBORS[a].push(b);
  NEIGHBORS[b].push(a);
}

const meta = {
  id: 'conquete',
  label: 'Les Terres d’Aldoria',
  emoji: '🗺️',
  tagline: 'Conquiers les territoires à coups de dés et deviens maître d’Aldoria.',
  min: 2,
  max: 6,
  minutes: '30 à 45',
  maxMinutes: 45,
  bots: true,
  maxBots: 5,
  botNames: ['Bot Ogre', 'Bot Gobelin', 'Bot Troll', 'Bot Korrigan', 'Bot Dragonnet'],
  rules: [
    'Chacun reçoit des territoires au hasard. Tu gagnes en les gardant, en prenant ceux des autres, et en éliminant tes adversaires.',
    'Ton tour : 1) place tes renforts (1 par tranche de 3 territoires, 3 au minimum, plus un bonus pour chaque région entière que tu tiens). 2) Attaque un territoire voisin. 3) Déplace éventuellement des armées, puis termine ton tour.',
    'Attaque : tu lances jusqu’à 3 dés (1 de moins que tes armées sur le territoire), le défenseur 2 au maximum. On compare les plus forts dés : le plus petit perd une armée, et l’égalité profite au défenseur.',
    'Quand tu prends un territoire, tu y installes au moins autant d’armées que de dés lancés, et tu peux en amener d’autres.',
    'Fortifier termine ton tour : tu déplaces des armées d’un territoire vers un territoire voisin qui t’appartient.',
    `La partie s’arrête quand un seul joueur reste, ou après ${MAX_ROUNDS} tours de table : le plus de territoires gagne (puis le plus d’armées).`,
  ],
};

// ---------------------------------------------------------------------------
// Outils (utilisés aussi par le bot)
// ---------------------------------------------------------------------------

const territoriesOf = (mg, who) => TERRITORIES.filter((t) => mg.terr[t.id].owner === who);

/** Renforts du joueur : 1 par tranche de 3 territoires (3 au minimum) + bonus des régions entières. */
function reinforcements(mg, who) {
  const owned = territoriesOf(mg, who);
  let n = Math.max(3, Math.floor(owned.length / 3));
  for (const r of REGIONS) {
    const members = TERRITORIES.filter((t) => t.region === r.id);
    if (members.every((t) => mg.terr[t.id].owner === who)) n += r.bonus;
  }
  return n;
}

const score = (mg, who) => {
  const owned = territoriesOf(mg, who);
  return { territories: owned.length, armies: owned.reduce((s, t) => s + mg.terr[t.id].armies, 0) };
};

const say = (mg, text) => {
  mg.log.push(text);
  if (mg.log.length > 12) mg.log.shift();
};

const rollDice = (n) => Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6)).sort((a, b) => b - a);

// ---------------------------------------------------------------------------
// Mise en place
// ---------------------------------------------------------------------------

function startTurn(mg) {
  mg.pending = reinforcements(mg, mg.turn);
  mg.phase = 'reinforce';
  mg.lastConquest = null;
}

function init(room) {
  // L'ordre de jeu est tiré au sort une fois pour toutes : chacun joue le même nombre de tours.
  const ids = shuffle(room.players.map((p) => p.id));
  const n = ids.length;
  const terr = {};
  const deal = shuffle(TERRITORIES.map((t) => t.id));
  deal.forEach((id, i) => {
    terr[id] = { owner: i % n, armies: 1 };
  });
  // Les armées restantes sont réparties au hasard sur les territoires de chaque joueur.
  for (let who = 0; who < n; who++) {
    const mine = deal.filter((id) => terr[id].owner === who);
    let left = START_ARMIES[n] - mine.length;
    while (left > 0) {
      terr[mine[Math.floor(Math.random() * mine.length)]].armies += 1;
      left -= 1;
    }
  }
  const mg = {
    ids,
    turn: 0,
    round: 1,
    phase: 'reinforce',
    pending: 0,
    terr,
    alive: ids.map(() => true),
    lastBattle: null,
    lastConquest: null,
    log: [],
    winner: null,
    reason: null,
  };
  startTurn(mg);
  room.mg = mg;
}

// ---------------------------------------------------------------------------
// Fin de partie
// ---------------------------------------------------------------------------

function ranking(mg) {
  return mg.ids
    .map((id, who) => ({ who, id, ...score(mg, who) }))
    .sort((a, b) => b.territories - a.territories || b.armies - a.armies);
}

function finish(room, winner, reason) {
  room.mg.winner = winner;
  room.mg.reason = reason;
  room.mg.phase = 'end';
  room.phase = 'end';
}

function endByRounds(room) {
  const [first, second] = ranking(room.mg);
  const tie = second && first.territories === second.territories && first.armies === second.armies;
  finish(room, tie ? null : first.who, 'rounds');
}

function advanceTurn(room) {
  const mg = room.mg;
  const n = mg.ids.length;
  let next = mg.turn;
  do {
    next = (next + 1) % n;
    if (next <= mg.turn) mg.round += 1; // on a fait le tour de la table
    mg.turn = next;
  } while (!mg.alive[next]);
  if (mg.round > MAX_ROUNDS) return endByRounds(room);
  startTurn(mg);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

const isCount = (n) => Number.isInteger(n) && n >= 1;

/** Un affrontement : renvoie le résultat des dés et applique les pertes. */
function battle(mg, fromId, toId, diceCount) {
  const from = mg.terr[fromId];
  const to = mg.terr[toId];
  const att = rollDice(diceCount);
  const def = rollDice(Math.min(2, to.armies));
  let attLoss = 0;
  let defLoss = 0;
  for (let i = 0; i < Math.min(att.length, def.length); i++) {
    if (att[i] > def[i]) defLoss += 1;
    else attLoss += 1;
  }
  from.armies -= attLoss;
  to.armies -= defLoss;
  return { att, def, attLoss, defLoss };
}

/** Le territoire est tombé : on installe les armées d'occupation et on vérifie les éliminations. */
function conquer(room, who, fromId, toId, dice) {
  const mg = room.mg;
  const from = mg.terr[fromId];
  const to = mg.terr[toId];
  const loser = to.owner;
  const move = Math.min(dice, from.armies - 1);
  from.armies -= move;
  to.owner = who;
  to.armies = move;
  mg.lastConquest = { from: fromId, to: toId };
  say(mg, `${BY_ID[toId].name} tombe aux mains de ${room.players.find((p) => p.id === mg.ids[who]).name}.`);
  if (territoriesOf(mg, loser).length === 0) {
    mg.alive[loser] = false;
    say(mg, `${room.players.find((p) => p.id === mg.ids[loser]).name} est éliminé !`);
    if (mg.alive.filter(Boolean).length === 1) finish(room, who, 'ko');
  }
}

function act(room, actor, type, payload) {
  const mg = room.mg;
  if (room.phase !== 'playing' || mg.phase === 'end') return err('La partie n’est pas en cours.');
  const who = mg.ids.indexOf(actor.id);
  if (who === -1) return err('Tu ne joues pas cette partie.');
  if (who !== mg.turn) return err('Ce n’est pas ton tour.');
  const t = (id) => (typeof id === 'string' && Object.hasOwn(mg.terr, id) ? mg.terr[id] : undefined);
  const name = actor.name;

  if (type === 'place') {
    if (mg.phase !== 'reinforce') return err('Tu as déjà placé tes renforts.');
    const target = t(payload.territory);
    if (!target || target.owner !== who) return err('Choisis un de tes territoires.');
    if (!isCount(payload.count) || payload.count > mg.pending) return err('Nombre de renforts invalide.');
    target.armies += payload.count;
    mg.pending -= payload.count;
    if (mg.pending === 0) {
      mg.phase = 'attack';
      say(mg, `${name} a placé ses renforts.`);
    }
    return ok();
  }

  if (mg.phase === 'reinforce') return err('Place d’abord tous tes renforts.');

  if (type === 'attack' || type === 'blitz') {
    const from = t(payload.from);
    const to = t(payload.to);
    if (!from || !to || from.owner !== who) return err('Attaque depuis un de tes territoires.');
    if (to.owner === who) return err('Tu ne peux pas attaquer ton propre territoire.');
    if (!NEIGHBORS[payload.from].includes(payload.to)) return err('Ces territoires ne sont pas voisins.');
    if (from.armies < 2) return err('Il faut au moins 2 armées pour attaquer.');
    const maxDice = Math.min(3, from.armies - 1);
    const dice = type === 'blitz' ? maxDice : payload.dice;
    if (!Number.isInteger(dice) || dice < 1 || dice > maxDice) return err(`Tu peux lancer 1 à ${maxDice} dé(s).`);
    mg.lastConquest = null;

    if (type === 'attack') {
      const res = battle(mg, payload.from, payload.to, dice);
      mg.lastBattle = { from: payload.from, to: payload.to, ...res, conquered: false, who };
      if (to.armies <= 0) {
        mg.lastBattle.conquered = true;
        conquer(room, who, payload.from, payload.to, dice);
      }
      return ok();
    }

    // Assaut : on relance les dés jusqu'à la victoire ou jusqu'à ce qu'il ne reste qu'une armée.
    let attLoss = 0;
    let defLoss = 0;
    let last = null;
    let lastDice = dice;
    while (from.armies >= 2 && to.armies > 0) {
      lastDice = Math.min(3, from.armies - 1);
      last = battle(mg, payload.from, payload.to, lastDice);
      attLoss += last.attLoss;
      defLoss += last.defLoss;
    }
    mg.lastBattle = { from: payload.from, to: payload.to, att: last.att, def: last.def, attLoss, defLoss, conquered: false, blitz: true, who };
    if (to.armies <= 0) {
      mg.lastBattle.conquered = true;
      conquer(room, who, payload.from, payload.to, lastDice);
    }
    return ok();
  }

  if (type === 'occupy') {
    const lc = mg.lastConquest;
    if (!lc) return err('Rien à déplacer pour le moment.');
    const from = mg.terr[lc.from];
    const to = mg.terr[lc.to];
    if (!isCount(payload.count) || payload.count > from.armies - 1) return err('Nombre d’armées invalide.');
    from.armies -= payload.count;
    to.armies += payload.count;
    mg.lastConquest = null;
    return ok();
  }

  if (type === 'fortify') {
    const from = t(payload.from);
    const to = t(payload.to);
    if (!from || !to || from.owner !== who || to.owner !== who) return err('Choisis deux de tes territoires.');
    if (!NEIGHBORS[payload.from].includes(payload.to)) return err('Les territoires doivent être voisins.');
    if (!isCount(payload.count) || payload.count > from.armies - 1) return err('Il doit rester au moins une armée sur place.');
    from.armies -= payload.count;
    to.armies += payload.count;
    say(mg, `${name} déplace ${payload.count} armée${payload.count > 1 ? 's' : ''} vers ${BY_ID[payload.to].name}.`);
    advanceTurn(room);
    return ok();
  }

  if (type === 'endTurn') {
    advanceTurn(room);
    return ok();
  }

  return err('Action inconnue.');
}

// ---------------------------------------------------------------------------
// Vue
// ---------------------------------------------------------------------------

function view(room, playerId) {
  const mg = room.mg;
  const mine = mg.ids.indexOf(playerId);
  return {
    phase: mg.phase,
    ids: mg.ids,
    mine,
    turn: mg.turn,
    round: mg.round,
    maxRounds: MAX_ROUNDS,
    pending: mg.pending,
    terr: Object.fromEntries(Object.entries(mg.terr).map(([id, s]) => [id, { o: s.owner, a: s.armies }])),
    alive: mg.alive,
    scores: mg.ids.map((_, who) => ({ ...score(mg, who), income: mg.alive[who] ? reinforcements(mg, who) : 0 })),
    lastBattle: mg.lastBattle,
    lastConquest: mg.turn === mine ? mg.lastConquest : null,
    log: mg.log,
    winner: mg.winner,
    reason: mg.reason,
    ranking: mg.phase === 'end' ? ranking(mg).map((r) => ({ id: r.id, territories: r.territories, armies: r.armies })) : null,
  };
}

module.exports = {
  meta,
  init,
  act,
  view,
  MAX_ROUNDS,
  START_ARMIES,
  // exposé pour le bot et les tests
  TERRITORIES,
  REGIONS,
  NEIGHBORS,
  BY_ID,
  territoriesOf,
  reinforcements,
};
