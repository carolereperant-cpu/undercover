'use strict';

/**
 * Le "cerveau" du bot des Quatre Couronnes.
 * Il ne triche pas : il n'utilise que ce qu'un joueur voit (sa main, le marché, les champions adverses).
 * nextMove() renvoie UNE action à la fois ; le serveur l'applique avec les mêmes règles que pour un humain,
 * puis redemande la suivante, jusqu'à la fin du tour.
 */

const { BY_ID } = require('./couronnes-cards');

/** Ordre de jeu de la main : champions d'abord (pour déclencher les alliances), puis pioches, puis le reste. */
function playPriority(def) {
  if (def.type === 'champion') return 0;
  if (def.fx && def.fx.d) return 1;
  return 2;
}

/** Intérêt d'acheter une carte : surtout son coût, un bonus pour les champions et pour sa faction principale. */
function buyScore(def, owned) {
  let score = def.cost;
  if (def.type === 'champion') score += 2;
  if (def.faction !== 'neutre') score += 0.5 * (owned[def.faction] || 0);
  return score;
}

function nextMove(room, botId) {
  const mg = room.mg;
  const who = mg.ids.indexOf(botId);
  if (who === -1 || mg.turn !== who || mg.phase !== 'play') return null;
  const me = mg.players[who];
  const foe = mg.players[1 - who];

  // 1. Jouer toute la main.
  if (me.hand.length > 0) {
    const sorted = [...me.hand].sort((a, b) => playPriority(BY_ID[a.id]) - playPriority(BY_ID[b.id]));
    return { type: 'play', uid: sorted[0].uid };
  }

  // 2. Activer les champions.
  const ready = me.champions.find((c) => !c.tapped);
  if (ready) return { type: 'activate', uid: ready.uid };

  // 3. Attaquer.
  if (mg.pool.a > 0) {
    const guards = foe.champions.filter((c) => BY_ID[c.id].garde);
    if (guards.length > 0) {
      const target = [...guards].sort((a, b) => BY_ID[a.id].def - BY_ID[b.id].def)[0];
      if (mg.pool.a >= BY_ID[target.id].def) return { type: 'attack', target: target.uid };
    } else {
      const foeLife = mg.life[1 - who];
      if (foeLife > mg.pool.a && foeLife > 15) {
        // Pas de coup fatal en vue : on élimine d'abord le champion le plus solide qu'on peut abattre.
        const killable = foe.champions
          .filter((c) => BY_ID[c.id].def <= mg.pool.a)
          .sort((a, b) => BY_ID[b.id].def - BY_ID[a.id].def)[0];
        if (killable) return { type: 'attack', target: killable.uid };
      }
      return { type: 'attack', target: 'player', amount: mg.pool.a };
    }
  }

  // 4. Acheter la meilleure carte possible (on ignore les cartes à 1 or : elles diluent le paquet).
  const owned = {};
  for (const c of [...me.deck, ...me.discard, ...me.hand, ...me.played, ...me.champions]) {
    const f = BY_ID[c.id].faction;
    owned[f] = (owned[f] || 0) + 1;
  }
  let best = -1;
  let bestScore = -Infinity;
  mg.market.forEach((c, i) => {
    const def = BY_ID[c.id];
    if (def.cost < 2 || def.cost > mg.pool.g) return;
    const score = buyScore(def, owned);
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  });
  if (best !== -1) return { type: 'buy', index: best };

  // 5. Rien d'autre à faire.
  return { type: 'endTurn' };
}

module.exports = { nextMove };
