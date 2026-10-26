'use strict';

/**
 * Le bot des Terres d'Aldoria. Il joue avec les mêmes informations qu'un humain (la carte est publique).
 * Stratégie : viser la région qu'il possède le mieux, concentrer ses renforts sur sa frontière,
 * n'attaquer que quand il a l'avantage, puis ramener les armées inutiles vers la frontière.
 */

const { TERRITORIES, REGIONS, NEIGHBORS, territoriesOf } = require('./conquete');

const memberIds = (regionId) => TERRITORIES.filter((t) => t.region === regionId).map((t) => t.id);

/** Région dont le bot possède la plus grande part (la plus proche d'être complétée). */
function targetRegion(mg, who) {
  let best = null;
  let bestShare = -1;
  for (const r of REGIONS) {
    const ids = memberIds(r.id);
    const share = ids.filter((id) => mg.terr[id].owner === who).length / ids.length + r.bonus / 100;
    if (share > bestShare && ids.some((id) => mg.terr[id].owner !== who)) {
      best = r.id;
      bestShare = share;
    }
  }
  return best;
}

const enemyNeighbors = (mg, who, id) => NEIGHBORS[id].filter((n) => mg.terr[n].owner !== who);

function nextMove(room, botId) {
  const mg = room.mg;
  const who = mg.ids.indexOf(botId);
  if (who === -1 || mg.turn !== who || mg.phase === 'end') return null;
  const mine = territoriesOf(mg, who).map((t) => t.id);
  const goal = targetRegion(mg, who);
  const goalOf = (id) => (TERRITORIES.find((t) => t.id === id).region === goal ? 1 : 0);

  // 1. Renforts : sur la frontière, en priorité là où l'on peut attaquer la région visée.
  if (mg.phase === 'reinforce') {
    const border = mine.filter((id) => enemyNeighbors(mg, who, id).length > 0);
    const pool = border.length > 0 ? border : mine;
    const valued = pool.map((id) => {
      const foes = enemyNeighbors(mg, who, id);
      const weakest = foes.length ? Math.min(...foes.map((n) => mg.terr[n].armies)) : 99;
      const goalBonus = foes.some((n) => goalOf(n)) ? 3 : 0;
      return { id, v: goalBonus + mg.terr[id].armies - weakest * 0.5 };
    });
    valued.sort((a, b) => b.v - a.v);
    return { type: 'place', territory: valued[0].id, count: mg.pending };
  }

  // 2. Armées d'occupation en plus après une conquête : on avance tout si le territoire d'origine est à l'abri.
  const lc = mg.lastConquest;
  if (lc) {
    const from = mg.terr[lc.from];
    const stillExposed = enemyNeighbors(mg, who, lc.from).length > 0;
    const extra = stillExposed ? Math.floor((from.armies - 1) / 2) : from.armies - 1;
    const wanted = Math.max(0, extra);
    if (wanted >= 1) return { type: 'occupy', count: wanted };
  }

  // 3. Attaque : on prend le meilleur rapport de forces, avec au moins +2 d'avantage (ou +1 pour finir un joueur).
  let best = null;
  for (const from of mine) {
    const a = mg.terr[from].armies;
    if (a < 2) continue;
    for (const to of enemyNeighbors(mg, who, from)) {
      const d = mg.terr[to].armies;
      const owner = mg.terr[to].owner;
      const lastTerritory = territoriesOf(mg, owner).length === 1;
      const margin = a - d;
      if (margin < (lastTerritory ? 1 : 2)) continue;
      const v = margin + goalOf(to) * 3 + (lastTerritory ? 4 : 0);
      if (!best || v > best.v) best = { from, to, v };
    }
  }
  if (best) return { type: 'blitz', from: best.from, to: best.to };

  // 4. Fortifier : ramener des armées d'un territoire intérieur vers une frontière voisine, puis finir le tour.
  let move = null;
  for (const id of mine) {
    const a = mg.terr[id].armies;
    if (a < 2 || enemyNeighbors(mg, who, id).length > 0) continue;
    const dest = NEIGHBORS[id].find((n) => mg.terr[n].owner === who && enemyNeighbors(mg, who, n).length > 0);
    if (dest && (!move || a > move.a)) move = { a, from: id, to: dest };
  }
  if (move) return { type: 'fortify', from: move.from, to: move.to, count: move.a - 1 };

  return { type: 'endTurn' };
}

module.exports = { nextMove };
