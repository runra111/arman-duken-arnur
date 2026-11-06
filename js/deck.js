/* Slides: navigation (keys, wheel, swipe, dots), the reveal animations, the camera per slide, price count-ups,
   the speech notes and sound toggles. */
(function(){
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const site = $('#site'), slides = $$('.slide'), N = slides.length, dotsEl = $('#dots'), notes = $('#notes');
  let idx = -1, lock = 0, started = false, notesOn = false;

  // split headings into words for the staggered rise (keeps <em> styling)
  $$('[data-split]').forEach(h => {
    let i = 0;
    const walk = node => Array.from(node.childNodes).forEach(n => {
      if(n.nodeType === 3){
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(p => {
          if(!p) return; if(/^\s+$/.test(p)){ frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'wd'; const s = document.createElement('span'); s.textContent = p; s.style.setProperty('--i', i++); w.appendChild(s); frag.appendChild(w);
        });
        node.replaceChild(frag, n);
      } else if(n.nodeType === 1) walk(n);
    });
    walk(h);
  });

  slides.forEach((s, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', (i + 1) + ': ' + s.dataset.title);
    b.addEventListener('click', () => go(i)); dotsEl.appendChild(b);
  });
  $('#tot').textContent = String(N).padStart(2, '0');

  function countUp(el){
    const to = +el.dataset.count, t0 = performance.now() + 450, d = 1400;
    const fmt = v => Math.round(v).toLocaleString('ru-RU').replace(/,/g, ' ');
    (function step(now){ const k = Math.max(0, Math.min(1, (now - t0)/d)), e = 1 - Math.pow(1 - k, 4); el.textContent = fmt(to*e); if(k < 1) requestAnimationFrame(step); })(performance.now());
  }

  function renderNotes(){
    const s = window.SPEECH && SPEECH[idx]; if(!s){ notes.innerHTML = ''; return; }
    const L = 'А-Яа-яӘәҒғҚқҢңӨөҰұҮүҺһІі';
    const hi = s.kk.replace(new RegExp('([' + L + '-]+(?:са|се|сам|сем|саңыз|сеңіз|саң|сең))(?=[^' + L + ']|$)', 'g'), '<mark>$1</mark>');
    notes.innerHTML = '<p>' + hi + '</p><p>' + s.ru + '</p>';
  }

  function go(i, instant){
    i = Math.max(0, Math.min(N - 1, i));
    if(i === idx || (!instant && performance.now() < lock)) return;
    lock = performance.now() + 900;
    const prev = slides[idx];
    if(prev){ prev.classList.remove('is-active'); prev.classList.add('is-leaving'); setTimeout(() => prev.classList.remove('is-leaving'), 650); }
    idx = i; const s = slides[i];
    // a fresh start for the reveals each time a slide comes in
    requestAnimationFrame(() => requestAnimationFrame(() => s.classList.add('is-active')));
    $$('button', dotsEl).forEach((b, k) => b.classList.toggle('on', k === i));
    $('#cur').textContent = String(i + 1).padStart(2, '0');
    if(history.replaceState) history.replaceState(null, '', '#' + (i + 1));
    World.go(i, instant);
    const hasViews = !!s.querySelector('[data-view]');
    if(hasViews) Views.start(); else setTimeout(() => { if(!slides[idx].querySelector('[data-view]')) Views.stop(); }, 700);
    $$('[data-count]', s).forEach(countUp);
    if(!instant && window.Sfx){ Sfx.whoosh(); Sfx.chime(i); }
    renderNotes();
  }

  /* the slides live on a fixed 1920×1080 stage that is scaled as a whole to the window (the 3D world fills the rest) */
  const stage = $('#stage');
  function fit(){
    const s = Math.min(innerWidth/1920, innerHeight/1080);
    stage.style.transform = 'translate(' + (innerWidth - 1920*s)/2 + 'px,' + (innerHeight - 1080*s)/2 + 'px) scale(' + s + ')';
  }
  fit(); addEventListener('resize', fit);

  /* slide 2: "Дүкен қандай?" - a real choice; the island grows or shrinks with it */
  $$('.pick__opt').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    $$('.pick__opt').forEach(o => { const on = o === b; o.classList.toggle('is-on', on); o.setAttribute('aria-checked', on); });
    World.setBig(b.dataset.size === 'big');
    if(window.Sfx) Sfx.sparkle();
  }));

  const next = () => go(idx + 1), prev = () => go(idx - 1);
  $('#next').addEventListener('click', next); $('#prev').addEventListener('click', prev);
  addEventListener('keydown', e => {
    if(!started) return;
    if(['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)){ e.preventDefault(); next(); }
    else if(['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)){ e.preventDefault(); prev(); }
    else if(e.key === 'Home') go(0); else if(e.key === 'End') go(N - 1);
    else if(/^[1-6]$/.test(e.key)) go(+e.key - 1);
    else if(e.key === 'n' || e.key === 'N' || e.key === 'т' || e.key === 'Т') toggleNotes();
    else if(e.key === 'm' || e.key === 'M' || e.key === 'ь' || e.key === 'Ь') toggleSound();
    else if(e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А'){ if(!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); else document.exitFullscreen(); }
  });
  let wheelT = 0;
  addEventListener('wheel', e => { if(!started || Math.abs(e.deltaY) < 18) return; const n = performance.now(); if(n - wheelT < 1000) return; wheelT = n; e.deltaY > 0 ? next() : prev(); }, { passive:true });
  let tx = null;
  addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive:true });
  addEventListener('touchend', e => { if(tx == null || !started) return; const d = e.changedTouches[0].clientX - tx; if(Math.abs(d) > 50) d < 0 ? next() : prev(); tx = null; });

  function toggleNotes(){ notesOn = !notesOn; notes.classList.toggle('on', notesOn); $('#btnNotes').classList.toggle('is-on', notesOn); }
  function toggleSound(){ if(!window.Sfx) return; Sfx.unlock(); Sfx.setOn(!Sfx.on); if(Sfx.on) Sfx.ambient(); $('#btnSnd').classList.toggle('off', !Sfx.on); }
  $('#btnNotes').addEventListener('click', toggleNotes);
  $('#btnSnd').addEventListener('click', toggleSound);
  // a sparkle burst on the finale when clicking the sky
  site.addEventListener('click', e => { if(idx === N - 1 && !e.target.closest('button,a') && window.Sfx) Sfx.sparkle(); });

  let initP = null;
  window.Deck = {
    get started(){ return started; },
    prepare(){                                   // start loading the world while the edit plays
      if(!initP) initP = World.init().then(() => $('#loading').classList.add('done')).catch(e => { console.error(e); $('#loading').classList.add('done'); });
      return initP;
    },
    enter(opts){                                 // the presentation becomes visible (called by the edit / CRT)
      Deck.prepare(); site.classList.add('is-on'); World.start();
      const h = parseInt(location.hash.slice(1), 10);
      started = true;
      go(opts && opts.at != null ? opts.at : (h >= 1 && h <= N ? h - 1 : 0), true);
      if(window.Sfx && Sfx.on) Sfx.ambient();
      $('#btnSnd').classList.toggle('off', !(window.Sfx && Sfx.on));
    }
  };
})();
