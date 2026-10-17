'use strict';

/**
 * Taboo : deux équipes. Le descripteur fait deviner un mot à son équipe en 60 secondes,
 * sans prononcer le mot ni les 5 mots interdits. L'équipe adverse surveille : au moindre mot interdit,
 * elle appuie sur « Interdit ! » (−1 point). Trouvé : +1 point. La carte n'est visible que du descripteur
 * et de l'équipe adverse, jamais de ses coéquipiers.
 */

const { ok, err, shuffle } = require('../common');
const { TABOO_CARDS } = require('./content2');

const SECONDS = 60;
const GRACE_MS = 1500;
const MAX_TURNS = 8;

const meta = {
  id: 'taboo',
  label: 'Taboo',
  emoji: '🚫',
  tagline: 'Fais deviner le mot sans dire les mots interdits.',
  min: 4,
  max: 13,
  minutes: '15',
  maxMinutes: 20,
  rules: [
    'Deux équipes. À chaque tour, un descripteur voit un mot et 5 mots interdits : il a 60 secondes pour le faire deviner à son équipe.',
    'Il ne peut dire ni le mot, ni les mots interdits, ni faire de mime ou d’initiale.',
    'Mot trouvé : +1 point. Si l’équipe adverse l’entend dire un mot interdit, elle appuie sur « Interdit ! » : −1 point.',
    'Les coéquipiers du descripteur ne voient pas la carte. Chaque équipe joue à tour de rôle.',
  ],
};

function init(room) {
  const ids = shuffle(room.players.map((p) => p.id));
  const teams = { A: [], B: [] };
  ids.forEach((id, i) => teams[i % 2 === 0 ? 'A' : 'B'].push(id));
  const totalTurns = Math.min(MAX_TURNS, 2 * Math.ceil(ids.length / 2));
  const describers = Array.from({ length: totalTurns }, (_, i) => {
    const team = i % 2 === 0 ? 'A' : 'B';
    return { team, id: teams[team][Math.floor(i / 2) % teams[team].length] };
  });
  room.mg = {
    teams,
    describers,
    totalTurns,
    turn: 1,
    phase: 'ready',
    deck: shuffle(TABOO_CARDS),
    cardIndex: 0,
    deadline: null,
    log: [],
    scores: { A: 0, B: 0 },
  };
}

const current = (mg) => mg.describers[mg.turn - 1];
const teamOf = (mg, id) => (mg.teams.A.includes(id) ? 'A' : 'B');
const card = (mg) => mg.deck[mg.cardIndex % mg.deck.length];

function act(room, actor, type) {
  const mg = room.mg;
  if (room.phase !== 'playing') return err('La partie n’est pas en cours.');
  const { team, id: describerId } = current(mg);

  if (type === 'start') {
    if (mg.phase !== 'ready') return err('Ce n’est pas le moment.');
    if (actor.id !== describerId && actor.id !== room.hostId) return err('Seul le descripteur ou l’hôte peut lancer le tour.');
    mg.phase = 'turn';
    mg.deadline = Date.now() + SECONDS * 1000;
    mg.log = [];
    return ok();
  }

  if (type === 'found' || type === 'pass') {
    if (mg.phase !== 'turn') return err('Ce n’est pas le moment.');
    if (actor.id !== describerId) return err('Seul le descripteur peut faire ça.');
    if (Date.now() > mg.deadline + GRACE_MS) return err('Le temps est écoulé.');
    mg.log.push({ word: card(mg)[0], outcome: type });
    if (type === 'found') mg.scores[team] += 1;
    mg.cardIndex += 1;
    return ok();
  }

  if (type === 'taboo') {
    if (mg.phase !== 'turn') return err('Ce n’est pas le moment.');
    if (teamOf(mg, actor.id) === team) return err('Seule l’équipe adverse peut dire « Interdit ! ».');
    if (Date.now() > mg.deadline + GRACE_MS) return err('Le temps est écoulé.');
    mg.log.push({ word: card(mg)[0], outcome: 'taboo' });
    mg.scores[team] -= 1;
    mg.cardIndex += 1;
    return ok();
  }

  // N'importe qui peut clore le tour, mais seulement une fois le temps réellement écoulé.
  if (type === 'timeup') {
    if (mg.phase !== 'turn') return err('Ce n’est pas le moment.');
    if (Date.now() < mg.deadline) return err('Le temps n’est pas écoulé.');
    mg.phase = 'result';
    return ok();
  }

  if (actor.id !== room.hostId) return err('Seul l’hôte peut faire ça.');

  if (type === 'force') {
    if (mg.phase !== 'turn') return err('Ce n’est pas le moment.');
    mg.phase = 'result';
    return ok();
  }

  if (type === 'next') {
    if (mg.phase !== 'result') return err('Ce n’est pas le moment.');
    if (mg.turn >= mg.totalTurns) {
      mg.phase = 'end';
      room.phase = 'end';
      return ok();
    }
    mg.turn += 1;
    mg.phase = 'ready';
    mg.deadline = null;
    mg.log = [];
    return ok();
  }

  return err('Action inconnue.');
}

function view(room, playerId) {
  const mg = room.mg;
  const { team, id: describerId } = current(mg);
  const myTeam = teamOf(mg, playerId);
  // La carte n'est visible que du descripteur et de l'équipe adverse (qui surveille les mots interdits).
  const canSee = mg.phase === 'turn' && (playerId === describerId || myTeam !== team);
  const [word, forbidden] = card(mg);
  return {
    phase: mg.phase,
    turn: mg.turn,
    totalTurns: mg.totalTurns,
    team,
    describerId,
    teams: mg.teams,
    myTeam,
    isDescriber: playerId === describerId,
    scores: mg.scores,
    card: canSee ? { word, forbidden } : null,
    deadline: mg.phase === 'turn' ? mg.deadline : null,
    serverNow: Date.now(),
    seconds: SECONDS,
    foundCount: mg.log.filter((l) => l.outcome === 'found').length,
    log: mg.phase === 'result' || mg.phase === 'end' ? mg.log : [],
  };
}

module.exports = { meta, init, act, view };
