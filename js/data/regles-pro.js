/* =====================================================================
   Numéville 3D — données du mode Pro
   • Plateau agrandi en 3D : boucle hexagonale de 25 cases sur trois niveaux
     (rez-de-chaussée, terrasses, toits) reliés par des escaliers.
   • 6 Complices : les 4 du jeu + Scrollo et Fracturo (créations de ce projet,
     elles ne font pas partie du jeu Numéville de l'INR).
   • 2 cases malus, l'objet Jetpack, 4 cartes Fin de manche et 4 cartes Attaque en plus.
   • Fin de partie : 6 sauvés = victoire totale, au moins 4 = victoire, 3 perdus = défaite.

   NV.activerPro() remplace les données du jeu de base au lancement d'une partie Pro
   (la page est rechargée avant toute nouvelle partie, rien n'est à restaurer).
   ===================================================================== */

(function () {
  /* ---------- géométrie du plateau ---------- */
  const R = 6.7;                                       // rayon de l'hexagone (sommets)
  const DALLE = 0.06;                                  // épaisseur des cases posées sur le sol ou les terrasses
  const NIVEAUX = [0, 0.5, 1.0, 1.0, 0.5, 0];          // hauteur de chaque côté (quartier)
  const QUARTIERS = ['datata', 'fracturo', 'stalky', 'hyperco', 'scrollo', 'hacker'];
  const FRACTIONS = [0.17, 0.39, 0.61, 0.83];          // position des 4 cases le long d'un côté
  const MOTIF = ['case', 'face', 'case', 'case'];      // la 2e case de chaque quartier est le portrait (face-à-face)

  // sommets dans le sens horaire vu du dessus (caméra côté +z) : bas, bas-gauche, haut-gauche, haut, haut-droite, bas-droite
  const sommet = (k) => { const a = -k * Math.PI / 3; return { x: R * Math.sin(a), z: R * Math.cos(a) }; };
  const COTES = [];
  for (let s = 0; s < 6; s++) {
    const A = sommet(s), B = sommet(s + 1);
    const L = Math.hypot(B.x - A.x, B.z - A.z);
    const t = { x: (B.x - A.x) / L, z: (B.z - A.z) / L };
    const m = { x: (A.x + B.x) / 2, z: (A.z + B.z) / 2 };
    const lm = Math.hypot(m.x, m.z);
    COTES.push({ A, B, L, t, n: { x: m.x / lm, z: m.z / lm }, h: NIVEAUX[s], c: QUARTIERS[s] });
  }
  const point = (s, f, dn = 0, dy = 0) => {
    const c = COTES[s];
    return { x: c.A.x + c.t.x * f * c.L + c.n.x * dn, y: c.h + dy, z: c.A.z + c.t.z * f * c.L + c.n.z * dn };
  };

  /* Boucle (index croissant = sens horaire) : 0 = la Place, puis 4 cases par quartier. */
  // p = centre de la face supérieure de la case (y : hauteur de la terrasse + épaisseur de la dalle)
  const BOUCLE = [{ type: 'place', c: null, p: { x: 0, y: DALLE, z: R * 0.9 } }];
  COTES.forEach((cote, s) => FRACTIONS.forEach((f, i) => BOUCLE.push({ type: MOTIF[i], c: cote.c, p: point(s, f, 0, DALLE), cote: s })));
  // les cases malus (elles restent des cases du quartier : on y répond ensuite à sa question)
  BOUCLE[9].malus = 'toboggan';  // haut du quartier de Stalky, sur les toits : on glisse jusqu'en bas de l'escalier
  BOUCLE[20].malus = 'batterie'; // quartier de Scrollo : la batterie se vide

  /* 4 cases départ à l'intérieur de l'hexagone, chacune face à une case de la boucle */
  const DEPARTS = [3, 11, 15, 23].map((entree, i) => {
    const b = BOUCLE[entree], n = COTES[b.cote].n;
    return { id: 'd' + i, entree, p: { x: b.p.x - n.x * 1.75, y: 0.05, z: b.p.z - n.z * 1.75 } };
  });

  const PIOCHES = {
    fin: { p: { x: -0.85, z: -0.95 }, w: 0.124, h: 0.18 },
    attaque: { p: { x: 0.85, z: -0.95 }, w: 0.124, h: 0.18 },
  };

  /* ---------- les 2 nouveaux Complices ---------- */
  const NOUVEAUX = {
    scrollo: {
      id: 'scrollo', nom: 'Scrollo', couleur: '#5b3df5', couleurClaire: '#a493ff',
      theme: 'Économie de l’attention, temps d’écran et sommeil',
      sauveNom: 'Carlo',
      histoire: 'Il adorait les histoires, les jeux et les vidéos qui font rire. Le Dark Master l’a rendu captif du défilement infini : notifications, lecture automatique, séries enchaînées jusqu’au milieu de la nuit. Il ne lève plus les yeux de son écran et entraîne tout son quartier dans la spirale.',
    },
    fracturo: {
      id: 'fracturo', nom: 'Fracturo', couleur: '#b8733a', couleurClaire: '#e8ad74',
      theme: 'Fracture numérique, accessibilité et inclusion',
      sauveNom: 'Arturo',
      histoire: 'Réparateur bricoleur, il aidait chacun à se servir des outils numériques. Le Dark Master a brisé les ponts : sites illisibles, démarches impossibles, zones sans réseau. Fracturo sème désormais l’exclusion et laisse les habitants seuls devant leurs écrans.',
    },
  };

  /* Zones des Complices en mode Pro : statue (fig3d) et jetons (zone3d) sur la terrasse de leur quartier */
  function zonesPro() {
    const z = {};
    COTES.forEach((cote, s) => {
      const f = point(s, 0.36, 1.3), j = point(s, 0.71, 1.2);
      z[cote.c] = { fig3d: f, zone3d: { ...j, t: cote.t, n: cote.n } };
    });
    return z;
  }

  /* ---------- cartes Dark Master supplémentaires ---------- */
  const CARTES_FIN_PRO = [
    { id: 'scrollinfini', titre: 'Scroll infini', texte: 'Ajoutez 1 jeton mauvaise pratique à Scrollo et à Stalky (si possible).' },
    { id: 'zoneblanche', titre: 'Zone blanche', texte: 'Ajoutez 1 jeton mauvaise pratique à Fracturo. Choisissez un autre Complice : retirez-lui 1 jeton bonne pratique (s’il en a).' },
    { id: 'sansecran', titre: 'Journée sans écran', texte: 'Retirez 1 jeton mauvaise pratique à Scrollo et à Hyperco (s’ils en ont).' },
    { id: 'mediatheque', titre: 'Atelier à la médiathèque', texte: 'Choisissez un Complice : ajoutez-lui 1 jeton bonne pratique. Si vous choisissez Fracturo, ajoutez-lui 2 jetons bonne pratique.' },
  ];
  const CARTES_ATTAQUE_PRO = [
    { id: 'autoplay', titre: 'Lecture automatique', texte: 'Ajoutez 1 jeton mauvaise pratique à Scrollo.' },
    { id: 'notifnuit', titre: 'Notifications nocturnes', texte: 'Ajoutez 1 jeton mauvaise pratique à Scrollo. Au prochain tour du joueur qui a déclenché l’attaque, un 1, 2 ou 3 au dé noir donnera une question difficile.' },
    { id: 'formulaire', titre: 'Formulaire illisible', texte: 'Ajoutez 1 jeton mauvaise pratique à Fracturo.' },
    { id: 'abandon', titre: 'Démarche abandonnée', texte: 'Le joueur qui a déclenché cette carte choisit : retirer 1 jeton bonne pratique à Fracturo, ou ajouter 1 jeton mauvaise pratique au Complice de son quartier.' },
  ];

  /* ---------- l'objet Jetpack ---------- */
  const JETPACK = {
    id: 'jetpack', titre: 'Jetpack', moment: 'de-blanc',
    texte: 'Après avoir lancé le dé blanc, jouez cette carte : avancez de 3 cases de plus que le résultat du dé, en survolant les cases traversées.',
    details: {
      quand: 'Juste après avoir lancé le dé blanc (mode Pro).',
      effet: 'Ton déplacement augmente de 3 cases : avec un 4 au dé, tu avances de 7. Tu survoles les cases traversées : seule la case d’arrivée compte (une case malus survolée ne fait rien).',
      conseil: 'Parfait pour traverser le grand plateau et rejoindre un Complice en danger à l’autre bout de Numéville.',
    },
  };

  /* ---------- cases malus : textes pour l'interface ---------- */
  const MALUS = {
    toboggan: { icone: '📉', titre: 'Toboggan à pop-ups', texte: 'Une avalanche de pop-ups te fait glisser : ton pion redescend de 3 cases (sens anti-horaire), jusqu’en bas de l’escalier. Tu joues ensuite ton tour sur la nouvelle case, sans piocher de carte Objet ou Pouvoir.' },
    batterie: { icone: '🪫', titre: 'Batterie à plat', texte: 'Ton téléphone s’éteint : tu perds ton Objet en main. Si tu n’en as pas, le Complice du quartier reçoit 1 jeton mauvaise pratique. Le pouvoir « Bouclier numérique » peut annuler ce malus.' },
  };

  NV.PRO = {
    BOUCLE, DEPARTS, PIOCHES, COTES, NOUVEAUX, MALUS, JETPACK,
    ORDRE: ['stalky', 'hyperco', 'scrollo', 'hacker', 'datata', 'fracturo'],
    FIN: { totale: 6, victoire: 4, defaite: 3 },
    actif: false,
  };

  /** Bascule les données du jeu en mode Pro (une seule fois par page). */
  NV.activerPro = function () {
    if (NV.PRO.actif) return;
    NV.PRO.actif = true;
    Object.assign(NV.COMPLICES, NOUVEAUX);
    const z = zonesPro();
    for (const id of Object.keys(z)) Object.assign(NV.COMPLICES[id], z[id]);
    NV.ORDRE_COMPLICES = NV.PRO.ORDRE.slice();
    NV.BOUCLE = BOUCLE;
    NV.DEPARTS = DEPARTS;
    NV.PIOCHES = PIOCHES;
    NV.FIN = NV.PRO.FIN;
    NV.CARTES_FIN = NV.CARTES_FIN.concat(CARTES_FIN_PRO);
    NV.CARTES_ATTAQUE = NV.CARTES_ATTAQUE.concat(CARTES_ATTAQUE_PRO);
    NV.OBJETS = NV.OBJETS.concat([JETPACK, { ...JETPACK }]); // 2 Jetpacks dans la pioche Objets
    if (window.NV_QUESTIONS_PRO) window.NV_QUESTIONS = window.NV_QUESTIONS.concat(window.NV_QUESTIONS_PRO);
    if (window.NV_TEXTURES_PRO) Object.assign(window.NV_TEXTURES_COMPLICES, window.NV_TEXTURES_PRO.complices);
  };
})();
