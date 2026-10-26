'use strict';

/**
 * Les Quatre Couronnes : duel de deck-building (2 joueurs).
 * On part d'un petit paquet de cartes de base, on achète de meilleures cartes au marché,
 * et on attaque l'adversaire jusqu'à ce que sa vie tombe à 0.
 */

const { ok, err, shuffle, pick } = require('../common');
const { STARTERS, MARKET, BY_ID } = require('./couronnes-cards');

const START_LIFE = 40;
const MAX_LIFE = 60;
const HAND = 5;
const MARKET_SIZE = 5;
const MAX_TURNS = 40; // tours cumulés des deux joueurs : au-delà, le plus de vie gagne

const meta = {
  id: 'couronnes',
  label: 'Les Quatre Couronnes',
  emoji: '👑',
  tagline: 'Duel de cartes : améliore ton paquet et écrase ton adversaire.',
  min: 2,
  max: 2,
  minutes: '15 à 20',
  maxMinutes: 20,
  noGuests: true,
  bots: true, // peut se jouer contre un bot (voir couronnes-bot.js)
  maxBots: 1,
  botNames: ['Bot Gobelin'],
  rules: [
    'Chacun commence avec 40 points de vie et 10 cartes de base (écus, bâtons, amulettes). Tu pioches 5 cartes par tour.',
    'Joue tes cartes : l’or sert à acheter au marché, l’attaque blesse l’adversaire, les soins te rendent de la vie.',
    'Les cartes achetées vont dans ta défausse et reviennent dans ton paquet plus tard.',
    'Les champions restent en jeu : ils ont une défense, s’activent une fois par tour, et il faut les vaincre pour les retirer. Un champion « garde » doit être attaqué en premier.',
    'Alliance : si une autre carte de la même faction est déjà en jeu, une carte joue son effet bonus.',
    'Le premier qui tombe à 0 vie perd. Après 20 tours chacun, le plus de vie gagne.',
  ],
};

let uidCounter = 0;
const mk = (id) => ({ uid: `c${++uidCounter}`, id });

function draw(p, n) {
  for (let i = 0; i < n; i++) {
    if (p.deck.length === 0) {
      if (p.discard.length === 0) return;
      p.deck = shuffle(p.discard);
      p.discard = [];
    }
    p.hand.push(p.deck.pop());
  }
}

function init(room) {
  const ids = room.players.map((p) => p.id);
  const starter = () => {
    const cards = [];
    for (let i = 0; i < 7; i++) cards.push(mk('ecu'));
    for (let i = 0; i < 2; i++) cards.push(mk('baton'));
    cards.push(mk('amulette'));
    return shuffle(cards);
  };
  const mkPlayer = () => ({ deck: starter(), hand: [], discard: [], played: [], champions: [] });
  const market = shuffle(MARKET.flatMap((c) => [mk(c.id), mk(c.id)]));
  const mg = {
    ids,
    turn: pick([0, 1]),
    turns: 0,
    phase: 'play',
    winner: null,
    life: [START_LIFE, START_LIFE],
    players: [mkPlayer(), mkPlayer()],
    market: [],
    marketDeck: market,
    pool: { g: 0, a: 0 },
    log: [],
    reason: null,
  };
  for (let i = 0; i < MARKET_SIZE; i++) mg.market.push(mg.marketDeck.pop());
  // Le premier joueur pioche 3 cartes (petit désavantage compensé), l'autre 5.
  draw(mg.players[mg.turn], 3);
  draw(mg.players[1 - mg.turn], HAND);
  room.mg = mg;
}

const say = (mg, text) => {
  mg.log.push(text);
  if (mg.log.length > 10) mg.log.shift();
};

function checkEnd(room) {
  const mg = room.mg;
  const dead = mg.life.findIndex((l) => l <= 0);
  if (dead !== -1) {
    mg.winner = 1 - dead;
    mg.reason = 'ko';
  } else if (mg.turns >= MAX_TURNS) {
    mg.reason = 'turns';
    mg.winner = mg.life[0] === mg.life[1] ? null : mg.life[0] > mg.life[1] ? 0 : 1;
  } else return;
  mg.phase = 'end';
  room.phase = 'end';
}

function applyFx(mg, who, fx, label) {
  if (!fx) return;
  const me = mg.players[who];
  const foe = mg.players[1 - who];
  const parts = [];
  if (fx.g) { mg.pool.g += fx.g; parts.push(`+${fx.g} or`); }
  if (fx.a) { mg.pool.a += fx.a; parts.push(`+${fx.a} attaque`); }
  if (fx.h) { mg.life[who] = Math.min(MAX_LIFE, mg.life[who] + fx.h); parts.push(`+${fx.h} vie`); }
  if (fx.d) { draw(me, fx.d); parts.push(`pioche ${fx.d}`); }
  if (fx.x) {
    for (let i = 0; i < fx.x && foe.hand.length > 0; i++) {
      const [gone] = foe.hand.splice(Math.floor(Math.random() * foe.hand.length), 1);
      foe.discard.push(gone);
    }
    parts.push(`l’adversaire défausse ${fx.x}`);
  }
  if (parts.length) say(mg, `${label} : ${parts.join(', ')}`);
}

const factionInPlay = (p, faction, exceptUid) =>
  [...p.played, ...p.champions].some((c) => c.uid !== exceptUid && BY_ID[c.id].faction === faction && faction !== 'neutre');

function act(room, actor, type, payload) {
  const mg = room.mg;
  if (room.phase !== 'playing' || mg.phase !== 'play') return err('La partie n’est pas en cours.');
  const who = mg.ids.indexOf(actor.id);
  if (who !== mg.turn) return err('Ce n’est pas ton tour.');
  const me = mg.players[who];
  const foe = mg.players[1 - who];

  if (type === 'play') {
    const idx = me.hand.findIndex((c) => c.uid === payload.uid);
    if (idx === -1) return err('Cette carte n’est pas dans ta main.');
    const [card] = me.hand.splice(idx, 1);
    const def = BY_ID[card.id];
    if (def.type === 'champion') {
      me.champions.push({ ...card, tapped: false, damage: 0 });
      say(mg, `${actor.name} pose ${def.name}.`);
      return ok();
    }
    const allied = def.ally && factionInPlay(me, def.faction, card.uid);
    me.played.push(card);
    applyFx(mg, who, def.fx, def.name);
    if (allied) applyFx(mg, who, def.ally, `${def.name} (alliance)`);
    checkEnd(room);
    return ok();
  }

  if (type === 'activate') {
    const champ = me.champions.find((c) => c.uid === payload.uid);
    if (!champ) return err('Ce champion n’est pas en jeu.');
    if (champ.tapped) return err('Ce champion a déjà été activé ce tour.');
    champ.tapped = true;
    const def = BY_ID[champ.id];
    applyFx(mg, who, def.act, def.name);
    checkEnd(room);
    return ok();
  }

  if (type === 'buy') {
    const index = payload.index;
    const card = mg.market[index];
    if (!Number.isInteger(index) || !card) return err('Carte inconnue.');
    const def = BY_ID[card.id];
    if (mg.pool.g < def.cost) return err(`Il te manque ${def.cost - mg.pool.g} or.`);
    mg.pool.g -= def.cost;
    me.discard.push(card);
    if (mg.marketDeck.length > 0) mg.market[index] = mg.marketDeck.pop();
    else mg.market.splice(index, 1);
    say(mg, `${actor.name} achète ${def.name}.`);
    return ok();
  }

  if (type === 'attack') {
    const guards = foe.champions.filter((c) => BY_ID[c.id].garde);
    if (payload.target === 'player') {
      if (guards.length > 0) return err('Un champion « garde » protège ton adversaire : attaque-le d’abord.');
      const amount = Math.min(mg.pool.a, Number.isInteger(payload.amount) && payload.amount > 0 ? payload.amount : mg.pool.a);
      if (amount < 1) return err('Tu n’as pas de points d’attaque.');
      mg.pool.a -= amount;
      mg.life[1 - who] -= amount;
      say(mg, `${actor.name} attaque : -${amount} vie.`);
      checkEnd(room);
      return ok();
    }
    const champ = foe.champions.find((c) => c.uid === payload.target);
    if (!champ) return err('Cible inconnue.');
    const def = BY_ID[champ.id];
    if (guards.length > 0 && !def.garde) return err('Tu dois attaquer les champions « garde » en premier.');
    if (mg.pool.a < def.def) return err(`Il faut ${def.def} d’attaque pour vaincre ${def.name}.`);
    mg.pool.a -= def.def;
    foe.champions.splice(foe.champions.indexOf(champ), 1);
    foe.discard.push({ uid: champ.uid, id: champ.id });
    say(mg, `${actor.name} vainc ${def.name}.`);
    return ok();
  }

  if (type === 'endTurn') {
    me.discard.push(...me.hand, ...me.played);
    me.hand = [];
    me.played = [];
    for (const c of me.champions) c.tapped = false;
    draw(me, HAND);
    mg.pool = { g: 0, a: 0 };
    mg.turns += 1;
    mg.turn = 1 - mg.turn;
    checkEnd(room);
    return ok();
  }

  return err('Action inconnue.');
}

const show = (c) => ({ uid: c.uid, id: c.id });

function view(room, playerId) {
  const mg = room.mg;
  const mine = mg.ids.indexOf(playerId);
  const me = mg.players[mine === -1 ? 0 : mine];
  const foe = mg.players[mine === 0 ? 1 : 0];
  return {
    phase: mg.phase,
    ids: mg.ids,
    mine,
    turn: mg.turn,
    turns: mg.turns,
    maxTurns: MAX_TURNS,
    life: mg.life,
    pool: mg.pool,
    hand: me.hand.map(show),
    champions: me.champions.map((c) => ({ ...show(c), tapped: c.tapped })),
    played: me.played.map(show),
    foeChampions: foe.champions.map((c) => ({ ...show(c), tapped: c.tapped })),
    foePlayed: foe.played.map(show),
    counts: { deck: me.deck.length, discard: me.discard.length, foeHand: foe.hand.length, foeDeck: foe.deck.length },
    market: mg.market.map(show),
    marketLeft: mg.marketDeck.length,
    log: mg.log,
    winner: mg.winner,
    reason: mg.reason,
  };
}

module.exports = { meta, init, act, view, MAX_TURNS };
