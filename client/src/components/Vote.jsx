import SecretCard from './SecretCard.jsx';
import DetectivePanel from './DetectivePanel.jsx';

export default function Vote({ state, act }) {
  const { me, players, meId, hostId, vote } = state;
  const isHost = meId === hostId;
  const alive = players.filter((p) => p.alive);
  const iCanVote = Boolean(me && me.alive);

  // Au second tour, seuls les ex æquo peuvent recevoir des voix.
  const targets = alive.filter((p) => p.id !== meId && (!vote.candidates || vote.candidates.includes(p.id)));

  return (
    <div className="stack">
      <h1 className="display">Qui est l’infiltré ?</h1>

      {vote.tiebreak && (
        <p className="notice">
          Égalité ! Nouveau vote : seuls les joueurs ex æquo peuvent recevoir des voix.
        </p>
      )}

      {iCanVote ? (
        <div className="vote-list" role="radiogroup" aria-label="Voter pour un joueur">
          {targets.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={vote.myVote === p.id}
              className={`vote-btn ${vote.myVote === p.id ? 'on' : ''}`}
              onClick={() => act('player:vote', { targetId: p.id })}
            >
              {p.name}
            </button>
          ))}
        </div>
      ) : (
        <p className="status">Tu es éliminé : tu ne votes plus, mais tu regardes.</p>
      )}

      {iCanVote && (
        <p className="muted">
          {vote.myVote ? 'Vote enregistré. Tu peux encore changer d’avis.' : 'Touche un nom pour voter.'}
        </p>
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

      <DetectivePanel state={state} act={act} />
      {me && me.alive && <SecretCard me={me} compact />}

      {isHost && (
        <button type="button" className="btn ghost" onClick={() => act('host:closeVote')}>
          Clôturer le vote maintenant
        </button>
      )}
    </div>
  );
}
