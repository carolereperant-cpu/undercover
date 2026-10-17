import SecretCard from './SecretCard.jsx';

export default function Reveal({ state, act }) {
  const { me, players, meId, hostId } = state;
  const isHost = meId === hostId;
  const readyCount = players.filter((p) => p.ready).length;
  const iAmReady = players.find((p) => p.id === meId)?.ready;
  const waiting = players.filter((p) => !p.ready);

  return (
    <div className="stack">
      <h1 className="display">Découvre ton mot, en secret.</h1>
      <p className="lead">
        Cache ton écran aux autres, puis maintiens la carte appuyée. Retiens bien ton mot : tu pourras le revoir pendant
        la partie.
      </p>

      {me && <SecretCard me={me} />}

      {iAmReady ? (
        <p className="status">
          Mot mémorisé. En attente de {waiting.map((p) => p.name).join(', ') || 'personne'}…
        </p>
      ) : (
        <button type="button" className="btn primary" onClick={() => act('player:ready')}>
          J’ai mémorisé mon mot
        </button>
      )}

      <p className="muted center">
        {readyCount} joueur{readyCount > 1 ? 's' : ''} sur {players.length} prêt{readyCount > 1 ? 's' : ''}
      </p>

      {isHost && readyCount < players.length && (
        <button type="button" className="btn ghost" onClick={() => act('host:begin')}>
          Commencer sans attendre
        </button>
      )}
    </div>
  );
}
