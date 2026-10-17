import { useState } from 'react';
import { Seats, useSeats, HostButton, Ranking, nameOf, EndActions } from './shared.jsx';

export default function QuiSuisJe({ state, act, leave }) {
  const { players } = state;
  const { seats, seat, setSeatId, send, sendHost } = useSeats(state, act);
  const [guess, setGuess] = useState('');
  const mg = state.mg;
  const mine = seat.mg;
  const me = mine.cards.find((c) => c.id === seat.id);
  const rows = mg.ranking.map((r) => ({ id: r.id, value: r.points }));

  if (mg.phase === 'end') {
    return (
      <div className="stack">
        <h1 className="display">Qui était qui ?</h1>
        <ul className="defs">
          {mg.cards.map((c) => (
            <li key={c.id} className={c.rank ? 'real' : ''}>
              <p>
                <strong>{nameOf(players, c.id)}</strong> était « {c.name} »
              </p>
              <p className="muted">{c.rank ? `Trouvé en ${c.rank}${c.rank === 1 ? 'er' : 'e'} (${c.wrong} erreur${c.wrong > 1 ? 's' : ''})` : 'Pas trouvé'}</p>
            </li>
          ))}
        </ul>
        <h2>Classement</h2>
        <Ranking players={players} rows={rows} unit="pt" />
        <EndActions state={state} act={act} leave={leave} />
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (!guess.trim()) return;
    const res = await send('guess', { text: guess });
    if (res.ok) setGuess('');
  };

  return (
    <div className="stack">
      <p className="muted">
        {mg.solvedCount} sur {players.length} ont trouvé
      </p>
      <h1 className="display">Qui suis-je ?</h1>
      <p className="lead">Pose des questions à voix haute (réponses : oui ou non), chacun son tour, puis tape ton personnage dès que tu penses l’avoir trouvé.</p>
      <Seats seats={seats} seat={seat} onChange={setSeatId} done={(s) => s.mg.cards.find((c) => c.id === s.id)?.rank != null} label="Qui regarde l’écran ?" />
      <ul className="defs">
        {mine.cards
          .filter((c) => c.id !== seat.id)
          .map((c) => (
            <li key={c.id} className={c.rank ? 'real' : ''}>
              <p>
                <strong>{nameOf(players, c.id)}</strong> : {c.name}
              </p>
              <p className="muted">
                {c.category}
                {c.rank ? ` · a trouvé (${c.rank}${c.rank === 1 ? 'er' : 'e'})` : ''}
              </p>
            </li>
          ))}
      </ul>
      {me.rank ? (
        <p className="status win">
          Bravo, tu as trouvé : « {me.name} » ! Tu es {me.rank}
          {me.rank === 1 ? 'er' : 'e'}.
        </p>
      ) : (
        <form className="stack" onSubmit={submit}>
          <p className="notice">
            {seat.isGuest ? `${seat.name} est` : 'Tu es'} un personnage de la catégorie : <strong>{me.category}</strong>. Les autres le voient, pas toi !
          </p>
          <label className="field">
            <span>{seat.isGuest ? `Je pense que ${seat.name} est…` : 'Je pense être…'}</span>
            <input value={guess} onChange={(e) => setGuess(e.target.value)} maxLength={40} autoComplete="off" autoCapitalize="off" />
          </label>
          <button className="btn primary" disabled={!guess.trim()}>
            Proposer
          </button>
          {me.wrong > 0 && (
            <p className="muted">
              {me.wrong} proposition{me.wrong > 1 ? 's' : ''} ratée{me.wrong > 1 ? 's' : ''}.
            </p>
          )}
        </form>
      )}
      <HostButton state={state} ghost onClick={() => sendHost('end')}>
        Terminer la partie maintenant
      </HostButton>
    </div>
  );
}
