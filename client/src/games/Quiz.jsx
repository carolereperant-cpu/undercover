import { Seats, useSeats, Progress, HostButton, Ranking, nameOf, EndActions, useCountdown, Timer } from './shared.jsx';

const LETTERS = ['A', 'B', 'C', 'D'];

export default function Quiz({ state, act, leave }) {
  const { players } = state;
  const { seats, seat, setSeatId, send, sendHost } = useSeats(state, act);
  const mg = state.mg;
  const mine = seat.mg;
  // Quand le temps est écoulé, tous les téléphones préviennent le serveur ; seul le premier compte.
  const left = useCountdown(mg.deadline, mg.serverNow, () => act('game:act', { type: 'timeup', quiet: true }));
  const rows = mg.ranking.map((r) => ({ id: r.id, value: r.points }));

  if (mg.phase === 'end') {
    return (
      <div className="stack">
        <h1 className="display">Le classement</h1>
        <Ranking players={players} rows={rows} unit="pt" />
        <EndActions state={state} act={act} leave={leave} />
      </div>
    );
  }

  const head = (
    <>
      <p className="muted">
        Question {mg.round} sur {mg.total}
        {mg.theme ? ` · ${mg.theme.emoji} ${mg.theme.label}` : ''}
      </p>
      <h1 className="display quiz-q">{mg.q}</h1>
    </>
  );

  if (mg.phase === 'result') {
    const { answer, answers } = mg.result;
    return (
      <div className="stack">
        {head}
        <div className="choice-grid" aria-label="Réponses">
          {mg.choices.map((c, i) => (
            <div key={c} className={`choice ${i === answer ? 'good' : ''}`}>
              <b>{LETTERS[i]}</b> {c}
            </div>
          ))}
        </div>
        {answers.length === 0 ? (
          <p className="lead">Personne n’a répondu.</p>
        ) : (
          <ol className="ranking">
            {answers.map((a) => (
              <li key={a.playerId}>
                <span>{a.correct ? '✅' : '❌'}</span>
                <span className="name">{nameOf(players, a.playerId)}</span>
                <strong>{a.points > 0 ? `+${a.points}` : '0'}</strong>
              </li>
            ))}
          </ol>
        )}
        <h2>Classement</h2>
        <Ranking players={players} rows={rows} unit="pt" />
        <HostButton state={state} onClick={() => sendHost('next')}>
          {mg.round >= mg.total ? 'Voir le classement final' : 'Question suivante'}
        </HostButton>
        {state.meId !== state.hostId && <p className="muted center">L’hôte lance la suite.</p>}
      </div>
    );
  }

  const answered = mine.myChoice !== null;
  return (
    <div className="stack">
      {head}
      <Timer left={left} total={mg.seconds} />
      <Seats seats={seats} seat={seat} onChange={setSeatId} done={(s) => s.mg.myChoice !== null} label="Qui répond ?" />
      <div className="vote-list" role="group" aria-label={`Réponse de ${seat.name}`}>
        {mine.choices.map((c, i) => (
          <button
            key={c}
            type="button"
            className={`vote-btn ${mine.myChoice === i ? 'on' : ''}`}
            disabled={answered}
            aria-pressed={mine.myChoice === i}
            onClick={() => send('answer', { choice: i })}
          >
            <b>{LETTERS[i]}</b> {c}
          </button>
        ))}
      </div>
      {answered && <p className="status">Réponse enregistrée, tu ne peux plus la changer.</p>}
      <Progress done={mg.answered.length} total={players.length} label="ont répondu" />
      <HostButton state={state} ghost onClick={() => sendHost('force')}>
        Révéler la réponse maintenant
      </HostButton>
    </div>
  );
}
