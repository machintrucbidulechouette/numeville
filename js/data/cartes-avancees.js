/* =====================================================================
   Numéville 3D — cartes du mode avancé (13 Objets, 13 Pouvoirs)
   Source : cartes Numéville Print & Play (INR), textes repris à l'identique.

   moment     : quand la carte peut être jouée (utilisé par js/jeu/mode-avance.js)
   complice   : Complice concerné ; s'il est déjà sauvé ou perdu au moment
                de la pioche, on reprend une carte (règle du livret)
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


  /* Fiches « En savoir plus » : quand jouer la carte, ce qu'elle fait, un conseil.
     Rédigées pour être comprises sans connaître les règles du jeu de plateau. */
  const DETAILS = {
    // ---- Objets (usage unique : la carte est défaussée après usage) ----
    parapluie: { quand: 'Juste après la révélation d’une carte « Dark Master – Attaque », pendant ton tour.', effet: 'La carte d’attaque est annulée : aucun de ses effets ne s’applique.', conseil: 'Garde-la pour une attaque qui ferait vraiment mal (par exemple un jeton mauvaise pratique sur un Complice presque perdu).' },
    doubleverif: { quand: 'Juste après avoir lancé le dé noir.', effet: 'Tu relances le dé noir une fois, puis tu choisis lequel des deux résultats garder.', conseil: 'Utile pour éviter un 6 (attaque) ou pour viser une question facile (1 à 3).' },
    gps: { quand: 'Au début de ton tour, à la place du dé blanc.', effet: 'Tu avances de 1, 2 ou 3 cases, au choix, dans le sens de ton choix.', conseil: 'Parfait pour atteindre une case précise toute proche : un face-à-face, la Place ou la case Pouvoir.' },
    guidecyber: { quand: 'Juste après une mauvaise réponse à une question sur Hacker.', effet: 'Le jeton mauvaise pratique n’est pas placé sur la fiche de Hacker.', conseil: 'Encore plus précieux en face-à-face, où une erreur coûte normalement 2 jetons.' },
    kit: { quand: 'Au début de ton tour, avant de te déplacer (Hyperco doit avoir au moins 1 jeton mauvaise pratique).', effet: 'Tu retires 1 jeton mauvaise pratique de la fiche d’Hyperco.', conseil: 'À jouer quand Hyperco approche du seuil où il serait perdu.' },
    carnetbp: { quand: 'Juste après une bonne réponse (pas en face-à-face).', effet: 'Le Complice reçoit 1 jeton bonne pratique de plus : 2 au total pour cette réponse.', conseil: 'Idéal pour finir de sauver un Complice à qui il ne manque qu’un ou deux jetons.' },
    loupe: { quand: 'Avant de piocher une question difficile sur Stalky.', effet: 'Tu pioches une question facile à la place.', conseil: 'Joue-la surtout en face-à-face avec Stalky : une question plus simple, un résultat doublé.' },
    coffre: { quand: 'Quand une carte Dark Master veut retirer un jeton bonne pratique à Datata (n’importe quel joueur qui l’a peut la jouer).', effet: 'Datata garde son jeton bonne pratique.', conseil: 'Elle protège automatiquement les progrès faits sur Datata : garde-la tant que Datata n’est pas sauvé.' },
    chargeur: { quand: 'À la fin de ton tour.', effet: 'Tu choisis un autre joueur : il joue un tour supplémentaire complet (dé blanc puis dé noir) avant la fin de la manche.', conseil: 'Choisis le joueur le mieux placé, par exemple à côté d’un face-à-face.' },
    filtre: { quand: 'Quand tu es dans le quartier d’Hyperco, avant de répondre.', effet: 'Jusqu’à la fin de la manche, chaque question sur Hyperco donne au maximum 1 jeton mauvaise pratique, même en face-à-face ou avec le Brouillard.', conseil: 'Très utile si plusieurs joueurs vont passer par le quartier d’Hyperco pendant la manche.' },
    indices: { quand: 'Avant de voir la question.', effet: 'Le groupe peut se concerter pendant 1 minute pour t’aider à répondre (un compte à rebours s’affiche sur la question).', conseil: 'Garde-la pour une question difficile ou un face-à-face.' },
    capture: { quand: 'Juste après une mauvaise réponse, quel que soit le Complice.', effet: 'Le jeton mauvaise pratique n’est pas placé (aucun jeton, même en face-à-face).', conseil: 'La protection la plus souple : elle marche pour tous les Complices.' },
    plan: { quand: 'Au début de ton tour, à la place du dé blanc.', effet: 'Tu vas directement sur la case de ton choix dans le quartier de ton choix (si elle est occupée, sur la suivante libre).', conseil: 'Le moyen le plus sûr d’atteindre un face-à-face ou la case Objet / Pouvoir.' },
    // ---- Pouvoirs (restent en main tant qu'on les garde) ----
    ambassadeur: { quand: 'Automatique, à chaque face-à-face raté.', effet: 'Une mauvaise réponse en face-à-face ne donne qu’1 jeton mauvaise pratique au lieu de 2.', conseil: 'Ose les face-à-face : le risque est réduit de moitié.' },
    gardien: { quand: 'Automatique, après une bonne réponse sur Datata (une fois par tour).', effet: 'Datata reçoit 1 jeton bonne pratique de plus.', conseil: 'Va souvent dans le quartier de Datata pour en profiter.' },
    decodeur: { quand: 'Juste après avoir lancé le dé noir pour une question sur Stalky.', effet: 'Tu relances le dé noir et gardes le nouveau résultat.', conseil: 'Utilise-le pour échapper à un 6 (attaque) ou à une question difficile.' },
    maitredes: { quand: 'Une fois par manche, juste après un lancer de dé blanc ou de dé noir.', effet: 'Tu ajoutes +1 ou −1 au résultat (entre 1 et 6).', conseil: 'Au dé blanc pour tomber pile sur une case ; au dé noir pour transformer un 4 en 3 (question facile) ou un 6 en 5 (pas d’attaque).' },
    bouclier: { quand: 'Quand tu fais 6 au dé noir, avant que la carte d’attaque soit piochée.', effet: 'Aucune carte d’attaque n’est piochée.', conseil: 'Contrairement au Parapluie, tu décides sans connaître l’attaque.' },
    eclaireur: { quand: 'À chacun de tes tours, à la place du dé blanc.', effet: 'Tu peux avancer de 2 cases sans lancer le dé blanc.', conseil: 'Pratique pour rester dans un quartier ou viser une case précise.' },
    coach: { quand: 'Juste après une bonne réponse à une question difficile.', effet: 'Au choix : 1 jeton bonne pratique en plus pour ce Complice, ou 1 de ses jetons mauvaise pratique retourné en bonne pratique.', conseil: 'Retourner un jeton est le plus fort : le Complice perd 1 mauvaise pratique et gagne 1 bonne.' },
    relais: { quand: 'À la fin de ton tour.', effet: 'Tu désignes un autre joueur : à son prochain tour, il pourra aller directement sur la case de son choix.', conseil: 'Donne-le au joueur qui doit rejoindre un quartier éloigné.' },
    veilleur: { quand: 'À la fin de chaque manche, avant que la carte « Fin de manche » soit révélée.', effet: 'Tu découvres la prochaine carte et choisis de la laisser sur la pioche ou de la glisser dessous.', conseil: 'Écarte les cartes dangereuses et garde les bonnes, comme Mobilisation citoyenne.' },
    reparcafe: { quand: 'À la fin de ton tour.', effet: 'Tu retires 1 jeton mauvaise pratique du Complice de ton choix.', conseil: 'Vise le Complice le plus proche d’être perdu.' },
    mediateur: { quand: 'Automatique, après chaque bonne réponse sur Stalky.', effet: 'Tu places 1 jeton bonne pratique en plus sur Stalky ou sur un autre Complice pas encore sauvé.', conseil: 'Sers-t’en pour aider le Complice qui en a le plus besoin, pas forcément Stalky.' },
    cyberpatrouille: { quand: 'Juste après ton déplacement.', effet: 'Tu réponds à la question d’un autre Complice que celui de ton quartier.', conseil: 'Pour viser le Complice qui a besoin d’aide sans avoir à te déplacer jusqu’à lui.' },
    memoire: { quand: 'Au moment où un Complice devrait être perdu (n’importe quel joueur qui l’a peut le jouer).', effet: 'Le Complice n’est pas perdu : on retire 1 jeton mauvaise pratique de sa fiche.', conseil: 'Une seconde chance unique : ne la gaspille pas.' },
  };

  for (const carte of [...OBJETS, ...POUVOIRS]) carte.details = DETAILS[carte.id];
  NV.OBJETS = OBJETS;
  NV.POUVOIRS = POUVOIRS;
})();
