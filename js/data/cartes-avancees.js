/* =====================================================================
   Numéville 3D — cartes du mode avancé (13 Objets, 13 Pouvoirs)
   Source : cartes Numéville Print & Play (INR), textes repris à l'identique.

   moment     : quand la carte peut être jouée (utilisé par js/jeu/mode-avance.js)
   complice   : Complice concerné ; s'il est déjà sauvé ou perdu au moment
                de la pioche, on reprend une carte (règle du livret, p. 12)
   utilisations (Pouvoirs) : Infinity = tant que la carte est gardée,
                'manche' = une fois par manche, sinon un nombre
   ===================================================================== */

(function () {
  const OBJETS = [
    { id: 'parapluie', titre: 'Parapluie anti-trolls', moment: 'attaque',
      texte: 'Jouez cette carte après avoir pioché une carte « Dark Master – attaque » : annulez entièrement ses effets.' },
    { id: 'doubleverif', titre: 'Double vérification', moment: 'de-noir',
      texte: 'Après avoir lancé le dé noir, vous pouvez le relancer une fois et garder le nouveau résultat au choix.' },
    { id: 'gps', titre: 'GPS de Numéville', moment: 'deplacement',
      texte: 'Avant de lancer le dé blanc, jouez cette carte : vous pouvez avancer votre pion de 1 à 3 cases au choix, sans lancer le dé blanc ce tour-ci.' },
    { id: 'guidecyber', titre: 'Guide de cybersécurité', moment: 'mauvaise-reponse', complice: 'hacker',
      texte: 'Jouez cette carte après avoir raté une question sur Hacker : ne placez pas 1 jeton mauvaise pratique sur sa fiche.' },
    { id: 'kit', titre: 'Kit de réparation', moment: 'libre', complice: 'hyperco',
      texte: 'Retirez 1 jeton mauvaise pratique de la fiche d’Hyperco.' },
    { id: 'carnetbp', titre: 'Carnet de bonnes pratiques', moment: 'bonne-reponse',
      texte: 'Après une bonne réponse, jouez cette carte pour placer 1 jeton bonne pratique supplémentaire sur le même Complice (donc 2 au total, ne s’applique pas en face-à-face).' },
    { id: 'loupe', titre: 'Loupe à fake news', moment: 'avant-question', complice: 'stalky',
      texte: 'Si vous devez répondre à une question sur Stalky, jouez cette carte : traitez votre question comme une question facile, même si le dé noir indiquait difficile (piochez dans la pile facile).' },
    { id: 'coffre', titre: 'Coffre-fort de données', moment: 'perte-datata', complice: 'datata',
      texte: 'Jouez cette carte quand une carte Dark Master vous demande de retirer 1 jeton bonne pratique de Datata : ignorez cette perte.' },
    { id: 'chargeur', titre: 'Chargeur universel', moment: 'fin-tour',
      texte: 'À la fin de votre tour, jouez cette carte : choisissez un autre joueur ; il peut jouer un tour supplémentaire (dé blanc + dé noir) avant la fin de la manche.' },
    { id: 'filtre', titre: 'Filtre anti-pub', moment: 'quartier', complice: 'hyperco',
      texte: 'Jouez cette carte lorsque vous êtes dans le quartier d’Hyperco : jusqu’à la fin de la manche, toutes les questions sur Hyperco ne peuvent pas donner plus de 1 jeton mauvaise pratique à la fois, même en face-à-face.' },
    { id: 'indices', titre: 'Carnet d’indices', moment: 'avant-question',
      texte: 'Avant de répondre à une question, jouez cette carte : le groupe peut se concerter pendant 1 minute et vous aider à répondre.' },
    { id: 'capture', titre: 'Capture d’écran', moment: 'mauvaise-reponse',
      texte: 'Jouez cette carte après une mauvaise réponse : ne placez pas le jeton mauvaise pratique sur la fiche du Complice concerné.' },
    { id: 'plan', titre: 'Plan de Numéville', moment: 'deplacement',
      texte: 'À votre tour, au lieu de lancer le dé blanc, jouez cette carte : déplacez votre pion directement dans le quartier de votre choix (sur n’importe quelle case de ce quartier).' },
  ];

  const POUVOIRS = [
    { id: 'ambassadeur', titre: 'Ambassadeur du calme', utilisations: Infinity,
      texte: 'Jusqu’à la fin de la partie, lorsque vous êtes en face-à-face avec un Complice : une mauvaise réponse ne donne que 1 jeton mauvaise pratique (au lieu de 2).' },
    { id: 'gardien', titre: 'Gardien des données', utilisations: Infinity, complice: 'datata',
      texte: 'Jusqu’à la fin de la partie, à chaque fois que vous réussissez une question sur Datata : vous pouvez placer 1 jeton bonne pratique supplémentaire sur Datata (max 1 fois par tour).' },
    { id: 'decodeur', titre: 'Décodeur de fake news', utilisations: 2, complice: 'stalky',
      texte: 'Deux fois dans la partie, après avoir vu le résultat du dé noir sur Stalky, vous pouvez relancer le dé noir.' },
    { id: 'maitredes', titre: 'Maître des dés', utilisations: 'manche',
      texte: 'Une fois par manche, après votre lancer de dé blanc ou noir, vous pouvez ajouter +1 ou -1 au résultat.' },
    { id: 'bouclier', titre: 'Bouclier numérique', utilisations: 2,
      texte: 'Deux fois dans la partie, lorsque vous devriez piocher une carte « Dark Master – attaque », vous pouvez décider de l’ignorer complètement.' },
    { id: 'eclaireur', titre: 'Éclaireur rapide', utilisations: Infinity,
      texte: 'Tant que vous avez ce pouvoir, vous pouvez, à votre tour : soit lancer le dé blanc normalement, soit choisir d’avancer de 2 cases, sans lancer le dé blanc.' },
    { id: 'coach', titre: 'Coach des Complices', utilisations: 2,
      texte: 'Deux fois dans la partie, après une bonne réponse difficile, vous pouvez : soit placer 1 jeton bonne pratique sur la fiche du Complice, soit retourner 1 jeton mauvaise pratique de ce Complice sur sa face bonne pratique.' },
    { id: 'relais', titre: 'Relais solidaire', utilisations: 1,
      texte: 'Une fois dans la partie, après votre tour, vous pouvez désigner un autre joueur : à son tour, il peut se rendre sur la case de son choix sans lancer le dé blanc.' },
    { id: 'veilleur', titre: 'Veilleur de Numéville', utilisations: Infinity,
      texte: 'À la fin de chaque manche, avant de piocher officiellement la carte « Dark Master – fin de manche », vous pouvez : regarder secrètement la première carte de la pioche et décider de la reposer dessus ou dessous la pioche.' },
    { id: 'reparcafe', titre: 'Repar’café', utilisations: 2,
      texte: 'Deux fois dans la partie, à la fin de votre tour, vous pouvez retirer 1 jeton mauvaise pratique de n’importe quel Complice au choix.' },
    { id: 'mediateur', titre: 'Médiateur en ligne', utilisations: Infinity, complice: 'stalky',
      texte: 'Tant que vous avez ce pouvoir, à chaque fois que vous réussissez une question sur Stalky, vous pouvez choisir : soit de placer 1 jeton bonne pratique sur Stalky, soit de placer 1 jeton bonne pratique sur un autre Complice de votre choix qui n’a pas encore été sauvé.' },
    { id: 'cyberpatrouille', titre: 'Cyber-patrouille', utilisations: 2,
      texte: 'Deux fois dans la partie, juste après votre déplacement, vous pouvez : choisir un Complice et considérer que vous êtes dans son quartier pour la question, même si votre pion est ailleurs.' },
    { id: 'memoire', titre: 'Mémoire longue', utilisations: 1,
      texte: 'Une seule fois dans la partie, quand un Complice devrait être perdu, vous pouvez retarder sa perte : retirez immédiatement 1 jeton mauvaise pratique de la fiche de ce Complice.' },
  ];

  NV.OBJETS = OBJETS;
  NV.POUVOIRS = POUVOIRS;
})();
