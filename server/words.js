'use strict';

// Paires de mots : [mot A, mot B]. Les deux mots sont proches mais pas identiques.
// Le serveur tire une paire au hasard et décide au hasard lequel est le mot des civils.
const CLASSIQUE = [
  // Cuisine et boissons
  ['Café', 'Thé'], ['Pizza', 'Quiche'], ['Croissant', 'Pain au chocolat'], ['Baguette', 'Pain de mie'],
  ['Fromage', 'Beurre'], ['Chocolat', 'Caramel'], ['Miel', 'Confiture'], ['Crêpe', 'Gaufre'],
  ['Glace', 'Sorbet'], ['Pomme', 'Poire'], ['Fraise', 'Framboise'], ['Citron', 'Orange'],
  ['Lait', 'Yaourt'], ['Vin', 'Champagne'], ['Bière', 'Cidre'], ['Soupe', 'Velouté'],
  ['Sushi', 'Maki'], ['Pâtes', 'Riz'], ['Burger', 'Sandwich'], ['Ketchup', 'Mayonnaise'],
  ['Sel', 'Poivre'], ['Gâteau', 'Tarte'], ['Bonbon', 'Chewing-gum'], ['Limonade', 'Jus d’orange'],
  ['Beurre', 'Margarine'], ['Barbecue', 'Raclette'], ['Frigo', 'Congélateur'], ['Four', 'Micro-ondes'],
  // Animaux
  ['Chien', 'Loup'], ['Lion', 'Tigre'], ['Cheval', 'Âne'], ['Requin', 'Dauphin'],
  ['Abeille', 'Guêpe'], ['Papillon', 'Libellule'], ['Grenouille', 'Crapaud'], ['Souris', 'Hamster'],
  ['Aigle', 'Faucon'], ['Mouton', 'Chèvre'], ['Poule', 'Canard'], ['Crocodile', 'Alligator'],
  ['Singe', 'Gorille'], ['Araignée', 'Scorpion'], ['Dragon', 'Dinosaure'],
  // Objets du quotidien
  ['Stylo', 'Crayon'], ['Chaise', 'Tabouret'], ['Canapé', 'Fauteuil'], ['Table', 'Bureau'],
  ['Lampe', 'Bougie'], ['Miroir', 'Fenêtre'], ['Couteau', 'Épée'], ['Fourchette', 'Cuillère'],
  ['Assiette', 'Bol'], ['Verre', 'Tasse'], ['Sac à dos', 'Valise'], ['Parapluie', 'Imperméable'],
  ['Montre', 'Réveil'], ['Téléphone', 'Tablette'], ['Ordinateur', 'Télévision'], ['Casque', 'Écouteurs'],
  ['Clé', 'Cadenas'], ['Livre', 'Magazine'], ['Cahier', 'Carnet'], ['Savon', 'Shampoing'],
  ['Brosse à dents', 'Peigne'], ['Lunettes', 'Lentilles'], ['Chapeau', 'Casquette'], ['Écharpe', 'Cravate'],
  ['Bague', 'Bracelet'], ['Chaussettes', 'Collants'], ['Baskets', 'Bottes'], ['Pull', 'Gilet'],
  ['Oreiller', 'Coussin'], ['Couette', 'Couverture'], ['Pyjama', 'Robe de chambre'], ['Rideau', 'Store'],
  ['Aspirateur', 'Balai'], ['Machine à laver', 'Lave-vaisselle'], ['Parfum', 'Déodorant'],
  ['Rouge à lèvres', 'Vernis à ongles'], ['Tatouage', 'Piercing'], ['Dictionnaire', 'Encyclopédie'],
  // Lieux
  ['Plage', 'Piscine'], ['Montagne', 'Colline'], ['Forêt', 'Jungle'], ['Rivière', 'Lac'],
  ['Désert', 'Savane'], ['Château', 'Palais'], ['Musée', 'Galerie'], ['Hôpital', 'Clinique'],
  ['École', 'Université'], ['Cinéma', 'Théâtre'], ['Supermarché', 'Marché'], ['Boulangerie', 'Pâtisserie'],
  ['Gare', 'Aéroport'], ['Hôtel', 'Auberge'], ['Zoo', 'Cirque'], ['Bibliothèque', 'Librairie'],
  ['Stade', 'Gymnase'], ['Mer', 'Océan'], ['Camping', 'Randonnée'], ['Cuisine', 'Salle de bain'],
  // Transports
  ['Vélo', 'Trottinette'], ['Moto', 'Scooter'], ['Train', 'Métro'], ['Avion', 'Hélicoptère'],
  ['Bateau', 'Sous-marin'], ['Voiture', 'Camion'], ['Bus', 'Tramway'],
  // Sports, métiers, culture
  ['Football', 'Rugby'], ['Tennis', 'Ping-pong'], ['Natation', 'Plongée'], ['Ski', 'Snowboard'],
  ['Yoga', 'Pilates'], ['Guitare', 'Ukulélé'], ['Chanteur', 'Rappeur'], ['Médecin', 'Infirmier'],
  ['Pompier', 'Policier'], ['Boulanger', 'Pâtissier'], ['Professeur', 'Instituteur'], ['Dentiste', 'Coiffeur'],
  ['Facteur', 'Livreur'], ['Danse', 'Gymnastique'], ['Opéra', 'Comédie musicale'], ['Peinture', 'Dessin'],
  ['Radio', 'Podcast'], ['Photo', 'Selfie'], ['Carte postale', 'Lettre'],
  // Fantastique et imaginaire
  ['Pirate', 'Corsaire'], ['Magicien', 'Sorcier'], ['Vampire', 'Zombie'], ['Fantôme', 'Squelette'],
  ['Roi', 'Empereur'], ['Princesse', 'Reine'], ['Fée', 'Sorcière'], ['Père Noël', 'Père Fouettard'],
  ['Harry Potter', 'Seigneur des Anneaux'], ['Mario', 'Sonic'], ['Minecraft', 'Fortnite'],
  // Numérique
  ['Facebook', 'Instagram'], ['WhatsApp', 'Messenger'], ['Netflix', 'YouTube'],
  // Temps, météo, fêtes
  ['Noël', 'Nouvel An'], ['Anniversaire', 'Mariage'], ['Vacances', 'Week-end'], ['Pluie', 'Neige'],
  ['Soleil', 'Lune'], ['Orage', 'Tempête'], ['Sieste', 'Nuit'], ['Rire', 'Sourire'],
  ['Bébé', 'Enfant'], ['Cadeau', 'Surprise'],
];


const ANNEES_80 = [
  ['Walkman', 'Radiocassette'], ['Minitel', 'Téléphone fixe'], ['Rubik’s Cube', 'Taquin'], ['Moon boots', 'Après-ski'],
  ['Goldorak', 'Albator'], ['Club Dorothée', 'Récré A2'], ['Polaroïd', 'Caméscope'], ['Jogging', 'Aérobic'],
  ['Pac-Man', 'Space Invaders'], ['Épaulettes', 'Jambières'], ['Michael Jackson', 'Prince'], ['Madonna', 'Cyndi Lauper'],
  ['Dallas', 'Dynastie'], ['Magnétoscope', 'Cassette vidéo'], ['E.T.', 'Gremlins'], ['Top 50', 'Hit-parade'],
];

const ANNEES_90 = [
  ['Tamagotchi', 'Game Boy'], ['Spice Girls', 'Backstreet Boys'], ['Beverly Hills', 'Dawson'], ['Cassette', 'CD'],
  ['Pokémon', 'Digimon'], ['Titanic', 'Jurassic Park'], ['Nirvana', 'Oasis'], ['Discman', 'Walkman'],
  ['Super Nintendo', 'Mega Drive'], ['Les Simpson', 'South Park'], ['MC Solaar', 'IAM'], ['Zidane', 'Ronaldo'],
  ['Tomb Raider', 'Super Mario'], ['Furby', 'Polly Pocket'], ['Pogs', 'Cartes Pokémon'], ['McDonald’s', 'Quick'],
];

const MILLENIALS = [
  ['MSN', 'Skype'], ['Skyblog', 'Facebook'], ['iPod', 'Lecteur MP3'], ['Nokia 3310', 'Motorola Razr'],
  ['Loft Story', 'Star Academy'], ['Wii', 'PlayStation'], ['Harry Potter', 'Twilight'], ['Lady Gaga', 'Rihanna'],
  ['YouTube', 'Dailymotion'], ['Kinder Bueno', 'Kinder Délice'], ['Tektonik', 'Hip-hop'], ['Crocs', 'Tongs'],
  ['Hunger Games', 'Divergente'], ['Shakira', 'Beyoncé'], ['Candy Crush', 'Angry Birds'], ['BlackBerry', 'iPhone'],
];

const GEN_Z = [
  ['TikTok', 'Reels'], ['BeReal', 'Snapchat'], ['AirPods', 'Écouteurs filaires'], ['Vinted', 'Leboncoin'],
  ['Twitch', 'YouTube'], ['Fortnite', 'Roblox'], ['Bubble tea', 'Smoothie'], ['Discord', 'WhatsApp'],
  ['Squeezie', 'Inoxtag'], ['Billie Eilish', 'Dua Lipa'], ['Skincare', 'Maquillage'], ['Trottinette électrique', 'Hoverboard'],
  ['Spotify', 'Deezer'], ['Emoji', 'Sticker'], ['Influenceur', 'Streamer'], ['Shein', 'Zara'],
  ['Uber Eats', 'Deliveroo'], ['ChatGPT', 'Google'],
];

const FILMS = [
  ['Titanic', 'Avatar'], ['Shrek', 'Madagascar'], ['Harry Potter', 'Le Seigneur des anneaux'], ['Star Wars', 'Star Trek'],
  ['Batman', 'Superman'], ['Toy Story', 'Cars'], ['La Reine des neiges', 'Raiponce'], ['Le Roi Lion', 'Bambi'],
  ['Astérix', 'Tintin'], ['Intouchables', 'Bienvenue chez les Ch’tis'], ['Jurassic Park', 'Godzilla'], ['Matrix', 'Inception'],
  ['Minions', 'Schtroumpfs'], ['Taxi', 'Fast & Furious'], ['Spider-Man', 'Iron Man'], ['Indiana Jones', 'Pirates des Caraïbes'],
  ['Marvel', 'DC Comics'], ['Oscar', 'César'],
];

const SERIES = [
  ['Netflix', 'Disney+'], ['Squid Game', 'La Casa de Papel'], ['Stranger Things', 'Wednesday'], ['Game of Thrones', 'Vikings'],
  ['Friends', 'How I Met Your Mother'], ['Breaking Bad', 'Peaky Blinders'], ['Les Simpson', 'Family Guy'], ['Lupin', 'Dix pour cent'],
  ['Plus belle la vie', 'Demain nous appartient'], ['Emily in Paris', 'Sex and the City'], ['Les Feux de l’amour', 'Santa Barbara'],
  ['Les Experts', 'NCIS'], ['Grey’s Anatomy', 'Dr House'], ['Koh-Lanta', 'Fort Boyard'], ['The Witcher', 'Arcane'],
  ['Bridgerton', 'Downton Abbey'], ['Prison Break', 'Lost'], ['Scènes de ménages', 'Joséphine ange gardien'],
];

const MUSIQUE = [
  ['Guitare', 'Basse'], ['Rap', 'Rock'], ['Concert', 'Festival'], ['Casque', 'Enceinte'],
  ['Piano', 'Orgue'], ['Violon', 'Violoncelle'], ['Batterie', 'Djembé'], ['Scène', 'Studio d’enregistrement'],
  ['Vinyle', 'Cassette audio'], ['Karaoké', 'Chorale'], ['Flûte', 'Clarinette'], ['Trompette', 'Saxophone'],
  ['Daft Punk', 'Justice'], ['Mozart', 'Beethoven'], ['Édith Piaf', 'Dalida'], ['Johnny Hallyday', 'Eddy Mitchell'],
  ['Clavier', 'Synthétiseur'], ['Techno', 'Électro'], ['Ukulélé', 'Banjo'],
];

const ENFANTS = [
  ['Peluche', 'Doudou'], ['Toboggan', 'Balançoire'], ['Pâte à modeler', 'Slime'], ['Lego', 'Playmobil'],
  ['Crayon', 'Feutre'], ['Dinosaure', 'Licorne'], ['Sucette', 'Barbe à papa'], ['Cartable', 'Trousse'],
  ['Pyjama', 'Chaussons'], ['Bain', 'Douche'], ['Trottinette', 'Patins à roulettes'], ['Cabane', 'Château de sable'],
  ['Princesse', 'Fée'], ['Pompier', 'Super-héros'], ['Pat’ Patrouille', 'Peppa Pig'], ['Bulles de savon', 'Ballon'],
  ['Bac à sable', 'Piscine gonflable'], ['Tétine', 'Biberon'], ['Cirque', 'Fête foraine'],
];

/**
 * Les thèmes proposés à l'hôte. Chaque thème est un lot de paires de mots proches.
 * "classique" regroupe les paires de la première version du jeu.
 */
const THEMES = [
  { id: 'classique', label: 'Classique', emoji: '🎲', pairs: CLASSIQUE },
  { id: 'annees80', label: 'Années 80', emoji: '📼', pairs: ANNEES_80 },
  { id: 'annees90', label: 'Années 90', emoji: '💾', pairs: ANNEES_90 },
  { id: 'millenials', label: 'Millénials', emoji: '📱', pairs: MILLENIALS },
  { id: 'genz', label: 'Gen Z', emoji: '🔥', pairs: GEN_Z },
  { id: 'films', label: 'Films', emoji: '🎬', pairs: FILMS },
  { id: 'series', label: 'Séries', emoji: '📺', pairs: SERIES },
  { id: 'musique', label: 'Musique', emoji: '🎵', pairs: MUSIQUE },
  { id: 'enfants', label: 'Enfants', emoji: '🧸', pairs: ENFANTS },
];

const THEME_IDS = THEMES.map((t) => t.id);
const PAIRS = THEMES.flatMap((t) => t.pairs);

module.exports = { THEMES, THEME_IDS, PAIRS };
