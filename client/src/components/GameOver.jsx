import { ROLE_INFO } from '../roles.js';

const TITLES = {
  civils: 'Les civils gagnent.',
  infiltres: 'Les infiltrés gagnent.',
  mrwhite: 'Mr White gagne seul.',
};

export default function GameOver({ state, act, leave }) {
  const { end, result, meId, hostId, players } = state;
  const isHost = meId === hostId;
  const host = players.find((p) => p.id === hostId);
  const mine = end.players.find((p) => p.id === meId);

  let reason = null;
  if (end.winner === 'mrwhite') {
    reason = `Mr White a deviné le mot des civils : « ${result?.guess?.text ?? end.civilWord} ».`;
  } else if (end.winner === 'infiltres') {
    reason = 'Les infiltrés sont maintenant aussi nombreux que les civils.';
  } else {
    reason = 'Tous les infiltrés ont été démasqués.';
  }

  return (
    <div className="stack">
      <h1 className="display">{TITLES[end.winner]}</h1>
      <p className="lead">{reason}</p>
      {mine && (
        <p className={`status ${mine.won ? 'win' : ''}`}>{mine.won ? 'Tu fais partie des gagnants.' : 'Pas cette fois pour toi.'}</p>
      )}

      <section className="words">
        <p>
          <span className="muted">Mot des civils</span>
          <strong>{end.civilWord}</strong>
        </p>
        <p>
          <span className="muted">Mot des undercovers</span>
          <strong>{end.undercoverWord}</strong>
        </p>
      </section>

      <section className="stack tight">
        <h2>Qui était qui</h2>
        <ul className="roster">
          {end.players.map((p) => {
            const info = ROLE_INFO[p.role];
            return (
              <li key={p.id} className={p.won ? 'won' : ''}>
                <span className="name">
                  {p.name}
                  {p.id === meId && ' (toi)'}
                </span>
                <span>
                  {info.emoji} {info.name}
                </span>
                <span className="word">{p.word ?? 'sans mot'}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {isHost ? (
        <button type="button" className="btn primary" onClick={() => act('host:rematch')}>
          Rejouer avec les mêmes joueurs
        </button>
      ) : (
        <p className="muted center">{host?.name} peut relancer une partie.</p>
      )}
      <button type="button" className="btn ghost" onClick={leave}>
        Quitter la salle
      </button>
    </div>
  );
}
