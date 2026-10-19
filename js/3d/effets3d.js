/* =====================================================================
   Numéville 3D — effets visuels
   Étiquettes (résultat des dés) et gerbes de particules.
   (méthodes ajoutées à la classe Plateau3D, voir js/3d/plateau3d.js)
   ===================================================================== */

class Effets3D {
  /* ---------- Petites animations de retour visuel ---------- */

  /** Nombre (résultat de dé…) qui s'élève et s'efface au-dessus d'un point. */
  _etiquette(texte, pos, couleur) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = 'rgba(7,10,22,.85)';
    g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.fill();
    g.lineWidth = 8; g.strokeStyle = couleur; g.stroke();
    g.fillStyle = '#ffffff';
    g.font = '800 70px "Baloo 2", system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(texte, 64, 70);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
    s.renderOrder = 10;
    s.position.copy(pos);
    this.scene.add(s);
    const y0 = pos.y;
    this.animer(1500, (k) => {
      const e = Plateau3D.easeOut(Math.min(1, k * 3));
      s.scale.setScalar(0.62 * e);
      s.position.y = y0 + k * 0.45;
      s.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    }).then(() => { this.scene.remove(s); t.dispose(); s.material.dispose(); });
  }

  _texParticule() {
    if (this._texP) return this._texP;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    const d = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    d.addColorStop(0, 'rgba(255,255,255,1)');
    d.addColorStop(0.35, 'rgba(255,255,255,.7)');
    d.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = d; g.fillRect(0, 0, 64, 64);
    this._texP = new THREE.CanvasTexture(cv);
    return this._texP;
  }

  /**
   * Gerbe de particules.
   * type : 'eclat' (lumière qui monte, Complice sauvé), 'fumee' (Complice perdu),
   *        'confettis' (victoire), 'braises' (attaque du Dark Master)
   */
  particules(centre, couleurs, type = 'eclat', duree = 2200) {
    if (this.mouvementReduit) return Promise.resolve();
    const N = { eclat: 160, fumee: 90, confettis: 420, braises: 110, paillettes: 46 }[type];
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), vit = [];
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      c.set(couleurs[i % couleurs.length]);
      col.set([c.r, c.g, c.b], i * 3);
      let x = centre.x, y = centre.y, z = centre.z, v;
      if (type === 'confettis') {
        x += (Math.random() - 0.5) * 11; z += (Math.random() - 0.5) * 11; y += 4 + Math.random() * 5;
        v = new THREE.Vector3((Math.random() - 0.5) * 0.6, -1.2 - Math.random() * 1.2, (Math.random() - 0.5) * 0.6);
      } else if (type === 'fumee') {
        x += (Math.random() - 0.5) * 1.6; z += (Math.random() - 0.5) * 1.6;
        v = new THREE.Vector3((Math.random() - 0.5) * 0.25, 0.5 + Math.random() * 0.8, (Math.random() - 0.5) * 0.25);
      } else if (type === 'paillettes') {
        // quelques points lumineux qui montent lentement en spirale autour du Complice
        const a = Math.random() * Math.PI * 2, r = 0.25 + Math.random() * 0.35;
        x += Math.cos(a) * r; z += Math.sin(a) * r; y += Math.random() * 0.3;
        v = new THREE.Vector3(a, 0.35 + Math.random() * 0.45, r); // (angle, vitesse de montée, rayon)
      } else {
        const a = Math.random() * Math.PI * 2, r = type === 'braises' ? 0.6 + Math.random() * 1.6 : 0.4 + Math.random() * 1.4;
        v = new THREE.Vector3(Math.cos(a) * r, 1.4 + Math.random() * 2.6, Math.sin(a) * r);
      }
      pos.set([x, y, z], i * 3);
      vit.push(v);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: { eclat: 0.16, fumee: 0.55, confettis: 0.13, braises: 0.12, paillettes: 0.1 }[type],
      map: this._texParticule(), vertexColors: true, transparent: true, depthWrite: false,
      blending: type === 'fumee' ? THREE.NormalBlending : THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);
    let tPrec = 0;
    return this.animer(duree, (t) => {
      const dt = (t - tPrec) * duree / 1000; tPrec = t;
      const a = geo.attributes.position.array;
      for (let i = 0; i < N; i++) {
        const v = vit[i];
        if (type === 'eclat' || type === 'braises') v.y -= 2.2 * dt;
        if (type === 'paillettes') {
          v.x += dt * 1.1;
          a[i * 3] = centre.x + Math.cos(v.x) * v.z; a[i * 3 + 2] = centre.z + Math.sin(v.x) * v.z; a[i * 3 + 1] += v.y * dt;
          continue;
        }
        if (type === 'confettis') { v.x = Math.sin(t * 9 + i) * 0.5; }
        a[i * 3] += v.x * dt; a[i * 3 + 1] += v.y * dt; a[i * 3 + 2] += v.z * dt;
        if (type === 'confettis' && a[i * 3 + 1] < this.HAUT + 0.05) a[i * 3 + 1] = this.HAUT + 0.05;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = type === 'fumee' ? 0.55 * (1 - t) : type === 'paillettes' ? Math.min(1, t * 5) * (1 - t) * (0.75 + Math.sin(t * 40) * 0.25) : (t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25);
      if (type === 'fumee') mat.size = 0.55 + t * 0.6;
    }).then(() => { this.scene.remove(pts); geo.dispose(); mat.dispose(); });
  }
}

NV_etendre(Plateau3D, Effets3D);
