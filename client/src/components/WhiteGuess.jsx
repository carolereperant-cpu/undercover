import { useState } from 'react';
import { buildSeats, withSeat } from '../seats.js';

export default function WhiteGuess({ state, act }) {
  const { result, guessFor } = state;
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);

  // Mr White peut être le joueur de cet écran, ou l'un de ses invités.
  const guessSeat = buildSeats(state).find((s) => s.id === guessFor);

  const submit = async (e) => {
    e.preventDefault();
    if (!word.trim() || busy) return;
    setBusy(true);
    await act('white:guess', withSeat(guessSeat, { word }));
    setBusy(false);
  };

  if (guessSeat) {
    const forGuest = guessSeat.isGuest;
    return (
      <form className="stack" onSubmit={submit}>
        <h1 className="display">{forGuest ? `${guessSeat.name} est Mr White.` : 'Tu es démasqué, Mr White.'}</h1>
        <p className="lead">
          {forGuest
            ? `Passe l’écran à ${guessSeat.name}. Dernière chance : en devinant le mot des civils, la partie est gagnée en solo. Un seul essai.`
            : 'Dernière chance : si tu devines le mot des civils, tu gagnes la partie à toi tout seul. Tu n’as qu’un essai.'}
        </p>
        <label className="field">
          <span>Le mot des civils</span>
          <input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            maxLength={30}
            autoComplete="off"
            autoCapitalize="off"
            autoFocus
          />
        </label>
        <button className="btn primary" disabled={!word.trim() || busy}>
          Proposer ce mot
        </button>
      </form>
    );
  }

  return (
    <div className="stack">
      <h1 className="display">{result.playerName} était Mr White.</h1>
      <p className="lead">
        Dernier essai : si le mot des civils est deviné, Mr White gagne seul. Silence, ça réfléchit.
      </p>
      <p className="status">En attente de sa réponse…</p>
    </div>
  );
}
