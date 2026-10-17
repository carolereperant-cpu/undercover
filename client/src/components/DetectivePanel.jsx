import { useState } from 'react';
import { withSeat } from '../seats.js';

/** Pouvoir du Détective : comparer son mot avec celui d'un autre joueur, une seule fois. */
export default function DetectivePanel({ seat, players, act }) {
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const me = seat && seat.me;

  if (!me || me.role !== 'detective') return null;

  if (me.investigation) {
    const { targetName, same } = me.investigation;
    return (
      <section className="panel">
        <h2>{seat.isGuest ? `Enquête de ${seat.name}` : 'Ton enquête'}</h2>
        <p>
          <strong>{targetName}</strong> {same ? 'a le même mot.' : 'n’a pas le même mot.'}
        </p>
      </section>
    );
  }

  if (!me.canInvestigate) return null;

  const candidates = players.filter((p) => p.alive && p.id !== seat.id);

  const run = async () => {
    setBusy(true);
    await act('detective:investigate', withSeat(seat, { targetId: target }));
    setBusy(false);
  };

  return (
    <section className="panel">
      <h2>{seat.isGuest ? `${seat.name} est le Détective` : 'Mène ton enquête'}</h2>
      <p className="muted">Une seule fois par partie : choisis un joueur pour savoir s’il a le même mot.</p>
      <div className="chips">
        {candidates.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`chip ${target === p.id ? 'on' : ''}`}
            onClick={() => setTarget(p.id)}
            aria-pressed={target === p.id}
          >
            {p.name}
          </button>
        ))}
      </div>
      <button type="button" className="btn secondary" disabled={!target || busy} onClick={run}>
        Comparer les mots
      </button>
    </section>
  );
}
