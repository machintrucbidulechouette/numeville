# Numéville 3D

Version numérique du jeu de plateau coopératif **Numéville – Les éclaireurs du numérique**
(Institut du Numérique Responsable), réalisée en **Three.js + HTML + CSS + JavaScript**.
Elle reproduit le **jeu de base** tel qu'il est décrit dans le livret de règles.

## Lancer le jeu

Ouvrir `index.html` dans un navigateur récent (Firefox, Chrome, Edge).
Une connexion internet est nécessaire au démarrage : Three.js **r184** (dernière version stable, avril 2026) et les polices sont chargés depuis un CDN.
Un navigateur compatible WebGL 2 est nécessaire (toutes les versions récentes de Firefox, Chrome, Edge et Safari).
Aucun serveur n'est requis : les images utilisées en 3D et les questions sont embarquées dans des fichiers `.js`.

Si besoin, on peut aussi servir le dossier : `python3 -m http.server` puis http://localhost:8000

## Jouer en ligne entre amis

Sur l'écran d'accueil, choisir **🌐 En ligne entre amis** :
1. un joueur entre son prénom et clique sur **Créer une partie** : il reçoit un **code** de 5 caractères (et un lien à copier) ;
2. ses amis (2 à 4 joueurs en tout) entrent ce code, ou ouvrent le lien, puis **Rejoindre** ;
3. dans le salon, chacun choisit son Éclaireur ; l'hôte règle le niveau et le mode avancé, puis lance la partie.

Pendant la partie, seul le joueur dont c'est le tour peut cliquer ; les autres voient la même chose en direct
(« C'est à … de jouer »). Une carte jouée hors de son tour (Coffre-fort, Mémoire longue, Veilleur…) est décidée par son détenteur.
- **Rechargement** de la page : on retrouve sa place, la partie est rejouée en accéléré jusqu'au moment présent.
- **Déconnexion** : la partie se met en pause ; au bout de 2 minutes, un autre joueur peut **jouer à sa place**.
  Le joueur reprend la main dès qu'il revient (dans le même onglet).
- Aucun compte : connexion **anonyme** (un identifiant invisible par onglet). Seuls le prénom et l'Éclaireur sont partagés.

Fonctionnement : chaque navigateur fait tourner le même moteur de règles. Les dés et les pioches viennent d'une
**graine partagée**, si bien que seuls les **clics des joueurs** transitent par **Firebase Realtime Database**
(quelques octets par action). Le SDK Firebase n'est téléchargé que si l'on choisit le jeu en ligne.
Le jeu en ligne nécessite le site publié (GitHub Pages) ou un serveur local : il ne marche pas en ouvrant `index.html` directement.

Règles de sécurité de la base : `firebase-regles.json` (à coller dans Firebase › Realtime Database › Règles).
Seuls les membres d'une partie peuvent la lire ; on ne peut plus rejoindre une partie commencée ;
seul l'hôte change les réglages et lance la partie ; une action déjà jouée ne peut pas être réécrite.

## Ce qui est implémenté (règles du jeu de base)

- 2 à 4 joueurs en local (même écran) ou en ligne, choix des Éclaireurs (Ana, Tom, Emily, Hakim) et du niveau
  (Découverte / Standard / Expert, avec les seuils de jetons prévus par les règles).
- Plateau 3D texturé avec le plateau officiel : 15 cases en boucle, 4 cases départ, portraits des Complices, la Place.
- Premier joueur désigné au dé blanc, puis sens horaire.
- **Dé blanc** : déplacement exact, choix du sens (aperçu des 2 destinations), case occupée → prochaine case libre.
- **Dé noir** : 1-3 question facile, 4-5 difficile, 6 difficile + carte « Dark Master – Attaque ».
- **200 questions** (50 par Complice, 25 faciles + 25 difficiles) avec la bonne réponse,
  l'explication et les sources du livret maître du jeu, affichées après chaque réponse.
- Jetons bleus / rouges, Complice sauvé ou perdu au seuil (fiche retournée, jetons retirés).
- **Face-à-face** (portrait d'un Complice) : résultat doublé. **La Place** : question difficile au choix, sans dé noir.
- 10 cartes **Fin de manche** et 15 cartes **Attaque** avec tous leurs effets
  (Nuit blanche, Brouillard, Notification sans fin, Piège à clics, Coup de stress, etc.),
  et la règle « effet sur un Complice déjà sauvé ou perdu → on reprend une carte ».
- Fin de partie : 4 sauvés (victoire totale), 3 sauvés (victoire), 2 perdus (défaite), ou pioche Fin de manche épuisée.

### Mise en scène

- **Les 4 Complices en 3D** derrière leur portrait sur la boucle : socle lumineux, buste holographique tiré des illustrations du jeu
  (toujours tourné vers la caméra) et emblème qui tourne (cœur, éclair, crâne, œil). Quand un Complice est sauvé, son buste grésille
  puis laisse place à sa version libérée (Sally, Nico, Iker, Tatiana) ; quand il est perdu, il vire au rouge et se met à clignoter.
- **Cinématiques** courtes aux moments clés : ouverture (survol de la ville en tournant puis descente vers le plateau), face-à-face, attaque du Dark Master,
  fin de manche, Complice sauvé (gerbe de lumière) ou perdu (fumée, lumière qui s'éteint), fin de partie.
  Elles se passent d'un clic ou avec Espace, et se coupent avec le bouton 🎬 (choix mémorisé).
- **Caméra qui suit le joueur actif** : au début de chaque tour, pendant le déplacement (vers la case d'arrivée) et après chaque cinématique,
  la cible glisse en douceur vers la zone du pion en gardant l'angle et le zoom choisis à la souris
  (le centre du plateau, avec les dés et les pioches, reste visible). Le bouton 🎯 recentre sur le joueur actif avec l'angle par défaut.
- **Animations de retour** : petit saut du pion quand c'est son tour, jetons qui tombent sur le plateau et sur les fiches, fiche qui s'illumine
  à chaque jeton, résultat du dé affiché au-dessus du dé.
- **Deux musiques d'ambiance génératives au choix** : *Néons* (synthwave nocturne) et *Circuit* (lo-fi rétro, sons 8 bits).
  Chacune est découpée en sections (couplet, refrain, pont) avec une mélodie renouvelée à chaque cycle
  (cycle d'environ 1 min 30), et suit la partie : calme en exploration, tendue quand un Complice est en danger
  ou lors d'une attaque, lumineuse quand un Complice est sauvé, sombre en cas de défaite. Elle baisse pendant les questions.
- **Effets sonores** : dé lancé réaliste (trois rebonds synchronisés avec l'animation, roulement sur les arêtes, oscillation finale), pion qui se pose, jetons bleu (cristallin) et rouge (grave),
  cartes, bonne / mauvaise réponse, face-à-face, tonnerre du Dark Master, gong de fin de manche,
  Complice sauvé / perdu, fanfare de victoire, thème de défaite.
- **Réglages du son** (bouton 🔊) : volume général (100 % par défaut), musique (60 %), effets (100 %), choix du morceau, coupure (touche M), mémorisés.
  Tout est synthétisé par la Web Audio API : aucun fichier audio téléchargé (éco-conception).
- Les animations sont réduites si le système le demande (« réduire les animations »).
- Contrastes des boutons vérifiés au repos, au survol et au focus (WCAG AA).

### Mode avancé (cartes Objet et Pouvoir)

À activer sur l'écran d'accueil (niveau Standard ou Expert uniquement).
- En début de partie, les joueurs choisissent une **case Objet** 🧰 et une **case Pouvoir** ⚡ (ou au hasard) ; elles sont signalées sur le plateau 3D.
- Terminer son déplacement sur l'une d'elles fait piocher une carte, puis on joue son tour normalement.
- **13 Objets** (usage unique) et **13 Pouvoirs** (permanents ou à quelques utilisations), avec leurs textes d'origine.
- Maximum 1 Objet et 1 Pouvoir en main : en piocher un autre oblige à choisir lequel garder.
- Une carte qui concerne un Complice déjà sauvé ou perdu est remplacée.
- Le jeu propose chaque carte **au bon moment** (avant le dé blanc, après un dé, avant ou après une question, à une attaque,
  en fin de tour, en fin de manche…). Les cartes du joueur actif s'affichent en bas de l'écran : un clic permet de relire leur texte.

Non inclus pour l'instant : le **mode Atelier** (animation de groupe en classe).

## Organisation du code

```
index.html                 page, chargement de Three.js r184 (importmap) puis des scripts dans l'ordre
css/
  base.css                 couleurs, boutons, barre du haut, fiches Complices, journal, barre d'actions
  cartes.css               fenêtres : question, cartes Dark Master, choix, révélation, fin, aide
  accueil.css              écran d'accueil
  animations.css           animations légères et bandes des cinématiques
  son.css                  panneau des réglages du son
  avance.css               mode avancé : interrupteur, cartes en main, minute de concertation
  en-ligne.css             jeu en ligne : choix du mode, salon d'attente, tour des autres joueurs, pause
  adaptatif.css            petits écrans et « réduire les animations » (chargé en dernier)
js/
  outils.js                NV_etendre (classe découpée en plusieurs fichiers), NV_alea (hasard à graine), NV_nomPropre
  data/
    regles.js              plateau, Complices, Éclaireurs, seuils, cartes Dark Master
    cartes-avancees.js     les 13 Objets et 13 Pouvoirs
    questions.js           les 200 questions + explications du livret maître du jeu
    textures.js            images pour WebGL (pions, pioches, bustes des Complices, icônes)
    board-texture.js       texture du plateau
  audio/
    audio.js               moteur audio, réglages, effets sonores
    musique.js             musique générative (2 morceaux, 4 ambiances)
  3d/
    plateau3d.js           scène Three.js : plateau, pions, dés, jetons, pioches, cases Objet/Pouvoir, boucle de rendu
    complices3d.js         les 4 Complices en 3D
    effets3d.js            étiquettes et particules
    cinematiques.js        caméra (recentrage fiable) et cinématiques
  jeu/
    jeu.js                 moteur de règles : manches, tour de jeu en étapes, jetons, questions
    cartes-dark-master.js  cartes Fin de manche et Attaque
    mode-avance.js         cartes Objet et Pouvoir
  ui/
    interface.js           interface HTML : actions, questions, cartes, choix, main du joueur, fin de partie
    main.js                écran d'accueil, réglages du son, démarrage
  reseau/
    config-firebase.js     identifiants (publics) du projet Firebase et version du SDK
    backend-firebase.js    accès à Firebase : connexion anonyme, lecture/écriture, présence (module chargé à la demande)
    en-ligne.js            créer / rejoindre une partie, salon, synchronisation des clics, pause et reprise
firebase-regles.json       règles de sécurité de la Realtime Database
assets/img/                visuels extraits du Print & Play (fiches, cartes, Éclaireurs)
```

## Crédits

Jeu original, textes des questions, illustrations et plateau : **Numéville**, Institut du Numérique Responsable (INR),
licence Creative Commons **CC BY-NC-ND 4.0** (attribution, pas d'utilisation commerciale, pas de modification).
