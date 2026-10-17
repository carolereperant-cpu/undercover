import { useEffect, useState } from 'react';
import { Seats, useSeats, HoldReveal, HostButton, Progress, nameOf, EndActions } from './shared.jsx';

function useCountdown(startedAt, durationMs) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const left = Math.max(0, startedAt + durationMs - now);
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return { left, label: `${m}:${String(s).padStart(2, '0')}` };
}

const REASONS = {
  'spy-found-place': (spy, place) => `${spy} a deviné le lieu (${place}) : l’espion gagne.`,
  'spy-found-place-after-caught': (spy, place) => `${spy} a été démasqué mais a deviné le lieu (${place}) : l’espion gagne.`,
  'spy-wrong-guess': (spy) => `${spy} s’est trompé de lieu : les autres gagnent.`,
  'spy-caught': (spy) => `${spy} a été démasqué et n’a pas trouvé le lieu : les autres gagnent.`,
  innocent: (spy) => `Le groupe a accusé un innocent : ${spy} gagne.`,
};

function LocationGrid({ locations, onPick, title }) {
  return (
    <section className="stack tight">
      <h2>{title}</h2>
      <ul className="chips">
        {locations.map((l) => (
          <li key={l}>
            <button type="button" className="chip" onClick={() => onPick(l)}>
              {l}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Intrus({ state, act, leave }) {
  const { players } = state;
  const { seats, seat, setSeatId, send, sendHost } = useSeats(state, act);
  const [guessing, setGuessing] = useState(false);
  const mg = state.mg;
  const mine = seat.mg;
  const clock = useCountdown(mg.startedAt, mg.durationMs);

  if (mg.phase === 'end') {
    const spy = nameOf(players, mg.spyId);
    return (
      <div className="stack">
        <h1 className="display">{mg.winner === 'spy' ? 'L’espion gagne.' : 'L’espion est démasqué.'}</h1>
        <p className="lead">{REASONS[mg.reason]?.(spy, mg.location) ?? ''}</p>
        <section className="words">
          <p>
            <span className="muted">Le lieu</span>
            <strong>{mg.location}</strong>
          </p>
          <p>
            <span className="muted">L’espion</span>
            <strong>{spy}</strong>
          </p>
        </section>
        <EndActions state={state} act={act} leave={leave} />
      </div>
    );
  }

  const secret = (
    <HoldReveal label={`Maintiens pour voir le rôle de ${seat.name}`}>
      {mine.isSpy ? (
        <span className="secret-word">Tu es l’espion !</span>
      ) : (
        <>
          <span className="muted">Le lieu</span>
          <span className="secret-word">{mine.location}</span>
        </>
      )}
    </HoldReveal>
  );

  const pickLocation = async (location) => {
    const res = await send('spyGuess', { location });
    if (res.ok) setGuessing(false);
  };

  if (mg.phase === 'spyGuess') {
    const spyName = nameOf(players, mg.spyId);
    const iAmSpy = mine.isSpy;
    return (
      <div className="stack">
        <h1 className="display">{spyName} est démasqué.</h1>
        <Seats seats={seats} seat={seat} onChange={setSeatId} done={() => false} label="Qui regarde l’écran ?" />
        {iAmSpy ? (
          <LocationGrid locations={mg.locations} onPick={pickLocation} title="Dernière chance : quel est le lieu ?" />
        ) : (
          <p className="lead">Dernière chance : s’il devine le lieu, il gagne quand même. Silence…</p>
        )}
        <HostButton state={state} ghost onClick={() => sendHost('giveUp')}>
          L’espion ne répond pas : terminer
        </HostButton>
      </div>
    );
  }

  if (mg.phase === 'vote') {
    return (
      <div className="stack">
        <h1 className="display">Qui est l’espion ?</h1>
        {mg.notice && <p className="notice">{mg.notice}</p>}
        <Seats seats={seats} seat={seat} onChange={setSeatId} done={(s) => Boolean(s.mg.myVote)} label="Qui vote ?" />
        <div className="vote-list" role="radiogroup" aria-label={`Vote de ${seat.name}`}>
          {players
            .filter((p) => p.id !== seat.id)
            .map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={mine.myVote === p.id}
                className={`vote-btn ${mine.myVote === p.id ? 'on' : ''}`}
                onClick={() => send('vote', { targetId: p.id })}
              >
                {p.name}
              </button>
            ))}
        </div>
        <Progress done={mg.voted.length} total={players.length} label="ont voté" />
        <HostButton state={state} ghost onClick={() => sendHost('closeVote')} disabled={mg.voted.length === 0}>
          Clôturer le vote maintenant
        </HostButton>
      </div>
    );
  }

  return (
    <div className="stack">
      <p className="muted">Temps de discussion conseillé</p>
      <h1 className="display" aria-live="off">
        {clock.left > 0 ? clock.label : 'Temps écoulé !'}
      </h1>
      {mg.notice && <p className="notice">{mg.notice}</p>}
      <p className="lead">
        {nameOf(players, mg.firstId)} pose la première question à quelqu’un, à voix haute. Chacun répond sans nommer le lieu.
      </p>
      <Seats seats={seats} seat={seat} onChange={setSeatId} done={() => false} label="Qui regarde l’écran ?" />
      {secret}
      {mine.isSpy &&
        (guessing ? (
          <LocationGrid locations={mg.locations} onPick={pickLocation} title="Quel est le lieu ? (une seule chance)" />
        ) : (
          <button type="button" className="btn secondary" onClick={() => setGuessing(true)}>
            Je pense connaître le lieu
          </button>
        ))}
      {!mine.isSpy && (
        <details className="places">
          <summary>Voir la liste des lieux possibles</summary>
          <p className="muted">{mg.locations.join(' · ')}</p>
        </details>
      )}
      <HostButton state={state} onClick={() => sendHost('openVote')}>
        Ouvrir le vote
      </HostButton>
    </div>
  );
}
