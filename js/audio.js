/* =====================================================================
   Numéville 3D — audio
   Musique d'ambiance générative et effets sonores, entièrement synthétisés
   avec la Web Audio API : aucun fichier audio n'est téléchargé (éco-conception).

   Graphe :  musique ─► atténuation (questions) ─┐
             effets  ───────────────────────────┼─► général ─► compresseur ─► sortie
             réverbération (envoi) ─────────────┘
   ===================================================================== */

(function () {
  const CLE = 'numeville-audio-v2';
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

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

  class AudioNumeville {
    constructor() {
      this.reglages = { general: 1, musique: 0.6, effets: 1, muet: false, piste: 'neons' };
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
      this.busMusique.gain.setTargetAtTime(r.musique * 1.2, t, k);
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

    /**
     * Impact d'un dé en plastique sur le plateau en carton :
     * claquement très bref (résonances du dé) + petit « toc » grave du plateau.
     */
    _impact(t, force, grave = 1) {
      const ctx = this.ctx, t0 = ctx.currentTime + t;
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      if (pan.pan) pan.pan.value = (Math.random() - 0.5) * 0.5;
      pan.connect(this.busEffets);
      const s = ctx.createBufferSource(); s.buffer = this._bruit;
      const env = ctx.createGain();
      const dur = 0.012 + force * 0.02;
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.exponentialRampToValueAtTime(0.9 * force, t0 + 0.0008);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      s.connect(env);
      // trois résonances du petit cube de plastique, légèrement aléatoires
      [[2300, 0.9], [3900, 0.6], [6100, 0.35]].forEach(([f, v]) => {
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
        bp.frequency.value = f * grave * (0.88 + Math.random() * 0.24); bp.Q.value = 9;
        const g = ctx.createGain(); g.gain.value = v * 1.6;
        env.connect(bp).connect(g).connect(pan);
      });
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
      const ghp = ctx.createGain(); ghp.gain.value = 0.25;
      env.connect(hp).connect(ghp).connect(pan);
      s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.02);
      // « toc » du plateau (seulement pour les chocs assez forts)
      if (force > 0.25) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(190 * grave, t0); o.frequency.exponentialRampToValueAtTime(95, t0 + 0.05);
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.32 * force, t0 + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.07);
        o.connect(g).connect(pan); o.start(t0); o.stop(t0 + 0.09);
      }
    }

    /**
     * Dé lancé, calé sur l'animation 3D (1,15 s) : trois rebonds de plus en plus
     * faibles, le dé roule sur ses arêtes entre deux rebonds, puis oscille avant de se poser.
     */
    _de({ couleur = 'blanc' }) {
      const grave = couleur === 'noir' ? 0.86 : 1;
      const rebonds = [[0.0, 1], [0.46, 0.62], [0.92, 0.38]];
      rebonds.forEach(([t, f]) => {
        this._impact(t, f, grave);
        // roulement : 2 à 4 arêtes qui touchent juste après le rebond
        let u = t, e = f;
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
          u += 0.028 + Math.random() * 0.045; e *= 0.5 + Math.random() * 0.2;
          this._impact(u, e, grave);
        }
      });
      // le dé se balance sur une arête puis s'immobilise (oscillations de plus en plus rapides)
      let t = 1.0, e = 0.55;
      [0.06, 0.045, 0.033, 0.024, 0.017, 0.012].forEach((dt) => {
        t += dt; e *= 0.74;
        this._impact(t, e, grave);
      });
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
       MUSIQUE GÉNÉRATIVE (2 morceaux, 4 ambiances chacun)
       ================================================================= */
    static get PISTES() { return PISTES; }

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

  window.NV_AUDIO = new AudioNumeville();
  window.NV_PISTES = PISTES;
})();
