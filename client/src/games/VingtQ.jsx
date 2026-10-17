import { useState } from 'react';
import { Seats, useSeats, HoldReveal, nameOf, EndActions } from './shared.jsx';

const ANSWER_LABEL = { oui: 'Oui', non: 'Non', peutetre: 'Peut-être' };

export default function VingtQ({ state, act, leave }) {
  const { players } = state;
  const { seats, seat, setSeatId, send } = useSeats(state, act);
  const [text, setText] = useState('');
  const [guess, setGuess] = useState('');
  const mg = state.mg;
  const mine = seat.mg;
  const thinkerName = nameOf(players, mg.thinkerId);
  const left = mg.max - mg.used;

  const log = (
    <ol className="qa">
      {mg.log.map((entry, i) => (
        <li key={i} className={entry.guess ? 'guess' : ''}>
          <span className="who">{nameOf(players, entry.by)}</span>
          <span>{entry.q}</span>
          <strong className={`ans ${entry.a ?? 'wait'}`}>{entry.a ? ANSWER_LABEL[entry.a] : '…'}</strong>
        </li>
      ))}
    </ol>
  );

  if (mg.phase === 'end') {
    return (
      <div className="stack">
        <h1 className="display">{mg.winner === 'guessers' ? 'Trouvé !' : 'Raté, le mot résiste.'}</h1>
        <p className="lead">
          Le mot était <strong>{mg.word}</strong>.{' '}
          {mg.winner === 'guessers' ? 'Bravo aux devineurs !' : `${thinkerName} gagne : 20 questions sans trouver.`}
        </p>
        {log}
        <EndActions state={state} act={act} leave={leave} />
      </div>
    );
  }

  const ask = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const res = await send('ask', { text });
    if (res.ok) setText('');
  };
  const tryGuess = async (e) => {
    e.preventDefault();
    if (!guess.trim()) return;
    const res = await send('guess', { text: guess });
    if (res.ok) setGuess('');
  };

  return (
    <div className="stack">
      <h1 className="display">
        {left} question{left > 1 ? 's' : ''} restante{left > 1 ? 's' : ''}
      </h1>
      <p className="lead">{thinkerName} pense à un mot. Posez des questions fermées.</p>
      <Seats seats={seats} seat={seat} onChange={setSeatId} done={() => false} label="Qui joue ?" />

      {mine.isThinker ? (
        <>
          <HoldReveal label={`Maintiens pour voir le mot de ${seat.name}`}>
            <span className="secret-word">{mine.word}</span>
          </HoldReveal>
          {mg.pending ? (
            <div className="stack tight">
              <p className="notice">« {mg.log[mg.log.length - 1].q} »</p>
              <div className="answers">
                {Object.entries(ANSWER_LABEL).map(([key, label]) => (
                  <button key={key} type="button" className="btn secondary" onClick={() => send('answer', { answer: key })}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <p className="muted center">En attente d’une question…</p>
              {mg.used === 0 && (
                <button type="button" className="btn ghost" onClick={() => send('change')}>
                  Me donner un autre mot
                </button>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <form className="stack tight" onSubmit={ask}>
            <label className="field">
              <span>{seat.isGuest ? `Question de ${seat.name}` : 'Ta question'}</span>
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={100} autoComplete="off" placeholder="Est-ce qu’on peut le manger ?" disabled={mg.pending} />
            </label>
            <button className="btn primary" disabled={!text.trim() || mg.pending}>
              {mg.pending ? 'Attends la réponse…' : 'Poser la question'}
            </button>
          </form>
          <form className="stack tight" onSubmit={tryGuess}>
            <label className="field">
              <span>Proposer un mot (un essai raté compte comme une question)</span>
              <input value={guess} onChange={(e) => setGuess(e.target.value)} maxLength={40} autoComplete="off" disabled={mg.pending} />
            </label>
            <button className="btn secondary" disabled={!guess.trim() || mg.pending}>
              C’est ce mot !
            </button>
          </form>
        </>
      )}
      {mg.log.length > 0 && log}
    </div>
  );
}
