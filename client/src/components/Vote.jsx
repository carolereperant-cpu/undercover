import { useState } from 'react';
import SecretCard from './SecretCard.jsx';
import SeatPicker from './SeatPicker.jsx';
import DetectivePanel from './DetectivePanel.jsx';
import { buildSeats, withSeat } from '../seats.js';

export default function Vote({ state, act }) {
  const { players, meId, hostId, vote } = state;
  const isHost = meId === hostId;
  const alive = players.filter((p) => p.alive);

  // Les joueurs de cet écran qui peuvent encore voter.
  const seats = buildSeats(state).filter((s) => s.me && s.me.alive);
  const [seatId, setSeatId] = useState(meId);
  const seat = seats.find((s) => s.id === seatId) ?? seats[0];
  const shared = seats.length > 1;

  // Au second tour, seuls les ex æquo peuvent recevoir des voix.
  const targets = seat
    ? alive.filter((p) => p.id !== seat.id && (!vote.candidates || vote.candidates.includes(p.id)))
    : [];

  const castVote = async (targetId) => {
    const res = await act('player:vote', withSeat(seat, { targetId }));
    if (res.ok && shared) {
      // On passe au prochain joueur de l'écran qui n'a pas encore voté.
      const next = seats.find((s) => s.id !== seat.id && !s.myVote);
      if (next) setSeatId(next.id);
    }
  };

  return (
    <div className="stack">
      <h1 className="display">{shared && seat ? `${seat.name}, qui est l’infiltré ?` : 'Qui est l’infiltré ?'}</h1>

      {vote.tiebreak && (
        <p className="notice">Égalité ! Nouveau vote : seuls les joueurs ex æquo peuvent recevoir des voix.</p>
      )}

      <SeatPicker seats={seats} current={seat ? seat.id : ''} onChange={setSeatId} done={(s) => Boolean(s.myVote)} label="Qui vote ?" />

      {seat ? (
        <>
          <div className="vote-list" role="radiogroup" aria-label={`Vote de ${seat.name}`}>
            {targets.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={seat.myVote === p.id}
                className={`vote-btn ${seat.myVote === p.id ? 'on' : ''}`}
                onClick={() => castVote(p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>
          <p className="muted">
            {seat.myVote ? 'Vote enregistré. Tu peux encore changer d’avis.' : 'Touche un nom pour voter.'}
          </p>
        </>
      ) : (
        <p className="status">Tu es éliminé : tu ne votes plus, mais tu regardes.</p>
      )}

      <section className="stack tight">
        <h2>
          {vote.voted} vote{vote.voted > 1 ? 's' : ''} sur {vote.total}
        </h2>
        <ul className="chips">
          {alive.map((p) => (
            <li key={p.id} className={`chip static ${p.voted ? 'on' : ''}`}>
              {p.voted ? '✓ ' : ''}
              {p.name}
            </li>
          ))}
        </ul>
      </section>

      {seat && (
        <>
          <DetectivePanel key={`d-${seat.id}`} seat={seat} players={players} act={act} />
          <SecretCard key={seat.id} me={seat.me} compact />
        </>
      )}

      {isHost && (
        <button type="button" className="btn ghost" onClick={() => act('host:closeVote')}>
          Clôturer le vote maintenant
        </button>
      )}
    </div>
  );
}
