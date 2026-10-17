import { useState } from 'react';

export default function WhiteGuess({ state, act }) {
  const { result, guessFor, meId } = state;
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const iGuess = guessFor === meId;

  const submit = async (e) => {
    e.preventDefault();
    if (!word.trim() || busy) return;
    setBusy(true);
    await act('white:guess', { word });
    setBusy(false);
  };

  if (iGuess) {
    return (
      <form className="stack" onSubmit={submit}>
        <h1 className="display">Tu es démasqué, Mr White.</h1>
        <p className="lead">
          Dernière chance : si tu devines le mot des civils, tu gagnes la partie à toi tout seul. Tu n’as qu’un essai.
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
        Il lui reste un essai : s’il devine le mot des civils, il gagne seul. Silence, il réfléchit.
      </p>
      <p className="status">En attente de sa réponse…</p>
    </div>
  );
}
