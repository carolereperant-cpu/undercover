import { useState } from 'react';
import { Seats, useSeats, HostButton, HoldReveal, Ranking, nameOf, EndActions, useCountdown, Timer } from './shared.jsx';

function Feed({ players, guesses }) {
  if (guesses.length === 0) return <p className="muted">Aucune proposition pour l’instant.</p>;
  return (
    <ul className="feed">
      {[...guesses].reverse().slice(0, 12).map((g, i) => (
        <li key={`${g.playerId}-${guesses.length - i}`}>
          <strong>{nameOf(players, g.playerId)}</strong> : {g.text}
        </li>
      ))}
    </ul>
  );
}

export default function Dessin({ state, act, leave }) {
  const { players } = state;
  const { seats, seat, setSeatId, send, sendHost } = useSeats(state, act);
  const [guess, setGuess] = useState('');
  const mg = state.mg;
  const mine = seat.mg;
  const left = useCountdown(mg.deadline, mg.serverNow, () => act('game:act', { type: 'timeup', quiet: true }));
  const rows = mg.ranking.map((r) => ({ id: r.id, value: r.points }));
  const drawerName = nameOf(players, mg.drawerId);
  const iAmDrawer = mine.drawerId === seat.id;

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
      Manche {mg.round} sur {mg.total} · Dessinateur : {drawerName}
    </p>
  );

  if (mg.phase === 'result') {
    return (
      <div className="stack">
        {head}
        <h1 className="display">« {mine.word} »</h1>
        {mg.winnerId ? (
          <p className="status win">
            {nameOf(players, mg.winnerId)} a trouvé ! +2 points, et +1 pour {drawerName}.
          </p>
        ) : (
          <p className="status">Personne n’a trouvé à temps.</p>
        )}
        <Feed players={players} guesses={mg.guesses} />
        <h2>Points</h2>
        <Ranking players={players} rows={rows} unit="pt" />
        <HostButton state={state} onClick={() => sendHost('next')}>
          {mg.round >= mg.total ? 'Voir le classement final' : 'Manche suivante'}
        </HostButton>
        {state.meId !== state.hostId && <p className="muted center">L’hôte lance la suite.</p>}
      </div>
    );
  }

  if (mg.phase === 'ready') {
    return (
      <div className="stack">
        {head}
        <Seats seats={seats} seat={seat} onChange={setSeatId} done={() => false} label="Qui regarde l’écran ?" />
        {iAmDrawer ? (
          <>
            <h1 className="display">{seat.isGuest ? `${seat.name}, tu dessines !` : 'Tu dessines !'}</h1>
            <p className="lead">Prends une feuille et un stylo. Découvre le mot en secret : les autres ne doivent pas le voir.</p>
            <HoldReveal label="Maintiens pour voir le mot">
              <span className="secret-word">{mine.word}</span>
            </HoldReveal>
            {mine.canReroll && (
              <button type="button" className="btn ghost" onClick={() => send('reroll')}>
                Changer de mot (une seule fois)
              </button>
            )}
            <button type="button" className="btn primary" onClick={() => send('start')}>
              Je commence à dessiner (90 s)
            </button>
          </>
        ) : (
          <>
            <h1 className="display">{drawerName} va dessiner</h1>
            <p className="lead">Prépare-toi à deviner le mot sur ce que {drawerName} dessine. Pas de lettres, pas de paroles !</p>
            <HostButton state={state} ghost onClick={() => sendHost('start')}>
              Lancer le dessin à sa place
            </HostButton>
          </>
        )}
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
      {head}
      <Timer left={left} total={mg.seconds} />
      <Seats seats={seats} seat={seat} onChange={setSeatId} done={() => false} label="Qui propose ?" />
      {iAmDrawer ? (
        <>
          <h1 className="display">Dessine !</h1>
          <HoldReveal label="Rappel du mot (maintiens)">
            <span className="secret-word">{mine.word}</span>
          </HoldReveal>
        </>
      ) : (
        <form className="stack" onSubmit={submit}>
          <h1 className="display">Qu’est-ce que c’est ?</h1>
          <label className="field">
            <span>{seat.isGuest ? `Proposition de ${seat.name}` : 'Ta proposition'}</span>
            <input value={guess} onChange={(e) => setGuess(e.target.value)} maxLength={40} autoComplete="off" autoCapitalize="off" />
          </label>
          <button className="btn primary" disabled={!guess.trim()}>
            Proposer
          </button>
        </form>
      )}
      <Feed players={players} guesses={mg.guesses} />
      <HostButton state={state} ghost onClick={() => sendHost('force')}>
        Terminer la manche
      </HostButton>
    </div>
  );
}
