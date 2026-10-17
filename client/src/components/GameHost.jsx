import Susceptible from '../games/Susceptible.jsx';
import Intrus from '../games/Intrus.jsx';
import Telepathie from '../games/Telepathie.jsx';
import VingtQ from '../games/VingtQ.jsx';
import Dictionnaire from '../games/Dictionnaire.jsx';
import Puissance4 from '../games/Puissance4.jsx';
import Bataille from '../games/Bataille.jsx';
import Des from '../games/Des.jsx';

// Un écran par mini-jeu. Pour ajouter un jeu : un composant dans games/ et une ligne ici.
const SCREENS = {
  susceptible: Susceptible,
  intrus: Intrus,
  telepathie: Telepathie,
  vingtq: VingtQ,
  dictionnaire: Dictionnaire,
  puissance4: Puissance4,
  bataille: Bataille,
  des: Des,
};

export default function GameHost(props) {
  const Screen = SCREENS[props.state.gameType];
  return Screen ? <Screen {...props} /> : <p className="splash">Jeu inconnu.</p>;
}
