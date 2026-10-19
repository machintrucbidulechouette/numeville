/* =====================================================================
   Numéville 3D — données des règles du jeu de base
   (plateau, Complices, Éclaireurs, seuils, cartes Dark Master)
   Source : livret de règles et cartes Numéville Print & Play (INR)
   ===================================================================== */

(function () {
  // Coordonnées relevées sur le plateau imprimé (image 561 px, plateau de 17→543 / 15→542)
  const px = (x, y) => ({ u: (x - 17) / 526, v: (y - 15) / 527 });

  /* Les 4 Complices, dans l'ordre de leurs numéros de questions */
  const COMPLICES = {
    hyperco: {
      id: 'hyperco', nom: 'Hyperco', couleur: '#3daa35', couleurClaire: '#8ee07f',
      theme: 'Surconsommation et impact environnemental du numérique',
      sauveNom: 'Nico', zone: px(477, 83),
    },
    stalky: {
      id: 'stalky', nom: 'Stalky', couleur: '#e6007e', couleurClaire: '#ff6fbf',
      theme: 'Réseaux sociaux, rumeurs et cyberharcèlement',
      sauveNom: 'Sally', zone: px(83, 83),
    },
    datata: {
      id: 'datata', nom: 'Datata', couleur: '#f05a1a', couleurClaire: '#ffa06f',
      theme: 'Données personnelles et intelligence artificielle',
      sauveNom: 'Tatiana', zone: px(83, 477),
    },
    hacker: {
      id: 'hacker', nom: 'Hacker', couleur: '#1aa3e8', couleurClaire: '#7fd2ff',
      theme: 'Cybersécurité et arnaques en ligne',
      sauveNom: 'Iker', zone: px(477, 477),
    },
  };
  const ORDRE_COMPLICES = ['stalky', 'hyperco', 'hacker', 'datata'];

  /* Boucle du plateau, dans le sens horaire (index croissant = sens horaire).
     type : 'case' (case de quartier), 'face' (portrait du Complice : face-à-face), 'place' */
  const BOUCLE = [
    { ...px(213, 65),  type: 'face',  c: 'stalky'  }, // 0
    { ...px(315, 65),  type: 'case',  c: 'hyperco' }, // 1
    { ...px(380, 95),  type: 'case',  c: 'hyperco' }, // 2
    { ...px(398, 158), type: 'case',  c: 'hyperco' }, // 3  ← départ haut-droite
    { ...px(497, 200), type: 'face',  c: 'hyperco' }, // 4
    { ...px(500, 335), type: 'case',  c: 'hacker'  }, // 5
    { ...px(430, 385), type: 'case',  c: 'hacker'  }, // 6  ← départ bas-droite
    { ...px(397, 490), type: 'face',  c: 'hacker'  }, // 7
    { ...px(277, 465), type: 'place', c: null      }, // 8
    { ...px(172, 432), type: 'case',  c: 'datata'  }, // 9  ← départ bas-gauche
    { ...px(52, 382),  type: 'case',  c: 'datata'  }, // 10
    { ...px(125, 325), type: 'face',  c: 'datata'  }, // 11
    { ...px(55, 237),  type: 'case',  c: 'stalky'  }, // 12
    { ...px(90, 172),  type: 'case',  c: 'stalky'  }, // 13
    { ...px(157, 155), type: 'case',  c: 'stalky'  }, // 14 ← départ haut-gauche
  ];

  /* Cases départ (hors boucle) et la case de la boucle à laquelle elles mènent */
  const DEPARTS = [
    { id: 'hg', ...px(200, 205), entree: 14 },
    { id: 'hd', ...px(355, 205), entree: 3 },
    { id: 'bd', ...px(355, 355), entree: 6 },
    { id: 'bg', ...px(200, 355), entree: 9 },
  ];

  /* Emplacements des pioches Dark Master au centre du plateau */
  const PIOCHES = {
    fin:     { ...px(247, 280), w: 0.124, h: 0.18 },
    attaque: { ...px(316, 280), w: 0.124, h: 0.18 },
  };

  /* Les 4 Éclaireurs du Numérique (pions) */
  const ECLAIREURS = {
    ana:   { id: 'ana',   nom: 'Ana',   couleur: '#b98cff', desc: 'Espiègle, elle n’a pas froid aux yeux et sait faire face à n’importe quelle situation.' },
    tom:   { id: 'tom',   nom: 'Tom',   couleur: '#2fd3c5', desc: 'Calme et stratège, il anticipe les mouvements adverses pour neutraliser les attaques des Complices.' },
    emily: { id: 'emily', nom: 'Emily', couleur: '#ffd23f', desc: 'Artiste talentueuse, elle utilise son talent pour inspirer les autres.' },
    hakim: { id: 'hakim', nom: 'Hakim', couleur: '#ff6b5a', desc: 'Il puise son courage dans son sens de la justice pour rétablir l’ordre dans Numéville.' },
  };

  /* Seuils [jetons bleus pour sauver, jetons rouges pour perdre] (page 10 des règles) */
  const SEUILS = {
    2: { decouverte: [3, 4], standard: [4, 4], expert: [5, 3] },
    3: { decouverte: [3, 4], standard: [4, 4], expert: [5, 3] },
    4: { decouverte: [3, 5], standard: [4, 5], expert: [5, 4] },
  };
  const NIVEAUX = { decouverte: 'Découverte', standard: 'Standard', expert: 'Expert' };

  /* Cartes « Dark Master – Fin de manche » (10 cartes) */
  const CARTES_FIN = [
    { id: 'vague',        titre: 'Vague de désinformation', texte: 'Ajoutez 1 jeton mauvaise pratique à Stalky et Datata (si possible).' },
    { id: 'cyberattaque', titre: 'Cyberattaque coordonnée', texte: 'Ajoutez 1 jeton mauvaise pratique à Hacker. Choisissez un autre Complice : ajoutez-lui aussi 1 jeton mauvaise pratique.' },
    { id: 'surconso',     titre: 'Surconsommation massive', texte: 'Ajoutez 1 jeton mauvaise pratique à un Complice au choix OU retirez 1 jeton bonne pratique à un Complice au choix.' },
    { id: 'fuite',        titre: 'Fuite de données',        texte: 'Ajoutez 1 jeton mauvaise pratique à Datata. Si Datata a déjà au moins 2 mauvaises pratiques, ajoutez aussi 1 jeton mauvaise pratique à un autre Complice au choix.' },
    { id: 'fuite',        titre: 'Fuite de données',        texte: 'Ajoutez 1 jeton mauvaise pratique à Datata. Si Datata a déjà au moins 2 mauvaises pratiques, ajoutez aussi 1 jeton mauvaise pratique à un autre Complice au choix.' },
    { id: 'nuitblanche',  titre: 'Nuit blanche sur les écrans', texte: 'Pendant la prochaine manche, au premier dé noir ayant un résultat entre 1 et 3, traitez la question comme difficile. Les autres lancers se jouent normalement.' },
    { id: 'obsolescence', titre: 'Obsolescence programmée', texte: 'Retirez 1 jeton bonne pratique à Hyperco. Ajoutez 1 jeton mauvaise pratique à Hyperco.' },
    { id: 'brouillard',   titre: 'Brouillard sur Numéville', texte: 'Pendant la prochaine manche, la première mauvaise réponse de chaque Complice ajoute 1 jeton mauvaise pratique supplémentaire (donc 2 au total). Les suivantes ne donnent qu’1 jeton.' },
    { id: 'mobilisation', titre: 'Mobilisation citoyenne',  texte: 'Retirez 1 jeton mauvaise pratique à chaque Complice qui en possède au moins 1.' },
    { id: 'campagne',     titre: 'Campagne éducative',      texte: 'Choisissez un Complice : retirez-lui 1 mauvaise pratique OU ajoutez-lui 1 bonne pratique.' },
  ];

  /* Cartes « Dark Master – Attaque » (15 cartes) */
  const CARTES_ATTAQUE = [
    { id: 'messagepiege', titre: 'Message piégé',            texte: 'Ajoutez 1 jeton mauvaise pratique au Complice du quartier du joueur qui a déclenché l’attaque.' },
    { id: 'rumeur',       titre: 'Rumeur virale',            texte: 'Ajoutez 1 jeton mauvaise pratique à Stalky.' },
    { id: 'motdepasse',   titre: 'Mot de passe trop simple', texte: 'Ajoutez 1 jeton mauvaise pratique à Hacker.' },
    { id: 'revendues',    titre: 'Données revendues',        texte: 'Ajoutez 1 jeton mauvaise pratique à Datata.' },
    { id: 'promo',        titre: 'Promo impossible à refuser', texte: 'Ajoutez 1 jeton mauvaise pratique à Hyperco.' },
    { id: 'cleusb',       titre: 'Clé USB suspecte',         texte: 'Ajoutez 1 jeton mauvaise pratique à Hacker.' },
    { id: 'stress',       titre: 'Coup de stress',           texte: 'Le joueur qui a déclenché cette carte doit immédiatement répondre à 1 question difficile supplémentaire sur le même Complice. Appliquez normalement le résultat.' },
    { id: 'influence',    titre: 'Influence toxique',        texte: 'Choisissez un Complice qui a déjà au moins 1 bonne pratique. Retournez 1 jeton bonne pratique de ce Complice sur sa face mauvaise pratique.' },
    { id: 'bug',          titre: 'Bug temporaire',           texte: 'Retirez 1 jeton bonne pratique au Complice de votre choix.' },
    { id: 'trolls',       titre: 'Trolls en embuscade',      texte: 'Ajoutez 1 jeton mauvaise pratique à 2 Complices au choix ayant déjà au moins 1 mauvaise pratique.' },
    { id: 'notification', titre: 'Notification sans fin',    texte: 'Le joueur qui a déclenché cette carte ne lance pas le dé blanc à son prochain tour : il reste dans le même quartier, mais joue son tour normalement (dé noir, question…).' },
    { id: 'piegeclics',   titre: 'Piège à clics',            texte: 'Au prochain tour de ce joueur : si le dé noir fait 1, 2 ou 3, il devra piocher une question difficile au lieu d’une question facile.' },
    { id: 'partage',      titre: 'Partage incontrôlé',       texte: 'Ajoutez 1 jeton mauvaise pratique à Datata OU à Stalky. Puis ajoutez 1 jeton mauvaise pratique à un Complice au choix ayant déjà au moins 1 jeton mauvaise pratique.' },
    { id: 'crash',        titre: 'Crash de serveur',         texte: 'Le joueur qui a déclenché cette carte doit choisir : soit retirer 1 jeton bonne pratique de la fiche d’Hacker, soit ajouter 1 jeton mauvaise pratique au Complice de son quartier.' },
    { id: 'consoexpress', titre: 'Consommation express',     texte: 'Le joueur qui a déclenché cette carte doit lancer à nouveau le dé noir : sur 1-2-3 rien ne se passe ; sur 4-5-6 il doit répondre à 1 question difficile sur Hyperco.' },
  ];

  window.NV = {
    COMPLICES, ORDRE_COMPLICES, BOUCLE, DEPARTS, PIOCHES, ECLAIREURS,
    SEUILS, NIVEAUX, CARTES_FIN, CARTES_ATTAQUE,
  };
})();
