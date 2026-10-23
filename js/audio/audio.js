/* =====================================================================
   Numéville 3D — audio
   Moteur audio et effets sonores (la musique est dans musique.js), entièrement synthétisés
   avec la Web Audio API : aucun fichier audio n'est téléchargé (éco-conception).

   Graphe :  musique ─► atténuation (questions) ─┐
             effets  ───────────────────────────┼─► général ─► compresseur ─► sortie
             réverbération (envoi) ─────────────┘
   ===================================================================== */

const NV_AUDIO_CLE = 'numeville-audio-v2';
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

class AudioNumeville {
  constructor() {
    this.reglages = { general: 1, musique: 0.6, effets: 1, muet: false, piste: 'neons' };
    try { Object.assign(this.reglages, JSON.parse(localStorage.getItem(NV_AUDIO_CLE) || '{}')); } catch (e) { /* stockage indisponible */ }
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
    try { localStorage.setItem(NV_AUDIO_CLE, JSON.stringify(this.reglages)); } catch (e) { /* stockage indisponible */ }
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
    if (!this.ctx || this.reglages.muet || window.NV_RATTRAPAGE) return;
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

  /** Carte Objet / Pouvoir piochée ou utilisée : scintillement magique. */
  _objet() {
    [84, 88, 91, 96, 100].forEach((n, i) => this._ton({ type: 'sine', f: midi(n), t: i * 0.05, duree: 0.5, vol: 0.06, reverb: 0.6 }));
    this._bruitFiltre({ duree: 0.5, vol: 0.05, type: 'highpass', f: 6000, f2: 9000, attaque: 0.1 });
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

  /** Fin de manche : souffle qui monte, gong (partiels inharmoniques) puis carillon doré quand la carte se soulève. */
  _finManche() {
    this._bruitFiltre({ duree: 1.1, vol: 0.07, type: 'bandpass', f: 400, f2: 2600, Q: 2, attaque: 0.9 });
    [[110, 0.2], [158, 0.12], [207, 0.1], [281, 0.07], [377, 0.05]].forEach(([f, v]) =>
      this._ton({ type: 'sine', f, t: 0.35, duree: 3.2, vol: v, attaque: 0.01, reverb: 0.6 }));
    this._bruitFiltre({ t: 0.35, duree: 0.15, vol: 0.15, type: 'bandpass', f: 1200, Q: 1 });
    [76, 79, 83, 88].forEach((n, i) => this._ton({ type: 'sine', f: midi(n), t: 1.3 + i * 0.13, duree: 1.2, vol: 0.05, reverb: 0.8 }));
  }

  /** « Nuit blanche sur les écrans » : nappe nocturne, carillon et petits bips d'écrans qui s'allument. */
  _nuit() {
    [45, 52, 57, 60].forEach((n) => this._ton({ type: 'triangle', f: midi(n), duree: 3.6, attaque: 1.1, vol: 0.045, filtre: 1100, reverb: 0.7 }));
    [84, 79, 76, 72].forEach((n, i) => this._ton({ type: 'sine', f: midi(n), t: 0.5 + i * 0.32, duree: 1.4, vol: 0.06, reverb: 0.8 }));
    [1.6, 1.9, 2.1, 2.45, 2.7].forEach((t, i) => this._ton({ type: 'square', f: midi(91 + (i % 3) * 2), t, duree: 0.05, vol: 0.02, filtre: 3000 }));
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

  /* ---------------- sons du mode Pro et nouveautés ---------------- */

  /** Début de tour : petit carillon à deux notes (plus vif quand c'est à toi). */
  _tour({ moi = true } = {}) {
    const n = moi ? [79, 86] : [72, 79];
    n.forEach((m, i) => this._ton({ type: 'sine', f: midi(m), t: i * 0.11, duree: 0.45, vol: moi ? 0.09 : 0.05, reverb: 0.5 }));
    this._ton({ type: 'triangle', f: midi(n[1] + 12), t: 0.11, duree: 0.18, vol: 0.025 });
  }

  /** Jetpack : allumage, souffle des réacteurs qui monte puis s'éloigne. */
  _jetpack() {
    this._ton({ type: 'square', f: 90, f2: 60, duree: 0.12, vol: 0.08, filtre: 600 });
    this._bruitFiltre({ t: 0.05, duree: 2.2, vol: 0.28, type: 'bandpass', f: 300, f2: 1400, Q: 0.8, attaque: 0.35, reverb: 0.25 });
    this._bruitFiltre({ t: 0.05, duree: 2.0, vol: 0.12, type: 'lowpass', f: 180, f2: 420, attaque: 0.2 });
    this._ton({ type: 'sawtooth', f: 70, f2: 160, t: 0.1, duree: 1.6, vol: 0.05, filtre: 500, attaque: 0.3 });
  }

  /** Case malus : sirène descendante et grésillement. */
  _malus() {
    this._ton({ type: 'square', f: midi(76), f2: midi(64), duree: 0.32, vol: 0.06, filtre: 1800 });
    this._ton({ type: 'square', f: midi(73), f2: midi(61), t: 0.3, duree: 0.42, vol: 0.06, filtre: 1500 });
    this._bruitFiltre({ t: 0.05, duree: 0.6, vol: 0.08, type: 'highpass', f: 3000 });
  }

  /** Quartier qui se rallume (victoire totale) : une note de la gamme par Complice. */
  _carillon({ n = 0 } = {}) {
    const notes = [72, 74, 76, 79, 81, 84];
    const m = notes[n % notes.length];
    this._ton({ type: 'sine', f: midi(m), duree: 1.6, vol: 0.1, reverb: 0.8 });
    this._ton({ type: 'sine', f: midi(m + 12), t: 0.02, duree: 1.0, vol: 0.04, reverb: 0.8 });
    this._ton({ type: 'triangle', f: midi(m - 12), duree: 1.2, vol: 0.04, attaque: 0.05, reverb: 0.5 });
  }

  /** Feu d'artifice : sifflement puis petite explosion. */
  _petard() {
    this._bruitFiltre({ duree: 0.35, vol: 0.06, type: 'bandpass', f: 1800, f2: 5200, Q: 8 });
    this._bruitFiltre({ t: 0.35, duree: 0.7, vol: 0.22, type: 'lowpass', f: 1600, f2: 200, reverb: 0.5 });
  }

  /** Victoire totale (mode Pro) : grande fanfare en trois temps. */
  _victoirePro() {
    const m = [[60, 0], [64, 0.18], [67, 0.36], [72, 0.54], [71, 0.9], [72, 1.08], [76, 1.26], [79, 1.62]];
    m.forEach(([n, t]) => {
      this._ton({ type: 'sawtooth', f: midi(n), t, duree: 0.4, vol: 0.06, filtre: 2600, reverb: 0.4 });
      this._ton({ type: 'triangle', f: midi(n + 12), t, duree: 0.32, vol: 0.04 });
    });
    [60, 64, 67, 72, 76, 79].forEach((n) => this._ton({ type: 'sawtooth', f: midi(n), t: 1.9, duree: 4.5, attaque: 0.6, vol: 0.035, filtre: 3000, reverb: 0.7 }));
    this._bruitFiltre({ t: 1.9, duree: 4, vol: 0.05, type: 'highpass', f: 5000, f2: 9000, attaque: 1.5 });
  }

  /** Défaite (mode Pro) : grondement grave qui monte, accord sombre. */
  _defaitePro() {
    this._ton({ type: 'sawtooth', f: midi(28), duree: 6, attaque: 1.5, vol: 0.12, filtre: 300, reverb: 0.5 });
    this._ton({ type: 'sawtooth', f: midi(34), duree: 6, attaque: 2, vol: 0.06, filtre: 400, reverb: 0.5 });
    [[57, 0.5], [55, 1.6], [53, 2.7], [52, 3.8]].forEach(([n, t]) => this._ton({ type: 'triangle', f: midi(n), t, duree: 1.3, vol: 0.07, reverb: 0.7 }));
    this._bruitFiltre({ duree: 5, vol: 0.12, type: 'lowpass', f: 120, f2: 400, attaque: 2.5, reverb: 0.4 });
  }

  /** Une lumière de quartier qui grille. */
  _coupure() {
    this._bruitFiltre({ duree: 0.18, vol: 0.12, type: 'highpass', f: 2500 });
    this._ton({ type: 'square', f: 50, duree: 0.25, vol: 0.06, filtre: 300 });
  }

  /** Apparition de l'hologramme : balayage électrique montant. */
  _hologramme() {
    this._ton({ type: 'sawtooth', f: 60, f2: 480, duree: 1.3, vol: 0.06, filtre: 1500, attaque: 0.2, reverb: 0.5 });
    this._ton({ type: 'sine', f: 120, f2: 960, duree: 1.3, vol: 0.05, attaque: 0.2, reverb: 0.5 });
    for (let i = 0; i < 6; i++) this._bruitFiltre({ t: Math.random() * 1.2, duree: 0.06, vol: 0.08, type: 'bandpass', f: 3000 + Math.random() * 3000, Q: 3 });
  }

  /**
   * Rire du Dark Master : une voix synthétique grave qui articule « ha ! ha ! ha ! haaa ».
   * Chaque syllabe = souffle (« h ») + son voisé passé dans deux filtres « formants » de la voyelle « a »,
   * doublé à l'octave inférieure et légèrement saturé, avec beaucoup de réverbération.
   */
  _rire() {
    const ctx = this.ctx, t0 = ctx.currentTime + 0.05;
    const sortie = ctx.createGain(); sortie.gain.value = 0.9;
    const sat = ctx.createWaveShaper();
    const courbe = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; courbe[i] = Math.tanh(x * 2.2); }
    sat.curve = courbe;
    sat.connect(sortie).connect(this.busEffets);
    const env = ctx.createGain(); env.gain.value = 0.5; sortie.connect(env).connect(this.reverb);
    const syllabes = [[0, 0.26, 1], [0.34, 0.24, 0.97], [0.64, 0.24, 0.93], [0.93, 0.25, 0.9], [1.23, 0.26, 0.88], [1.55, 0.3, 0.85], [1.95, 1.1, 0.78]];
    const F0 = 118;
    syllabes.forEach(([t, d, h], i) => {
      const debut = t0 + t;
      // souffle « h »
      this._bruitFiltre({ t: t + 0.03, duree: 0.07, vol: 0.12, type: 'bandpass', f: 1400, Q: 1.2, dest: sat });
      for (const [mult, vol] of [[1, 0.5], [0.5, 0.45]]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        const f = F0 * h * mult;
        o.frequency.setValueAtTime(f * 1.12, debut);
        o.frequency.exponentialRampToValueAtTime(f, debut + 0.06);
        o.frequency.exponentialRampToValueAtTime(f * (i === syllabes.length - 1 ? 0.7 : 0.9), debut + d);
        const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 6; vg.gain.value = f * 0.02;
        vib.connect(vg).connect(o.frequency);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, debut);
        g.gain.exponentialRampToValueAtTime(vol, debut + 0.04);
        g.gain.setValueAtTime(vol * 0.8, debut + d * 0.6);
        g.gain.exponentialRampToValueAtTime(0.0001, debut + d);
        for (const [ff, q, gv] of [[720, 7, 1.4], [1150, 9, 0.9], [2500, 10, 0.25]]) {
          const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff * (mult < 1 ? 0.92 : 1); bp.Q.value = q;
          const gg = ctx.createGain(); gg.gain.value = gv;
          o.connect(bp).connect(gg).connect(g);
        }
        g.connect(sat);
        o.start(debut); o.stop(debut + d + 0.05); vib.start(debut); vib.stop(debut + d + 0.05);
      }
    });
    // grondement sous le rire
    this._ton({ type: 'sine', f: 46, duree: 3.4, attaque: 0.3, vol: 0.25 });
  }

  /** Petite mélodie 8 bits. */
  _fete() {
    const m = [72, 76, 79, 84, 79, 76, 72, 74, 77, 81, 86, 81, 77, 74, 76, 79, 83, 88];
    m.forEach((n, i) => this._ton({ type: 'square', f: midi(n), t: i * 0.12, duree: 0.11, vol: 0.035, filtre: 4000 }));
    [48, 50, 52].forEach((n, i) => this._ton({ type: 'triangle', f: midi(n), t: i * 0.72, duree: 0.7, vol: 0.06 }));
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
}

window.AudioNumeville = AudioNumeville;
