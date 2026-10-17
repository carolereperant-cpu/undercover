import { useState } from 'react';

/** Pouvoir du Détective : comparer son mot avec celui d'un autre joueur, une seule fois. */
export default function DetectivePanel({ state, act }) {
  const { me, players, meId } = state;
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!me || me.role !== 'detective') return null;

  if (me.investigation) {
    const { targetName, same } = me.investigation;
    return (
      <section className="panel">
        <h2>Ton enquête</h2>
        <p>
          <strong>{targetName}</strong> {same ? 'a le même mot que toi.' : 'n’a pas le même mot que toi.'}
        </p>
      </section>
    );
  }

  if (!me.canInvestigate) return null;

  const candidates = players.filter((p) => p.alive && p.id !== meId);

  const run = async () => {
    setBusy(true);
    await act('detective:investigate', { targetId: target });
    setBusy(false);
  };

  return (
    <section className="panel">
      <h2>Mène ton enquête</h2>
      <p className="muted">Une seule fois par partie : choisis un joueur pour savoir s’il a le même mot que toi.</p>
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
        Comparer nos mots
      </button>
    </section>
  );
}
