# Numéville 3D

Version numérique du jeu de plateau coopératif **Numéville – Les éclaireurs du numérique**
(Institut du Numérique Responsable), réalisée en **Three.js + HTML + CSS + JavaScript**.
Elle reproduit le **jeu de base** tel qu'il est décrit dans le livret de règles.

## Lancer le jeu

Ouvrir `index.html` dans un navigateur récent (Firefox, Chrome, Edge).
Une connexion internet est nécessaire au démarrage : Three.js (r160) et les polices sont chargés depuis un CDN.
Aucun serveur n'est requis : les images utilisées en 3D et les questions sont embarquées dans des fichiers `.js`.

Si besoin, on peut aussi servir le dossier : `python3 -m http.server` puis http://localhost:8000

## Ce qui est implémenté (règles du jeu de base)

- 2 à 4 joueurs en local (même écran), choix des Éclaireurs (Ana, Tom, Emily, Hakim) et du niveau
  (Découverte / Standard / Expert, avec les seuils de jetons du tableau de la page 10).
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

- **Cinématiques** courtes aux moments clés : ouverture sur la ville, face-à-face, attaque du Dark Master,
  fin de manche, Complice sauvé (gerbe de lumière) ou perdu (fumée, lumière qui s'éteint), fin de partie.
  Elles se passent d'un clic ou avec Espace, et se coupent avec le bouton 🎬 (choix mémorisé).
- **Animations de retour** : jetons qui tombent sur le plateau et sur les fiches, fiche qui s'illumine
  à chaque jeton, résultat du dé affiché au-dessus du dé.
- Les animations sont réduites si le système le demande (« réduire les animations »).
- Contrastes des boutons vérifiés au repos, au survol et au focus (WCAG AA).

Non inclus pour l'instant : le **mode avancé** (cartes Objet / Pouvoir) et le **mode Atelier**.

## Organisation du code

```
index.html            page, chargement de Three.js (importmap) et des scripts
css/style.css         interface (HUD, fiches Complices, cartes, modales)
js/data/regles.js     données : plateau, Complices, Éclaireurs, seuils, cartes Dark Master
js/data/questions.js  les 200 questions + explications du livret maître du jeu
js/data/textures.js   images des pions et des pioches (data URI, pour WebGL sans serveur)
js/data/board-texture.js  texture du plateau
js/plateau3d.js       scène Three.js : plateau, pions, dés 3D, jetons, pioches, animations, sons
js/jeu.js             moteur de règles (déroulé des manches, tours, effets des cartes)
js/interface.js       interface HTML : actions, questions, cartes, choix, fin de partie
js/main.js            écran d'accueil et démarrage
assets/img/           visuels extraits du Print & Play (fiches, cartes, Éclaireurs)
```

## Crédits

Jeu original, textes des questions, illustrations et plateau : **Numéville**, Institut du Numérique Responsable (INR),
licence Creative Commons **CC BY-NC-ND 4.0** (attribution, pas d'utilisation commerciale, pas de modification).
Cette adaptation est réalisée dans un cadre pédagogique (BUT Informatique, R3.03 Analyse) ; le contenu du jeu n'est pas modifié.
