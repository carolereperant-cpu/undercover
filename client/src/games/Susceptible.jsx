import { Seats, useSeats, Progress, HostButton, Ranking, nameOf, EndActions } from './shared.jsx';

export default function Susceptible({ state, act, leave }) {
  const { players } = state;
  const { seats, seat, setSeatId, send, sendHost } = useSeats(state, act);
  const mg = state.mg;
  const mine = seat.mg;

  if (mg.phase === 'end') {
    const rows = mg.ranking.map((r) => ({ id: r.id, value: r.titles }));
    return (
      <div className="stack">
        <h1 className="display">Les titres de la soirée</h1>
        <p className="lead">Chaque titre = une question où le groupe a désigné ce joueur.</p>
        <Ranking players={players} rows={rows} unit="titre(s)" />
        <EndActions state={state} act={act} leave={leave} />
      </div>
    );
  }

  if (mg.phase === 'result') {
    const { counts, winners } = mg.result;
    const sorted = [...players].sort((a, b) => counts[b.id] - counts[a.id]);
    return (
      <div className="stack">
        <p className="muted">
          Question {mg.round} sur {mg.total}
        </p>
        <h1 className="display">Qui est le plus susceptible de {mg.question} ?</h1>
        <p className="lead">
          {winners.length === 1 ? `${nameOf(players, winners[0])} remporte le titre !` : `Égalité : ${winners.map((id) => nameOf(players, id)).join(' et ')}.`}
        </p>
        <ul className="bars">
          {sorted.map((p) => (
            <li key={p.id} className={winners.includes(p.id) ? 'top' : ''}>
              <span className="name">{p.name}</span>
              <span className="bar" style={{ width: `${(counts[p.id] / Math.max(1, mg.result.max)) * 100}%` }} />
              <strong>{counts[p.id]}</strong>
            </li>
          ))}
        </ul>
        <HostButton state={state} onClick={() => sendHost('next')}>
          {mg.round >= mg.total ? 'Voir le classement' : 'Question suivante'}
        </HostButton>
        {state.meId !== state.hostId && <p className="muted center">L’hôte lance la suite.</p>}
      </div>
    );
  }

  return (
    <div className="stack">
      <p className="muted">
        Question {mg.round} sur {mg.total}
      </p>
      <h1 className="display">Qui est le plus susceptible de {mg.question} ?</h1>
      <Seats seats={seats} seat={seat} onChange={setSeatId} done={(s) => Boolean(s.mg.myVote)} label="Qui vote ?" />
      <div className="vote-list" role="radiogroup" aria-label={`Vote de ${seat.name}`}>
        {players
          .filter((p) => p.id !== seat.id)
          .map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={mine.myVote === p.id}
              className={`vote-btn ${mine.myVote === p.id ? 'on' : ''}`}
              onClick={() => send('vote', { targetId: p.id })}
            >
              {p.name}
            </button>
          ))}
      </div>
      <Progress done={mg.voted.length} total={players.length} label="ont voté" />
      <HostButton state={state} ghost onClick={() => sendHost('force')} disabled={mg.voted.length === 0}>
        Révéler le résultat maintenant
      </HostButton>
    </div>
  );
}
