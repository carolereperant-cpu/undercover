# Undercover

Plateforme de jeux de société en ligne (Undercover et 8 autres jeux, de 2 à 13 joueurs). Chacun joue sur son propre smartphone : une personne crée une salle, les autres entrent le code (ou ouvrent le lien partagé), et la partie se déroule en temps réel. Gratuit, sans compte, sans base de données.

## Lancer le jeu sur ton ordinateur

Il faut Node.js 20 ou plus.

```bash
npm run install:all     # installe le serveur ET l'interface
npm run build           # construit l'interface dans client/dist
npm start               # http://localhost:3001
```

Pour tester avec ton téléphone (même Wi-Fi) et modifier le code en direct, ouvre deux terminaux :

```bash
npm run dev:server      # terminal 1 : le serveur, redémarre à chaque modification
npm run dev:client      # terminal 2 : l'interface sur http://localhost:5173
```

Vite affiche aussi une adresse du type `http://192.168.x.x:5173` : ouvre-la sur ton téléphone.

Pour vérifier que tout fonctionne : `npm test` (128 tests).



## Plusieurs jeux sur un même site

L'accueil propose un menu de jeux, filtrable par nombre de joueurs et par durée. Tous partagent les mêmes salles (code, QR code, joueurs invités sur l'écran d'un autre joueur).

| Jeu | Joueurs | Durée |
|---|---|---|
| Undercover (avec thèmes, rôles et mode dessin papier-crayon) | 3 à 12 | 10 à 20 min |
| Qui est le plus susceptible de… | 3 à 13 | 10 min |
| L'intrus (type Spyfall) | 3 à 13 | 8 à 10 min |
| Télépathie | 2 à 8 | 5 à 10 min |
| 20 questions | 2 à 6 | 5 à 10 min |
| Le Dictionnaire | 3 à 13 | 15 min |
| Puissance 4 | 2 | 5 min |
| Bataille navale | 2 | 10 à 15 min |
| Dés menteurs | 2 à 6 | 10 à 15 min |
| Just One (coopératif) | 3 à 13 | 15 min |
| Quiz buzzer (100 questions, par thème) | 2 à 13 | 10 à 15 min |
| Dessiner c'est gagné (papier-crayon) | 3 à 13 | 15 min |
| Téléphone dessin (papier-crayon) | 4 à 13 | 15 à 20 min |
| Loup-Garou express (le serveur est le narrateur) | 5 à 13 | 15 à 20 min |
| Pendu (un joueur choisit le mot, les autres devinent) | 2 à 13 | 10 à 15 min |
| Qui suis-je ? (chacun voit le personnage des autres, pas le sien) | 3 à 13 | 10 à 15 min |
| Petit bac (6 catégories, 90 secondes, 5 manches) | 2 à 13 | 15 à 20 min |
| Taboo (deux équipes, mots interdits) | 4 à 13 | 15 à 20 min |
| Codenames (deux équipes, chefs d’espions) | 4 à 12 | 15 à 25 min |
| Les Quatre Couronnes (duel de cartes, deck-building original, jouable contre un bot) | 2 | 15 à 20 min |

**Ajouter un jeu** : créer `server/minigames/monjeu.js` (fiche `meta`, `init`, `act`, `view`), le déclarer dans `server/minigames/index.js`, puis ajouter son écran dans `client/src/games/` et une ligne dans `client/src/components/GameHost.jsx`. La règle d'or reste la même : `view(room, playerId)` ne renvoie que ce que ce joueur a le droit de voir (ses dés, son mot, jamais ceux des autres).

**Jeux à chronomètre** (Quiz, Dessiner c'est gagné) : le serveur fixe l'échéance (`deadline`) et les téléphones affichent le compte à rebours avec l'horloge du serveur. À la fin du temps, chaque téléphone envoie `timeup`, mais le serveur ne l'accepte que si l'échéance est vraiment passée : un joueur ne peut donc pas écourter la manche.

**Questions du quiz** : `server/minigames/quizdata.js`, une ligne par question dans le bon thème (les mêmes thèmes que les mots d'Undercover, choisis par l'hôte dans la salle d'attente).

**Mode dessin d'Undercover** : option de la salle d'attente. L'appli donne toujours les mots et les rôles, mais au lieu de donner un indice à voix haute, chacun dessine son mot sur une feuille réelle, les uns derrière les autres.

## Thèmes de mots

9 thèmes (Classique, Années 80, Années 90, Millénials, Gen Z, Films, Séries, Musique, Enfants), soit 291 paires de mots proches. Chaque paire se joue dans les deux sens (quel mot va aux civils ?), donc 582 combinaisons. L'hôte coche les thèmes dans la salle d'attente (« Tout mélanger » par défaut) et peut afficher le thème pendant la partie. Les mots sont dans `server/words.js` : pour ajouter un thème, ajoute un tableau de paires et une ligne dans `THEMES`.

## Inviter et jouer à plusieurs sur un seul écran

- **QR code** : dans la salle d'attente, un QR code (avec bouton « Agrandir ») ouvre directement la salle sur le téléphone de la personne qui le scanne. Il est généré dans le navigateur : aucun service externe n'est utilisé. Le lien `/?salle=ABCD` pré-remplit aussi le code.
- **Joueurs sur ton écran** : un enfant sans smartphone peut jouer avec le téléphone d'un adulte. Chaque joueur peut ajouter jusqu'à 3 invités dans la salle d'attente. Pendant la partie, un sélecteur permet de passer d'un joueur de l'écran à l'autre pour voir son mot, voter, enquêter ou deviner (Mr White). Les invités comptent dans les 12 joueurs maximum.
- Côté sécurité : les secrets d'un invité ne sont envoyés qu'à son propriétaire. Le serveur vérifie à chaque action `asId` que l'invité appartient bien au téléphone qui agit.

## Les règles en bref

- Chaque joueur voit son mot en maintenant sa carte appuyée. Les civils ont le même mot, les undercovers un mot proche (sans le savoir), Mr White n'en a pas.
- À chaque manche : chacun donne un indice à voix haute, puis tout le monde vote. Le plus voté sort et son rôle est révélé. Égalité : second vote entre les ex æquo, puis personne ne sort si l'égalité persiste.
- Les civils gagnent si tous les infiltrés sont démasqués. Les infiltrés gagnent s'ils sont aussi nombreux que les civils. Mr White démasqué peut gagner seul en devinant le mot des civils.

### Les 5 rôles

| Rôle | Mot | Particularité |
|---|---|---|
| Civil | mot des civils | aucune |
| Undercover | mot proche | croit être un civil |
| Mr White | aucun | peut deviner le mot s'il est démasqué |
| Le Bouclier | mot des civils | annule le premier vote contre lui, mais son rôle est alors révélé |
| Le Détective | mot des civils | une fois par partie, compare son mot avec celui d'un joueur |

Répartition automatique : 3 ou 4 joueurs = Civils + 1 Undercover. Mr White dès 5 joueurs, le Bouclier dès 6, le Détective dès 7, un second Undercover dès 9. À 12 joueurs : 7 civils, 2 undercovers, Mr White, le Bouclier et le Détective. L'hôte peut désactiver les rôles spéciaux dans la salle d'attente.

## Mettre en ligne gratuitement (Render)

1. Crée un dépôt GitHub avec ce dossier (`git init`, `git add .`, `git commit`, puis `git push`). Le `.gitignore` exclut déjà `node_modules` et `client/dist`.
2. Sur [render.com](https://render.com), crée un compte puis **New > Blueprint** et choisis ton dépôt. Le fichier `render.yaml` configure tout. (Sans Blueprint : **New > Web Service**, build `npm install && npm run build`, start `npm start`, plan Free.)
3. Après quelques minutes, Render te donne une adresse `https://undercover-xxxx.onrender.com`. C'est le lien à partager aux joueurs.

À savoir sur l'offre gratuite de Render (vérifié sur [render.com/docs/free](https://render.com/docs/free)) :

- Le service se met en veille après 15 minutes sans trafic. Le premier visiteur attend environ une minute que le service se réveille. Ouvre le site une ou deux minutes avant de lancer la soirée.
- Tant que des joueurs sont connectés, les messages temps réel gardent le service éveillé.
- Les parties vivent en mémoire : si le service redémarre, les salles en cours sont perdues. Pour des parties de 15 minutes, c'est acceptable.
- 750 heures gratuites par mois : largement suffisant pour des soirées entre amis.

## Comment c'est construit (et pourquoi) : pour justifier tes choix

| Choix | Pourquoi |
|---|---|
| **Socket.IO** plutôt que des requêtes HTTP classiques | Le serveur doit pouvoir prévenir tous les téléphones lui-même (quelqu'un a voté, le vote est ouvert). Avec du HTTP classique, chaque téléphone devrait demander sans cesse « du nouveau ? » (polling). Les WebSockets gardent un canal ouvert dans les deux sens. Socket.IO ajoute la reconnexion automatique et un repli en polling si les WebSockets sont bloqués. |
| **Pas de base de données** | Une partie dure quelques minutes et n'a aucune valeur après. Tout vit dans la mémoire du serveur (`Map` des salles) : plus simple, plus rapide, gratuit. Le ménage des salles abandonnées est automatique. |
| **Logique du jeu isolée** (`server/game.js`) | Ce fichier ne connaît ni Express ni Socket.IO : il se teste seul (tests unitaires et 650 parties simulées). La couche réseau (`server/index.js`) ne fait que recevoir, appeler la logique, puis rediffuser. |
| **Le serveur filtre ce que chaque joueur voit** (`viewFor`) | Ne jamais faire confiance au navigateur : si on envoyait tous les mots à tous les téléphones en les cachant à l'affichage, il suffirait d'ouvrir la console pour tricher. Chaque joueur ne reçoit que son mot. L'Undercover reçoit même le rôle « civil », puisqu'il ne sait pas qu'il est undercover. |
| **Jeton secret de reconnexion** | L'identifiant d'un joueur est public (il sert à voter). Se reconnecter demande un jeton aléatoire que seul son téléphone connaît, sinon n'importe qui pourrait usurper un joueur. Le jeton est gardé dans `localStorage`, donc un téléphone qui se met en veille retrouve sa place. |
| **Aléatoire cryptographique** (`crypto.randomInt`) | `Math.random` est prévisible. Pour distribuer les rôles équitablement, on utilise le générateur sécurisé de Node. |
| **Helmet** (en-têtes HTTP) | Ajoute des protections de navigateur : une politique de sécurité de contenu (CSP) limite les scripts et connexions autorisés, et le site ne peut pas être affiché dans une iframe d'un autre site. |
| **Limite de débit par connexion** | 25 événements maximum par tranche de 10 s, et des messages limités à 10 Ko : un client malveillant ne peut pas saturer le serveur. |
| **Validation côté serveur** | Pseudos nettoyés (longueur, caractères invisibles), pseudos uniques, droits vérifiés (seul l'hôte lance, ouvre le vote, etc.), phase du jeu vérifiée pour chaque action. |
| **React + Vite** | React redessine l'écran selon la phase envoyée par le serveur (un composant par phase). Vite fournit le rechargement instantané en développement et un build léger. |
| **Un seul serveur pour le site et le jeu** | Express sert aussi l'interface construite : un seul service à héberger, pas de problème de CORS. |
| **Render** plutôt que Vercel | Vercel exécute des fonctions sans état qui s'arrêtent après chaque requête : impossible d'y garder des WebSockets ouverts et des salles en mémoire. Render fait tourner un vrai serveur Node permanent. |

## Organisation du code

```
server/
  game.js          règles du jeu, rôles, votes, vue filtrée par joueur
  game.test.js     tests de la logique
  words.js         151 paires de mots françaises (cuisine, animaux, lieux, objets, métiers…)
  index.js         Express + Socket.IO, salles, reconnexion, sécurité
client/src/
  useGame.js       connexion au serveur, état, actions
  App.jsx          choix de l'écran selon la phase
  components/      Home, Lobby, Reveal, Discussion, Vote, Result, WhiteGuess, GameOver, Rules…
  styles.css       thème (une couleur d'écran par phase)
test/
  e2e.test.js      partie complète avec de vrais clients Socket.IO
```

## Idées pour aller plus loin

- Un minuteur de discussion qui ouvre le vote tout seul.
- Des mots personnalisés ajoutés par les joueurs (attention : celui qui saisit la paire connaît les deux mots, il faut donc le piocher au hasard dans une liste commune).
- Plus de rôles : Cupidon, le Fou qui gagne s'il est éliminé, etc.
- Stocker les parties terminées dans MySQL pour afficher des statistiques (ce serait l'occasion de relier le projet à ta stack).
