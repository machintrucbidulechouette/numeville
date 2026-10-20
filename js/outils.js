/* =====================================================================
   Numéville 3D — outils communs
   ===================================================================== */

/**
 * Ajoute à une classe les méthodes d'une autre classe (découpage d'une grosse classe en
 * plusieurs fichiers thématiques, chargés après le fichier principal).
 */
window.NV_etendre = (Cible, Source) => {
  for (const nom of Object.getOwnPropertyNames(Source.prototype)) {
    if (nom !== 'constructor') Object.defineProperty(Cible.prototype, nom, Object.getOwnPropertyDescriptor(Source.prototype, nom));
  }
};

/**
 * Hasard du jeu (dés, mélanges, tirages) : générateur pseudo-aléatoire à graine (mulberry32).
 * En ligne, tous les joueurs partent de la même graine : ils obtiennent donc exactement
 * les mêmes dés et les mêmes pioches sans avoir à les échanger.
 * Les effets visuels et sonores continuent d'utiliser Math.random (ils ne changent pas la partie).
 */
(function () {
  let etat = (Math.random() * 2 ** 32) >>> 0;
  window.NV_graine = (g) => { etat = (g >>> 0) || 1; };
  window.NV_alea = () => {
    etat = (etat + 0x6D2B79F5) >>> 0;
    let t = etat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();

/** Les noms sont affichés dans la page : on retire les caractères qui pourraient y injecter du HTML. */
window.NV_nomPropre = (s) => String(s || '').replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
