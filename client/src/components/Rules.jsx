import { useEffect } from 'react';
import { ROLE_INFO } from '../roles.js';

export default function Rules({ onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Règles du jeu" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Règles du jeu</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer les règles">
            ×
          </button>
        </div>

        <h3>Le principe</h3>
        <p>
          Chaque joueur reçoit un mot secret. Les civils ont tous le même mot. Les undercovers ont un mot très proche, sans
          le savoir. Mr White n’a aucun mot.
        </p>

        <h3>Une manche</h3>
        <ol>
          <li>Chacun son tour, à voix haute, donne un indice sur ton mot sans le prononcer.</li>
          <li>L’hôte ouvre le vote : chacun désigne le joueur qu’il soupçonne.</li>
          <li>Le joueur le plus voté sort de la partie et son rôle est révélé.</li>
          <li>En cas d’égalité, nouveau vote entre les ex æquo. Si l’égalité persiste, personne ne sort.</li>
        </ol>

        <h3>Comment gagner</h3>
        <ul>
          <li>Les civils gagnent quand tous les infiltrés (undercovers et Mr White) sont démasqués.</li>
          <li>Les infiltrés gagnent quand ils sont aussi nombreux que les civils.</li>
          <li>
            Mr White démasqué peut tenter de deviner le mot des civils : s’il réussit, il gagne seul.
          </li>
        </ul>

        <h3>Les rôles</h3>
        <ul className="roles">
          {Object.entries(ROLE_INFO).map(([key, info]) => (
            <li key={key}>
              <strong>
                {info.emoji} {info.name}
              </strong>
              <span>{info.power}</span>
            </li>
          ))}
        </ul>

        <h3>Bon à savoir</h3>
        <p>
          De 4 à 12 joueurs. Mr White apparaît dès 5 joueurs, le Bouclier dès 6, le Détective dès 7. L’hôte peut
          désactiver ces rôles avant de lancer la partie.
        </p>
      </div>
    </div>
  );
}
