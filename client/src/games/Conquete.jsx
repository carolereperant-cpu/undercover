import { useEffect, useMemo, useState } from 'react';
import MAP from '../../../server/minigames/conquete-map.json';
import { useSeats, nameOf, EndActions } from './shared.jsx';

// Couleur + symbole : on ne distingue jamais les joueurs par la couleur seule.
const COLORS = ['#e63946', '#2a9d8f', '#f4d35e', '#9b5de5', '#4d96ff', '#f78c40'];
const INK = ['#fff', '#fff', '#1b1433', '#fff', '#fff', '#1b1433'];
const SYMBOLS = ['▲', '●', '■', '◆', '★', '✚'];

const { territories: TERRITORIES, regions: REGIONS, links: LINKS } = MAP;
const BY_ID = Object.fromEntries(TERRITORIES.map((t) => [t.id, t]));
const REGION = Object.fromEntries(REGIONS.map((r) => [r.id, r]));
const NEIGHBORS = Object.fromEntries(TERRITORIES.map((t) => [t.id, []]));
for (const [a, b] of LINKS) {
  NEIGHBORS[a].push(b);
  NEIGHBORS[b].push(a);
}

const RADIUS = 34;

function Dice({ values, tone }) {
  return (
    <span className={`cq-dice ${tone}`}>
      {values.map((v, i) => (
        <b key={i}>{v}</b>
      ))}
    </span>
  );
}

function BattleReport({ players, mg }) {
  const b = mg.lastBattle;
  if (!b) return null;
  const who = nameOf(players, mg.ids[b.who]);
  return (
    <p className="cq-battle" aria-live="polite">
      <strong>{who}</strong> : {BY_ID[b.from].name} → {BY_ID[b.to].name}
      {b.blitz && ' (assaut)'}
      <br />
      <Dice values={b.att} tone="att" /> contre <Dice values={b.def} tone="def" />
      <span className="muted">
        {' '}
        · pertes {b.attLoss} / {b.defLoss}
      </span>
      {b.conquered && <strong> · territoire conquis !</strong>}
    </p>
  );
}

function Stepper({ value, min, max, onChange, label }) {
  return (
    <div className="cq-stepper" role="group" aria-label={label}>
      <button type="button" className="btn secondary" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="Moins">
        −
      </button>
      <strong aria-live="polite">{value}</strong>
      <button type="button" className="btn secondary" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="Plus">
        +
      </button>
    </div>
  );
}

export default function Conquete({ state, act, leave }) {
  const { players } = state;
  const { seats, seat, setSeatId, send, shared } = useSeats(state, act);
  const mg = seat.mg;
  const mine = mg.mine;
  const myTurn = mg.turn === mine && mg.phase !== 'end';

  const [sel, setSel] = useState(null); // territoire sélectionné (renforts) ou d'où l'on attaque
  const [target, setTarget] = useState(null); // territoire visé
  const [fortify, setFortify] = useState(false);
  const [count, setCount] = useState(1);
  const [occupy, setOccupy] = useState(1);
  const [zoom, setZoom] = useState(false);
  const [info, setInfo] = useState(null);

  // Sur un écran partagé, on passe automatiquement au joueur dont c'est le tour.
  useEffect(() => {
    const s = seats.find((x) => x.mg.mine === mg.turn);
    if (s) setSeatId(s.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mg.turn, mg.round]);

  // On repart d'une sélection vide à chaque changement de tour ou de phase.
  useEffect(() => {
    setSel(null);
    setTarget(null);
    setFortify(false);
    setCount(1);
  }, [mg.turn, mg.phase, mine]);

  useEffect(() => {
    setOccupy(1);
    // Une fois le territoire conquis, la cible n'est plus un ennemi : on la désélectionne.
    if (target && !fortify && owner(target) === mine) setTarget(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mg.lastConquest, mg.terr]);

  const nameOfIdx = (i) => nameOf(players, mg.ids[i]);
  const owner = (id) => mg.terr[id].o;
  const armies = (id) => mg.terr[id].a;

  // Territoires mis en valeur selon ce que l'on est en train de faire.
  const hints = useMemo(() => {
    const set = new Set();
    if (!myTurn || mg.phase !== 'attack' || !sel) return set;
    for (const n of NEIGHBORS[sel]) {
      if (fortify ? owner(n) === mine : owner(n) !== mine) set.add(n);
    }
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, fortify, myTurn, mg.phase, mg.terr]);

  const tap = (id) => {
    setInfo(id);
    if (!myTurn) return;
    if (mg.phase === 'reinforce') {
      if (owner(id) === mine) setSel(id);
      return;
    }
    if (fortify) {
      if (owner(id) !== mine) return;
      if (!sel || id === sel || !NEIGHBORS[sel].includes(id)) {
        setSel(id);
        setTarget(null);
      } else {
        setTarget(id);
        setCount(Math.max(1, Math.min(count, armies(sel) - 1)));
      }
      return;
    }
    if (owner(id) === mine) {
      setSel(id);
      setTarget(null);
    } else if (sel && NEIGHBORS[sel].includes(id)) {
      setTarget(id);
    }
  };

  // --- Fin de partie ------------------------------------------------------
  if (mg.phase === 'end') {
    const win = mg.winner === null ? null : mg.ids[mg.winner];
    return (
      <div className="stack">
        <h1 className="display">{win === null ? 'Égalité !' : `${nameOf(players, win)} règne sur Aldoria !`}</h1>
        <p className="lead">{mg.reason === 'ko' ? 'Tous les adversaires sont éliminés.' : `Après ${mg.maxRounds} tours de table, le plus grand territoire l’emporte.`}</p>
        <ol className="ranking">
          {mg.ranking.map((r) => {
            const idx = mg.ids.indexOf(r.id);
            return (
              <li key={r.id}>
                <span className="name">
                  <span style={{ color: COLORS[idx] }}>{SYMBOLS[idx]}</span> {nameOf(players, r.id)}
                </span>
                <strong>
                  {r.territories} terr. · {r.armies} armées
                </strong>
              </li>
            );
          })}
        </ol>
        <EndActions state={state} act={act} leave={leave} />
      </div>
    );
  }

  const sCount = sel ? armies(sel) : 0;
  const maxDice = sel ? Math.min(3, sCount - 1) : 0;
  const canAttack = myTurn && mg.phase === 'attack' && !fortify && sel && owner(sel) === mine && target && owner(target) !== mine && maxDice >= 1;
  const lc = myTurn ? mg.lastConquest : null;
  const regionHolder = (r) => {
    const ids = TERRITORIES.filter((t) => t.region === r.id).map((t) => owner(t.id));
    return ids.every((o) => o === ids[0]) ? ids[0] : null;
  };

  return (
    <div className="stack tight">
      {shared && (
        <div className="seat-switch" role="group" aria-label="Qui joue ?">
          {seats.map((s) => (
            <button key={s.id} type="button" className={`chip ${s.id === seat.id ? 'on' : ''}`} onClick={() => setSeatId(s.id)}>
              {s.name}
            </button>
          ))}
        </div>
      )}

      <ul className="cq-players" aria-label="Joueurs">
        {mg.ids.map((id, i) => (
          <li key={id} className={`${mg.turn === i ? 'on' : ''} ${mg.alive[i] ? '' : 'out'}`}>
            <span className="cq-badge" style={{ background: COLORS[i], color: INK[i] }} aria-hidden="true">
              {SYMBOLS[i]}
            </span>
            <span className="cq-pname">
              {nameOf(players, id)}
              {i === mine && ' (toi)'}
            </span>
            {mg.alive[i] ? (
              <span className="muted">
                {mg.scores[i].territories} terr. · {mg.scores[i].armies} 🛡️ · +{mg.scores[i].income}
              </span>
            ) : (
              <span className="muted">éliminé</span>
            )}
          </li>
        ))}
      </ul>

      <p className="cq-turn" aria-live="polite">
        <span className="tag">
          Tour de table {mg.round}/{mg.maxRounds}
        </span>{' '}
        {myTurn ? (
          <strong>
            {mg.phase === 'reinforce' ? `À toi : place tes ${mg.pending} renfort${mg.pending > 1 ? 's' : ''}.` : 'À toi : attaque, ou termine ton tour.'}
          </strong>
        ) : (
          <span>
            {nameOfIdx(mg.turn)} joue…
          </span>
        )}
      </p>

      <div className={`cq-mapwrap ${zoom ? 'zoom' : ''}`}>
        <svg viewBox={`0 0 ${MAP.width} ${MAP.height}`} className="cq-map" role="group" aria-label="Carte d’Aldoria">
          <g>
            {TERRITORIES.map((t) => (
              <circle key={t.id} cx={t.x} cy={t.y} r={78} fill={REGION[t.region].color} opacity="0.2" />
            ))}
          </g>
          <g stroke="currentColor" strokeOpacity="0.45" strokeWidth="3">
            {LINKS.map(([a, b]) => (
              <line key={`${a}-${b}`} x1={BY_ID[a].x} y1={BY_ID[a].y} x2={BY_ID[b].x} y2={BY_ID[b].y} />
            ))}
          </g>
          {TERRITORIES.map((t) => {
            const o = owner(t.id);
            const isSel = sel === t.id || target === t.id;
            const hint = hints.has(t.id);
            const label = `${t.name}, ${nameOfIdx(o)}, ${armies(t.id)} armée${armies(t.id) > 1 ? 's' : ''}`;
            return (
              <g
                key={t.id}
                className={`cq-node ${hint ? 'hint' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={label}
                aria-pressed={isSel}
                onClick={() => tap(t.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    tap(t.id);
                  }
                }}
              >
                {hint && <circle cx={t.x} cy={t.y} r={RADIUS + 9} className="cq-ring" />}
                <circle cx={t.x} cy={t.y} r={RADIUS} fill={COLORS[o]} stroke={isSel ? '#fff' : 'rgba(0,0,0,.55)'} strokeWidth={isSel ? 6 : 3} />
                <text x={t.x} y={t.y + 9} textAnchor="middle" className="cq-army" fill={INK[o]}>
                  {armies(t.id)}
                </text>
                <text x={t.x} y={t.y - 14} textAnchor="middle" className="cq-sym" fill={INK[o]} aria-hidden="true">
                  {SYMBOLS[o]}
                </text>
                <text x={t.x} y={t.y + RADIUS + 18} textAnchor="middle" className="cq-name" aria-hidden="true">
                  {t.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <button type="button" className="mini-btn" onClick={() => setZoom(!zoom)}>
        {zoom ? '🔍 Carte entière' : '🔍 Agrandir la carte'}
      </button>

      <BattleReport players={players} mg={mg} />

      {info && !myTurn && (
        <p className="muted">
          {BY_ID[info].name} ({REGION[BY_ID[info].region].name}) : {nameOfIdx(owner(info))}, {armies(info)} armée{armies(info) > 1 ? 's' : ''}.
        </p>
      )}

      {myTurn && mg.phase === 'reinforce' && (
        <section className="panel stack tight">
          <h2>
            Renforts : {mg.pending}
          </h2>
          <p className="muted">{sel ? `${BY_ID[sel].name} : ${armies(sel)} armée${armies(sel) > 1 ? 's' : ''}. Combien en ajouter ?` : 'Touche un de tes territoires sur la carte.'}</p>
          <div className="cq-actions">
            <button type="button" className="btn secondary" disabled={!sel} onClick={() => send('place', { territory: sel, count: 1 })}>
              +1
            </button>
            {mg.pending >= 3 && (
              <button type="button" className="btn secondary" disabled={!sel} onClick={() => send('place', { territory: sel, count: 3 })}>
                +3
              </button>
            )}
            <button type="button" className="btn primary" disabled={!sel} onClick={() => send('place', { territory: sel, count: mg.pending })}>
              Tout ici ({mg.pending})
            </button>
          </div>
        </section>
      )}

      {myTurn && mg.phase === 'attack' && (
        <section className="panel stack tight">
          {lc && (
            <div className="cq-occupy">
              <p>
                <strong>{BY_ID[lc.to].name}</strong> est à toi. Amener d’autres armées depuis {BY_ID[lc.from].name} ?
              </p>
              <Stepper value={occupy} min={1} max={Math.max(1, armies(lc.from) - 1)} onChange={setOccupy} label="Armées à amener" />
              <button type="button" className="btn secondary" disabled={armies(lc.from) < 2} onClick={() => send('occupy', { count: occupy })}>
                Amener {occupy}
              </button>
            </div>
          )}

          {!fortify ? (
            <>
              <h2>Attaquer</h2>
              <p className="muted">
                {!sel
                  ? 'Touche un de tes territoires (2 armées ou plus), puis un territoire voisin ennemi.'
                  : !target
                    ? `${BY_ID[sel].name} (${sCount}) : touche un voisin ennemi en surbrillance.`
                    : `${BY_ID[sel].name} (${sCount}) → ${BY_ID[target].name} (${armies(target)})`}
              </p>
              <div className="cq-actions">
                {[1, 2, 3].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="btn secondary"
                    disabled={!canAttack || d > maxDice}
                    onClick={() => send('attack', { from: sel, to: target, dice: d })}
                  >
                    🎲 {d}
                  </button>
                ))}
                <button type="button" className="btn danger" disabled={!canAttack} onClick={() => send('blitz', { from: sel, to: target })}>
                  ⚔️ Assaut
                </button>
              </div>
              <div className="cq-actions">
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setFortify(true);
                    setSel(null);
                    setTarget(null);
                  }}
                >
                  Fortifier…
                </button>
                <button type="button" className="btn primary" onClick={() => send('endTurn')}>
                  Terminer le tour
                </button>
              </div>
            </>
          ) : (
            <>
              <h2>Fortifier</h2>
              <p className="muted">
                {!sel ? 'Touche le territoire de départ.' : !target ? `${BY_ID[sel].name} : touche un voisin à toi.` : `${BY_ID[sel].name} → ${BY_ID[target].name}`}
              </p>
              {sel && target && (
                <>
                  <Stepper value={Math.min(count, armies(sel) - 1)} min={1} max={Math.max(1, armies(sel) - 1)} onChange={setCount} label="Armées à déplacer" />
                  <button type="button" className="btn primary" disabled={armies(sel) < 2} onClick={() => send('fortify', { from: sel, to: target, count: Math.min(count, armies(sel) - 1) })}>
                    Déplacer et finir le tour
                  </button>
                </>
              )}
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setFortify(false);
                  setSel(null);
                  setTarget(null);
                }}
              >
                Annuler
              </button>
            </>
          )}
        </section>
      )}

      <section className="stack tight">
        <h2>Régions</h2>
        <ul className="cq-regions">
          {REGIONS.map((r) => {
            const holder = regionHolder(r);
            return (
              <li key={r.id}>
                <span className="cq-swatch" style={{ background: r.color }} aria-hidden="true" />
                <span>{r.name}</span>
                <span className="muted">
                  bonus +{r.bonus}
                  {holder !== null && ` · ${SYMBOLS[holder]} ${nameOfIdx(holder)}`}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {mg.log.length > 0 && (
        <ul className="feed" aria-label="Journal">
          {[...mg.log].reverse().map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
