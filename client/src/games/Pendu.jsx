import { useState } from 'react';
import { Seats, useSeats, HostButton, Ranking, nameOf, EndActions } from './shared.jsx';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** Le dessin du pendu : une pièce de plus à chaque erreur (7 au total). */
function Gallows({ errors }) {
  const parts = [
    <line key="base" x1="10" y1="140" x2="90" y2="140" />,
    <line key="pole" x1="30" y1="140" x2="30" y2="15" />,
    <path key="arm" d="M30 15 H80 V32" />,
    <circle key="head" cx="80" cy="42" r="10" />,
    <line key="body" x1="80" y1="52" x2="80" y2="95" />,
    <path key="arms" d="M62 70 L80 60 L98 70" />,
    <path key="legs" d="M65 120 L80 95 L95 120" />,
  ];
  return (
    <svg className="gallows" viewBox="0 0 110 150" role="img" aria-label={`${errors} erreur${errors > 1 ? 's' : ''} sur 7`}>
      <g fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        {parts.slice(0, errors)}
      </g>
    </svg>
  );
}

function Word({ pattern }) {
  return (
    <p className="pendu-word" aria-label="Le mot à trouver">
      {pattern.map((c, i) => (
        <span key={i} className={c ? 'on' : ''}>
          {c ?? ''}
        </span>
      ))}
    </p>
  );
}

export default function Pendu({ state, act, leave }) {
  const { players } = state;
  const { seats, seat, setSeatId, send, sendHost } = useSeats(state, act);
  const [word, setWord] = useState('');
  const [solve, setSolve] = useState('');
  const mg = state.mg;
  const mine = seat.mg;
  const rows = mg.ranking.map((r) => ({ id: r.id, value: r.points }));
  const masterName = nameOf(players, mg.masterId);
  const iAmMaster = mine.masterId === seat.id;

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
      Manche {mg.round} sur {mg.total} · Le maître du mot : {masterName}
    </p>
  );

  if (mg.phase === 'choose') {
    const submit = async (e) => {
      e.preventDefault();
      const res = await send('word', { text: word });
      if (res.ok) setWord('');
    };
    return (
      <div className="stack">
        {head}
        <Seats seats={seats} seat={seat} onChange={setSeatId} done={() => false} label="Qui regarde l’écran ?" />
        {iAmMaster ? (
          <form className="stack" onSubmit={submit}>
            <h1 className="display">{seat.isGuest ? `${seat.name}, choisis un mot` : 'Choisis un mot secret'}</h1>
            <p className="lead">3 à 20 lettres, sans espace ni chiffre. Les accents seront retirés.</p>
            <label className="field">
              <span>Le mot à faire deviner</span>
              <input value={word} onChange={(e) => setWord(e.target.value)} maxLength={20} autoComplete="off" autoCapitalize="off" type="password" />
            </label>
            <button className="btn primary" disabled={word.trim().length < 3}>
              Valider le mot
            </button>
          </form>
        ) : (
          <>
            <h1 className="display">{masterName} choisit un mot…</h1>
            <p className="lead">Patiente, le jeu commence dès que le mot est choisi.</p>
          </>
        )}
      </div>
    );
  }

  const done = mg.phase === 'result';
  const sendLetter = (letter) => send('letter', { letter });
  const submitSolve = async (e) => {
    e.preventDefault();
    if (!solve.trim()) return;
    const res = await send('solve', { text: solve });
    if (res.ok) setSolve('');
  };

  return (
    <div className="stack">
      {head}
      <Seats seats={seats} seat={seat} onChange={setSeatId} done={() => false} label="Qui joue ?" />
      <Gallows errors={mg.errors} />
      <p className="muted center">
        {mg.errors} erreur{mg.errors > 1 ? 's' : ''} sur {mg.maxErrors}
      </p>
      <Word pattern={mg.pattern} />
      {done ? (
        <>
          {mg.outcome === 'won' ? (
            <p className="status win">
              Trouvé ! {nameOf(players, mg.finisherId)} a découvert le mot « {mg.word} » (+1 pour les devineurs, +1 de bonus).
            </p>
          ) : (
            <p className="status">Pendu ! Le mot était « {mg.word} » : +2 pour {masterName}.</p>
          )}
          <h2>Points</h2>
          <Ranking players={players} rows={rows} unit="pt" />
          <HostButton state={state} onClick={() => sendHost('next')}>
            {mg.round >= mg.total ? 'Voir le classement final' : 'Manche suivante'}
          </HostButton>
          {state.meId !== state.hostId && <p className="muted center">L’hôte lance la suite.</p>}
        </>
      ) : iAmMaster ? (
        <p className="lead">Tu connais le mot : « {mine.word} ». Tu regardes les autres chercher !</p>
      ) : (
        <>
          <div className="keyboard" role="group" aria-label="Lettres">
            {LETTERS.map((l) => {
              const tried = mg.tried.includes(l);
              const good = tried && mg.pattern.includes(l);
              return (
                <button key={l} type="button" className={`key ${good ? 'good' : tried ? 'bad' : ''}`} disabled={tried} onClick={() => sendLetter(l)}>
                  {l}
                </button>
              );
            })}
          </div>
          <form className="stack tight" onSubmit={submitSolve}>
            <label className="field">
              <span>Tu connais le mot ? (une erreur te coûte un morceau du dessin)</span>
              <input value={solve} onChange={(e) => setSolve(e.target.value)} maxLength={20} autoComplete="off" autoCapitalize="off" />
            </label>
            <button className="btn secondary" disabled={!solve.trim()}>
              Proposer le mot entier
            </button>
          </form>
        </>
      )}
    </div>
  );
}
