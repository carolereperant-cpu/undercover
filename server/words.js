'use strict';

// Paires de mots : [mot A, mot B]. Les deux mots sont proches mais pas identiques.
// Le serveur tire une paire au hasard et décide au hasard lequel est le mot des civils.
const PAIRS = [
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

module.exports = { PAIRS };
