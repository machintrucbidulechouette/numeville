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
    $('#cinema').addEventListener('click', () => this.plateau && this.plateau.passerCinematique());
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (document.body.classList.contains('cinema')) {
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); this.plateau && this.plateau.passerCinematique(); }
        return;
      }
      if ($('#aide').classList.contains('ouverte') || $('#accueil:not(.cache)')) return;
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
      return `<span class="mini ${p === j ? 'actif' : ''}" style="--c:${e.couleur}" title="${p.nom}${p.notification ? ' — notification sans fin' : ''}${p.piegeClics ? ' — piège à clics' : ''}"><img src="${IMG}eclaireur-${e.id}.jpg" alt="${p.nom}">${p.notification ? '<i>🔔</i>' : ''}${p.piegeClics ? '<i>🪤</i>' : ''}</span>`;
    }).join('');
    const effets = [];
    if (jeu.effets.nuitBlanche) effets.push('🌙 Nuit blanche');
    if (jeu.effets.brouillard) effets.push('🌫️ Brouillard');
    $('#hud-effets').innerHTML = effets.map((e) => `<span>${e}</span>`).join('');

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
  fermer() { this.modale.classList.remove('ouverte'); this.modale.innerHTML = ''; }

  choisir(titre, texte, options) {
    return new Promise((resolve) => {
      const c = el('div', {}, `<h2>${titre}</h2><p>${texte}</p>`);
      const liste = el('div', { class: 'choix' });
      options.forEach((o, i) => liste.appendChild(el('button', {
        class: `btn option ${i === 0 ? 'principal' : ''}`, disabled: !!o.desactive,
        onclick: () => { this.fermer(); resolve(o.valeur); },
      }, o.label)));
      c.appendChild(liste);
      this.ouvrir(c, 'petite');
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
            ${bon ? `Bonne réponse ! +${gain} jeton${gain > 1 ? 's' : ''} bonne pratique 🔵` : `Mauvaise réponse… +${gain} jeton${gain > 1 ? 's' : ''} mauvaise pratique 🔴`}
            <small>La bonne réponse était ${LETTRES[q.a]}.</small>
          </div>
          <details class="explication" open>
            <summary>Le mot du livret maître du jeu</summary>
            <p>${q.e}</p>
            ${sources ? `<ul class="sources">${sources}</ul>` : ''}
          </details>`;
        const suite = el('button', { class: 'btn principal', onclick: () => { this.fermer(); resolve(bon); } }, 'Continuer');
        retour.appendChild(suite);
        carte.classList.add(bon ? 'reussie' : 'ratee');
        suite.focus({ preventScroll: true });
        retour.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      };
      this.ouvrir(carte, 'large');
      if (window.NV_AUDIO) NV_AUDIO.attenuer(true);
    }).then((bon) => { if (window.NV_AUDIO) NV_AUDIO.attenuer(false); return bon; });
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
        totale: 'Les 4 Complices sont sauvés : Numéville est libérée de l’emprise du Dark Master !',
        victoire: 'Vous avez sauvé au moins 3 Complices : Numéville résiste au Dark Master.',
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
      c.appendChild(el('button', { class: 'btn principal', onclick: () => location.reload() }, 'Nouvelle partie'));
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
          <li><b>Dé blanc</b> : avance du nombre exact de cases, dans le sens de ton choix. Si la case d’arrivée est occupée, va à la prochaine case libre. La case indique le quartier (donc le Complice).</li>
          <li><b>Dé noir</b> : 1-2-3 = question facile · 4-5 = question difficile · 6 = question difficile puis carte « Dark Master – Attaque ».</li>
          <li><b>Bonne réponse</b> = 1 jeton bleu (bonne pratique) · <b>mauvaise réponse</b> = 1 jeton rouge (mauvaise pratique) sur la fiche du Complice.</li>
        </ol></section>
        <section><h3>Cases spéciales</h3><ul>
          <li><b>Portrait d’un Complice</b> : face-à-face, le résultat compte double (2 jetons).</li>
          <li><b>La Place</b> : choisis le Complice et réponds à une question difficile, sans lancer le dé noir.</li>
          <li><b>Fin de manche</b> : quand tout le monde a joué, on révèle une carte « Dark Master – Fin de manche ».</li>
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
