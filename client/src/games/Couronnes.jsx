import { useState } from 'react';
import cards from '../../../server/minigames/couronnes-cards.json';
import { useSeats, nameOf, EndActions } from './shared.jsx';

const { FACTIONS, STARTERS, MARKET } = cards;
const BY_ID = Object.fromEntries([...STARTERS, ...MARKET].map((c) => [c.id, c]));
const EXTS = ['png', 'jpg', 'webp'];

const FX_LABEL = { g: ['🪙', 'or'], a: ['⚔️', 'attaque'], h: ['💚', 'soin'], d: ['🃏', 'pioche'], x: ['✂️', 'défausse adverse'] };
const fxText = (fx) =>
  Object.entries(fx ?? {})
    .map(([k, v]) => `${FX_LABEL[k][0]}${v}`)
    .join(' ');

/** Illustration : ton image dans /cartes/<id>.png (ou .jpg / .webp), sinon un dessin de secours. */
function Art({ id }) {
  const [ext, setExt] = useState(0);
  const faction = FACTIONS[BY_ID[id].faction];
  if (ext >= EXTS.length) {
    return (
      <div className="cc-art cc-fallback" style={{ background: faction.color }} aria-hidden="true">
        <span>{faction.emoji}</span>
      </div>
    );
  }
  return <img className="cc-art" src={`/cartes/${id}.${EXTS[ext]}`} alt="" loading="lazy" onError={() => setExt(ext + 1)} />;
}

function Card({ id, onClick, disabled, tapped, small, extra }) {
  const def = BY_ID[id];
  const faction = FACTIONS[def.faction];
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`cc ${small ? 'small' : ''} ${tapped ? 'tapped' : ''} ${def.garde ? 'garde' : ''}`}
      style={{ '--fc': faction.color }}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      aria-label={`${def.name}${def.cost ? `, coût ${def.cost}` : ''}`}
    >
      <Art id={id} />
      <span className="cc-name">
        {faction.emoji} {def.name}
      </span>
      {def.cost > 0 && <span className="cc-cost">{def.cost}</span>}
      {def.type === 'champion' && (
        <span className="cc-def" title="Défense">
          🛡️{def.def}
          {def.garde ? ' garde' : ''}
        </span>
      )}
      <span className="cc-fx">
        {def.type === 'champion' ? `↻ ${fxText(def.act)}` : fxText(def.fx)}
        {def.ally && <em> · alliance {fxText(def.ally)}</em>}
      </span>
      {extra}
    </Tag>
  );
}

export default function Couronnes({ state, act, leave }) {
  const { players } = state;
  const { seats, seat, setSeatId, send } = useSeats(state, act);
  const mg = seat.mg;
  const myTurn = mg.turn === mg.mine;
  const foeId = mg.ids[1 - mg.mine];
  const [tab, setTab] = useState('hand');

  if (mg.phase === 'end') {
    const win = mg.winner === null ? null : mg.ids[mg.winner];
    return (
      <div className="stack">
        <h1 className="display">{win === null ? 'Égalité !' : `${nameOf(players, win)} gagne !`}</h1>
        <p className="lead">
          {mg.reason === 'ko' ? 'Sa vie est tombée à 0.' : 'Limite de tours atteinte : le plus de vie l’emporte.'} Vie : {nameOf(players, mg.ids[0])} {mg.life[0]} · {nameOf(players, mg.ids[1])} {mg.life[1]}
        </p>
        <EndActions state={state} act={act} leave={leave} />
      </div>
    );
  }

  const playAll = async () => {
    for (const c of mg.hand) await send('play', { uid: c.uid });
  };
  const turnsLeft = Math.ceil((mg.maxTurns - mg.turns) / 2);

  return (
    <div className="stack tight">
      {seats.length > 1 && (
        <div className="seat-switch" role="group" aria-label="Qui joue ?">
          {seats.map((s) => (
            <button key={s.id} type="button" className={`chip ${s.id === seat.id ? 'on' : ''}`} onClick={() => setSeatId(s.id)}>
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div className="cc-bar foe">
        <strong>{nameOf(players, foeId)}</strong>
        <span>❤️ {mg.life[1 - mg.mine]}</span>
        <span>✋ {mg.counts.foeHand}</span>
        <span>📚 {mg.counts.foeDeck}</span>
      </div>
      <div className="cc-row">
        {mg.foeChampions.length === 0 && <p className="muted">Aucun champion adverse.</p>}
        {mg.foeChampions.map((c) => (
          <Card key={c.uid} id={c.id} small tapped={c.tapped} disabled={!myTurn} onClick={() => send('attack', { target: c.uid })} />
        ))}
      </div>

      <div className="cc-bar pool">
        <strong>{myTurn ? 'À toi de jouer' : `Tour de ${nameOf(players, foeId)}`}</strong>
        <span>🪙 {mg.pool.g}</span>
        <span>⚔️ {mg.pool.a}</span>
        <span className="muted">{turnsLeft} tours restants</span>
      </div>

      {myTurn && (
        <div className="cc-actions">
          <button type="button" className="btn danger" disabled={mg.pool.a < 1} onClick={() => send('attack', { target: 'player' })}>
            ⚔️ Attaquer {nameOf(players, foeId)} ({mg.pool.a})
          </button>
          <button type="button" className="btn secondary" disabled={mg.hand.length === 0} onClick={playAll}>
            Tout jouer
          </button>
          <button type="button" className="btn primary" onClick={() => send('endTurn')}>
            Fin du tour
          </button>
        </div>
      )}

      <div className="cc-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'hand'} className={tab === 'hand' ? 'on' : ''} onClick={() => setTab('hand')}>
          Ma main ({mg.hand.length})
        </button>
        <button type="button" role="tab" aria-selected={tab === 'market'} className={tab === 'market' ? 'on' : ''} onClick={() => setTab('market')}>
          Marché
        </button>
      </div>

      {tab === 'market' ? (
        <>
          <div className="cc-row wrap">
            {mg.market.map((c, i) => {
              const def = BY_ID[c.id];
              return <Card key={c.uid} id={c.id} disabled={!myTurn || mg.pool.g < def.cost} onClick={() => send('buy', { index: i })} />;
            })}
          </div>
          <p className="muted center">{mg.marketLeft} cartes restantes dans la pioche du marché. Touche une carte pour l’acheter.</p>
        </>
      ) : (
        <div className="cc-row wrap">
          {mg.hand.length === 0 && <p className="muted">Main vide.</p>}
          {mg.hand.map((c) => (
            <Card key={c.uid} id={c.id} disabled={!myTurn} onClick={() => send('play', { uid: c.uid })} />
          ))}
        </div>
      )}

      <h2>Mes champions</h2>
      <div className="cc-row wrap">
        {mg.champions.length === 0 && <p className="muted">Aucun champion en jeu.</p>}
        {mg.champions.map((c) => (
          <Card key={c.uid} id={c.id} small tapped={c.tapped} disabled={!myTurn || c.tapped} onClick={() => send('activate', { uid: c.uid })} />
        ))}
      </div>
      {mg.played.length > 0 && (
        <p className="muted">Jouées ce tour : {mg.played.map((c) => BY_ID[c.id].name).join(', ')}</p>
      )}
      <p className="scorebar">
        <span>❤️ Moi : <strong>{mg.life[mg.mine]}</strong></span>
        <span>📚 {mg.counts.deck}</span>
        <span>🗑️ {mg.counts.discard}</span>
      </p>
      <details>
        <summary>Journal</summary>
        <ul className="feed">
          {[...mg.log].reverse().map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
