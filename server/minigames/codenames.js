'use strict';

/**
 * Codenames : deux équipes (rouge et bleue), chacune avec un chef d'espions qui connaît la couleur
 * de chacune des 25 cartes. Il donne un indice (un mot + un nombre) pour faire trouver les cartes de
 * son équipe. Attention à la carte « assassin » : la révéler fait perdre immédiatement !
 */

const { ok, err, shuffle, cleanText, wordKey } = require('../common');
const { JUST_ONE_WORDS, DRAW_WORDS } = require('./content');
const { CODE_EXTRA_WORDS } = require('./content2');

const other = (team) => (team === 'rouge' ? 'bleu' : 'rouge');

const meta = {
  id: 'codenames',
  label: 'Codenames',
  emoji: '🕶️',
  tagline: 'Deux chefs d’espions, 25 mots, un assassin à éviter.',
  min: 4,
  max: 12,
  minutes: '15 à 20',
  maxMinutes: 20,
  rules: [
    'Deux équipes, rouge et bleue. Chacune a un chef d’espions qui voit la couleur de toutes les cartes.',
    'À son tour, le chef donne un indice d’un seul mot et un nombre : ce nombre de cartes de son équipe sont liées à l’indice.',
    'Ses équipiers touchent les cartes qu’ils pensent liées à l’indice. Une carte de son équipe : on continue. Autre couleur : le tour s’arrête.',
    'La carte noire est l’assassin : la révéler fait perdre aussitôt. La première équipe à trouver toutes ses cartes gagne.',
  ],
};

/** Tous les mots possibles, sans doublon (ni accent ni majuscule). */
function wordPool() {
  const seen = new Set();
  const out = [];
  for (const w of [...JUST_ONE_WORDS, ...DRAW_WORDS, ...CODE_EXTRA_WORDS]) {
    const k = wordKey(w);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(w);
    }
  }
  return out;
}

function init(room) {
  const ids = shuffle(room.players.map((p) => p.id));
  const teams = { rouge: [], bleu: [] };
  ids.forEach((id, i) => teams[i % 2 === 0 ? 'rouge' : 'bleu'].push(id));
  const startTeam = shuffle(['rouge', 'bleu'])[0];
  const colors = shuffle([
    ...Array(9).fill(startTeam),
    ...Array(8).fill(other(startTeam)),
    ...Array(7).fill('neutre'),
    'assassin',
  ]);
  const words = shuffle(wordPool()).slice(0, 25);
  room.mg = {
    teams,
    spymasters: { rouge: teams.rouge[0], bleu: teams.bleu[0] },
    startTeam,
    board: words.map((word, i) => ({ word, color: colors[i], revealed: false })),
    turn: startTeam,
    phase: 'clue',
    clue: null,
    guessesLeft: 0,
    guessedThisTurn: 0,
    winner: null,
    reason: null,
    log: [],
  };
}

const remaining = (mg, team) => mg.board.filter((c) => c.color === team && !c.revealed).length;
const teamOf = (mg, id) => (mg.teams.rouge.includes(id) ? 'rouge' : 'bleu');

function endTurn(mg) {
  mg.turn = other(mg.turn);
  mg.phase = 'clue';
  mg.clue = null;
  mg.guessesLeft = 0;
  mg.guessedThisTurn = 0;
}

function finish(room, winner, reason) {
  room.mg.winner = winner;
  room.mg.reason = reason;
  room.mg.phase = 'end';
  room.phase = 'end';
}

function act(room, actor, type, payload) {
  const mg = room.mg;
  if (room.phase !== 'playing') return err('La partie n’est pas en cours.');
  const team = mg.turn;
  const isSpy = actor.id === mg.spymasters[teamOf(mg, actor.id)];

  if (type === 'clue') {
    if (mg.phase !== 'clue') return err('Ce n’est pas le moment de donner un indice.');
    if (actor.id !== mg.spymasters[team]) return err(`Seul le chef d’espions de l’équipe ${team} donne l’indice.`);
    const word = cleanText(payload.word, 25);
    const number = payload.number;
    if (!word) return err('Écris un indice.');
    if (word.includes(' ')) return err('Un seul mot, pas une phrase !');
    if (!Number.isInteger(number) || number < 1 || number > 9) return err('Le nombre doit être entre 1 et 9.');
    const kc = wordKey(word);
    for (const c of mg.board) {
      const kw = wordKey(c.word);
      if (!c.revealed && kc.length >= 3 && (kw.includes(kc) || kc.includes(kw))) return err(`L’indice ne peut pas être un mot de la grille (« ${c.word} »).`);
    }
    mg.clue = { word, number };
    mg.guessesLeft = number + 1;
    mg.guessedThisTurn = 0;
    mg.phase = 'guess';
    mg.log.push({ team, clue: word, number, picks: [] });
    return ok();
  }

  if (type === 'guess') {
    if (mg.phase !== 'guess') return err('Ce n’est pas le moment de deviner.');
    if (teamOf(mg, actor.id) !== team || isSpy) return err('Seuls les équipiers (pas le chef) de l’équipe qui joue peuvent deviner.');
    const card = mg.board[payload.index];
    if (!card) return err('Carte invalide.');
    if (card.revealed) return err('Cette carte est déjà retournée.');
    card.revealed = true;
    mg.guessedThisTurn += 1;
    mg.guessesLeft -= 1;
    mg.log[mg.log.length - 1].picks.push({ word: card.word, color: card.color });
    if (card.color === 'assassin') return finish(room, other(team), 'assassin'), ok();
    if (remaining(mg, 'rouge') === 0) return finish(room, 'rouge', 'cartes'), ok();
    if (remaining(mg, 'bleu') === 0) return finish(room, 'bleu', 'cartes'), ok();
    if (card.color !== team || mg.guessesLeft <= 0) endTurn(mg);
    return ok();
  }

  if (type === 'endTurn') {
    if (mg.phase !== 'guess') return err('Ce n’est pas le moment.');
    if (teamOf(mg, actor.id) !== team || isSpy) return err('Seuls les équipiers de l’équipe qui joue peuvent arrêter le tour.');
    if (mg.guessedThisTurn < 1) return err('Retourne au moins une carte avant d’arrêter.');
    endTurn(mg);
    return ok();
  }

  if (actor.id !== room.hostId) return err('Seul l’hôte peut faire ça.');

  if (type === 'pass') {
    if (mg.phase === 'end') return err('La partie est terminée.');
    endTurn(mg);
    return ok();
  }

  return err('Action inconnue.');
}

function view(room, playerId) {
  const mg = room.mg;
  const myTeam = teamOf(mg, playerId);
  const isSpy = playerId === mg.spymasters[myTeam];
  const over = mg.phase === 'end';
  return {
    phase: mg.phase,
    turn: mg.turn,
    myTeam,
    isSpymaster: isSpy,
    teams: mg.teams,
    spymasters: mg.spymasters,
    // Seuls les chefs d'espions (et tout le monde à la fin) voient les couleurs des cartes cachées.
    board: mg.board.map((c, index) => ({
      index,
      word: c.word,
      revealed: c.revealed,
      color: c.revealed || isSpy || over ? c.color : null,
    })),
    clue: mg.clue,
    guessesLeft: mg.guessesLeft,
    guessedThisTurn: mg.guessedThisTurn,
    remaining: { rouge: remaining(mg, 'rouge'), bleu: remaining(mg, 'bleu') },
    winner: mg.winner,
    reason: mg.reason,
    log: mg.log,
  };
}

module.exports = { meta, init, act, view, wordPool };
