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
