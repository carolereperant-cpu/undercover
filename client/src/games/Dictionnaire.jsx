import { useState } from 'react';
import { Seats, useSeats, Progress, HostButton, Ranking, nameOf, EndActions } from './shared.jsx';

export default function Dictionnaire({ state, act, leave }) {
  const { players } = state;
  const { seats, seat, setSeatId, send, sendHost } = useSeats(state, act);
  const [text, setText] = useState('');
  const mg = state.mg;
  const mine = seat.mg;
  const rows = mg.ranking.map((r) => ({ id: r.id, value: r.points }));

  if (mg.phase === 'end') {
    return (
      <div className="stack">
        <h1 className="display">Le classement</h1>
        <Ranking players={players} rows={rows} unit="pt" />
        <EndActions state={state} act={act} leave={leave} />
      </div>
    );
  }

  const header = (
    <>
      <p className="muted">
        Mot {mg.round} sur {mg.total}
      </p>
      <h1 className="display">« {mg.word} »</h1>
    </>
  );

  if (mg.phase === 'result') {
    const { options, realId } = mg.result;
    return (
      <div className="stack">
        {header}
        <p className="lead">Voici la vraie définition et qui a piégé qui.</p>
        <ul className="defs">
          {options.map((o) => (
            <li key={o.id} className={o.id === realId ? 'real' : ''}>
              <p>{o.text}</p>
              <p className="muted">
                {o.id === realId ? '✅ Vraie définition' : `Écrite par ${nameOf(players, o.authorId)}`}
                {o.voters.length > 0 ? ` · votes : ${o.voters.map((id) => nameOf(players, id)).join(', ')}` : ' · aucun vote'}
              </p>
            </li>
          ))}
        </ul>
        <h2>Points</h2>
        <Ranking players={players} rows={rows} unit="pt" />
        <HostButton state={state} onClick={() => sendHost('next')}>
          {mg.round >= mg.total ? 'Voir le classement final' : 'Mot suivant'}
        </HostButton>
        {state.meId !== state.hostId && <p className="muted center">L’hôte lance la suite.</p>}
      </div>
    );
  }

  if (mg.phase === 'vote') {
    return (
      <div className="stack">
        {header}
        <p className="lead">Laquelle est la vraie définition ?</p>
        <Seats seats={seats} seat={seat} onChange={setSeatId} done={(s) => Boolean(s.mg.myVote)} label="Qui vote ?" />
        <div className="vote-list" role="radiogroup" aria-label={`Vote de ${seat.name}`}>
          {mine.options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={mine.myVote === o.id}
              disabled={o.mine}
              className={`vote-btn def ${mine.myVote === o.id ? 'on' : ''}`}
              onClick={() => send('vote', { optionId: o.id })}
            >
              {o.text}
              {o.mine && <small> (la tienne)</small>}
            </button>
          ))}
        </div>
        <Progress done={mg.voted.length} total={players.length} label="ont voté" />
        <HostButton state={state} ghost onClick={() => sendHost('force')} disabled={mg.voted.length === 0}>
          Révéler les réponses maintenant
        </HostButton>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (text.trim().length < 3) return;
    const res = await send('define', { text });
    if (res.ok) setText('');
  };

  return (
    <form className="stack" onSubmit={submit}>
      {header}
      <p className="lead">Invente une définition crédible pour piéger les autres.</p>
      <Seats seats={seats} seat={seat} onChange={setSeatId} done={(s) => Boolean(s.mg.myDef)} label="Qui écrit ?" />
      <label className="field">
        <span>{seat.isGuest ? `Définition de ${seat.name}` : 'Ta fausse définition'}</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={140} rows={3} placeholder="Le fait de…" />
      </label>
      <button className="btn primary" disabled={text.trim().length < 3}>
        {mine.myDef ? 'Remplacer ma définition' : 'Envoyer ma définition'}
      </button>
      {mine.myDef && <p className="status">Enregistrée : « {mine.myDef} »</p>}
      <Progress done={mg.submitted.length} total={players.length} label="ont écrit" />
      <HostButton state={state} ghost onClick={() => sendHost('force')} disabled={mg.submitted.length === 0}>
        Passer au vote maintenant
      </HostButton>
    </form>
  );
}
