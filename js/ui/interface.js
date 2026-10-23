/* =====================================================================
   Numéville 3D — interface (HTML/CSS par-dessus la scène 3D)
   Toutes les interactions renvoient des promesses : le moteur de jeu
   « attend » simplement la décision du joueur.
   ===================================================================== */

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs = {}, html = '') => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v !== undefined) e.setAttribute(k, v === true ? '' : v);
  }
  if (html) e.innerHTML = html;
  return e;
};
const LETTRES = ['A', 'B', 'C', 'D'];
const IMG = 'assets/img/';

class Interface {
  constructor() {
    this.zoneActions = $('#actions');
    this.journal = $('#journal-liste');
    this.modale = $('#modale');
    this._construireFiches();
    // hauteur réelle de la barre d'actions : les cartes en main et le journal se placent au-dessus
    if (window.ResizeObserver) {
      new ResizeObserver(() => document.documentElement.style.setProperty('--actions-h', this.zoneActions.offsetHeight + 'px')).observe(this.zoneActions);
    }
    $('#cinema').addEventListener('click', () => this.plateau && this.plateau.passerCinematique());
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (document.body.classList.contains('cinema')) {
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); this.plateau && this.plateau.passerCinematique(); }
        return;
      }
      if ($('#aide').classList.contains('ouverte')) { if (e.key === 'Escape') this.fermerAide(); return; }
      if ($('#accueil:not(.cache)')) return;
      if (e.key === ' ' || e.key === 'Enter') {
        const zone = this.modale.classList.contains('ouverte') ? this.modale : this.zoneActions;
        const b = zone.querySelector('.btn.principal:not([disabled])');
        if (b) { e.preventDefault(); b.click(); }
      }
      if (['1', '2', '3', 'a', 'b', 'c'].includes(e.key.toLowerCase()) && this.modale.classList.contains('ouverte')) {
        const i = { 1: 0, 2: 1, 3: 2, a: 0, b: 1, c: 2 }[e.key.toLowerCase()];
        const opt = this.modale.querySelectorAll('.option:not([disabled])')[i];
        if (opt) opt.click();
      }
    });
  }

  /** Mode Pro : 6 fiches de Complices, plus compactes. */
  activerPro() {
    document.body.classList.add('pro');
    this._prec = {};
    this._construireFiches();
  }

  /* ---------------- « C'est ton tour » ---------------- */
  /**
   * Fenêtre éclair au centre de l'écran au début de chaque tour, aux couleurs de l'Éclaireur.
   * Elle se ferme seule (ou d'un clic) et ne bloque jamais la partie.
   * En ligne, NV_monTour(place) dit si ce navigateur joue ce joueur : « C'est ton tour ! » ou « C'est au tour de … ».
   */
  annoncerTour(j) {
    if (window.NV_RATTRAPAGE || (this.plateau && this.plateau.vitesse > 1)) return;
    const e = NV.ECLAIREURS[j.eclaireur];
    const enLigne = typeof window.NV_monTour === 'function';
    const moi = enLigne ? window.NV_monTour(j.id) : true;
    let pop = $('#tour-pop');
    if (!pop) {
      pop = el('div', { id: 'tour-pop', role: 'status', 'aria-live': 'assertive' });
      pop.addEventListener('click', () => this._fermerTour());
      document.body.appendChild(pop);
    }
    clearTimeout(this._minuteurTour);
    pop.style.setProperty('--c', e.couleur);
    const titre = enLigne ? (moi ? 'C’est ton tour !' : `C’est au tour de ${j.nom}`) : 'C’est ton tour !';
    pop.innerHTML = `<div class="tp-boite"><div class="tp-halo"></div><img src="${IMG}eclaireur-${e.id}.jpg" alt=""><div class="tp-texte"><small>${enLigne && !moi ? e.nom : `${j.nom} · ${e.nom}`}</small><b>${titre}</b></div></div>`;
    pop.classList.remove('visible', 'sortie'); void pop.offsetWidth;
    pop.classList.add('visible');
    if (window.NV_AUDIO) NV_AUDIO.effet('tour', { moi });
    this._minuteurTour = setTimeout(() => this._fermerTour(), 1900);
  }
  _fermerTour() {
    const pop = $('#tour-pop');
    if (!pop || !pop.classList.contains('visible')) return;
    pop.classList.add('sortie');
    setTimeout(() => pop.classList.remove('visible', 'sortie'), 350);
  }

  /* ---------------- fiches Complices (panneau gauche) ---------------- */
  _construireFiches() {
    const zone = $('#fiches');
    zone.innerHTML = '';
    for (const id of NV.ORDRE_COMPLICES) {
      const c = NV.COMPLICES[id];
      const f = el('article', { class: `fiche fiche-${id}`, id: `fiche-${id}`, style: `--c:${c.couleur}` }, `
        <div class="fiche-tete">
          <div class="fiche-portrait" style="background-image:url(${IMG}fiche-${id}.jpg)"></div>
          <div><h3>${c.nom}</h3><p>${c.theme}</p></div>
        </div>
        <div class="pistes">
          <div class="piste bleue" aria-label="bonnes pratiques"></div>
          <div class="piste rouge" aria-label="mauvaises pratiques"></div>
        </div>
        <div class="statut"></div>`);
      zone.appendChild(f);
    }
  }

  majHUD(jeu) {
    $('#hud-manche').textContent = jeu.manche || '–';
    $('#hud-pioche').textContent = jeu.piocheFin.length;
    $('#hud-niveau').textContent = `${NV.NIVEAUX[jeu.niveau]} · ${jeu.seuilBleu}🔵 / ${jeu.seuilRouge}🔴`;
    const j = jeu.joueurActif;
    const zj = $('#hud-joueur');
    if (j) {
      const e = NV.ECLAIREURS[j.eclaireur];
      zj.innerHTML = `<img src="${IMG}eclaireur-${e.id}.jpg" alt=""><span>${j.nom}</span>`;
      zj.style.setProperty('--c', e.couleur);
      if (this._dernierJoueur !== j) { zj.style.animation = 'none'; void zj.offsetWidth; zj.style.animation = ''; this._dernierJoueur = j; }
    }
    // ordre des joueurs
    $('#hud-ordre').innerHTML = jeu.ordre.map((p) => {
      const e = NV.ECLAIREURS[p.eclaireur];
      const cartes = jeu.avance ? `${p.objet ? ' — objet : ' + p.objet.titre : ''}${p.pouvoir ? ' — pouvoir : ' + p.pouvoir.carte.titre : ''}` : '';
      return `<span class="mini ${p === j ? 'actif' : ''}" style="--c:${e.couleur}" title="${p.nom}${p.notification ? ' — notification sans fin' : ''}${p.piegeClics ? ' — piège à clics' : ''}${cartes}"><img src="${IMG}eclaireur-${e.id}.jpg" alt="${p.nom}">${p.notification ? '<i>🔔</i>' : ''}${p.piegeClics ? '<i>🪤</i>' : ''}${jeu.avance && (p.objet || p.pouvoir) ? `<i class="cartes">${p.objet ? '🧰' : ''}${p.pouvoir ? '⚡' : ''}</i>` : ''}</span>`;
    }).join('');
    this.majMain(jeu);
    this.majEffets(jeu);

    this._prec = this._prec || {};
    for (const id of NV.ORDRE_COMPLICES) {
      const st = jeu.complices[id];
      const f = $(`#fiche-${id}`);
      const prec = this._prec[id] || { bleus: 0, rouges: 0, statut: 'actif' };
      f.dataset.statut = st.statut;
      // les pastilles nouvellement remplies « tombent » dans leur emplacement
      const piste = (n, avant, seuil, cls) => Array.from({ length: seuil }, (_, i) =>
        `<span class="pastille ${cls} ${i < n ? 'pleine' : ''} ${i < n && i >= avant ? 'nouvelle' : ''}"></span>`).join('');
      $('.piste.bleue', f).innerHTML = piste(st.bleus, prec.bleus, jeu.seuilBleu, 'b');
      $('.piste.rouge', f).innerHTML = piste(st.rouges, prec.rouges, jeu.seuilRouge, 'r');
      let effet = null;
      if (st.bleus > prec.bleus) effet = 'gain-bleu';
      else if (st.rouges > prec.rouges) effet = 'gain-rouge';
      else if (st.bleus < prec.bleus || st.rouges < prec.rouges) effet = 'retrait';
      if (st.statut !== prec.statut) effet = st.statut === 'sauve' ? 'devient-sauve' : 'devient-perdu';
      if (effet) { f.classList.remove('gain-bleu', 'gain-rouge', 'retrait', 'devient-sauve', 'devient-perdu'); void f.offsetWidth; f.classList.add(effet); }
      this._prec[id] = { bleus: st.bleus, rouges: st.rouges, statut: st.statut };
      $('.statut', f).textContent = st.statut === 'sauve' ? `Sauvé·e : ${NV.COMPLICES[id].sauveNom}` : st.statut === 'perdu' ? 'Perdu' : '';
      $('.fiche-portrait', f).style.backgroundImage = `url(${IMG}${st.statut === 'sauve' ? 'sauve' : 'fiche'}-${id}.jpg)`;
    }
  }

  log(html) {
    const li = el('li', {}, html);
    this.journal.appendChild(li);
    this.journal.parentElement.scrollTop = this.journal.parentElement.scrollHeight;
  }

  /* ---------------- cinématiques (bandes noires + légende) ---------------- */
  cinemaDebut(titre, texte, couleur = '#38e1ff') {
    const c = $('#cinema');
    $('h2', c).textContent = titre;
    $('p', c).textContent = texte || '';
    c.style.setProperty('--c', couleur);
    document.body.classList.add('cinema');
  }
  cinemaFin() { document.body.classList.remove('cinema'); }
  /** Change la légende pendant une cinématique (petit fondu). */
  cinemaMaj(titre, texte, couleur) {
    const c = $('#cinema'), l = $('.legende', c);
    l.classList.remove('change'); void l.offsetWidth; l.classList.add('change');
    $('h2', c).textContent = titre;
    $('p', c).textContent = texte || '';
    if (couleur) c.style.setProperty('--c', couleur);
  }

  /* ---------------- barre d'action (bas de l'écran) ---------------- */
  action(texte, boutons) {
    return new Promise((resolve) => {
      const z = this.zoneActions;
      z.innerHTML = '';
      z.appendChild(el('p', { class: 'consigne' }, texte));
      const rangee = el('div', { class: 'boutons' });
      for (const b of boutons) {
        const btn = el('button', {
          class: `btn ${b.principal ? 'principal' : ''}`,
          style: b.couleur ? `--c:${b.couleur}` : false,
          onclick: () => { z.querySelectorAll('button').forEach((x) => (x.disabled = true)); resolve(b.valeur); },
        }, b.label);
        this._lierDestination(btn, b.dest);
        rangee.appendChild(btn);
      }
      z.appendChild(rangee);
      z.classList.remove('flash'); void z.offsetWidth; z.classList.add('flash');
      const p = z.querySelector('.principal') || z.querySelector('button');
      if (p) p.focus({ preventScroll: true });
    }).then((v) => { this.zoneActions.innerHTML = '<p class="consigne attente">…</p>'; return v; });
  }

  /* ---------------- fenêtres modales ---------------- */
  ouvrir(contenu, classe = '') {
    this.modale.innerHTML = '';
    const boite = el('div', { class: `boite ${classe}` });
    boite.appendChild(contenu);
    this.modale.appendChild(boite);
    this.modale.classList.add('ouverte');
    return boite;
  }
  fermer() {
    this.modale.classList.remove('ouverte', 'choix-case'); this.modale.innerHTML = '';
    if (this.plateau && this.plateau.surlignerDestination) this.plateau.surlignerDestination(null);
  }

  /* ---------------- boutons ↔ cases en évidence sur le plateau ---------------- */
  /** Survoler (ou sélectionner au clavier) un bouton met sa ou ses cases en avant sur le plateau. */
  _lierDestination(btn, dest) {
    if (dest === undefined || dest === null) return;
    btn.dataset.dest = [].concat(dest).join(' ');
    const on = () => this.plateau && this.plateau.surlignerDestination(dest);
    const off = () => this.plateau && this.plateau.surlignerDestination(null);
    btn.addEventListener('mouseenter', on); btn.addEventListener('focus', on);
    btn.addEventListener('mouseleave', off); btn.addEventListener('blur', off);
  }
  _boutonsDestination(k) {
    return Array.from(document.querySelectorAll('#actions button[data-dest], #modale button[data-dest]'))
      .filter((b) => b.dataset.dest.split(' ').includes(String(k)));
  }
  /** Survol d'une case en 3D : le bouton correspondant s'allume. */
  marquerDestination(k) {
    document.querySelectorAll('button.survol-dest').forEach((b) => b.classList.remove('survol-dest'));
    if (k !== null && k !== undefined) this._boutonsDestination(k).forEach((b) => b.classList.add('survol-dest'));
  }
  /** Clic sur une case en 3D = clic sur son bouton (même chemin qu'un vrai clic, donc aussi en ligne). */
  cliquerDestination(k, idx) {
    const b = this._boutonsDestination(k).find((x) => !x.disabled);
    if (!b) return false;
    this.caseCliquee = idx;   // permet d'enchaîner « quartier » puis « case » en un seul clic sur le plateau
    b.click();
    return true;
  }

  /** @param {{caseAvance:'objet'|'pouvoir'}} [info] case à expliquer (bouton « En savoir plus ») */
  choisir(titre, texte, options, info) {
    return new Promise((resolve) => {
      const c = el('div', {}, `<h2>${titre}</h2><p>${texte}</p>`);
      if (info && info.caseAvance) c.appendChild(this._boutonSavoirPlus(() => this.montrerCaseInfo(info.caseAvance)));
      const liste = el('div', { class: 'choix' });
      options.forEach((o, i) => {
        const b = el('button', {
          class: `btn option ${i === 0 ? 'principal' : ''}`, disabled: !!o.desactive,
          onclick: () => { this.fermer(); resolve(o.valeur); },
        }, o.label);
        this._lierDestination(b, o.dest);
        liste.appendChild(b);
      });
      c.appendChild(liste);
      this.ouvrir(c, 'petite');
      // choix d'une case : fenêtre plus discrète pour voir les cases en évidence sur le plateau
      this.modale.classList.toggle('choix-case', options.some((o) => o.dest !== undefined));
    });
  }

  _boutonSavoirPlus(action) {
    return el('button', { class: 'savoir-plus', type: 'button', onclick: (e) => { e.stopPropagation(); action(); } },
      'En savoir plus <span aria-hidden="true">›</span>');
  }

  /** Utilisation d'une carte, en clair. */
  static usageCarte(type, carte) {
    if (type === 'objet') return 'Usage unique : la carte est défaussée après avoir été jouée.';
    if (carte.utilisations === Infinity) return 'Permanent : l’effet dure tant que tu gardes la carte.';
    if (carte.utilisations === 'manche') return 'Une fois par manche, tant que tu gardes la carte.';
    return `${carte.utilisations} fois dans la partie, puis la carte est défaussée.`;
  }

  /**
   * Quand une carte est piochée alors qu'on en a déjà une du même type :
   * les deux cartes côte à côte, chacune avec « Garder celle-ci ».
   */
  choisirCarteAGarder(type, nouvelle, ancienne, joueur, resteAncienne) {
    return new Promise((resolve) => {
      const c = el('div', {}, `<h2>${type === 'objet' ? '🧰 Un seul Objet en main' : '⚡ Un seul Pouvoir en main'}</h2>
        <p>${joueur.nom}, tu ne peux garder qu’une carte ${type === 'objet' ? 'Objet' : 'Pouvoir'}. L’autre est défaussée sans appliquer son effet.</p>`);
      const grille = el('div', { class: 'choix-cartes' });
      for (const [carte, cle, etiquette, reste] of [[nouvelle, 'nouvelle', 'Nouvelle carte', null], [ancienne, 'ancienne', 'Carte actuelle', resteAncienne]]) {
        const bloc = el('div', { class: `mini-carte ${type}` }, `<span class="etiquette">${etiquette}</span><h3>${carte.titre}</h3><p>${carte.texte}</p>${reste ? `<p class="usage">${reste}</p>` : ''}`);
        bloc.appendChild(el('button', { class: `btn ${cle === 'nouvelle' ? 'principal' : ''}`, onclick: () => { this.fermer(); resolve(cle); } }, 'Garder celle-ci'));
        grille.appendChild(bloc);
      }
      c.appendChild(grille);
      this.ouvrir(c, 'large');
    });
  }

  choisirComplice(titre, texte, ids, jeu) {
    return new Promise((resolve) => {
      const c = el('div', {}, `<h2>${titre}</h2><p>${texte}</p>`);
      const grille = el('div', { class: 'choix-complices' });
      for (const id of ids) {
        const cp = NV.COMPLICES[id], st = jeu.complices[id];
        grille.appendChild(el('button', {
          class: 'carte-complice option', style: `--c:${cp.couleur}`,
          onclick: () => { this.fermer(); resolve(id); },
        }, `<img src="${IMG}dos-${id}-facile.jpg" alt=""><b>${cp.nom}</b><small>${st.bleus} 🔵 · ${st.rouges} 🔴</small>`));
      }
      c.appendChild(grille);
      this.ouvrir(c);
    });
  }

  /** Affiche une carte Question ; renvoie true si la réponse est juste. */
  question(q, ctx) {
    return new Promise((resolve) => {
      const cp = NV.COMPLICES[q.c];
      const j = ctx.joueur;
      const e = NV.ECLAIREURS[j.eclaireur];
      const badges = [
        `<span class="badge">${q.lvl === 'facile' ? 'Question facile' : 'Question difficile'}</span>`,
        ctx.face ? '<span class="badge fort">Face-à-face ×2</span>' : '',
        ctx.place ? '<span class="badge">La Place</span>' : '',
        ctx.stress ? '<span class="badge fort">Coup de stress</span>' : '',
        ctx.de ? `<span class="badge">Dé noir : ${ctx.de}</span>` : '',
      ].join('');
      const carte = el('div', { class: 'carte-question', style: `--c:${cp.couleur};--cl:${cp.couleurClaire}` }, `
        <header>
          <div class="cq-nom">${cp.nom}</div>
          <div class="cq-joueur" style="--j:${e.couleur}"><img src="${IMG}eclaireur-${e.id}.jpg" alt="">${j.nom} répond</div>
        </header>
        <div class="cq-corps">
          <div class="cq-num">${q.id}</div>
          <div class="cq-badges">${badges}</div>
          <h2 class="cq-q">${q.q}</h2>
          <div class="cq-options"></div>
          <div class="cq-retour"></div>
        </div>`);
      const opts = $('.cq-options', carte);
      q.o.forEach((txt, i) => {
        opts.appendChild(el('button', {
          class: 'option', 'data-i': i,
          onclick: () => repondre(i),
        }, `<span class="lettre">${LETTRES[i]}</span><span>${txt}</span>`));
      });
      const repondre = (i) => {
        const bon = i === q.a;
        opts.querySelectorAll('button').forEach((b, k) => {
          b.disabled = true;
          if (k === q.a) b.classList.add('juste');
          else if (k === i) b.classList.add('faux');
        });
        const sources = (q.s || []).filter(Boolean).map((s) => `<li>${s}</li>`).join('');
        const gain = ctx.face ? 2 : 1;
        const retour = $('.cq-retour', carte);
        retour.innerHTML = `
          <div class="verdict ${bon ? 'ok' : 'ko'}">
            ${bon ? 'Bonne réponse ! 🔵' : 'Mauvaise réponse… 🔴'}
            <small>La bonne réponse était ${LETTRES[q.a]}.${gain > 1 ? ' Face-à-face : le résultat compte double.' : ''}</small>
          </div>
          <details class="explication" open>
            <summary>${q.pro ? 'Pour en savoir plus' : 'Le mot du livret maître du jeu'}</summary>
            <p>${q.e}</p>
            ${sources ? `<ul class="sources">${sources}</ul>` : ''}
          </details>`;
        const suite = el('button', { class: 'btn principal', onclick: () => { this.fermer(); resolve(bon); } }, 'Continuer');
        retour.appendChild(suite);
        carte.classList.add(bon ? 'reussie' : 'ratee');
        suite.focus({ preventScroll: true });
        retour.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      };
      // Carnet d'indices : 1 minute de concertation affichée sur la carte
      if (ctx.concertation) {
        const bandeau = el('div', { class: 'concertation', role: 'timer' }, '<span>🗣️ Concertation du groupe : <b>60</b> s</span><i></i>');
        $('.cq-corps', carte).insertBefore(bandeau, opts);
        const fin = Date.now() + 60000;
        const minuteur = setInterval(() => {
          const r = Math.max(0, Math.ceil((fin - Date.now()) / 1000));
          $('b', bandeau).textContent = r;
          $('i', bandeau).style.width = (r / 60 * 100) + '%';
          if (r === 0 || !document.body.contains(bandeau)) { clearInterval(minuteur); bandeau.classList.add('fini'); }
        }, 250);
      }
      this.ouvrir(carte, 'large');
      if (window.NV_AUDIO) NV_AUDIO.attenuer(true);
    }).then((bon) => { if (window.NV_AUDIO) NV_AUDIO.attenuer(false); return bon; });
  }

  /** Carte Objet ou Pouvoir piochée (même retournement que les cartes Dark Master). */
  carteAvance(type, carte, note) {
    return new Promise((resolve) => {
      const reste = type === 'pouvoir' ? (carte.utilisations === Infinity ? 'Permanent' : carte.utilisations === 'manche' ? '1 fois par manche' : `${carte.utilisations} utilisation${carte.utilisations > 1 ? 's' : ''}`) : 'Usage unique';
      const c = el('div', { class: `carte-dm ${type}` }, `
        <div class="dm-dos"><img src="${IMG}dos-${type}.jpg" alt=""></div>
        <div class="dm-face">
          <header>${type}</header>
          <h2>${carte.titre}</h2>
          <p>${carte.texte}</p>
          <p class="usage">${reste}</p>
          ${note ? `<p class="note">${note}</p>` : ''}
          <div class="dm-illu" style="background-image:url(${IMG}dos-${type}.jpg)"></div>
        </div>`);
      const b = el('button', { class: 'btn principal', onclick: () => { this.fermer(); resolve(); } }, note ? 'Reprendre une carte' : 'Prendre la carte');
      $('.dm-face', c).appendChild(b);
      this.ouvrir(c, 'dm');
      setTimeout(() => { c.classList.add('retournee'); if (window.NV_AUDIO) NV_AUDIO.effet('retourne'); }, 60);
      setTimeout(() => b.focus({ preventScroll: true }), 400);
    });
  }

  /**
   * Effets en cours dans la barre du haut (Nuit blanche, Brouillard, Filtre anti-pub) :
   * chaque étiquette est un bouton qui ouvre une bulle d'explication juste en dessous.
   */
  majEffets(jeu) {
    const nomC = (id) => NV.COMPLICES[id].nom;
    const effets = [];
    const nb = (e) => e.nuitBlanche;
    if (nb(jeu.effets) || nb(jeu.effetsProchains || {})) {
      const actif = nb(jeu.effets);
      effets.push({ cle: 'nuit', label: actif ? '🌙 Nuit blanche' : '🌙 Nuit blanche (prochaine manche)',
        titre: '🌙 Nuit blanche sur les écrans',
        texte: `Le Dark Master a joué cette carte « Fin de manche ». ${actif ? 'Pendant <b>cette manche</b>' : 'Pendant la <b>prochaine manche</b>'}, le <b>premier dé noir qui donne 1, 2 ou 3</b> transforme la question en <b>question difficile</b>. Ensuite l’effet disparaît et les autres lancers se jouent normalement.`,
        etat: actif ? 'Actif : en attente du premier 1, 2 ou 3 au dé noir.' : 'Programmé : commence à la prochaine manche.' });
    }
    const br = jeu.effets.brouillard || (jeu.effetsProchains && jeu.effetsProchains.brouillard);
    if (br) {
      const actif = !!jeu.effets.brouillard;
      const restants = NV.ORDRE_COMPLICES.filter((id) => jeu.complices[id].statut === 'actif' && !(actif && br.has(id)));
      effets.push({ cle: 'brouillard', label: actif ? '🌫️ Brouillard' : '🌫️ Brouillard (prochaine manche)',
        titre: '🌫️ Brouillard sur Numéville',
        texte: `${actif ? 'Pendant <b>cette manche</b>' : 'Pendant la <b>prochaine manche</b>'}, la <b>première mauvaise réponse</b> de chaque Complice ajoute <b>2 jetons</b> mauvaise pratique au lieu d’1. Les mauvaises réponses suivantes n’en ajoutent qu’1.`,
        etat: restants.length ? `Encore exposés : ${restants.map(nomC).join(', ')}.` : 'Tous les Complices ont déjà subi le brouillard.' });
    }
    if (jeu.effets.filtreHyperco) {
      effets.push({ cle: 'filtre', label: '🛡️ Filtre anti-pub', titre: '🛡️ Filtre anti-pub (objet)',
        texte: 'Un Éclaireur a activé le Filtre anti-pub dans le quartier d’Hyperco : jusqu’à la fin de la manche, Hyperco reçoit <b>au plus 1 jeton</b> mauvaise pratique à chaque mauvaise réponse.',
        etat: 'Actif jusqu’à la fin de la manche.' });
    }
    this._effets = effets;
    const zone = $('#hud-effets');
    zone.innerHTML = '';
    for (const e of effets) {
      zone.appendChild(el('button', { type: 'button', class: 'effet', 'data-cle': e.cle, 'aria-expanded': String(this._bulle === e.cle),
        'aria-controls': 'hud-bulle', title: 'Qu’est-ce que c’est ?', onclick: (ev) => { ev.stopPropagation(); this.basculerBulle(e.cle); } }, e.label));
    }
    // hauteur réelle du HUD (sur mobile, la ligne d'effets le rallonge) : les fiches se placent dessous
    this._hauteurHUD();
    if (!this._resizeHUD) { this._resizeHUD = true; window.addEventListener('resize', () => this._hauteurHUD()); }
    // la bulle ouverte suit l'état du jeu (ou se ferme si l'effet a disparu)
    if (this._bulle) { if (effets.some((e) => e.cle === this._bulle)) this.ouvrirBulle(this._bulle); else this.fermerBulle(); }
  }

  _hauteurHUD() {
    const h = $('#hud');
    if (h) document.documentElement.style.setProperty('--hud-h', h.offsetHeight + 'px');
  }

  basculerBulle(cle) { if (this._bulle === cle) this.fermerBulle(); else this.ouvrirBulle(cle); }

  ouvrirBulle(cle) {
    const e = (this._effets || []).find((x) => x.cle === cle);
    const bouton = $(`#hud-effets [data-cle="${cle}"]`);
    if (!e || !bouton) return;
    let bulle = $('#hud-bulle');
    if (!bulle) {
      bulle = el('div', { id: 'hud-bulle', role: 'dialog', 'aria-live': 'polite' });
      $('#hud').appendChild(bulle);
      document.addEventListener('click', (ev) => { if (this._bulle && !bulle.contains(ev.target)) this.fermerBulle(); });
      document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && this._bulle) this.fermerBulle(); });
    }
    bulle.innerHTML = `<h3>${e.titre}</h3><p>${e.texte}</p><p class="etat">${e.etat}</p>`;
    const fermer = el('button', { type: 'button', class: 'icone', 'aria-label': 'Fermer', onclick: (ev) => { ev.stopPropagation(); this.fermerBulle(); } }, '✕');
    bulle.prepend(fermer);
    bulle.hidden = false;
    this._bulle = cle;
    for (const b of document.querySelectorAll('#hud-effets .effet')) b.setAttribute('aria-expanded', String(b.dataset.cle === cle));
    // placée sous l'étiquette, sans sortir de l'écran
    const hud = $('#hud').getBoundingClientRect(), r = bouton.getBoundingClientRect();
    const larg = Math.min(340, window.innerWidth - 16);
    const gauche = Math.max(8, Math.min(r.left, window.innerWidth - larg - 8));
    bulle.style.width = larg + 'px';
    bulle.style.left = (gauche - hud.left) + 'px';
    bulle.style.setProperty('--fleche', Math.max(14, Math.min(larg - 20, r.left + r.width / 2 - gauche)) + 'px');
  }

  fermerBulle() {
    const bulle = $('#hud-bulle');
    if (bulle) bulle.hidden = true;
    this._bulle = null;
    for (const b of document.querySelectorAll('#hud-effets .effet')) b.setAttribute('aria-expanded', 'false');
  }

  /** Main du joueur actif (mode avancé) : ses cartes Objet et Pouvoir, cliquables pour relire leur texte. */
  majMain(jeu) {
    const zone = $('#main-joueur');
    const j = jeu.joueurActif;
    if (!jeu.avance || !j || (!j.objet && !j.pouvoir)) { zone.hidden = true; return; }
    zone.hidden = false;
    zone.innerHTML = '';
    zone.appendChild(el('span', { class: 'main-titre' }, `Cartes de ${j.nom}`));
    if (j.objet) {
      const o = j.objet;
      zone.appendChild(el('button', { class: 'puce-carte objet', title: o.texte, onclick: () => this.montrerCarteInfo('objet', o) }, `🧰 ${o.titre}`));
    }
    if (j.pouvoir) {
      const p = j.pouvoir;
      const reste = jeu.libelleReste(p) + (p.reste === 'manche' && j.maitreUtilise ? ' (déjà utilisé cette manche)' : '');
      zone.appendChild(el('button', { class: 'puce-carte pouvoir', title: p.carte.texte, onclick: () => this.montrerCarteInfo('pouvoir', p.carte, reste) }, `⚡ ${p.carte.titre} <small>${reste}</small>`));
    }
  }

  /** Fiche « En savoir plus » des écrans de placement : à quoi servent la case Objet et la case Pouvoir. */
  montrerCaseInfo(type) {
    const objet = type === 'objet';
    const cartes = objet ? NV.OBJETS : NV.POUVOIRS;
    const liste = cartes.map((c) => `<li><b>${c.titre}</b> — ${c.texte}</li>`).join('');
    const sections = objet ? [
      ['📍 C’est quoi ?', 'Une case du plateau que vous choisissez ensemble. Un marqueur <b>Objet</b> y reste posé toute la partie.'],
      ['🎴 Quand on s’y arrête', 'L’Éclaireur qui <b>termine son déplacement</b> sur cette case pioche une <b>carte Objet</b> (passer dessus sans s’arrêter ne compte pas).'],
      ['✋ Combien de cartes', 'Chaque Éclaireur garde <b>1 Objet au maximum</b>. S’il en a déjà un, il choisit lequel garder ; l’autre est défaussé.'],
      ['🔁 Utilisation', '<b>Usage unique</b> : on joue l’Objet au bon moment (le jeu te le propose), puis il est défaussé.'],
      ['💡 Bien la placer', 'Choisissez une case souvent atteinte, par exemple près de La Place ou dans le quartier d’un Complice en difficulté.'],
    ] : [
      ['📍 C’est quoi ?', 'Une autre case du plateau, choisie ensemble. Un marqueur <b>Pouvoir</b> y reste posé toute la partie.'],
      ['🎴 Quand on s’y arrête', 'L’Éclaireur qui <b>termine son déplacement</b> sur cette case pioche une <b>carte Pouvoir</b> (passer dessus sans s’arrêter ne compte pas).'],
      ['✋ Combien de cartes', 'Chaque Éclaireur garde <b>1 Pouvoir au maximum</b>, en plus de son éventuel Objet. S’il en a déjà un, il choisit lequel garder.'],
      ['🔁 Utilisation', 'Un Pouvoir dure plus longtemps qu’un Objet : <b>plusieurs utilisations</b>, <b>une fois par manche</b> ou <b>permanent</b> selon la carte.'],
      ['💡 Bien la placer', 'Éloignez-la de la case Objet pour que les deux soient atteintes par des joueurs différents.'],
    ];
    const couche = $('#aide');
    couche.innerHTML = '';
    const boite = el('div', { class: `boite petite fiche-carte ${type}` }, `
      <p class="fc-type">${objet ? '🧰 Mode avancé' : '⚡ Mode avancé'}</p>
      <h2>La case ${objet ? 'Objet' : 'Pouvoir'}</h2>
      <dl>${sections.map(([t, d]) => `<div><dt>${t}</dt><dd>${d}</dd></div>`).join('')}</dl>
      <details class="fc-liste"><summary>Voir les ${cartes.length} cartes ${objet ? 'Objet' : 'Pouvoir'}</summary><ul>${liste}</ul></details>`);
    const fermer = el('button', { class: 'btn principal', onclick: () => this.fermerAide() }, 'Fermer');
    boite.appendChild(fermer);
    couche.appendChild(boite);
    couche.classList.add('ouverte');
    fermer.focus({ preventScroll: true });
  }

  /** Relire une carte de sa main (couche d'aide : n'interrompt pas l'action en cours). */
  /** Fiche « En savoir plus » : quand jouer la carte, effet, utilisation, conseil (couche d'aide, n'interrompt rien). */
  montrerCarteInfo(type, carte, reste) {
    const couche = $('#aide');
    couche.innerHTML = '';
    const d = carte.details || {};
    // nombre d'utilisations restantes affiché seulement pour un pouvoir déjà en main et limité (ex. « 1 utilisation »)
    const usage = reste && /\d/.test(reste) && !/fois par manche/.test(reste) ? `${Interface.usageCarte(type, carte)} <b>Il te reste : ${reste}.</b>` : Interface.usageCarte(type, carte);
    const boite = el('div', { class: `boite petite fiche-carte ${type}` }, `
      <p class="fc-type">${type === 'objet' ? '🧰 Carte Objet' : '⚡ Carte Pouvoir'}</p>
      <h2>${carte.titre}</h2>
      <blockquote>${carte.texte}</blockquote>
      <dl>
        <div><dt>🕑 Quand la jouer</dt><dd>${d.quand || '—'}</dd></div>
        <div><dt>✨ Ce qu’elle fait</dt><dd>${d.effet || carte.texte}</dd></div>
        <div><dt>🔁 Utilisation</dt><dd>${usage}</dd></div>
        ${d.conseil ? `<div><dt>💡 Conseil</dt><dd>${d.conseil}</dd></div>` : ''}
      </dl>`);
    const fermer = el('button', { class: 'btn principal', onclick: () => this.fermerAide() }, 'Fermer');
    boite.appendChild(fermer);
    couche.appendChild(boite);
    couche.classList.add('ouverte');
    fermer.focus({ preventScroll: true });
  }

  carteDM(type, carte, note) {
    return new Promise((resolve) => {
      const c = el('div', { class: `carte-dm ${type}` }, `
        <div class="dm-dos"><img src="${IMG}dos-dm-${type === 'fin' ? 'fin' : 'attaque'}.jpg" alt=""></div>
        <div class="dm-face">
          <header>${type === 'fin' ? 'fin de manche' : 'attaque'}</header>
          <h2>${carte.titre}</h2>
          <p>${carte.texte}</p>
          ${note ? `<p class="note">${note}</p>` : ''}
          <div class="dm-illu" style="background-image:url(${IMG}dos-dm-${type === 'fin' ? 'fin' : 'attaque'}.jpg)"></div>
        </div>`);
      const b = el('button', { class: 'btn principal', onclick: () => { this.fermer(); resolve(); } }, note ? 'Reprendre une carte' : 'Appliquer l’effet');
      $('.dm-face', c).appendChild(b);
      this.ouvrir(c, 'dm');
      setTimeout(() => { c.classList.add('retournee'); if (window.NV_AUDIO) NV_AUDIO.effet('retourne'); }, 60);
      setTimeout(() => b.focus({ preventScroll: true }), 400);
    });
  }

  revelerComplice(id, statut) {
    return new Promise((resolve) => {
      const cp = NV.COMPLICES[id];
      const sauve = statut === 'sauve';
      const c = el('div', { class: `revelation ${statut}`, style: `--c:${cp.couleur}` }, `
        <img src="${IMG}${sauve ? 'sauve' : 'fiche'}-${id}.jpg" alt="">
        <h2>${sauve ? `${cp.nom} est sauvé·e !` : `${cp.nom} est perdu…`}</h2>
        <p>${sauve ? `Grâce à vos bonnes pratiques, ${cp.nom} redevient <b>${cp.sauveNom}</b> et échappe à l’emprise du Dark Master.` : `${cp.nom} bascule définitivement du côté obscur. Ses mauvaises pratiques renforcent le Dark Master.`}</p>`);
      c.appendChild(el('button', { class: 'btn principal', onclick: () => { this.fermer(); resolve(); } }, 'Continuer'));
      this.ouvrir(c, 'large');
    });
  }

  finPartie(jeu) {
    return new Promise(() => {
      const f = jeu.fin || { type: 'defaite' };
      const s = jeu.compte('sauve'), p = jeu.compte('perdu');
      const titres = { totale: 'Victoire totale !', victoire: 'Victoire !', defaite: 'Défaite…' };
      const textes = {
        totale: `Les ${NV.FIN.totale} Complices sont sauvés : Numéville est libérée de l’emprise du Dark Master !`,
        victoire: `Vous avez sauvé au moins ${NV.FIN.victoire} Complices : Numéville résiste au Dark Master.`,
        defaite: 'Le Dark Master garde le contrôle de Numéville. Retentez votre chance, éclaireurs !',
      };
      const stats = jeu.joueurs.map((j) => {
        const e = NV.ECLAIREURS[j.eclaireur];
        const total = j.bonnes + j.mauvaises;
        return `<li style="--c:${e.couleur}"><img src="${IMG}eclaireur-${e.id}.jpg" alt=""><b>${j.nom}</b><span>${j.bonnes} / ${total} bonnes réponses</span></li>`;
      }).join('');
      const fiches = NV.ORDRE_COMPLICES.map((id) => `<figure class="${jeu.complices[id].statut}"><img src="${IMG}${jeu.complices[id].statut === 'sauve' ? 'sauve' : 'fiche'}-${id}.jpg" alt=""><figcaption>${NV.COMPLICES[id].nom} : ${({ sauve: 'sauvé', perdu: 'perdu', actif: 'non résolu' })[jeu.complices[id].statut]}</figcaption></figure>`).join('');
      const c = el('div', { class: `fin-partie ${f.type}` }, `
        <h1>${titres[f.type]}</h1>
        <p>${textes[f.type]}${f.raison ? `<br><small>${f.raison}</small>` : ''}</p>
        <p class="bilan">${s} sauvé${s > 1 ? 's' : ''} · ${p} perdu${p > 1 ? 's' : ''} · ${jeu.manche} manche${jeu.manche > 1 ? 's' : ''}</p>
        <div class="fiches-fin">${fiches}</div>
        <ul class="stats">${stats}</ul>`);
      // boutons de fin : « Rejouer avec le même groupe » (ajouté par main.js ou en-ligne.js), puis « Nouvelle partie »
      const actions = el('div', { class: 'fin-actions' });
      for (const b of this.boutonsFin || []) {
        const btn = el('button', { class: `btn ${b.principal ? 'principal' : ''}`, onclick: () => b.action(btn) }, b.label);
        if (b.id) btn.id = b.id;
        actions.appendChild(btn);
      }
      actions.appendChild(el('button', { class: `btn ${(this.boutonsFin || []).length ? '' : 'principal'}`, onclick: () => location.reload() }, 'Nouvelle partie'));
      c.appendChild(actions);
      if ((this.boutonsFin || []).length) c.appendChild(el('p', { class: 'fin-note', id: 'fin-note', role: 'status' }, this.noteFin || ''));
      this.ouvrir(c, 'large');
      this.zoneActions.innerHTML = '<p class="consigne">Partie terminée.</p>';
    });
  }

  regles() {
    const c = el('div', { class: 'regles' }, `
      <h2>Aide de jeu Numéville</h2>
      <p><b>Numéville</b> est un jeu coopératif : 2 à 4 Éclaireurs du Numérique répondent à des questions pour ramener à la raison les 4 Complices du Dark Master.</p>
      <div class="cols">
        <section><h3>Tour de jeu</h3><ol>
          <li><b>Dé blanc</b> : avance du nombre exact de cases, dans le sens de ton choix. Les deux cases possibles s’allument sur le plateau, avec leur chemin : clique le bouton ou directement la case. Si la case d’arrivée est occupée, va à la prochaine case libre. La case indique le quartier (donc le Complice).</li>
          <li><b>Dé noir</b> : 1-2-3 = question facile · 4-5 = question difficile · 6 = question difficile puis carte « Dark Master – Attaque ».</li>
          <li><b>Bonne réponse</b> = 1 jeton bleu (bonne pratique) · <b>mauvaise réponse</b> = 1 jeton rouge (mauvaise pratique) sur la fiche du Complice.</li>
        </ol></section>
        <section><h3>Cases spéciales</h3><ul>
          <li><b>Portrait d’un Complice</b> : face-à-face, le résultat compte double (2 jetons).</li>
          <li><b>La Place</b> : choisis le Complice et réponds à une question difficile, sans lancer le dé noir.</li>
          <li><b>Fin de manche</b> : quand tout le monde a joué, on révèle une carte « Dark Master – Fin de manche ».</li>
        </ul></section>
        <section><h3>Mode avancé</h3><ul>
          <li>Une <b>case Objet</b> 🧰 et une <b>case Pouvoir</b> ⚡ sont choisies en début de partie.</li>
          <li>Finir son déplacement dessus fait piocher une carte, puis on joue son tour normalement.</li>
          <li><b>Objet</b> : effet ponctuel, usage unique. <b>Pouvoir</b> : permanent ou à quelques utilisations.</li>
          <li>Maximum 1 Objet et 1 Pouvoir en main : si on en pioche un autre, on choisit lequel garder.</li>
          <li>Le jeu propose chaque carte au bon moment ; clique sur une carte en bas de l’écran pour relire son texte.</li>
        </ul></section>
        <section><h3>Mode Pro</h3><ul>
          <li>Grand plateau en 3D : 25 cases sur trois niveaux reliés par des escaliers, <b>6 Complices</b> (avec Scrollo et Fracturo).</li>
          <li>Comprend le mode avancé, plus l’objet <b>Jetpack</b> 🚀 : après le dé blanc, avance de 3 cases de plus en survolant le plateau.</li>
          <li><b>Toboggan à pop-ups</b> 📉 : finir dessus fait redescendre de 3 cases (sans piocher de carte sur la case d’arrivée).</li>
          <li><b>Batterie à plat</b> 🪫 : on perd son Objet ; sans Objet, le Complice du quartier reçoit 1 jeton mauvaise pratique.</li>
          <li>Fin : 6 sauvés = victoire totale, au moins 4 = victoire, 3 perdus = défaite.</li>
        </ul></section>
        <section><h3>Fin de partie</h3><ul>
          <li>4 Complices sauvés : victoire totale.</li>
          <li>3 Complices sauvés : victoire.</li>
          <li>2 Complices perdus : défaite.</li>
          <li>La partie s’arrête aussi quand la pioche « Fin de manche » est vide.</li>
        </ul></section>
      </div>
      <p class="credits">Jeu original : <b>Numéville</b>, Institut du Numérique Responsable (INR), licence CC BY-NC-ND 4.0. Questions et explications issues du livret maître du jeu.</p>`);
    c.appendChild(el('button', { class: 'btn principal', onclick: () => this.fermerAide() }, 'Fermer'));
    // l'aide s'affiche dans sa propre couche pour ne pas perturber une modale en cours
    const couche = $('#aide');
    couche.innerHTML = '';
    const boite = el('div', { class: 'boite large' });
    boite.appendChild(c);
    couche.appendChild(boite);
    couche.classList.add('ouverte');
  }
  fermerAide() { $('#aide').classList.remove('ouverte'); }
}

window.Interface = Interface;
