/* =====================================================================
   Numéville 3D — configuration du projet Firebase (jeu en ligne)

   Ces valeurs ne sont pas secrètes : elles identifient le projet et se
   retrouvent forcément dans le code d'un site web. La sécurité des parties
   repose sur la connexion anonyme et sur les règles de la Realtime Database
   (fichier firebase-regles.json, à coller dans la console Firebase).
   ===================================================================== */

window.NV_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyD83EbTcFLnhicShk_P71EAvf4tdN8ejtE',
  authDomain: 'numeville-2aa24.firebaseapp.com',
  databaseURL: 'https://numeville-2aa24-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'numeville-2aa24',
  storageBucket: 'numeville-2aa24.firebasestorage.app',
  messagingSenderId: '32484661834',
  appId: '1:32484661834:web:d351b2d6cbec111f45e4b3',
};

/* Version du SDK Firebase (modules ES chargés depuis le CDN officiel de Google). */
window.NV_FIREBASE_SDK = 'https://www.gstatic.com/firebasejs/12.19.0/';
