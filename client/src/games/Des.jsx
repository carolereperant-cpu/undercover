import { useState } from 'react';
import { Seats, useSeats, HoldReveal, HostButton, nameOf, EndActions } from './shared.jsx';

const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const Dice = ({ values }) => (
  <span className="dice" aria-label={`Dés : ${values.join(', ')}`}>
    {values.map((v, i) => (
      <span key={i}>{FACES[v - 1]}</span>
    ))}
  </span>
);

export default function Des({ state, act, leave }) {
  const { players } = state;
  const { seats, seat, setSeatId, send, sendHost } = useSeats(state, act);
  const mg = state.mg;
  const mine = seat.mg;
  const [qty, setQty] = useState(1);
  const [face, setFace] = useState(1);
  const turn = nameOf(players, mg.turnId);
  const myTurn = mg.turnId === seat.id && mg.phase === 'bid';

  const counts = (
    <ul className="chips">
      {mg.order.map((id) => (
        <li key={id} className={`chip static ${id === mg.turnId && mg.phase === 'bid' ? 'on' : ''} ${mg.counts[id] === 0 ? 'out' : ''}`}>
          {nameOf(players, id)} : {mg.counts[id]} 🎲
        </li>
      ))}
    </ul>
  );

  if (mg.phase === 'end') {
    return (
      <div className="stack">
        <h1 className="display">{mg.winner ? `${nameOf(players, mg.winner)} gagne !` : 'Fin de partie'}</h1>
        {counts}
        <EndActions state={state} act={act} leave={leave} />
      </div>
    );
  }

  if (mg.phase === 'reveal') {
    const r = mg.result;
    return (
      <div className="stack">
        <h1 className="display">« Menteur ! »</h1>
        <p className="lead">
          {nameOf(players, r.challengerId)} conteste le pari de {nameOf(players, r.bid.by)} : au moins {r.bid.qty} dé{r.bid.qty > 1 ? 's' : ''} de{' '}
          <strong>{FACES[r.bid.face - 1]}</strong>. Il y en a <strong>{r.found}</strong>.
        </p>
        <ul className="roster">
          {Object.entries(r.dice).map(([id, values]) => (
            <li key={id}>
              <span className="name">{nameOf(players, id)}</span>
              <Dice values={values} />
            </li>
          ))}
        </ul>
        <p className="status">
          {nameOf(players, r.loserId)} perd un dé{r.eliminated ? ' et est éliminé.' : '.'}
        </p>
        {counts}
        <HostButton state={state} onClick={() => sendHost('next')}>
          Manche suivante
        </HostButton>
        {state.meId !== state.hostId && <p className="muted center">L’hôte lance la manche suivante.</p>}
      </div>
    );
  }

  const bid = mg.bid;
  const submitBid = async () => {
    const res = await send('bid', { qty, face });
    if (res.ok) setQty((q) => q);
  };

  return (
    <div className="stack">
      <p className="muted">
        Manche {mg.round} · {mg.total} dés sur la table
      </p>
      <h1 className="display">{myTurn ? 'À toi de parier.' : `Au tour de ${turn}…`}</h1>
      {counts}
      {bid ? (
        <p className="notice">
          Pari en cours : au moins <strong>{bid.qty}</strong> dé{bid.qty > 1 ? 's' : ''} de <strong>{FACES[bid.face - 1]}</strong> ({nameOf(players, bid.by)})
        </p>
      ) : (
        <p className="muted">Aucun pari pour l’instant.</p>
      )}
      <Seats seats={seats} seat={seat} onChange={setSeatId} done={() => false} label="Qui regarde l’écran ?" />
      {mine.myDice.length > 0 ? (
        <HoldReveal label={`Maintiens pour voir les dés de ${seat.name}`}>
          <Dice values={mine.myDice} />
        </HoldReveal>
      ) : (
        <p className="status">Tu es éliminé : tu regardes la fin de la partie.</p>
      )}
      {myTurn && (
        <section className="stack tight panel">
          <h2>Ton pari</h2>
          <div className="stepper">
            <button type="button" className="icon-btn" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Moins de dés">
              −
            </button>
            <strong>{qty}</strong>
            <button type="button" className="icon-btn" onClick={() => setQty((q) => Math.min(mg.total, q + 1))} aria-label="Plus de dés">
              +
            </button>
            <span className="muted">dé(s) de</span>
          </div>
          <div className="chips" role="radiogroup" aria-label="Valeur du dé">
            {FACES.map((f, i) => (
              <button key={f} type="button" role="radio" aria-checked={face === i + 1} className={`chip big ${face === i + 1 ? 'on' : ''}`} onClick={() => setFace(i + 1)}>
                {f}
              </button>
            ))}
          </div>
          <button type="button" className="btn primary" onClick={submitBid}>
            Parier {qty} × {FACES[face - 1]}
          </button>
          {bid && (
            <button type="button" className="btn secondary" onClick={() => send('liar')}>
              Menteur !
            </button>
          )}
        </section>
      )}
    </div>
  );
}
