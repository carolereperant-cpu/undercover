import Lobby from './Lobby.jsx';
import Reveal from './Reveal.jsx';
import Discussion from './Discussion.jsx';
import Vote from './Vote.jsx';
import Result from './Result.jsx';
import WhiteGuess from './WhiteGuess.jsx';
import GameOver from './GameOver.jsx';
import GameHost from './GameHost.jsx';

/**
 * Choisit l'écran à afficher selon la phase envoyée par le serveur.
 * Salle d'attente commune à tous les jeux ; ensuite Undercover a ses propres phases,
 * et chaque mini-jeu gère lui-même ses écrans (voir GameHost).
 */
export default function CurrentScreen({ state, act, notify, leave }) {
  const props = { state, act, notify };
  if (state.phase === 'lobby') return <Lobby {...props} />;
  if (state.gameType) return <GameHost {...props} leave={leave} />;

  switch (state.phase) {
    case 'reveal':
      return <Reveal {...props} />;
    case 'discussion':
      return <Discussion {...props} />;
    case 'vote':
      return <Vote {...props} />;
    case 'result':
      return <Result {...props} />;
    case 'whiteGuess':
      return <WhiteGuess {...props} />;
    case 'end':
      return <GameOver {...props} leave={leave} />;
    default:
      return <p className="splash">Écran inconnu.</p>;
  }
}
