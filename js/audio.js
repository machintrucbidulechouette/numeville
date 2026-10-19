/* =====================================================================
   Numéville 3D — audio
   Musique d'ambiance générative et effets sonores, entièrement synthétisés
   avec la Web Audio API : aucun fichier audio n'est téléchargé (éco-conception).

   Graphe :  musique ─► atténuation (questions) ─┐
             effets  ───────────────────────────┼─► général ─► compresseur ─► sortie
             réverbération (envoi) ─────────────┘
   ===================================================================== */

(function () {
  const CLE = 'numeville-audio';
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  /* ------------------------------------------------------------------
     Ambiances musicales : accords (notes MIDI), tempo, couches actives
     ------------------------------------------------------------------ */
  const AMBIANCES = {
    // Exploration de la ville : la mineur, posé
    calme: {
      bpm: 92, filtre: 900, batterie: 0, arp: 0.55, basse: 'souple',
      accords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], // Am F C G
    },
    // Danger (Complice proche d'être perdu, attaque, fin de manche)
    tension: {
      bpm: 104, filtre: 1500, batterie: 1, arp: 0.75, basse: 'pulsee',
      accords: [[57, 60, 64], [57, 60, 64], [58, 62, 65], [56, 59, 64]], // Am Am Bb E
    },
    // Moment lumineux (Complice sauvé, victoire)
    lumineux: {
      bpm: 100, filtre: 2600, batterie: 0.6, arp: 1, basse: 'souple',
      accords: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]], // C G Am F
    },
    // Défaite : nappe grave seule
    sombre: {
      bpm: 70, filtre: 500, batterie: 0, arp: 0, basse: 'tenue',
      accords: [[45, 48, 52], [44, 48, 51]], // Am  Ab(aug)
    },
  };

  class AudioNumeville {
    constructor() {
      this.reglages = { general: 0.8, musique: 0.45, effets: 0.85, muet: false };
      try { Object.assign(this.reglages, JSON.parse(localStorage.getItem(CLE) || '{}')); } catch (e) { /* stockage indisponible */ }
      this.ctx = null;
      this.ambiance = 'calme';
      this.ambianceSuivante = null;
      this.musiqueActive = false;
      this.retourAmbiance = null;
    }

    /* ---------------- démarrage (après un geste de l'utilisateur) ---------------- */
    deverrouiller() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        this.compresseur = ctx.createDynamicsCompressor();
        this.compresseur.threshold.value = -14;
        this.compresseur.ratio.value = 4;
        this.compresseur.connect(ctx.destination);
        this.busGeneral = ctx.createGain(); this.busGeneral.connect(this.compresseur);
        this.busMusique = ctx.createGain(); this.attenuation = ctx.createGain();
        this.busMusique.connect(this.attenuation).connect(this.busGeneral);
        this.busEffets = ctx.createGain(); this.busEffets.connect(this.busGeneral);
        // réverbération synthétique (bruit à décroissance exponentielle)
        this.reverb = ctx.createConvolver();
        this.reverb.buffer = this._impulsion(2.4, 2.8);
        this.retourReverb = ctx.createGain(); this.retourReverb.gain.value = 0.35;
        this.reverb.connect(this.retourReverb).connect(this.busGeneral);
        // écho rythmique pour l'arpège
        this.echo = ctx.createDelay(1.5);
        this.echoRetour = ctx.createGain(); this.echoRetour.gain.value = 0.32;
        this.echo.connect(this.echoRetour).connect(this.echo);
        this.echo.connect(this.busMusique);
        this._bruit = this._bufferBruit();
        this.appliquer(true);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    _impulsion(duree, decroissance) {
      const ctx = this.ctx, n = Math.floor(ctx.sampleRate * duree);
      const b = ctx.createBuffer(2, n, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = b.getChannelData(c);
        for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decroissance);
      }
      return b;
    }
    _bufferBruit() {
      const ctx = this.ctx, n = ctx.sampleRate * 2;
      const b = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      return b;
    }

    /* ---------------- réglages ---------------- */
    regler(cle, valeur) {
      this.reglages[cle] = valeur;
      try { localStorage.setItem(CLE, JSON.stringify(this.reglages)); } catch (e) { /* stockage indisponible */ }
      this.appliquer();
    }
    appliquer(immediat = false) {
      if (!this.ctx) return;
      const r = this.reglages, t = this.ctx.currentTime, k = immediat ? 0.001 : 0.08;
      this.busGeneral.gain.setTargetAtTime(r.muet ? 0 : r.general, t, k);
      this.busMusique.gain.setTargetAtTime(r.musique * 1.5, t, k);
      this.busEffets.gain.setTargetAtTime(r.effets, t, k);
    }
    /** Baisse la musique pendant les questions pour aider la concentration. */
    attenuer(oui) {
      if (!this.ctx) return;
      this.attenuation.gain.setTargetAtTime(oui ? 0.45 : 1, this.ctx.currentTime, 0.4);
    }

    /* ---------------- briques de synthèse ---------------- */
    _ton({ type = 'sine', f, f2, t = 0, duree = 0.3, vol = 0.2, attaque = 0.005, dest, reverb = 0, filtre, detune = 0 }) {
      const ctx = this.ctx, t0 = ctx.currentTime + t;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t0); o.detune.value = detune;
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + duree);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + attaque);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + duree);
      let n = o;
      if (filtre) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filtre; o.connect(fl); n = fl; }
      n.connect(g).connect(dest || this.busEffets);
      if (reverb) { const s = ctx.createGain(); s.gain.value = reverb; g.connect(s).connect(this.reverb); }
      o.start(t0); o.stop(t0 + duree + 0.05);
    }

    _bruitFiltre({ t = 0, duree = 0.2, vol = 0.2, type = 'bandpass', f = 1000, f2, Q = 1, attaque = 0.003, dest, reverb = 0 }) {
      const ctx = this.ctx, t0 = ctx.currentTime + t;
      const s = ctx.createBufferSource(); s.buffer = this._bruit;
      s.playbackRate.value = 0.8 + Math.random() * 0.4;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.Q.value = Q;
      fl.frequency.setValueAtTime(f, t0);
      if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + duree);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + attaque);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + duree);
      s.connect(fl).connect(g).connect(dest || this.busEffets);
      if (reverb) { const r = ctx.createGain(); r.gain.value = reverb; g.connect(r).connect(this.reverb); }
      s.start(t0, Math.random() * 1.5); s.stop(t0 + duree + 0.05);
    }

    /* =================================================================
       EFFETS SONORES
       ================================================================= */
    effet(nom, opt = {}) {
      if (!this.ctx || this.reglages.muet) return;
      const f = this['_' + nom];
      if (f) { try { f.call(this, opt); } catch (e) { /* un son raté ne doit jamais bloquer le jeu */ } }
    }

    /** Dé qui roule : rebonds synchronisés avec l'animation 3D (1,15 s). */
    _de({ couleur = 'blanc' }) {
      const grave = couleur === 'noir' ? 0.8 : 1;
      const chocs = [0.02, 0.09, 0.15, 0.24, 0.46, 0.53, 0.82, 0.88, 1.02, 1.1];
      chocs.forEach((t, i) => {
        const v = 0.32 * (1 - i / chocs.length * 0.7);
        this._bruitFiltre({ t, duree: 0.05, vol: v, type: 'bandpass', f: 2600 * grave + Math.random() * 600, Q: 3 });
        this._ton({ type: 'triangle', f: (700 + Math.random() * 300) * grave, f2: 300 * grave, t, duree: 0.06, vol: v * 0.5 });
      });
      // le dé se pose
      this._ton({ type: 'sine', f: 180 * grave, f2: 90, t: 1.12, duree: 0.12, vol: 0.25 });
    }

    /** Le pion se pose sur une case. */
    _pas() {
      this._ton({ type: 'sine', f: 260, f2: 140, duree: 0.09, vol: 0.18 });
      this._bruitFiltre({ duree: 0.05, vol: 0.06, type: 'lowpass', f: 1800 });
    }

    /** Jeton bonne pratique : tintement cristallin. */
    _jetonBleu() {
      this._ton({ type: 'sine', f: 1318.5, duree: 0.7, vol: 0.12, reverb: 0.5 });
      this._ton({ type: 'sine', f: 1975.5, t: 0.04, duree: 0.6, vol: 0.08, reverb: 0.5 });
      this._ton({ type: 'triangle', f: 2637, t: 0.02, duree: 0.25, vol: 0.03 });
    }

    /** Jeton mauvaise pratique : impact grave et grinçant. */
    _jetonRouge() {
      this._ton({ type: 'sine', f: 140, f2: 55, duree: 0.35, vol: 0.32 });
      this._ton({ type: 'sawtooth', f: 116.5, duree: 0.35, vol: 0.07, filtre: 700 });
      this._ton({ type: 'sawtooth', f: 123.5, duree: 0.35, vol: 0.07, filtre: 700 });
    }

    /** Jeton retiré : petit souffle ascendant. */
    _retrait() {
      this._bruitFiltre({ duree: 0.25, vol: 0.1, type: 'bandpass', f: 500, f2: 3500, Q: 2 });
    }

    /** Carte qui s'envole de la pioche. */
    _carte() {
      this._bruitFiltre({ duree: 0.4, vol: 0.18, type: 'bandpass', f: 400, f2: 3200, Q: 1.2, reverb: 0.2 });
    }

    /** Carte qui se retourne à l'écran. */
    _retourne() {
      this._bruitFiltre({ duree: 0.18, vol: 0.12, type: 'highpass', f: 2500, f2: 6000 });
      this._ton({ type: 'triangle', f: 880, t: 0.16, duree: 0.08, vol: 0.06 });
    }

    /** Bonne réponse : arpège majeur montant. */
    _bonne() {
      [72, 76, 79, 84].forEach((n, i) => this._ton({ type: 'triangle', f: midi(n), t: i * 0.07, duree: 0.45, vol: 0.13, reverb: 0.4 }));
    }

    /** Mauvaise réponse : deux notes descendantes « buzz ». */
    _mauvaise() {
      this._ton({ type: 'square', f: midi(52), t: 0, duree: 0.22, vol: 0.06, filtre: 1200 });
      this._ton({ type: 'square', f: midi(51), f2: midi(46), t: 0.2, duree: 0.45, vol: 0.06, filtre: 900 });
    }

    /** Petit clic d'interface. */
    _clic() {
      this._ton({ type: 'sine', f: 1500, f2: 1100, duree: 0.04, vol: 0.035 });
    }

    /** Ouverture : nappe qui monte, souffle de la ville. */
    _intro() {
      this._bruitFiltre({ duree: 3.5, vol: 0.12, type: 'bandpass', f: 200, f2: 2400, Q: 0.8, attaque: 2.5, reverb: 0.5 });
      [57, 64, 69, 72].forEach((n, i) => this._ton({ type: 'sawtooth', f: midi(n), t: 0.4 + i * 0.25, duree: 3.4, attaque: 1.2, vol: 0.035, filtre: 1600, reverb: 0.6 }));
    }

    /** Face-à-face : battement de cœur + montée. */
    _face() {
      [0, 0.22, 0.75, 0.97].forEach((t, i) => this._ton({ type: 'sine', f: i % 2 ? 50 : 62, f2: 40, t, duree: 0.2, vol: 0.38 }));
      this._bruitFiltre({ t: 0.2, duree: 1.4, vol: 0.08, type: 'bandpass', f: 300, f2: 4000, Q: 3, attaque: 1.2 });
    }

    /** Attaque du Dark Master : craquement et tonnerre. */
    _attaque() {
      this._bruitFiltre({ duree: 0.25, vol: 0.4, type: 'highpass', f: 3000 });
      this._bruitFiltre({ t: 0.05, duree: 2.6, vol: 0.5, type: 'lowpass', f: 900, f2: 120, attaque: 0.05, reverb: 0.4 });
      this._ton({ type: 'sine', f: 70, f2: 30, t: 0.02, duree: 1.2, vol: 0.45 });
      this._ton({ type: 'sawtooth', f: midi(45), t: 0.3, duree: 1.8, vol: 0.05, filtre: 600, reverb: 0.4 });
      this._ton({ type: 'sawtooth', f: midi(51), t: 0.3, duree: 1.8, vol: 0.05, filtre: 600, reverb: 0.4 }); // triton
    }

    /** Fin de manche : gong (partiels inharmoniques). */
    _finManche() {
      [[110, 0.2], [158, 0.12], [207, 0.1], [281, 0.07], [377, 0.05]].forEach(([f, v]) =>
        this._ton({ type: 'sine', f, duree: 3, vol: v, attaque: 0.01, reverb: 0.6 }));
      this._bruitFiltre({ duree: 0.15, vol: 0.15, type: 'bandpass', f: 1200, Q: 1 });
    }

    /** Complice sauvé : accord lumineux + scintillement montant. */
    _sauve() {
      [60, 64, 67, 72].forEach((n) => this._ton({ type: 'sawtooth', f: midi(n), duree: 2.4, attaque: 0.3, vol: 0.04, filtre: 2600, reverb: 0.6 }));
      [72, 76, 79, 84, 88, 91, 96].forEach((n, i) => this._ton({ type: 'sine', f: midi(n), t: 0.25 + i * 0.09, duree: 0.6, vol: 0.09, reverb: 0.7 }));
    }

    /** Complice perdu : grondement et accord dissonant qui se referme. */
    _perdu() {
      this._ton({ type: 'sawtooth', f: midi(33), duree: 2.8, attaque: 0.2, vol: 0.12, filtre: 400 });
      this._ton({ type: 'sawtooth', f: midi(39), duree: 2.8, attaque: 0.4, vol: 0.06, filtre: 500, reverb: 0.4 });
      this._ton({ type: 'sine', f: midi(64), f2: midi(52), t: 0.3, duree: 1.8, vol: 0.06, reverb: 0.5 });
      this._bruitFiltre({ duree: 2.6, vol: 0.18, type: 'lowpass', f: 300, f2: 80, attaque: 0.6 });
    }

    /** Victoire : fanfare. */
    _victoire() {
      const m = [[60, 0], [64, 0.15], [67, 0.3], [72, 0.45], [67, 0.75], [72, 0.9]];
      m.forEach(([n, t]) => {
        this._ton({ type: 'sawtooth', f: midi(n), t, duree: 0.35, vol: 0.07, filtre: 2400, reverb: 0.4 });
        this._ton({ type: 'triangle', f: midi(n + 12), t, duree: 0.3, vol: 0.05 });
      });
      [60, 64, 67, 72, 76].forEach((n) => this._ton({ type: 'sawtooth', f: midi(n), t: 1.1, duree: 2.8, attaque: 0.05, vol: 0.045, filtre: 3000, reverb: 0.6 }));
    }

    /** Défaite : ligne descendante mineure. */
    _defaite() {
      [[69, 0], [67, 0.5], [65, 1.0], [64, 1.5]].forEach(([n, t]) =>
        this._ton({ type: 'triangle', f: midi(n), t, duree: 0.9, vol: 0.1, reverb: 0.6 }));
      [45, 52, 57].forEach((n) => this._ton({ type: 'sawtooth', f: midi(n), t: 1.5, duree: 3.5, attaque: 0.6, vol: 0.04, filtre: 500, reverb: 0.5 }));
    }

    /* =================================================================
       MUSIQUE GÉNÉRATIVE
       ================================================================= */
    demarrerMusique() {
      if (!this.ctx || this.musiqueActive) return;
      this.musiqueActive = true;
      this.pas = 0;
      this.mesure = 0;
      this.prochain = this.ctx.currentTime + 0.1;
      this.minuteur = setInterval(() => this._planifier(), 25);
    }
    arreterMusique() {
      this.musiqueActive = false;
      clearInterval(this.minuteur);
    }

    /**
     * Change d'ambiance au début de la mesure suivante.
     * @param {string} nom calme | tension | lumineux | sombre
     * @param {number} [mesures] durée en mesures avant de revenir à l'ambiance de fond
     */
    changerAmbiance(nom, mesures) {
      if (!AMBIANCES[nom]) return;
      if (mesures) { this.retourAmbiance = { apres: mesures, vers: this.ambianceFond || 'calme' }; }
      else { this.ambianceFond = nom; this.retourAmbiance = null; }
      this.ambianceSuivante = nom;
    }

    /** Ambiance de fond selon la situation (sans couper une ambiance temporaire en cours). */
    definirFond(nom) {
      if (!AMBIANCES[nom] || this.ambianceFond === nom) return;
      this.ambianceFond = nom;
      if (this.retourAmbiance) this.retourAmbiance.vers = nom;
      else this.ambianceSuivante = nom;
    }

    _planifier() {
      if (!this.ctx || this.ctx.state !== 'running') return;
      // onglet mis en arrière-plan : on reprend proprement au lieu de rattraper le retard
      if (this.prochain < this.ctx.currentTime - 0.2) this.prochain = this.ctx.currentTime + 0.05;
      while (this.prochain < this.ctx.currentTime + 0.15) {
        if (this.pas % 16 === 0) {
          if (this.ambianceSuivante) { this.ambiance = this.ambianceSuivante; this.ambianceSuivante = null; }
          else if (this.retourAmbiance && --this.retourAmbiance.apres <= 0) {
            this.ambiance = this.retourAmbiance.vers; this.retourAmbiance = null;
          }
        }
        const A = AMBIANCES[this.ambiance];
        const duree16 = 60 / A.bpm / 4;
        this._jouerPas(A, this.pas, this.prochain, duree16);
        this.prochain += duree16;
        this.pas++;
      }
    }

    _jouerPas(A, pas, t, d) {
      const ctx = this.ctx, dans = t - ctx.currentTime;
      const accord = A.accords[Math.floor(pas / 16) % A.accords.length];
      const p = pas % 16;
      this.echo.delayTime.setValueAtTime(d * 3, t); // écho à la croche pointée

      // Nappe : un accord par mesure
      if (p === 0) {
        accord.forEach((n) => [-7, 7].forEach((det) =>
          this._ton({ type: 'sawtooth', f: midi(n), t: dans, duree: d * 16 + 0.6, attaque: 0.5, vol: 0.04, filtre: A.filtre, detune: det, dest: this.busMusique, reverb: 0.35 })));
      }
      // Basse
      const fond = midi(accord[0] - 12);
      if (A.basse === 'souple' && (p === 0 || p === 6 || p === 10)) this._ton({ type: 'sawtooth', f: fond, t: dans, duree: d * 3, vol: 0.15, filtre: 380, dest: this.busMusique });
      if (A.basse === 'pulsee' && p % 2 === 0) this._ton({ type: 'sawtooth', f: fond, t: dans, duree: d * 1.6, vol: 0.12, filtre: 520, dest: this.busMusique });
      if (A.basse === 'tenue' && p === 0) this._ton({ type: 'sine', f: fond / 2, t: dans, duree: d * 16 + 0.5, attaque: 1, vol: 0.12, dest: this.busMusique });

      // Arpège (avec écho)
      if (A.arp && p % 2 === 0) {
        const motif = [0, 1, 2, 1, 2, 0, 1, 2];
        const n = accord[motif[(p / 2) % motif.length]] + 12 + (p >= 8 && A.arp > 0.7 ? 12 : 0);
        const g = ctx.createGain(); g.gain.value = 0.5; g.connect(this.echo);
        this._ton({ type: 'triangle', f: midi(n), t: dans, duree: d * 1.8, vol: 0.08 * A.arp, dest: this.busMusique, reverb: 0.25 });
        this._ton({ type: 'square', f: midi(n), t: dans, duree: d * 0.9, vol: 0.012 * A.arp, filtre: A.filtre * 1.5, dest: g });
      }

      // Batterie légère
      if (A.batterie) {
        const v = A.batterie;
        if (p % 4 === 0) this._ton({ type: 'sine', f: 120, f2: 42, t: dans, duree: 0.28, vol: 0.22 * v, dest: this.busMusique });
        if (p === 4 || p === 12) this._bruitFiltre({ t: dans, duree: 0.16, vol: 0.09 * v, type: 'bandpass', f: 1800, Q: 0.8, dest: this.busMusique, reverb: 0.2 });
        if (p % 2 === 1) this._bruitFiltre({ t: dans, duree: 0.04, vol: 0.035 * v, type: 'highpass', f: 7500, dest: this.busMusique });
      }
    }
  }

  window.NV_AUDIO = new AudioNumeville();
})();
