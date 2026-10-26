import Susceptible from '../games/Susceptible.jsx';
import Intrus from '../games/Intrus.jsx';
import Telepathie from '../games/Telepathie.jsx';
import VingtQ from '../games/VingtQ.jsx';
import Dictionnaire from '../games/Dictionnaire.jsx';
import Puissance4 from '../games/Puissance4.jsx';
import Bataille from '../games/Bataille.jsx';
import Des from '../games/Des.jsx';
import JustOne from '../games/JustOne.jsx';
import Quiz from '../games/Quiz.jsx';
import Dessin from '../games/Dessin.jsx';
import Telephone from '../games/Telephone.jsx';
import LoupGarou from '../games/LoupGarou.jsx';
import Pendu from '../games/Pendu.jsx';
import QuiSuisJe from '../games/QuiSuisJe.jsx';
import PetitBac from '../games/PetitBac.jsx';
import Taboo from '../games/Taboo.jsx';
import Codenames from '../games/Codenames.jsx';
import Couronnes from '../games/Couronnes.jsx';

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
  justone: JustOne,
  quiz: Quiz,
  dessin: Dessin,
  telephone: Telephone,
  loupgarou: LoupGarou,
  pendu: Pendu,
  quisuisje: QuiSuisJe,
  petitbac: PetitBac,
  taboo: Taboo,
  codenames: Codenames,
  couronnes: Couronnes,
};

export default function GameHost(props) {
  const Screen = SCREENS[props.state.gameType];
  return Screen ? <Screen {...props} /> : <p className="splash">Jeu inconnu.</p>;
}
