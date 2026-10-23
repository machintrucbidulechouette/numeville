/* =====================================================================
   Numéville 3D — cases où l'on peut aller (tous les modes)
   Pendant un choix de case (sens du déplacement, téléportation, case Objet / Pouvoir) :
   • chaque case possible reçoit un disque, un anneau épais qui respire, un faisceau de
     lumière et une balise flottante (↻ / ↺ ou ★) qui reste visible au-dessus des pions ;
   • de petites flèches défilent sur le chemin que suivra le pion ;
   • le reste du plateau s'assombrit légèrement ;
   • survoler un bouton (ou la case en 3D) met sa destination en avant, cliquer la case en 3D
     revient à cliquer le bouton (donc fonctionne aussi en ligne).
   (méthodes ajoutées à la classe Plateau3D, voir js/3d/plateau3d.js)
   ===================================================================== */

class Destinations3D {
  _initDestinations() {
    if (this._dest) return this._dest;
    const D = this._dest = { liste: [], survol: null, actif: false, expoBase: this.renderer.toneMappingExposure, souris: null };
    D.groupe = new THREE.Group();
    this.scene.add(D.groupe);
    D.geoDisque = new THREE.CircleGeometry(1, 48);
    D.geoAnneau = new THREE.RingGeometry(1.04, 1.32, 48);
    D.geoFaisceau = new THREE.CylinderGeometry(0.62, 0.9, 1, 32, 1, true);
    D.geoFaisceau.translate(0, 0.5, 0);
    D.geoCible = new THREE.CylinderGeometry(1.35, 1.35, 1, 16);
    D.geoCible.translate(0, 0.5, 0);
    const chevron = new THREE.Shape();
    chevron.moveTo(-0.1, 0.12); chevron.lineTo(0.07, 0); chevron.lineTo(-0.1, -0.12); chevron.lineTo(-0.05, 0); chevron.closePath();
    D.geoChevron = new THREE.ShapeGeometry(chevron);
    // dégradé vertical du faisceau (opaque en bas, transparent en haut)
    const cv = document.createElement('canvas'); cv.width = 4; cv.height = 128;
    const g = cv.getContext('2d'), d = g.createLinearGradient(0, 0, 0, 128);
    d.addColorStop(0, 'rgba(255,255,255,0)'); d.addColorStop(0.55, 'rgba(255,255,255,.25)'); d.addColorStop(1, 'rgba(255,255,255,.85)');
    g.fillStyle = d; g.fillRect(0, 0, 4, 128);
    D.texFaisceau = new THREE.CanvasTexture(cv);
    D.ray = new THREE.Raycaster();
    this._ecouterDestinations();
    return D;
  }

  /** Rayon visuel d'une case (pour dimensionner les marqueurs). */
  _rayonCase(idx) {
    const b = NV.BOUCLE[idx];
    if (this.pro) return b.type === 'place' ? 0.98 : b.type === 'face' ? 0.66 : 0.56;
    return b.type === 'case' ? 0.36 : 0.42;
  }

  _baliseTexture(couleur, symbole) {
    const N = 128, cv = document.createElement('canvas'); cv.width = N; cv.height = N * 1.4;
    const g = cv.getContext('2d');
    // pointe vers la case
    g.fillStyle = couleur; g.strokeStyle = '#ffffff'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(N / 2 - 26, N * 0.86); g.lineTo(N / 2, N * 1.32); g.lineTo(N / 2 + 26, N * 0.86); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.arc(N / 2, N / 2, N / 2 - 6, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#ffffff'; g.font = `800 ${symbole.length > 1 ? 44 : 70}px "Baloo 2", system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 6;
    g.fillText(symbole, N / 2, N / 2 + 4);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /**
   * Met en évidence des cases possibles.
   * @param {{idx:number, couleur?:string, chemin?:number[], symbole?:string}[]} dests
   * @param {{depuis?:THREE.Vector3}} [opt] depuis : position de départ du pion (début des flèches)
   */
  montrerDestinations(dests, opt = {}) {
    this.cacherDestinations();
    const D = this._initDestinations();
    const base = (mat) => Object.assign(mat, { transparent: true, depthWrite: false, toneMapped: false });
    dests.forEach((d, k) => {
      const couleur = d.couleur || '#ffd23f';
      const p = this.posCase(d.idx), r = this._rayonCase(d.idx);
      const g = new THREE.Group();
      g.position.copy(p);
      const disque = new THREE.Mesh(D.geoDisque, base(new THREE.MeshBasicMaterial({ color: couleur, opacity: 0.32, polygonOffset: true, polygonOffsetFactor: -4 })));
      disque.rotation.x = -Math.PI / 2; disque.position.y = 0.012; disque.scale.setScalar(r * 0.98);
      const anneau = new THREE.Mesh(D.geoAnneau, base(new THREE.MeshBasicMaterial({ color: couleur, opacity: 0.95, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 })));
      anneau.rotation.x = -Math.PI / 2; anneau.position.y = 0.016; anneau.scale.setScalar(r);
      const hauteur = this.pro ? 2.3 : 1.5;
      const faisceau = new THREE.Mesh(D.geoFaisceau, base(new THREE.MeshBasicMaterial({ color: couleur, alphaMap: D.texFaisceau, opacity: 0.55, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })));
      faisceau.scale.set(r, hauteur, r);
      const balise = new THREE.Sprite(base(new THREE.SpriteMaterial({ map: this._baliseTexture(couleur, d.symbole || '★'), depthTest: false })));
      const tb = this.pro ? 0.62 : 0.46;
      balise.scale.set(tb, tb * 1.4, 1);
      balise.renderOrder = 10;
      balise.userData.y0 = hauteur * 0.62 + tb * 0.5;
      const cible = new THREE.Mesh(D.geoCible, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }));
      cible.scale.set(r, hauteur, r);
      cible.userData.k = k;
      g.add(disque, anneau, faisceau, balise, cible);
      D.groupe.add(g);
      // petites flèches sur le chemin (entre les cases, et sur les cases traversées)
      const chevrons = [];
      if (d.chemin && d.chemin.length) {
        const pts = [opt.depuis ? opt.depuis.clone() : null, ...d.chemin.map((i) => this.posCase(i))].filter(Boolean);
        let n = 0;
        for (let i = 0; i + 1 < pts.length; i++) {
          const A = pts[i], B = pts[i + 1];
          const dx = B.x - A.x, dz = B.z - A.z;
          for (const f of i + 2 < pts.length ? [0.34, 0.67, 1] : [0.34, 0.67]) {
            const c = new THREE.Mesh(D.geoChevron, base(new THREE.MeshBasicMaterial({ color: couleur, opacity: 0.9, side: THREE.DoubleSide, depthTest: false })));
            c.rotation.order = 'YXZ';
            c.rotation.y = Math.atan2(-dz, dx); c.rotation.x = -Math.PI / 2;
            c.position.set(A.x + dx * f, Math.max(A.y, B.y) + 0.05, A.z + dz * f);
            c.scale.setScalar(this.pro ? 2.3 : 1.5);
            c.renderOrder = 6;
            c.userData.n = n++;
            D.groupe.add(c); chevrons.push(c);
          }
        }
      }
      D.liste.push({ k, idx: d.idx, groupe: g, disque, anneau, faisceau, balise, cible, chevrons, r });
    });
    D.actif = dests.length > 0;
    D.survol = null;
  }

  /** Met en avant une destination (ou plusieurs : tableau), null = toutes à égalité. */
  surlignerDestination(k) {
    const D = this._dest;
    if (!D) return;
    D.survol = k === null || k === undefined ? null : [].concat(k);
  }

  cacherDestinations() {
    const D = this._dest;
    if (!D) return;
    for (const o of D.groupe.children.slice()) {
      o.traverse((m) => { if (m.material) { if (m.material.map) m.material.map.dispose(); m.material.dispose(); } });
      D.groupe.remove(o);
    }
    D.liste = []; D.actif = false; D.survol = null;
    this.renderer.domElement.style.cursor = '';
  }

  /** Cadre les destinations (et le pion) : utile sur le grand plateau du mode Pro. */
  cadrerDestinations(points, duree = 800) {
    if (!points.length) return Promise.resolve();
    const c = new THREE.Vector3();
    points.forEach((p) => c.add(p)); c.divideScalar(points.length);
    let etendue = 0;
    points.forEach((p) => { etendue = Math.max(etendue, Math.hypot(p.x - c.x, p.z - c.z)); });
    const cible = this.VUE.cible.clone().lerp(new THREE.Vector3(c.x, 0, c.z), 0.5);
    const k = THREE.MathUtils.clamp(0.66 + etendue / (this.pro ? 14 : 9), 0.66, 1);
    const pos = cible.clone().add(this.VUE.pos.clone().sub(this.VUE.cible).multiplyScalar(k));
    return this._glisserVue(pos, cible, this.mouvementReduit ? 1 : duree);
  }

  _animerDestinations(temps) {
    const D = this._dest;
    if (!D) return;
    // assombrit le plateau pendant un choix (les marqueurs ne sont pas concernés)
    const cibleExpo = D.actif ? D.expoBase * 0.68 : D.expoBase;
    const e = this.renderer.toneMappingExposure;
    if (Math.abs(e - cibleExpo) > 0.002) this.renderer.toneMappingExposure = e + (cibleExpo - e) * 0.12;
    if (!D.actif) return;
    const calme = this.mouvementReduit;
    for (const o of D.liste) {
      const enAvant = !D.survol || D.survol.includes(o.k);
      const fort = D.survol && D.survol.includes(o.k);
      const respire = calme ? 1 : 1 + 0.07 * Math.sin(temps * 5);
      o.anneau.scale.setScalar(o.r * respire * (fort ? 1.14 : 1));
      o.anneau.material.opacity = enAvant ? 0.95 : 0.3;
      o.disque.material.opacity = fort ? 0.5 : enAvant ? 0.3 : 0.1;
      o.faisceau.material.opacity = fort ? 0.95 : enAvant ? 0.55 : 0.12;
      o.balise.material.opacity = enAvant ? 1 : 0.35;
      const s = fort ? 1.18 : 1;
      o.balise.scale.set(s * (this.pro ? 0.62 : 0.46), s * (this.pro ? 0.62 : 0.46) * 1.4, 1);
      o.balise.position.y = o.balise.userData.y0 + (calme ? 0 : Math.abs(Math.sin(temps * 3.2 + o.k)) * 0.22);
      for (const c of o.chevrons) {
        c.visible = enAvant;
        c.material.opacity = calme ? 0.85 : 0.25 + 0.75 * Math.pow(Math.max(0, Math.sin(temps * 5 - c.userData.n * 0.75)), 2);
      }
    }
  }

  /** Survol et clic des destinations directement sur le plateau 3D. */
  _ecouterDestinations() {
    const el = this.renderer.domElement, D = this._dest;
    const viser = (e) => {
      if (!D.actif) return null;
      const r = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      D.ray.setFromCamera(ndc, this.camera);
      const hit = D.ray.intersectObjects(D.liste.map((o) => o.cible), false)[0];
      return hit ? hit.object.userData.k : null;
    };
    let appui = null;
    el.addEventListener('pointerdown', (e) => { appui = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointermove', (e) => {
      if (!D.actif || e.pointerType === 'touch') return;
      const k = viser(e);
      if (k !== D.souris) {
        D.souris = k;
        this.surlignerDestination(k);
        if (this.ui && this.ui.marquerDestination) this.ui.marquerDestination(k);
      }
      el.style.cursor = k === null ? '' : 'pointer';
    });
    el.addEventListener('pointerup', (e) => {
      if (!appui || Math.hypot(e.clientX - appui.x, e.clientY - appui.y) > 8) { appui = null; return; }
      appui = null;
      const k = viser(e);
      if (k !== null && this.ui && this.ui.cliquerDestination) this.ui.cliquerDestination(k, D.liste[k] && D.liste[k].idx);
    });
  }
}

NV_etendre(Plateau3D, Destinations3D);
