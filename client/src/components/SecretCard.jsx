import { useEffect, useState } from 'react';
import { ROLE_INFO } from '../roles.js';

/**
 * La carte secrète. Fermée, elle ressemble à un document caviardé ;
 * le mot n'apparaît que tant que le joueur garde le doigt appuyé.
 * Ainsi, un voisin qui jette un œil à ton écran ne voit rien.
 */
export default function SecretCard({ me, compact = false }) {
  const [shown, setShown] = useState(false);
  const info = ROLE_INFO[me.role];
  const isWhite = me.role === 'mrwhite';
  const special = me.role !== 'civil';

  // Si l'écran passe en arrière-plan, on recache immédiatement.
  useEffect(() => {
    const hide = () => setShown(false);
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('blur', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('blur', hide);
    };
  }, []);

  const show = () => setShown(true);
  const hide = () => setShown(false);

  const onKeyDown = (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      show();
    }
  };
  const onKeyUp = (e) => {
    if (e.key === ' ' || e.key === 'Enter') hide();
  };

  return (
    <button
      type="button"
      className={`secret ${shown ? 'open' : 'closed'} ${compact ? 'compact' : ''}`}
      onPointerDown={show}
      onPointerUp={hide}
      onPointerLeave={hide}
      onPointerCancel={hide}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={hide}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={shown ? 'Carte secrète visible' : 'Maintiens appuyé pour voir ton mot'}
    >
      {shown ? (
        <span className="secret-face">
          {isWhite ? (
            <>
              <span className="secret-label">Tu es</span>
              <span className="secret-word">Mr White</span>
              <span className="secret-note">Tu n’as pas de mot.</span>
            </>
          ) : (
            <>
              <span className="secret-label">Ton mot</span>
              <span className="secret-word">{me.word}</span>
            </>
          )}
          {special && !compact && (
            <span className="secret-power">
              {info.emoji} {info.name} : {info.power}
            </span>
          )}
          {isWhite && compact && <span className="secret-note">Écoute et bluffe.</span>}
          {special && compact && !isWhite && (
            <span className="secret-note">
              {info.emoji} {info.name}
            </span>
          )}
        </span>
      ) : (
        <span className="secret-face">
          <span className="redacted" aria-hidden="true" />
          <span className="redacted short" aria-hidden="true" />
          <span className="secret-hint">Maintiens appuyé pour voir ton mot</span>
        </span>
      )}
    </button>
  );
}
