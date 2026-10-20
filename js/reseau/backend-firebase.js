/* =====================================================================
   Numéville 3D — accès à Firebase (Realtime Database + connexion anonyme)

   Module ES chargé seulement quand on choisit de jouer en ligne. Il expose
   quelques opérations simples sur des chemins (« parties/K7P3Q/clics/12 »),
   utilisées par js/reseau/en-ligne.js : le reste du jeu ignore tout de Firebase.
   ===================================================================== */

export async function connecter(config, sdk) {
  const [{ initializeApp }, auth, db] = await Promise.all([
    import(sdk + 'firebase-app.js'),
    import(sdk + 'firebase-auth.js'),
    import(sdk + 'firebase-database.js'),
  ]);
  const app = initializeApp(config);

  // Connexion anonyme : un identifiant invisible par onglet. Il survit à un rechargement de la page
  // (on retrouve sa place dans la partie) ; deux onglets du même navigateur sont deux joueurs différents.
  const a = auth.getAuth(app);
  await auth.setPersistence(a, auth.browserSessionPersistence);
  const utilisateur = await new Promise((resolve, reject) => {
    const stop = auth.onAuthStateChanged(a, (u) => {
      if (u) { stop(); resolve(u); }
    }, reject);
    auth.signInAnonymously(a).catch(reject);
  });

  const base = db.getDatabase(app);
  const r = (chemin) => db.ref(base, chemin);

  return {
    uid: utilisateur.uid,
    heureServeur: () => db.serverTimestamp(),
    lire: async (chemin) => (await db.get(r(chemin))).val(),
    ecrire: (chemin, valeur) => db.set(r(chemin), valeur),
    maj: (chemin, valeurs) => db.update(r(chemin), valeurs),
    ecouter(chemin, cb, erreur) {
      return db.onValue(r(chemin), (s) => cb(s.val()), erreur);
    },
    ecouterAjouts(chemin, cb, erreur) {
      return db.onChildAdded(r(chemin), (s) => cb(s.key, s.val()), erreur);
    },
    ecouterRetraits(chemin, cb) {
      return db.onChildRemoved(r(chemin), (s) => cb(s.key));
    },
    /** Valeur écrite par le serveur si la connexion se coupe (onglet fermé, réseau perdu). */
    surDeconnexion: (chemin, valeur) => db.onDisconnect(r(chemin)).set(valeur),
    etatConnexion(cb) {
      return db.onValue(r('.info/connected'), (s) => cb(s.val() === true));
    },
  };
}
