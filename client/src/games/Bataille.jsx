import { useSeats, nameOf, EndActions } from './shared.jsx';

const LETTERS = 'ABCDEFGHIJ';

function Sea({ size, ships = [], shots, onFire, sunkCells = new Set(), disabled, label }) {
  const shipCells = new Set(ships.flat().map(([r, c]) => `${r},${c}`));
  return (
    <div className="sea" role="grid" aria-label={label} style={{ '--n': size }}>
      {Array.from({ length: size }, (_, r) =>
        Array.from({ length: size }, (_, c) => {
          const shot = shots[r][c];
          const key = `${r},${c}`;
          const cls = ['sea-cell', shipCells.has(key) ? 'ship' : '', shot ?? '', sunkCells.has(key) ? 'sunk' : ''].join(' ');
          return onFire ? (
            <button
              key={key}
              type="button"
              className={cls}
              disabled={disabled || Boolean(shot)}
              onClick={() => onFire(r, c)}
              aria-label={`${LETTERS[c]}${r + 1}${shot ? ` (${shot === 'hit' ? 'touché' : 'raté'})` : ''}`}
            />
          ) : (
            <span key={key} className={cls} role="gridcell" />
          );
        }),
      )}
    </div>
  );
}

const SHOT_TEXT = { hit: 'Touché !', sunk: 'Coulé !', miss: 'À l’eau.' };

export default function Bataille({ state, act, leave }) {
  const { players } = state;
  const { send } = useSeats(state, act);
  const mg = state.mg;
  const enemy = players.find((p) => p.id !== state.meId);
  const sunkCells = new Set(mg.sunk.flat().map(([r, c]) => `${r},${c}`));
  const last = mg.lastShot;
  const lastText = last ? `${last.by === state.meId ? 'Ton tir' : `Tir de ${nameOf(players, last.by)}`} : ${SHOT_TEXT[last.result]}` : null;

  if (mg.phase === 'place') {
    return (
      <div className="stack">
        <h1 className="display">Ta flotte</h1>
        <p className="lead">Elle est placée au hasard. Re-mélange-la si elle ne te plaît pas, puis valide.</p>
        <Sea size={mg.size} ships={mg.myShips} shots={mg.incoming} label="Ma flotte" />
        {mg.ready ? (
          <p className="status">{mg.enemyReady ? 'Début de la partie…' : `En attente de ${enemy?.name ?? 'l’adversaire'}…`}</p>
        ) : (
          <>
            <button type="button" className="btn secondary" onClick={() => send('shuffle')}>
              Mélanger ma flotte
            </button>
            <button type="button" className="btn primary" onClick={() => send('ready')}>
              Je suis prêt
            </button>
          </>
        )}
      </div>
    );
  }

  const over = mg.phase === 'end';
  const myTurn = mg.turn === state.meId && !over;
  let headline;
  if (over) headline = mg.winner === state.meId ? 'Victoire ! Flotte ennemie coulée.' : 'Défaite : ta flotte est coulée.';
  else headline = myTurn ? 'À toi de tirer.' : `${enemy?.name ?? 'L’adversaire'} vise…`;

  return (
    <div className="stack">
      <h1 className="display">{headline}</h1>
      {lastText && <p className="notice">{lastText}</p>}
      <section className="stack tight">
        <h2>
          Flotte ennemie ({mg.shipsLeft} bateau{mg.shipsLeft > 1 ? 'x' : ''} restant{mg.shipsLeft > 1 ? 's' : ''})
        </h2>
        <Sea
          size={mg.size}
          ships={mg.enemyShips}
          shots={mg.outgoing}
          sunkCells={sunkCells}
          onFire={(r, c) => send('fire', { r, c })}
          disabled={!myTurn}
          label="Flotte ennemie"
        />
      </section>
      <section className="stack tight">
        <h2>
          Ma flotte ({mg.myShipsLeft} bateau{mg.myShipsLeft > 1 ? 'x' : ''} restant{mg.myShipsLeft > 1 ? 's' : ''})
        </h2>
        <Sea size={mg.size} ships={mg.myShips} shots={mg.incoming} label="Ma flotte" />
      </section>
      {over && <EndActions state={state} act={act} leave={leave} />}
    </div>
  );
}
