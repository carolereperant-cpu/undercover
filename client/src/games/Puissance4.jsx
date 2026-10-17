import { useSeats, nameOf, EndActions } from './shared.jsx';

export default function Puissance4({ state, act, leave }) {
  const { players } = state;
  const { send } = useSeats(state, act);
  const mg = state.mg;
  const colorOf = (i) => (i === 0 ? 'red' : 'yellow');
  const myTurn = mg.mine === mg.turn && mg.phase === 'play';
  const winCells = new Set((mg.line ?? []).map(([r, c]) => `${r},${c}`));

  let headline;
  if (mg.phase === 'end') {
    headline = mg.draw ? 'Match nul.' : mg.winner === mg.mine ? 'Tu as gagné !' : `${nameOf(players, mg.ids[mg.winner])} a gagné.`;
  } else {
    headline = myTurn ? 'À toi de jouer.' : `Au tour de ${nameOf(players, mg.ids[mg.turn])}…`;
  }

  return (
    <div className="stack">
      <h1 className="display">{headline}</h1>
      <p className="muted center">
        <span className={`dot ${colorOf(mg.mine)}`} /> Tu joues les jetons {mg.mine === 0 ? 'rouges' : 'jaunes'}.
      </p>
      <div className="c4" role="group" aria-label="Grille de Puissance 4">
        {mg.board[0].map((_, col) => (
          <button
            key={col}
            type="button"
            className="c4-col"
            disabled={!myTurn || mg.board[0][col] !== null}
            onClick={() => send('drop', { col })}
            aria-label={`Colonne ${col + 1}`}
          >
            {mg.board.map((row, r) => (
              <span
                key={r}
                className={`c4-cell ${row[col] === null ? '' : colorOf(row[col])} ${winCells.has(`${r},${col}`) ? 'win' : ''}`}
              />
            ))}
          </button>
        ))}
      </div>
      {mg.phase === 'end' && <EndActions state={state} act={act} leave={leave} />}
    </div>
  );
}
