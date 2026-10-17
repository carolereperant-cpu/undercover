import { useState } from 'react';
import { useGame } from './useGame.js';
import Home from './components/Home.jsx';
import Lobby from './components/Lobby.jsx';
import Reveal from './components/Reveal.jsx';
import Discussion from './components/Discussion.jsx';
import Vote from './components/Vote.jsx';
import Result from './components/Result.jsx';
import WhiteGuess from './components/WhiteGuess.jsx';
import GameOver from './components/GameOver.jsx';
import Rules from './components/Rules.jsx';

export default function App() {
  const game = useGame();
  const { state, connected, booting, toast, act, create, join, leave, notify } = game;
  const [showRules, setShowRules] = useState(false);

  // Chaque phase du jeu a sa couleur d'écran (voir styles.css, [data-phase]).
  const phase = state ? state.phase : 'home';

  let screen;
  if (booting) {
    screen = <p className="splash">Reconnexion à la salle…</p>;
  } else if (!state) {
    screen = <Home create={create} join={join} notify={notify} />;
  } else {
    const props = { state, act, notify };
    const screens = {
      lobby: <Lobby {...props} />,
      reveal: <Reveal {...props} />,
      discussion: <Discussion {...props} />,
      vote: <Vote {...props} />,
      result: <Result {...props} />,
      whiteGuess: <WhiteGuess {...props} />,
      end: <GameOver {...props} leave={leave} />,
    };
    screen = screens[phase];
  }

  const confirmLeave = () => {
    const inGame = state && state.phase !== 'lobby' && state.phase !== 'end';
    const message = inGame
      ? 'Quitter la partie en cours ? Les autres joueurs continueront sans toi.'
      : 'Quitter la salle ?';
    if (window.confirm(message)) leave();
  };

  return (
    <div className="app" data-phase={phase}>
      <header className="topbar">
        <span className="brand">Undercover</span>
        <div className="topbar-actions">
          {state && <span className="room-chip">Salle {state.code}</span>}
          <button type="button" className="icon-btn" onClick={() => setShowRules(true)} aria-label="Lire les règles">
            ?
          </button>
          {state && (
            <button type="button" className="icon-btn" onClick={confirmLeave} aria-label="Quitter la salle">
              ×
            </button>
          )}
        </div>
      </header>

      {!connected && !booting && (
        <p className="banner" role="status">
          Connexion perdue, on essaie de te reconnecter…
        </p>
      )}

      <main className="screen">{screen}</main>

      {toast && (
        <div className="toast" role="alert">
          {toast}
        </div>
      )}
      {showRules && <Rules onClose={() => setShowRules(false)} />}
    </div>
  );
}
