'use strict';

/**
 * « Les Quatre Couronnes » : cartes d'un jeu de deck-building 100 % original.
 * Les données sont dans couronnes-cards.json (lu aussi par l'interface, pour afficher les cartes).
 *
 * Effets (clés courtes) : g = or, a = attaque, h = soin, d = cartes à piocher,
 * x = cartes que l'adversaire défausse au hasard.
 * type 'action' : jouée une fois, puis défaussée.
 * type 'champion' : reste en jeu, a une défense `def`, s'active une fois par tour (`act`).
 *   `garde:true` : il doit être attaqué avant tout autre champion et avant le joueur.
 * `ally` : effet bonus si une AUTRE carte de la même faction est déjà en jeu.
 * `prompt` : description à donner à l'outil de génération d'images (Google Flow).
 */

const data = require('./couronnes-cards.json');

const { FACTIONS, STYLE, STARTERS, MARKET } = data;
const ALL = [...STARTERS, ...MARKET];
const BY_ID = Object.fromEntries(ALL.map((c) => [c.id, c]));

module.exports = { FACTIONS, STYLE, STARTERS, MARKET, ALL, BY_ID };
