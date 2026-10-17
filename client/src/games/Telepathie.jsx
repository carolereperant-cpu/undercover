import { useState } from 'react';
import { Seats, useSeats, Progress, HostButton, EndActions } from './shared.jsx';

function Round({ entry, players }) {
  return (
    <section className="stack tight">
      <h2>Manche {entry.round}</h2>
      <ul className="chips">
        {players.map((p) => (
          <li key={p.id} className="chip static">
            {p.name} : <strong>{entry.words[p.id] ?? '…'}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Telepathie({ state, act, leave }) {
  const { players } = state;
  const { seats, seat, setSeatId, send, sendHost } = useSeats(state, act);
  const [word, setWord] = useState('');
  const mg = state.mg;

  if (mg.phase === 'end') {
    return (
      <div className="stack">
        <h1 className="display">{mg.won ? 'Télépathie réussie !' : 'Pas la même longueur d’onde…'}</h1>
        <p className="lead">
          {mg.won ? `Vous avez écrit le même mot en ${mg.history.length} manche${mg.history.length > 1 ? 's' : ''}.` : 'Les 8 manches sont passées sans trouver le même mot.'}
        </p>
        {[...mg.history].reverse().map((entry) => (
          <Round key={entry.round} entry={entry} players={players} />
        ))}
        <EndActions state={state} act={act} leave={leave} />
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (!word.trim()) return;
    const res = await send('word', { word });
    if (res.ok) setWord('');
  };

  if (mg.phase === 'reveal') {
    const last = mg.history[mg.history.length - 1];
    return (
      <div className="stack">
        <h1 className="display">Manche {last.round} : pas encore !</h1>
        <p className="lead">Regardez les mots des autres, puis essayez de vous rapprocher à la prochaine manche.</p>
        <Round entry={last} players={players} />
        <HostButton state={state} onClick={() => sendHost('next')}>
          Manche suivante
        </HostButton>
        {state.meId !== state.hostId && <p className="muted center">L’hôte lance la manche suivante.</p>}
      </div>
    );
  }

  const prev = mg.history[mg.history.length - 1];
  const sent = seat.mg.myWord;
  return (
    <form className="stack" onSubmit={submit}>
      <p className="muted">
        Manche {mg.round} sur {mg.maxRounds}
      </p>
      <h1 className="display">{mg.round === 1 ? 'Écris le premier mot qui te vient.' : 'Rapproche-toi des autres.'}</h1>
      {prev && (
        <p className="lead">
          Manche précédente : {players.map((p) => `${p.name} « ${prev.words[p.id] ?? '…'} »`).join(', ')}.
        </p>
      )}
      <Seats seats={seats} seat={seat} onChange={setSeatId} done={(s) => Boolean(s.mg.myWord)} label="Qui écrit ?" />
      <label className="field">
        <span>{seat.isGuest ? `Le mot de ${seat.name}` : 'Ton mot'}</span>
        <input value={word} onChange={(e) => setWord(e.target.value)} maxLength={30} autoComplete="off" autoCapitalize="off" />
      </label>
      <button className="btn primary" disabled={!word.trim()}>
        {sent ? 'Changer mon mot' : 'Valider mon mot'}
      </button>
      {sent && <p className="status">Mot enregistré. Tu peux encore le changer avant la révélation.</p>}
      <Progress done={mg.submitted.length} total={players.length} label="ont écrit" />
      <HostButton state={state} ghost onClick={() => sendHost('force')} disabled={mg.submitted.length === 0}>
        Révéler maintenant
      </HostButton>
    </form>
  );
}
