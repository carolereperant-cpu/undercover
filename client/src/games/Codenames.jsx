import { useState } from 'react';
import { Seats, useSeats, HostButton, nameOf, EndActions } from './shared.jsx';

const TEAM = { rouge: '🔴 Rouge', bleu: '🔵 Bleu' };

export default function Codenames({ state, act, leave }) {
  const { players } = state;
  const { seats, seat, setSeatId, send, sendHost } = useSeats(state, act);
  const [word, setWord] = useState('');
  const [number, setNumber] = useState(2);
  const mg = state.mg;
  const mine = seat.mg;
  const myTurn = mine.myTeam === mg.turn;
  const iGiveClue = mg.phase === 'clue' && mine.isSpymaster && myTurn;
  const iGuess = mg.phase === 'guess' && !mine.isSpymaster && myTurn;

  const names = (ids) => ids.map((id) => nameOf(players, id) + (id === mg.spymasters.rouge || id === mg.spymasters.bleu ? ' 🕶️' : '')).join(', ');

  const board = (
    <div className="cn-board" role="grid" aria-label="Grille de mots">
      {mine.board.map((c) => (
        <button
          key={c.index}
          type="button"
          role="gridcell"
          className={`cn-card ${c.color ? `c-${c.color}` : ''} ${c.revealed ? 'revealed' : ''} ${mine.isSpymaster && !c.revealed ? 'spy' : ''}`}
          disabled={!iGuess || c.revealed}
          onClick={() => send('guess', { index: c.index })}
        >
          {c.word}
        </button>
      ))}
    </div>
  );

  const counters = (
    <p className="scorebar">
      <span>🔴 reste <strong>{mine.remaining.rouge}</strong></span>
      <span>🔵 reste <strong>{mine.remaining.bleu}</strong></span>
    </p>
  );

  if (mg.phase === 'end') {
    return (
      <div className="stack">
        <h1 className="display">{TEAM[mg.winner]} gagne !</h1>
        <p className="lead">
          {mg.reason === 'assassin' ? `L’équipe ${mg.winner === 'rouge' ? 'bleue' : 'rouge'} a retourné l’assassin !` : 'Toutes les cartes ont été trouvées.'}
        </p>
        {board}
        <EndActions state={state} act={act} leave={leave} />
      </div>
    );
  }

  const submitClue = async (e) => {
    e.preventDefault();
    if (!word.trim()) return;
    const res = await send('clue', { word, number });
    if (res.ok) setWord('');
  };

  return (
    <div className="stack">
      {counters}
      <Seats seats={seats} seat={seat} onChange={setSeatId} done={() => false} label="Qui regarde l’écran ?" />
      <p className="notice">
        Tu es dans l’équipe <strong>{TEAM[mine.myTeam]}</strong>
        {mine.isSpymaster ? ' et tu es le chef d’espions : tu vois les couleurs.' : '.'}
      </p>
      <h1 className="display">{mg.phase === 'clue' ? `Au tour de l’équipe ${TEAM[mg.turn]}` : `Indice : « ${mg.clue.word} » ${mg.clue.number}`}</h1>
      {mg.phase === 'guess' && (
        <p className="lead">
          {TEAM[mg.turn]} : {mg.guessesLeft} essai{mg.guessesLeft > 1 ? 's' : ''} restant{mg.guessesLeft > 1 ? 's' : ''}.
        </p>
      )}
      {iGiveClue && (
        <form className="stack" onSubmit={submitClue}>
          <label className="field">
            <span>Ton indice (un seul mot)</span>
            <input value={word} onChange={(e) => setWord(e.target.value)} maxLength={25} autoComplete="off" autoCapitalize="off" />
          </label>
          <label className="field">
            <span>Nombre de cartes concernées : {number}</span>
            <input type="range" min="1" max="9" value={number} onChange={(e) => setNumber(Number(e.target.value))} />
          </label>
          <button className="btn primary" disabled={!word.trim()}>
            Donner l’indice
          </button>
        </form>
      )}
      {mg.phase === 'clue' && !iGiveClue && <p className="lead">Le chef d’espions {nameOf(players, mg.spymasters[mg.turn])} réfléchit à son indice…</p>}
      {iGuess && <p className="lead">Touche les cartes que tu penses liées à l’indice.</p>}
      {mg.phase === 'guess' && !iGuess && !mine.isSpymaster && <p className="lead">L’équipe adverse cherche… surveille-la !</p>}
      {board}
      {iGuess && (
        <button type="button" className="btn ghost" disabled={mine.guessedThisTurn < 1} onClick={() => send('endTurn')}>
          Arrêter le tour
        </button>
      )}
      {mg.log.length > 0 && (
        <details>
          <summary>Historique des indices</summary>
          <ul className="feed">
            {[...mg.log].reverse().map((l, i) => (
              <li key={i}>
                {TEAM[l.team]} · « {l.clue} » {l.number} → {l.picks.length ? l.picks.map((p) => p.word).join(', ') : '—'}
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="stack tight">
        <p className="muted">{TEAM.rouge} : {names(mg.teams.rouge)}</p>
        <p className="muted">{TEAM.bleu} : {names(mg.teams.bleu)}</p>
      </div>
      <HostButton state={state} ghost onClick={() => sendHost('pass')}>
        Passer le tour de l’équipe (si quelqu’un est absent)
      </HostButton>
    </div>
  );
}
