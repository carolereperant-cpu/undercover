import { ROLE_INFO } from '../roles.js';

function Tally({ tally }) {
  if (!tally || tally.length === 0) return null;
  return (
    <section className="stack tight">
      <h2>Les voix</h2>
      <ul className="plan">
        {tally.map((t) => (
          <li key={t.id}>
            <span>{t.name}</span>
            <strong>{t.votes}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Result({ state, act }) {
  const { result, meId, hostId, players } = state;
  const isHost = meId === hostId;
  const host = players.find((p) => p.id === hostId);

  let body;
  if (result.type === 'eliminated') {
    const info = ROLE_INFO[result.role];
    body = (
      <>
        <h1 className="display">{result.playerName} sort de la partie.</h1>
        <div className="reveal-card">
          <span className="emoji" aria-hidden="true">
            {info.emoji}
          </span>
          <p>
            C’était <strong>{info.name}</strong>, dans le camp des {result.camp === 'civils' ? 'civils' : 'infiltrés'}.
          </p>
        </div>
        {result.guess && (
          <p className="notice">
            Mr White a proposé « {result.guess.text} » : ce n’est pas le mot des civils. La partie continue.
          </p>
        )}
      </>
    );
  } else if (result.type === 'saved') {
    body = (
      <>
        <h1 className="display">Le Bouclier de {result.playerName} a tenu !</h1>
        <div className="reveal-card">
          <span className="emoji" aria-hidden="true">
            🛡️
          </span>
          <p>
            Le vote est annulé et personne ne sort. <strong>{result.playerName}</strong> est un civil, mais son bouclier
            est maintenant brisé.
          </p>
        </div>
      </>
    );
  } else if (result.type === 'tie') {
    body = (
      <>
        <h1 className="display">Égalité : personne ne sort.</h1>
        <p className="lead">
          {result.tiedNames.join(' et ')} ont reçu autant de voix, deux fois de suite. On repart sur une nouvelle manche.
        </p>
      </>
    );
  } else {
    body = (
      <>
        <h1 className="display">Aucun vote : personne ne sort.</h1>
        <p className="lead">Le vote a été clôturé sans aucune voix. On repart sur une nouvelle manche.</p>
      </>
    );
  }

  return (
    <div className="stack">
      {body}
      <Tally tally={result.tally} />
      {isHost ? (
        <button type="button" className="btn primary" onClick={() => act('host:next')}>
          Manche suivante
        </button>
      ) : (
        <p className="muted center">{host?.name} lancera la manche suivante.</p>
      )}
    </div>
  );
}
