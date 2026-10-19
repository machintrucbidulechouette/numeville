/* =====================================================================
   Numéville 3D — musique générative
   Deux morceaux (Néons, Circuit), quatre ambiances chacun, découpés en sections
   avec mélodie renouvelée à chaque cycle. Méthodes ajoutées à AudioNumeville.
   ===================================================================== */

/* ------------------------------------------------------------------
   Accords : [fondamentale (basse), notes de l'accord…] en notes MIDI
   ------------------------------------------------------------------ */
const ACC = {
  // Néons (la mineur)
  Am: [45, 57, 60, 64], F: [41, 57, 60, 65], C: [48, 55, 60, 64], G: [43, 55, 59, 62],
  E: [40, 56, 59, 64], Dm: [50, 53, 57, 62], Em: [52, 55, 59, 64], Bb: [46, 58, 62, 65],
  Gsus: [43, 55, 60, 62],
  // Circuit (ré dorien, accords de septième)
  Dm7: [50, 53, 57, 60, 64], G7: [43, 53, 59, 62, 65], Cmaj7: [48, 55, 59, 60, 64],
  Am7: [45, 55, 60, 64, 67], Fmaj7: [41, 57, 60, 64, 65], Bbmaj7: [46, 57, 58, 62, 65],
  A7: [45, 55, 57, 61, 64], Gm7: [43, 55, 58, 62, 65], Ebmaj7: [51, 55, 58, 62, 63],
  Bbm: [46, 53, 58, 61],
  // nappes graves (défaite)
  AmG: [33, 45, 48, 52], LabAug: [32, 44, 48, 52], DmG: [38, 50, 53, 57], SibmG: [34, 46, 49, 53],
};

/* Motifs d'arpège : index dans l'accord (+10 = une octave au-dessus, -1 = silence), un par croche */
const MOTIFS = [
  [0, 1, 2, 1, 2, 0, 1, 2], [0, 2, 1, 2, 10, 2, 1, 2], [0, -1, 1, -1, 2, -1, 1, -1],
  [2, 1, 0, 1, 2, 10, 12, 10], [0, 0, 1, 0, 2, 0, 1, 0], [0, 1, 2, 10, 0, 1, 2, 11],
  [0, -1, 2, -1, 1, -1, 3, -1], [0, 2, 1, 3, 0, 2, 1, 3], [3, 2, 1, 0, 1, 2, 3, 10],
];

/* ------------------------------------------------------------------
   Deux morceaux au choix. Chaque ambiance est découpée en sections
   de 8 mesures (couplet, refrain, pont…) ; la mélodie est générée
   à chaque cycle, avec des phrases qui se répondent toutes les 4 mesures.
   ------------------------------------------------------------------ */
const PISTES = {
  neons: {
    nom: 'Néons', desc: 'Synthwave nocturne',
    nappe: 'sawtooth', basseType: 'sawtooth', arpType: 'triangle', leadType: 'triangle', style: 'synth', swing: 0,
    gamme: [69, 71, 72, 74, 76, 77, 79, 81, 83, 84],
    ambiances: {
      calme: { bpm: 92, filtre: 1000, batterie: 0.3, arp: 0.55, basse: 'souple', sections: [
        { accords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'E'], motif: 0 },
        { accords: ['F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'E'], motif: 1, melodie: 0.45 },
        { accords: ['Am', 'Am', 'F', 'F', 'C', 'C', 'G', 'Gsus'], motif: 2, arp: 0.35, basse: false, batterie: 0, melodie: 0.35 },
        { accords: ['Dm', 'F', 'C', 'G', 'Dm', 'F', 'E', 'E'], motif: 3, melodie: 0.5, batterie: 0.55 },
      ] },
      tension: { bpm: 104, filtre: 1500, batterie: 1, arp: 0.75, basse: 'pulsee', sections: [
        { accords: ['Am', 'Am', 'Bb', 'E'], motif: 4 },
        { accords: ['Dm', 'Am', 'Bb', 'E', 'Dm', 'Am', 'F', 'E'], motif: 5, melodie: 0.5 },
      ] },
      lumineux: { bpm: 100, filtre: 2600, batterie: 0.7, arp: 1, basse: 'souple', sections: [
        { accords: ['C', 'G', 'Am', 'F'], motif: 1, melodie: 0.55 },
        { accords: ['F', 'G', 'C', 'Am', 'F', 'G', 'C', 'C'], motif: 3, melodie: 0.5 },
      ] },
      sombre: { bpm: 70, filtre: 500, batterie: 0, arp: 0, basse: 'tenue', sections: [{ accords: ['AmG', 'LabAug'] }] },
    },
  },
  circuit: {
    nom: 'Circuit', desc: 'Lo-fi rétro, sons 8 bits',
    nappe: 'triangle', basseType: 'triangle', arpType: 'square', leadType: 'square', style: 'lofi', swing: 0.14, crepitement: true,
    gamme: [62, 64, 65, 67, 69, 71, 72, 74, 76, 77],
    ambiances: {
      calme: { bpm: 84, filtre: 1400, batterie: 0.7, arp: 0.5, basse: 'boom', sections: [
        { accords: ['Dm7', 'G7', 'Cmaj7', 'Am7'], motif: 6 },
        { accords: ['Fmaj7', 'G7', 'Dm7', 'Am7', 'Bbmaj7', 'Cmaj7', 'Dm7', 'A7'], motif: 7, melodie: 0.5 },
        { accords: ['Dm7', 'Dm7', 'Gm7', 'Gm7', 'Bbmaj7', 'Cmaj7', 'A7', 'A7'], motif: 6, batterie: 0.35, basse: false, melodie: 0.4 },
        { accords: ['Dm7', 'G7', 'Cmaj7', 'Fmaj7', 'Bbmaj7', 'Gm7', 'A7', 'A7'], motif: 8, melodie: 0.55 },
      ] },
      tension: { bpm: 98, filtre: 1800, batterie: 1, arp: 0.8, basse: 'pulsee', sections: [
        { accords: ['Dm7', 'Dm7', 'Ebmaj7', 'A7'], motif: 4 },
        { accords: ['Gm7', 'Dm7', 'Ebmaj7', 'A7', 'Gm7', 'Dm7', 'Bbm', 'A7'], motif: 5, melodie: 0.5 },
      ] },
      lumineux: { bpm: 92, filtre: 2400, batterie: 0.8, arp: 0.9, basse: 'boom', sections: [
        { accords: ['Fmaj7', 'Cmaj7', 'Dm7', 'Bbmaj7'], motif: 7, melodie: 0.55 },
        { accords: ['Bbmaj7', 'Cmaj7', 'Am7', 'Dm7', 'Bbmaj7', 'Cmaj7', 'Fmaj7', 'Fmaj7'], motif: 8, melodie: 0.5 },
      ] },
      sombre: { bpm: 66, filtre: 450, batterie: 0, arp: 0, basse: 'tenue', sections: [{ accords: ['DmG', 'SibmG'] }] },
    },
  },
};

/* générateur pseudo-aléatoire reproductible (mélodies) */
const prng = (graine) => () => {
  graine = (graine + 0x6D2B79F5) | 0;
  let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};


class MusiqueNumeville {
  /* =================================================================
     MUSIQUE GÉNÉRATIVE (2 morceaux, 4 ambiances chacun)
     ================================================================= */

  demarrerMusique() {
    if (!this.ctx || this.musiqueActive) return;
    this.musiqueActive = true;
    this.pas = 0;
    this.barre = 0;
    this.prochain = this.ctx.currentTime + 0.1;
    this.minuteur = setInterval(() => this._planifier(), 25);
  }
  arreterMusique() {
    this.musiqueActive = false;
    clearInterval(this.minuteur);
  }

  /** Choisit le morceau (neons | circuit) ; le changement se fait à la mesure suivante. */
  choisirPiste(id) {
    if (!PISTES[id]) return;
    this.regler('piste', id);
    this.barre = 0;
  }

  /**
   * Change d'ambiance au début de la mesure suivante.
   * @param {string} nom calme | tension | lumineux | sombre
   * @param {number} [mesures] durée en mesures avant de revenir à l'ambiance de fond
   */
  changerAmbiance(nom, mesures) {
    if (!PISTES.neons.ambiances[nom]) return;
    if (mesures) { this.retourAmbiance = { apres: mesures, vers: this.ambianceFond || 'calme' }; }
    else { this.ambianceFond = nom; this.retourAmbiance = null; }
    this.ambianceSuivante = nom;
  }

  /** Ambiance de fond selon la situation (sans couper une ambiance temporaire en cours). */
  definirFond(nom) {
    if (!PISTES.neons.ambiances[nom] || this.ambianceFond === nom) return;
    this.ambianceFond = nom;
    if (this.retourAmbiance) this.retourAmbiance.vers = nom;
    else this.ambianceSuivante = nom;
  }

  _planifier() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    // onglet mis en arrière-plan : on reprend proprement au lieu de rattraper le retard
    if (this.prochain < this.ctx.currentTime - 0.2) this.prochain = this.ctx.currentTime + 0.05;
    // son coupé ou musique à 0 : on avance le temps sans créer de sons (économie de calcul)
    const silencieux = this.reglages.muet || this.reglages.musique === 0 || this.reglages.general === 0;
    while (this.prochain < this.ctx.currentTime + 0.15) {
      if (this.pas % 16 === 0) {
        if (this.pas > 0) this.barre++;
        if (this.ambianceSuivante) {
          if (this.ambianceSuivante !== this.ambiance) this.barre = 0;
          this.ambiance = this.ambianceSuivante; this.ambianceSuivante = null;
        } else if (this.retourAmbiance && --this.retourAmbiance.apres <= 0) {
          this.ambiance = this.retourAmbiance.vers; this.retourAmbiance = null; this.barre = 0;
        }
      }
      const P = PISTES[this.reglages.piste] || PISTES.neons;
      const A = P.ambiances[this.ambiance];
      const duree16 = 60 / A.bpm / 4;
      if (!silencieux) this._jouerPas(P, A, this.pas % 16, this.prochain, duree16);
      this.prochain += duree16;
      this.pas++;
    }
  }

  _jouerPas(P, A, p, t, d) {
    const ctx = this.ctx;
    const barre = this.barre;
    const iSection = Math.floor(barre / 8) % A.sections.length;
    const S = A.sections[iSection];
    const bIn = barre % 8;
    const acc = ACC[S.accords[bIn % S.accords.length]];
    const fond = acc[0], notes = acc.slice(1);
    const arp = S.arp !== undefined ? S.arp : A.arp;
    const batterie = S.batterie !== undefined ? S.batterie : A.batterie;
    const basse = S.basse === false ? null : A.basse;
    const swing = P.swing && p % 2 === 1 ? P.swing * d : 0;
    const dans = t - ctx.currentTime + swing;
    const dest = this.busMusique;
    if (p === 0) this.echo.delayTime.setValueAtTime(d * 3, t); // écho à la croche pointée

    // --- Nappe : un accord tenu par mesure
    if (p === 0) {
      notes.slice(0, 3).forEach((n) => [-7, 7].forEach((det) =>
        this._ton({ type: P.nappe, f: midi(n), t: dans, duree: d * 16 + 0.6, attaque: 0.5, vol: P.nappe === 'sawtooth' ? 0.04 : 0.06, filtre: A.filtre, detune: det, dest, reverb: 0.35 })));
    }

    // --- Basse
    const fb = midi(fond);
    if (basse === 'souple') {
      const motif = bIn % 2 ? [0, 6, 10, 14] : [0, 6, 10];
      if (motif.includes(p)) this._ton({ type: P.basseType, f: p === 14 ? fb * 2 : fb, t: dans, duree: d * 3, vol: 0.15, filtre: 380, dest });
    } else if (basse === 'pulsee' && p % 2 === 0) {
      this._ton({ type: P.basseType, f: p === 12 && bIn % 2 ? fb * 2 : fb, t: dans, duree: d * 1.6, vol: 0.12, filtre: 520, dest });
    } else if (basse === 'boom' && [0, 3, 8, 11].includes(p)) {
      this._ton({ type: P.basseType, f: p === 11 ? fb * 2 : fb, t: dans, duree: d * (p === 0 ? 4 : 2), vol: 0.22, dest });
    } else if (basse === 'tenue' && p === 0) {
      this._ton({ type: 'sine', f: fb, t: dans, duree: d * 16 + 0.5, attaque: 1, vol: 0.14, dest });
    }

    // --- Arpège (avec écho)
    if (arp && p % 2 === 0) {
      const m = MOTIFS[S.motif || 0][(p / 2) % 8];
      if (m >= 0) {
        const n = notes[(m % 10) % notes.length] + 12 + (m >= 10 ? 12 : 0);
        const env = ctx.createGain(); env.gain.value = 0.5; env.connect(this.echo);
        this._ton({ type: P.arpType, f: midi(n), t: dans, duree: d * 1.8, vol: (P.arpType === 'square' ? 0.03 : 0.08) * arp, filtre: P.arpType === 'square' ? 2200 : undefined, dest, reverb: 0.25 });
        this._ton({ type: 'square', f: midi(n), t: dans, duree: d * 0.9, vol: 0.012 * arp, filtre: A.filtre * 1.5, dest: env });
      }
    }

    // --- Mélodie : phrases de 4 mesures, renouvelées à chaque cycle du morceau
    if (S.melodie && p % 2 === 0) {
      const cycle = Math.floor(barre / (8 * A.sections.length));
      const r = prng(cycle * 7919 + iSection * 131 + (bIn % 4) * 17 + p);
      const cadence = bIn % 4 === 3 && p === 8;
      if (cadence || r() < S.melodie) {
        const tonsAccord = notes.map((n) => { let x = n; while (x < 64) x += 12; while (x > 84) x -= 12; return x; });
        let n;
        if (cadence) n = tonsAccord[0];
        else if (p % 4 === 0 || r() < 0.6) n = tonsAccord[Math.floor(r() * tonsAccord.length)];
        else n = P.gamme[Math.floor(r() * P.gamme.length)];
        const longue = cadence || r() < 0.25;
        const envoi = ctx.createGain(); envoi.gain.value = 0.6; envoi.connect(this.echo);
        this._ton({ type: P.leadType, f: midi(n), t: dans, duree: d * (longue ? 6 : 1.8), attaque: 0.01, vol: P.leadType === 'square' ? 0.028 : 0.06, filtre: P.leadType === 'square' ? 2600 : 4000, dest, reverb: 0.4 });
        this._ton({ type: P.leadType, f: midi(n), t: dans, duree: d * (longue ? 6 : 1.8), vol: 0.015, dest: envoi });
      }
    }

    // --- Batterie
    if (batterie > 0) {
      const v = batterie;
      const remplissage = bIn % 4 === 3 && p >= 12 && v >= 0.6; // break de caisse claire avant la phrase suivante
      if (P.style === 'lofi') {
        if (p === 0 || p === 10 || (p === 7 && bIn % 2)) this._ton({ type: 'sine', f: 95, f2: 40, t: dans, duree: 0.32, vol: 0.32 * v, dest });
        if (p === 4 || p === 12) this._bruitFiltre({ t: dans, duree: 0.18, vol: 0.1 * v, type: 'bandpass', f: 1500, Q: 0.7, dest, reverb: 0.15 });
        if (!remplissage && p % 2 === 0) this._bruitFiltre({ t: dans, duree: 0.05, vol: (p % 4 ? 0.025 : 0.04) * v, type: 'highpass', f: 6500, dest });
      } else {
        if (p % 4 === 0) this._ton({ type: 'sine', f: 120, f2: 42, t: dans, duree: 0.28, vol: 0.22 * v, dest });
        if (p === 4 || p === 12) this._bruitFiltre({ t: dans, duree: 0.16, vol: 0.09 * v, type: 'bandpass', f: 1800, Q: 0.8, dest, reverb: 0.2 });
        if (!remplissage && p % 2 === 1) this._bruitFiltre({ t: dans, duree: 0.04, vol: 0.035 * v, type: 'highpass', f: 7500, dest });
      }
      if (remplissage) this._bruitFiltre({ t: dans, duree: 0.09, vol: (0.04 + (p - 12) * 0.02) * v, type: 'bandpass', f: 1700, Q: 0.9, dest });
      // cymbale en début de section
      if (p === 0 && bIn === 0 && barre > 0) this._bruitFiltre({ t: dans, duree: 1.4, vol: 0.06 * v, type: 'highpass', f: 5000, dest, reverb: 0.3 });
    }

    // --- Crépitement « vinyle » (morceau lo-fi)
    if (P.crepitement && Math.random() < 0.35) {
      this._bruitFiltre({ t: dans + Math.random() * d, duree: 0.006, vol: 0.02 + Math.random() * 0.03, type: 'highpass', f: 3000, dest });
    }
  }
}

NV_etendre(AudioNumeville, MusiqueNumeville);

window.NV_AUDIO = new AudioNumeville();
window.NV_PISTES = PISTES;
