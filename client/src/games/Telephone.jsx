import { useState } from 'react';
import { Seats, useSeats, Progress, HostButton, HoldReveal, nameOf, EndActions } from './shared.jsx';

function Story({ players, steps, index }) {
  return (
    <section className="stack tight story">
      <h2>Histoire {index + 1}</h2>
      <ol className="story-steps">
        {steps.map((s, i) => (
          <li key={i}>
            {s.kind === 'draw' ? (
              <>
                <strong>{nameOf(players, s.playerId)}</strong> {i === 0 ? 'a dessiné son mot de départ' : 'a dessiné'} : « {s.text} »
              </>
            ) : (
              <>
                <strong>{nameOf(players, s.playerId)}</strong> a cru voir : « {s.text} »
              </>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function Telephone({ state, act, leave }) {
  const { players } = state;
  const { seats, seat, setSeatId, send, sendHost } = useSeats(state, act);
  const [text, setText] = useState('');
  const mg = state.mg;
  const mine = seat.mg;

  if (mg.phase === 'end') {
    return (
      <div className="stack">
        <h1 className="display">Le téléphone est coupé !</h1>
        {mg.stories.map((steps, i) => (
          <Story key={i} players={players} steps={steps} index={i} />
        ))}
        <EndActions state={state} act={act} leave={leave} />
      </div>
    );
  }

  if (mg.phase === 'reveal') {
    const total = players.length;
    return (
      <div className="stack">
        <h1 className="display">La révélation</h1>
        <p className="lead">Montrez vos dessins à tour de rôle pendant qu’on lit chaque histoire.</p>
        {mg.stories.map((steps, i) => (
          <Story key={i} players={players} steps={steps} index={i} />
        ))}
        <HostButton state={state} onClick={() => sendHost('next')}>
          {mg.revealed < total ? (mg.revealed === 0 ? 'Révéler la première histoire' : 'Histoire suivante') : 'Terminer'}
        </HostButton>
        {state.meId !== state.hostId && <p className="muted center">L’hôte révèle les histoires une par une.</p>}
      </div>
    );
  }

  const task = mine.task;
  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const res = await send('describe', { text });
    if (res.ok) setText('');
  };

  const head = (
    <p className="muted">
      Étape {mg.step + 1} sur {mg.steps}
    </p>
  );

  return (
    <div className="stack">
      {head}
      <Seats seats={seats} seat={seat} onChange={setSeatId} done={(s) => s.mg.task.done} label="Qui joue ?" />
      {task.kind === 'draw' ? (
        <>
          <h1 className="display">À toi de dessiner !</h1>
          <p className="lead">
            {mg.step === 0
              ? 'Voici ton mot de départ. Dessine-le sur ta feuille, sans lettres ni paroles.'
              : 'Dessine cette description sur une nouvelle feuille, sans lettres ni paroles.'}
          </p>
          <HoldReveal label={`Maintiens pour voir ce que ${seat.name} doit dessiner`}>
            <span className="secret-word">{task.text}</span>
          </HoldReveal>
          <p className="notice">Quand tu as fini, passe ta feuille à {nameOf(players, task.toId)}, face cachée.</p>
          <button type="button" className="btn primary" disabled={task.done} onClick={() => send('drawn')}>
            {task.done ? 'Dessin terminé ✓' : 'J’ai fini mon dessin'}
          </button>
        </>
      ) : (
        <form className="stack" onSubmit={submit}>
          <h1 className="display">Que vois-tu ?</h1>
          <p className="notice">Récupère la feuille de {nameOf(players, task.fromId)} et décris son dessin avec des mots.</p>
          <label className="field">
            <span>{seat.isGuest ? `Description de ${seat.name}` : 'Ce que je crois voir'}</span>
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={60} autoComplete="off" />
          </label>
          <button className="btn primary" disabled={!text.trim()}>
            {task.myText ? 'Changer ma description' : 'Envoyer ma description'}
          </button>
          {task.myText && <p className="status">Enregistré : « {task.myText} »</p>}
        </form>
      )}
      <Progress done={mg.done.length} total={players.length} label="ont terminé" />
      <HostButton state={state} ghost onClick={() => sendHost('force')}>
        Passer à l’étape suivante
      </HostButton>
    </div>
  );
}
