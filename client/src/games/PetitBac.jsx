import { useRef, useState } from 'react';
import { Seats, useSeats, Progress, HostButton, Ranking, nameOf, EndActions, useCountdown, Timer } from './shared.jsx';
import { withSeat } from '../seats.js';

export default function PetitBac({ state, act, leave }) {
  const { players } = state;
  const { seats, seat, setSeatId, send, sendHost } = useSeats(state, act);
  const mg = state.mg;
  const mine = seat.mg;
  // Les saisies de chaque joueur de cet écran (moi + invités), gardées en mémoire tant que la manche dure.
  const [drafts, setDrafts] = useState({});
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const seatsRef = useRef(seats);
  seatsRef.current = seats;
  const blank = mg.cats.map(() => '');
  const draftOf = (s) => draftsRef.current[`${mg.round}:${s.id}`] ?? s.mg.myAnswers ?? blank;

  // À la fin du temps : on envoie ce que chacun a écrit, puis on prévient le serveur.
  const left = useCountdown(mg.deadline, mg.serverNow, async () => {
    for (const s of seatsRef.current) {
      await act('game:act', withSeat(s, { type: 'submit', answers: draftOf(s), quiet: true }));
    }
    await act('game:act', { type: 'timeup', quiet: true });
  });
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
    <p className="muted">
      Manche {mg.round} sur {mg.total}
    </p>
  );

  if (mg.phase === 'review') {
    const isHost = state.meId === state.hostId;
    return (
      <div className="stack">
        {head}
        <h1 className="display">Lettre {mg.letter} : la relecture</h1>
        {isHost && <p className="muted">Une réponse douteuse ? Touche-la pour la refuser (ou la rétablir).</p>}
        {mg.review.map((row, i) => (
          <section key={row.category} className="stack tight">
            <h2>{row.category}</h2>
            <ul className="defs">
              {row.entries.map((e) => (
                <li key={e.playerId} className={e.points === 2 ? 'real' : ''}>
                  <p>
                    <strong>{nameOf(players, e.playerId)}</strong> : {e.text || '—'}
                  </p>
                  <p className="muted">
                    {e.rejected ? 'Refusée' : e.text && !e.valid ? `Ne commence pas par ${mg.letter}` : e.points ? `+${e.points}` : '0'}
                  </p>
                  {isHost && e.text && (
                    <button type="button" className="btn ghost small" onClick={() => sendHost('reject', { playerId: e.playerId, index: i })}>
                      {e.rejected ? 'Rétablir' : 'Refuser'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <h2>Points de la manche</h2>
        <Ranking
          players={players}
          rows={Object.entries(mg.roundPoints)
            .map(([id, value]) => ({ id, value }))
            .sort((a, b) => b.value - a.value)}
          unit="pt"
        />
        <HostButton state={state} onClick={() => sendHost('next')}>
          {mg.round >= mg.total ? 'Voir le classement final' : 'Manche suivante'}
        </HostButton>
        {!isHost && <p className="muted center">L’hôte valide les points et lance la suite.</p>}
      </div>
    );
  }

  const draft = draftOf(seat);
  const setAnswer = (i, value) => setDrafts((d) => ({ ...d, [`${mg.round}:${seat.id}`]: draft.map((v, k) => (k === i ? value : v)) }));
  const submit = (e) => {
    e.preventDefault();
    send('submit', { answers: draft });
  };
  const done = mine.myAnswers !== null && mg.submitted.includes(seat.id);

  return (
    <form className="stack" onSubmit={submit}>
      {head}
      <Timer left={left} total={mg.seconds} />
      <h1 className="display">
        Lettre <span className="big-letter">{mg.letter}</span>
      </h1>
      <Seats seats={seats} seat={seat} onChange={setSeatId} done={(s) => mg.submitted.includes(s.id)} label="Qui écrit ?" />
      {mg.cats.map((cat, i) => (
        <label key={cat} className="field">
          <span>{cat}</span>
          <input value={draft[i]} onChange={(e) => setAnswer(i, e.target.value)} maxLength={30} autoComplete="off" autoCapitalize="words" placeholder={`${mg.letter}…`} />
        </label>
      ))}
      <button className="btn primary">{done ? 'Mettre à jour mes réponses' : 'J’ai fini !'}</button>
      {done && <p className="status">Réponses envoyées. Tu peux encore les modifier avant la fin du temps.</p>}
      <Progress done={mg.submitted.length} total={players.length} label="ont fini" />
      <HostButton state={state} ghost onClick={() => sendHost('force')}>
        Passer à la relecture maintenant
      </HostButton>
    </form>
  );
}
