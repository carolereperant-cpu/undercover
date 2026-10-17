import { useState } from 'react';
import { Seats, useSeats, Progress, HostButton, HoldReveal, nameOf, EndActions } from './shared.jsx';

function Verdict({ mg }) {
  if (mg.passed) return <p className="status">Le devineur a passé.</p>;
  return mg.correct ? (
    <p className="status win">Bravo ! « {mg.guess} » était la bonne réponse.</p>
  ) : (
    <p className="status">Raté : « {mg.guess} ». C’était « {mg.word} ».</p>
  );
}

function Clues({ players, mg, showAuthors }) {
  return (
    <div className="stack tight">
      <h2>Indices</h2>
      {mg.kept.length === 0 && <p className="muted">Aucun indice n’a survécu : tous étaient en double !</p>}
      <ul className="chips">
        {mg.kept.map((c, i) => (
          <li key={`${c.text}-${i}`} className="chip static">
            <strong>{c.text}</strong>
            {showAuthors && c.authorId ? <small> · {nameOf(players, c.authorId)}</small> : null}
          </li>
        ))}
      </ul>
      {mg.cancelledCount > 0 &&
        (showAuthors && mg.cancelled.length > 0 ? (
          <p className="muted">
            Annulés (en double) : {mg.cancelled.map((c) => `${c.text} (${nameOf(players, c.authorId)})`).join(', ')}
          </p>
        ) : (
          <p className="muted">{mg.cancelledCount} indice(s) annulé(s) car en double.</p>
        ))}
    </div>
  );
}

export default function JustOne({ state, act, leave }) {
  const { players } = state;
  const { seats, seat, setSeatId, send, sendHost } = useSeats(state, act);
  const [clue, setClue] = useState('');
  const [guess, setGuess] = useState('');
  const mg = state.mg;
  const mine = seat.mg;
  const iAmGuesser = mine.guesserId === seat.id;

  if (mg.phase === 'end') {
    const verdict =
      mg.score >= 6 ? 'Incroyable, vous êtes en parfaite harmonie !' : mg.score >= 4 ? 'Très bon score, bien joué !' : mg.score >= 2 ? 'Pas mal, vous progressez.' : 'On retente ? Les indices doivent être plus originaux !';
    return (
      <div className="stack">
        <h1 className="display">
          {mg.score} / {mg.total}
        </h1>
        <p className="lead">{verdict}</p>
        <ul className="defs">
          {mg.history.map((h) => (
            <li key={h.round} className={h.correct ? 'real' : ''}>
              <p>
                <strong>{h.word}</strong> {h.correct ? '✅' : '❌'}
              </p>
              <p className="muted">
                {nameOf(players, h.guesserId)} {h.passed ? 'a passé' : `a répondu « ${h.guess} »`}
              </p>
            </li>
          ))}
        </ul>
        <EndActions state={state} act={act} leave={leave} />
      </div>
    );
  }

  const head = (
    <p className="muted">
      Manche {mg.round} sur {mg.total} · Score de l’équipe : {mg.score}
    </p>
  );
  const guesserName = nameOf(players, mine.guesserId);

  if (mine.phase === 'result') {
    return (
      <div className="stack">
        {head}
        <h1 className="display">« {mine.word} »</h1>
        <Verdict mg={mine} />
        <Clues players={players} mg={mine} showAuthors />
        <HostButton state={state} onClick={() => sendHost('next')}>
          {mg.round >= mg.total ? 'Voir le score final' : 'Manche suivante'}
        </HostButton>
        {state.meId !== state.hostId && <p className="muted center">L’hôte lance la suite.</p>}
      </div>
    );
  }

  if (mine.phase === 'guess') {
    const submitGuess = async (e) => {
      e.preventDefault();
      if (!guess.trim()) return;
      const res = await send('guess', { text: guess });
      if (res.ok) setGuess('');
    };
    return (
      <div className="stack">
        {head}
        <Seats seats={seats} seat={seat} onChange={setSeatId} done={() => false} label="Qui regarde l’écran ?" />
        {iAmGuesser ? (
          <form className="stack" onSubmit={submitGuess}>
            <h1 className="display">{seat.isGuest ? `${seat.name}, à toi de deviner !` : 'À toi de deviner !'}</h1>
            <Clues players={players} mg={mine} showAuthors={false} />
            <label className="field">
              <span>Ta proposition</span>
              <input value={guess} onChange={(e) => setGuess(e.target.value)} maxLength={40} autoComplete="off" autoCapitalize="off" />
            </label>
            <button className="btn primary" disabled={!guess.trim()}>
              Valider
            </button>
            <button type="button" className="btn ghost" onClick={() => send('pass')}>
              Je passe
            </button>
          </form>
        ) : (
          <>
            <h1 className="display">{guesserName} réfléchit…</h1>
            <p className="lead">Le mot à faire deviner : « {mine.word} »</p>
            <Clues players={players} mg={mine} showAuthors />
            <HostButton state={state} ghost onClick={() => sendHost('pass')}>
              Faire passer {guesserName}
            </HostButton>
          </>
        )}
      </div>
    );
  }

  // Écriture des indices
  const submitClue = async (e) => {
    e.preventDefault();
    if (!clue.trim()) return;
    const res = await send('clue', { text: clue });
    if (res.ok) setClue('');
  };
  const writers = players.length - 1;
  return (
    <form className="stack" onSubmit={submitClue}>
      {head}
      <Seats
        seats={seats}
        seat={seat}
        onChange={setSeatId}
        done={(s) => s.mg.guesserId === s.id || Boolean(s.mg.myClue)}
        label="Qui écrit ?"
      />
      {iAmGuesser ? (
        <>
          <h1 className="display">{seat.isGuest ? `${seat.name} devine !` : 'C’est toi qui devines !'}</h1>
          <p className="lead">Détourne le regard des écrans pendant que les autres écrivent leurs indices.</p>
        </>
      ) : (
        <>
          <h1 className="display">{guesserName} doit deviner</h1>
          <HoldReveal label={`Maintiens pour voir le mot (${seat.name})`}>
            <span className="secret-word">{mine.word}</span>
          </HoldReveal>
          <label className="field">
            <span>{seat.isGuest ? `Indice de ${seat.name} (un seul mot)` : 'Ton indice (un seul mot)'}</span>
            <input value={clue} onChange={(e) => setClue(e.target.value)} maxLength={25} autoComplete="off" autoCapitalize="off" />
          </label>
          <button className="btn primary" disabled={!clue.trim()}>
            {mine.myClue ? 'Changer mon indice' : 'Valider mon indice'}
          </button>
          {mine.myClue && <p className="status">Indice enregistré : « {mine.myClue} »</p>}
        </>
      )}
      <Progress done={mine.submitted.length} total={writers} label="ont écrit" />
      <HostButton state={state} ghost onClick={() => sendHost('force')} disabled={mine.submitted.length === 0}>
        Passer à la réponse maintenant
      </HostButton>
    </form>
  );
}
