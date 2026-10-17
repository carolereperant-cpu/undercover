'use strict';

/**
 * Petits outils partagés par Undercover (game.js) et par tous les mini-jeux (minigames/).
 * Rien ici ne dépend du réseau : ce sont des fonctions pures, faciles à tester.
 */

const crypto = require('node:crypto');

const ok = (extra = {}) => ({ ok: true, ...extra });
const err = (error) => ({ ok: false, error });

/** Mélange de Fisher-Yates avec un vrai générateur aléatoire (crypto), pas Math.random. */
function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Un élément au hasard dans une liste non vide. */
const pick = (list) => list[crypto.randomInt(list.length)];

// Caractères de contrôle et caractères invisibles (zéro-largeur, séparateurs de ligne…) à supprimer.
const INVISIBLE_CHARS = new RegExp('[\\u0000-\\u001f\\u007f\\u200b-\\u200f\\u2028-\\u202f\\ufeff]', 'g');

/** Nettoie un texte saisi par un joueur : caractères invisibles, espaces multiples, longueur. */
function cleanText(value, max) {
  return String(value ?? '')
    .replace(INVISIBLE_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Clé de comparaison : sans accents, sans majuscules, sans article, sans espaces ni tirets. */
function wordKey(value) {
  let t = String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  t = t.replace(/^(le|la|les|l|un|une|des|du|de la|de l|d) /, '');
  return t.replace(/ /g, '');
}

const stripPlural = (k) => (k.length > 3 ? k.replace(/[sx]$/, '') : k);

/** Deux mots sont considérés identiques à l'accent, à l'article et au pluriel près. */
function sameWord(a, b) {
  const ka = wordKey(a);
  const kb = wordKey(b);
  if (!ka || !kb) return false;
  return ka === kb || stripPlural(ka) === stripPlural(kb);
}

module.exports = { ok, err, shuffle, pick, cleanText, wordKey, sameWord };
