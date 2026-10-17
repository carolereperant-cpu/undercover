import SecretCard from './SecretCard.jsx';
import DetectivePanel from './DetectivePanel.jsx';

export default function Discussion({ state, act }) {
  const { me, players, order, round, meId, hostId } = state;
  const isHost = meId === hostId;
  const byId = Object.fromEntries(players.map((p) => [p.id, p]));
  const dead = players.filter((p) => !p.alive);

  return (
    <div className="stack">
      <h1 className="display">Manche {round}</h1>
      <p className="lead">
        Chacun son tour, donne un indice sur ton mot : un mot ou une phrase courte, sans prononcer le mot lui-même. À
        voix haute, tous ensemble.
      </p>

      <section className="stack tight">
        <h2>Ordre de parole</h2>
        <ol className="order">
          {order.map((id) => (
            <li key={id} className={id === meId ? 'me' : ''}>
              {byId[id]?.name}
              {id === meId && ' (toi)'}
            </li>
          ))}
        </ol>
        {dead.length > 0 && (
          <p className="muted">
            Éliminés : {dead.map((p) => `${p.name}`).join(', ')}
          </p>
        )}
      </section>

      <DetectivePanel state={state} act={act} />

      {me && me.alive && <SecretCard me={me} compact />}
      {me && !me.alive && <p className="status">Tu es éliminé : tu peux encore suivre la partie.</p>}

      {isHost ? (
        <button type="button" className="btn primary" onClick={() => act('host:openVote')}>
          Ouvrir le vote
        </button>
      ) : (
        <p className="muted center">
          {players.find((p) => p.id === hostId)?.name} ouvrira le vote quand tout le monde aura parlé.
        </p>
      )}
    </div>
  );
}
