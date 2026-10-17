'use strict';

/**
 * Registre des mini-jeux. Chaque mini-jeu est un module qui exporte :
 *   meta      : nom, nombre de joueurs, durée, règles (affiché dans le menu et la salle d'attente)
 *   init(room): prépare room.mg au lancement de la partie
 *   act(room, acteur, type, payload) : applique une action ({ ok } ou { ok:false, error })
 *   view(room, playerId) : ce que CE joueur a le droit de voir
 * Undercover n'est pas ici : il a son propre moteur (game.js), seule sa fiche est listée.
 */

const MINI = {
  susceptible: require('./susceptible'),
  intrus: require('./intrus'),
  telepathie: require('./telepathie'),
  vingtq: require('./vingtq'),
  dictionnaire: require('./dictionnaire'),
  puissance4: require('./puissance4'),
  bataille: require('./bataille'),
  des: require('./des'),
  justone: require('./justone'),
  quiz: require('./quiz'),
  dessin: require('./dessin'),
  telephone: require('./telephone'),
  loupgarou: require('./loupgarou'),
};

const UNDERCOVER_META = {
  id: 'undercover',
  label: 'Undercover',
  emoji: '🎭',
  tagline: 'Un mot pour tous, sauf pour un.',
  min: 3,
  max: 12,
  minutes: '10 à 20',
  maxMinutes: 20,
  rules: [],
};

/** Les fiches de tous les jeux, Undercover en premier. */
const GAMES = [UNDERCOVER_META, ...Object.values(MINI).map((m) => m.meta)];

const metaOf = (id) => GAMES.find((g) => g.id === id) ?? null;

module.exports = { MINI, GAMES, metaOf };
