/* The opening edit about dreams (~18 s). It is painted like the "АРМАН" shot: words stamped in watercolor on paper
   ("Әр түнде / біз / түс / көреміз"), then "АРМАН", streaks of thought, an x-ray head with a glowing skull (REM),
   the skull dissolving into a dream galaxy, the painted question - and then the edit switches itself off like an
   old TV and the presentation switches on. */
(function(){
  const $ = s => document.querySelector(s);
  const gate = $('#gate'), edit = $('#edit'), paint = $('#edPaint'), glc = $('#edGL'), cap = $('#edCap'), arman = $('#edArman'), hud = $('#edHud'), fin = $('#edFinal'), flash = $('#edFlash'), wordEl = $('#edWord');
  // the streaks, the x-ray head and the galaxy shots are cut: C = D = E = F, so the edit goes
  // painted words -> "АРМАН" -> the painted question -> the TV switches off
  const T = { A:0, B:3.6, step:.3, C:6.0, D:6.0, E:6.0, F:6.0, END:10.0 };
  const CAPS = [];
  const PAL = ['#e8413c', '#f39a2b', '#3fbf5a', '#3b8be0', '#7b4fc9'];
  // the painted words of the opening: [start time, lines, paper tint]
  const WORDS = [
    [.1,  ['ӘР', 'ТҮНДЕ'], '#f6efe2'],
    [.95, ['БІЗ'],         '#fbe6ea'],
    [1.8, ['ТҮС'],         '#e6eefb'],
    [2.65,['КӨРЕМІЗ'],     '#fbf1d8']
  ];
  const QUESTION = ['АЛ ЕГЕР АРМАНДЫ', 'САТЫП АЛУҒА БОЛСА?'];
  const q = new URLSearchParams(location.search);

  /* ---------------- the paper and the painted doodles (2D) ---------------- */
  const px = paint.getContext('2d');
  let PW = 0, PH = 0, dpr = 1, layers = null;
  function sizePaint(){ dpr = Math.min(devicePixelRatio || 1, 1.5); PW = paint.width = Math.round(innerWidth*dpr); PH = paint.height = Math.round(innerHeight*dpr); layers = null; }
  function blot(c, x, y, r, col, a){ const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col.replace('A', a)); g.addColorStop(.7, col.replace('A', a*.5)); g.addColorStop(1, col.replace('A', 0)); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
  function off(w, h){ const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  const rgba = hex => 'rgba(' + parseInt(hex.slice(1, 3), 16) + ',' + parseInt(hex.slice(3, 5), 16) + ',' + parseInt(hex.slice(5, 7), 16) + ',A)';
  function wash(c, s, col){                       // fill the current path with a watercolor wash of one colour
    c.save(); c.clip(); c.fillStyle = col; c.globalAlpha = .55; c.fillRect(0, 0, s, s); c.globalAlpha = 1;
    for(let i = 0; i < 26; i++) blot(c, Math.random()*s, Math.random()*s, s*(.08 + Math.random()*.2), rgba(col), .25 + Math.random()*.35);
    c.restore();
  }
  function doodle(kind, col){                     // a small painted moon / star / cloud / heart
    const s = 220, cv = off(s, s), c = cv.getContext('2d');
    c.beginPath();
    if(kind === 'moon'){                           // a crescent: a full disc, then the bite taken out of it
      c.arc(110, 110, 80, 0, 7); wash(c, s, col);
      c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(150, 82, 70, 0, 7); c.fill(); c.globalCompositeOperation = 'source-over';
      return cv;
    }
    else if(kind === 'star'){ for(let i = 0; i < 10; i++){ const a = -Math.PI/2 + i*Math.PI/5, r = i % 2 ? 38 : 92; c.lineTo(110 + Math.cos(a)*r, 115 + Math.sin(a)*r); } c.closePath(); }
    else if(kind === 'cloud'){ [[70, 130, 42], [110, 105, 55], [155, 128, 40], [110, 140, 45]].forEach(([x, y, r]) => { c.moveTo(x + r, y); c.arc(x, y, r, 0, 7); }); }
    else { c.moveTo(110, 180); c.bezierCurveTo(20, 120, 40, 40, 110, 80); c.bezierCurveTo(180, 40, 200, 120, 110, 180); }
    wash(c, s, col); return cv;
  }
  function buildLayers(){
    const W = PW, H = PH, R = Math.min(W, H);
    const papers = WORDS.map(w => w[2]).concat(['#f6efe2']).map(tint => {
      const p = off(W, H), x = p.getContext('2d'); x.fillStyle = tint; x.fillRect(0, 0, W, H);
      for(let i = 0; i < 80; i++) blot(x, Math.random()*W, Math.random()*H, R*(.05 + Math.random()*.25), ['rgba(255,200,215,A)', 'rgba(200,215,255,A)', 'rgba(255,235,190,A)', 'rgba(220,200,250,A)'][i % 4], .06 + Math.random()*.08);
      return p;
    });
    const kinds = ['moon', 'star', 'cloud', 'star', 'heart', 'star'];
    const doodles = Array.from({ length:14 }, (_, i) => doodle(kinds[i % kinds.length], PAL[i % PAL.length]));
    // where the doodles land on each card: around the edges, never on the words in the middle
    const spots = WORDS.map(() => Array.from({ length:6 }, (_, i) => {
      const side = i % 2 ? 1 : -1, x = W/2 + side*(W*.3 + Math.random()*W*.15), y = H*(.12 + Math.random()*.76);
      return { img:doodles[(Math.random()*doodles.length) | 0], x, y, r:(Math.random() - .5)*.8, s:R*(.12 + Math.random()*.1)/220, at:i*.06 };
    }));
    layers = { papers, spots, doodles };
  }
  function drawA(t){                              // 0 .. B: painted words, a new sheet of paper on every beat
    if(!layers) buildLayers();
    let k = 0; WORDS.forEach((w, i) => { if(t >= w[0]) k = i; });
    const local = t - WORDS[k][0], z = 1 + local*.025;
    px.save(); px.setTransform(z, 0, 0, z, -PW*(z - 1)/2, -PH*(z - 1)/2);
    px.drawImage(layers.papers[k], 0, 0);
    layers.spots[k].forEach(d => {
      const a = Math.max(0, Math.min(1, (local - d.at)/.18)); if(!a) return;
      const sc = d.s*(1 + (1 - a)*.8)*(1 + Math.sin(t*2 + d.x)*.03);
      px.save(); px.globalAlpha = a*.9; px.translate(d.x, d.y + Math.sin(t*1.5 + d.y)*4*dpr); px.rotate(d.r); px.scale(sc, sc); px.drawImage(d.img, -110, -110); px.restore();
    });
    px.restore();
    if(wordEl.dataset.k !== String(k)) showWord(WORDS[k][1], k);
  }
  function showWord(lines, k){                     // stamp the letters of one card, one after another
    wordEl.dataset.k = k; wordEl.innerHTML = ''; wordEl.classList.toggle('sm', lines.join('').length > 6); wordEl.classList.toggle('xs', lines.join('').length > 16);
    let n = 0;
    lines.forEach(line => {
      const ln = document.createElement('div'); ln.className = 'ln';
      [...line].forEach(ch => {
        const s = document.createElement('span'); s.textContent = ch === ' ' ? '\u00a0' : ch;
        s.style.setProperty('--c', PAL[(n + k*2) % PAL.length]); s.style.setProperty('--r', ((n*37 % 11) - 5) + 'deg');
        const loud = n === 0 ? 1 : .45;
        ln.appendChild(s); const d = n*55; setTimeout(() => { s.classList.add('on'); if(window.Sfx && ch !== ' ') Sfx.stamp(loud); }, d); n++;
      });
      wordEl.appendChild(ln);
    });
  }
  function drawB(t){ if(!layers) buildLayers(); px.drawImage(layers.papers[layers.papers.length - 1], 0, 0); }

  /* ---------------- the 3D shots ---------------- */
  let R3 = null, gl = null;
  function setupGL(){
    if(gl) return gl;
    R3 = new THREE.WebGLRenderer({ canvas:glc, antialias:true }); R3.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); R3.setSize(innerWidth, innerHeight, false);
    R3.outputEncoding = THREE.sRGBEncoding; R3.setClearColor('#000');
    const cam = new THREE.PerspectiveCamera(50, innerWidth/innerHeight, .05, 400);
    // streaks
    const sC = new THREE.Scene(), n = 1600, pos = new Float32Array(n*6), seg = [];
    for(let i = 0; i < n; i++){ const a = Math.random()*Math.PI*2, r = .6 + Math.pow(Math.random(), .5)*9; seg.push({ x:Math.cos(a)*r, y:Math.sin(a)*r, z:-Math.random()*90, v:18 + Math.random()*40, l:.6 + Math.random()*2.4 }); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const col = new Float32Array(n*6); for(let i = 0; i < n; i++){ const c = Math.random() < .2 ? [.55, 1, .85] : [.9, .95, 1]; col.set([...c.map(v => v*.15), ...c], i*6); } lg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    sC.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors:true, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false })));
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-6, -2.2, -14), new THREE.Vector3(-2, -.9, -8), new THREE.Vector3(.5, -1.4, -5), new THREE.Vector3(2.6, -.4, -2.2), new THREE.Vector3(5, .6, -1)]);
    const tc = document.createElement('canvas'); tc.width = 256; tc.height = 64; const tx = tc.getContext('2d'); tx.fillStyle = '#2e8f78'; tx.fillRect(0, 0, 256, 64);
    tx.strokeStyle = 'rgba(10,40,35,.8)'; tx.lineWidth = 1.5; for(let i = 0; i < 60; i++){ tx.beginPath(); let x = Math.random()*256, y = Math.random()*64; tx.moveTo(x, y); for(let j = 0; j < 4; j++){ x += (Math.random() - .5)*30; y += (Math.random() - .5)*20; tx.lineTo(x, y); } tx.stroke(); }
    const tt = new THREE.CanvasTexture(tc); tt.wrapS = tt.wrapT = THREE.RepeatWrapping; tt.repeat.set(6, 1); tt.encoding = THREE.sRGBEncoding;
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, .55, 24), new THREE.MeshStandardMaterial({ map:tt, color:'#7fe0c0', emissive:'#0d4a3c', roughness:.35, metalness:.1 }));
    sC.add(tube); sC.add(new THREE.HemisphereLight('#bfffee', '#102030', 1.2)); const pl = new THREE.PointLight('#ffffff', 2, 20); pl.position.set(2, 3, 2); sC.add(pl);
    // head
    const sD = new THREE.Scene(), holo = new THREE.Group(); sD.add(holo);
    gl = { cam, sC, seg, lg, pos, tube, sD, holo, head:null };
    Promise.all([Models.gltf('assets/models/head.glb'), Models.skull()]).then(([g, sk]) => { const h = Models.hologram(g.scene, sk, { size:14, col:'#5f9dff' }); holo.add(h); gl.head = h; }).catch(e => console.warn(e));
    addEventListener('resize', () => { if(!R3) return; R3.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth/innerHeight; cam.updateProjectionMatrix(); });
    return gl;
  }
  function drawC(t, dt){
    const g = gl, k = (t - T.C)/(T.D - T.C);
    g.seg.forEach((s, i) => { s.z += s.v*dt; if(s.z > 4) s.z -= 94; g.pos.set([s.x, s.y, s.z - s.l*(1 + k*2), s.x, s.y, s.z], i*6); });
    g.lg.attributes.position.needsUpdate = true;
    g.tube.material.map.offset.x -= dt*.6; g.tube.rotation.z = Math.sin(t)*.05;
    g.cam.position.set(Math.sin(t*.7)*.3, .2, 3.2 - k*1.2); g.cam.lookAt(0, -.3, -6); g.cam.fov = 50 + k*12; g.cam.updateProjectionMatrix();
    R3.render(g.sC, g.cam);
  }
  function drawDE(t, dt){
    const g = gl; if(!g.head){ R3.clear(); return; }
    const h = g.head, mat = h.userData.mat, pm = h.userData.pts.material.uniforms;
    mat.uniforms.time.value = t; pm.time.value = t;
    if(t < T.E){
      const k = (t - T.D)/(T.E - T.D), a = -.9 + k*1.5;
      g.cam.position.set(Math.sin(a)*4.4, .55 + Math.sin(k*3)*.1, Math.cos(a)*4.4); g.cam.lookAt(0, .25, 0); g.cam.fov = 38 - k*6;
      mat.uniforms.amp.value = Math.min(1, (t - T.D)*3); pm.morph.value = 0; pm.spin.value = 0; pm.amp.value = Math.min(1, (t - T.D)*2);
    } else {
      const k = Math.min(1, (t - T.E)/(T.F - T.E)), e = k*k*(3 - 2*k);
      mat.uniforms.amp.value = Math.max(0, 1 - k*2.5);
      pm.morph.value = Math.min(1, k*1.3); pm.spin.value = e*2.4;
      const r = 4.4 + e*1.4, a = .6 + k*.8;
      g.cam.position.set(Math.sin(a)*r, .55 + e*3.4, Math.cos(a)*r); g.cam.lookAt(0, .25 - e*.25, 0); g.cam.fov = 32 + e*12;
      pm.amp.value = 1 - Math.max(0, (t - (T.F - .5))/.5);
    }
    g.cam.updateProjectionMatrix(); h.rotation.y = Math.sin(t*.4)*.1;
    R3.render(g.sD, g.cam);
  }

  /* ---------------- HUD bits ---------------- */
  const eeg = $('#edEeg'), ex = eeg.getContext('2d'), hz = $('#edHz');
  function drawEEG(t){
    ex.clearRect(0, 0, 420, 180); ex.strokeStyle = 'rgba(255,255,255,.18)'; ex.lineWidth = 1;
    for(let y = 30; y < 180; y += 30){ ex.beginPath(); ex.moveTo(0, y); ex.lineTo(420, y); ex.stroke(); }
    [['#ff6b8b', 0, 1], ['#7fd4ff', 1.7, .7], ['#ffffff', 3.1, .45]].forEach(([c, ph, a], j) => {
      ex.strokeStyle = c; ex.globalAlpha = a; ex.lineWidth = 2; ex.beginPath();
      for(let x = 0; x <= 420; x += 3){ const u = x/420*10 + t*3; const y = 90 + j*14 - 18 + Math.sin(u*2.1 + ph)*22*Math.sin(u*.4 + t) + Math.sin(u*7.3 + ph)*6 + (Math.random() - .5)*4; x ? ex.lineTo(x, y) : ex.moveTo(x, y); }
      ex.stroke();
    }); ex.globalAlpha = 1;
    if(Math.random() < .2) hz.textContent = (5.6 + Math.random()*1.8).toFixed(1);
  }

  /* ---------------- captions ---------------- */
  let capIdx = -1;
  function setCap(i){
    if(i === capIdx) return; capIdx = i;
    cap.classList.remove('out'); cap.innerHTML = '';
    if(i < 0) return;
    CAPS[i][2].split(' ').forEach((w, k) => { const s = document.createElement('span'); s.className = 'w'; s.textContent = w; cap.appendChild(s); cap.appendChild(document.createTextNode(' ')); setTimeout(() => s.classList.add('on'), 60 + k*120); });
  }

  /* ---------------- the timeline ---------------- */
  let t0 = 0, lastNow = 0, playing = false, shot = '', ended = false;
  const lettersOn = new Set();
  function doFlash(){ flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go'); }
  function tick(now){
    if(!playing) return;
    requestAnimationFrame(tick);
    const t = (now - t0)/1000, dt = Math.min(.05, (now - (lastNow || now))/1000); lastNow = now;
    // captions
    let ci = -1; CAPS.forEach((c, i) => { if(t >= c[0] && t < c[1]) ci = i; });
    if(ci !== capIdx){ if(ci < 0 && capIdx >= 0){ cap.classList.add('out'); capIdx = -1; } else setCap(ci); }
    let s = t < T.B ? 'A' : t < T.C ? 'B' : t < T.D ? 'C' : t < T.E ? 'D' : t < T.F ? 'E' : 'F';
    if(s !== shot){
      shot = s; edit.classList.toggle('gl-on', s === 'C' || s === 'D' || s === 'E');
      hud.classList.toggle('on', s === 'D');
      if(s === 'B' || s === 'C' || s === 'D' || s === 'F') doFlash();
      if(s === 'B'){ wordEl.innerHTML = ''; wordEl.dataset.k = ''; }
      if(s !== 'A' && s !== 'B') arman.classList.add('out');   // "АРМАН" leaves before the next shot (the question)
      if(s === 'F'){ drawB(t); showWord(QUESTION, 4); }       // back to paper: the question, painted
    }
    if(s === 'A') drawA(t);
    else if(s === 'F') drawB(t);
    else if(s === 'B'){
      drawB(t);
      for(let i = 0; i < 5; i++) if(t >= T.B + i*T.step && !lettersOn.has(i)){ lettersOn.add(i); arman.children[i].classList.add('on'); }
      const sh = Math.max(0, 1 - ((t - T.B) % T.step)/.12)*8;           // a small shake on each stamp
      arman.style.transform = 'translate(' + ((Math.random() - .5)*sh) + 'px,' + ((Math.random() - .5)*sh) + 'px)';
    }
    else if(s === 'C'){ px.clearRect(0, 0, PW, PH); drawC(t, dt); }
    else if(s === 'D' || s === 'E'){ drawDE(t, dt); if(s === 'D') drawEEG(t); }
    if(t >= T.END && !ended){ ended = true; finish(); }
  }

  function play(){
    gate.classList.add('is-gone'); setTimeout(() => gate.style.display = 'none', 900);
    if(window.Sfx){ Sfx.unlock(); }
    Deck.prepare();                                  // the world loads while the edit plays
    sizePaint(); if(T.C < T.F) setupGL(); edit.classList.add('is-on');
    setTimeout(() => {
      if(window.Sfx) Sfx.score(T);
      t0 = performance.now() - (parseFloat(q.get('t')) || 0)*1000;   // ?t=11 starts the edit at 11 s (for checking a shot)
      lastNow = 0; playing = true; requestAnimationFrame(tick);
    }, 400);
  }

  /* ---------------- the end: old TV off, then the presentation switches on ---------------- */
  const crt = $('#crt'), root = document.documentElement;
  const easeIn = k => k*k, easeOut = k => 1 - Math.pow(1 - k, 2), setV = (k, v) => crt.style.setProperty(k, v);
  function tvOff(target, done){
    const fx = document.createElement('div'); fx.className = 'crtfx';
    const nz = document.createElement('canvas'); nz.width = 192; nz.height = 108; fx.appendChild(nz); target.appendChild(fx);
    const nctx = nz.getContext('2d'), img = nctx.createImageData(192, 108);
    crt.style.display = 'block'; crt.style.opacity = '1'; crt.style.background = 'transparent';
    const SL = q.has('crtslow') ? 6 : 1, E = { snow:550, flat:640, s1:730, s2:810, s3:930, dot:1060, fade:1750 }; Object.keys(E).forEach(k => E[k] *= SL);
    if(window.Sfx) Sfx.crtOff();
    let ph = 0; const st = performance.now();
    function snow(){ const d = img.data; ph += .35; for(let y = 0; y < 108; y++){ const band = .62 + .38*Math.sin(y*.32 + ph + Math.sin(y*.05)*3); for(let x = 0; x < 192; x++){ const v = Math.min(255, (60 + Math.random()*195)*band) | 0, i = (y*192 + x)*4; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; } } nctx.putImageData(img, 0, 0); }
    (function step(now){
      const t = now - st;
      if(t < E.snow){ const k = t/E.snow; fx.style.opacity = Math.min(1, k*1.6).toFixed(3); snow(); target.style.transform = 'translateX(' + ((Math.random() - .5)*14*k).toFixed(1) + 'px)'; target.style.filter = 'brightness(' + (1 + .6*k).toFixed(2) + ')'; }
      else if(t < E.flat){ fx.style.opacity = 1; nz.style.opacity = 0; fx.style.background = '#7b7b7b'; target.style.transform = ''; target.style.filter = ''; }
      else if(t < E.s1){ const k = (t - E.flat)/(E.s1 - E.flat), c = 123 + 80*k | 0; fx.style.background = 'rgb(' + c + ',' + c + ',' + c + ')'; target.style.transform = 'scaleY(' + (1 - .66*easeIn(k)).toFixed(4) + ')'; }
      else if(t < E.s2){ const k = (t - E.s1)/(E.s2 - E.s1), c = 203 + 52*k | 0; fx.style.background = 'rgb(' + c + ',' + c + ',' + c + ')'; target.style.transform = 'scaleY(' + (.34 - .2*easeIn(k)).toFixed(4) + ')'; }
      else if(t < E.s3){ const k = (t - E.s2)/(E.s3 - E.s2); fx.style.background = '#fff'; target.style.transform = 'scaleY(' + Math.max(.004, .14 - .136*easeIn(k)).toFixed(4) + ')'; target.style.filter = 'brightness(' + (1.6 + 2*k).toFixed(2) + ')'; }
      else if(t < E.dot){ const k = (t - E.s3)/(E.dot - E.s3); target.style.visibility = 'hidden'; crt.style.background = '#000'; setV('--lo', 1); setV('--lw', (1 - easeIn(k)*.985).toFixed(4)); setV('--lh', (3 + k*4).toFixed(1)); }
      else if(t < E.fade){ const k = (t - E.dot)/(E.fade - E.dot); crt.style.background = '#000'; setV('--lw', .012); setV('--lh', 7); setV('--lo', Math.max(0, 1 - easeOut(k)*1.02 + Math.sin(t*.06)*.05*(1 - k)).toFixed(3)); }
      else { setV('--lo', 0); fx.remove(); target.style.transform = ''; target.style.filter = ''; done(); return; }
      requestAnimationFrame(step);
    })(st);
  }
  function tvOn(target, done){                       // a dot, a line, then the picture opens vertically with a flash
    crt.style.display = 'block'; crt.style.opacity = '1'; crt.style.background = '#000';
    target.style.visibility = 'visible'; target.style.transform = 'scaleY(.004)'; target.style.filter = 'brightness(4)';
    const SL = q.has('crtslow') ? 6 : 1, E = { dot:260, line:520, open:980, settle:1500 }; Object.keys(E).forEach(k => E[k] *= SL);
    if(window.Sfx) Sfx.crtOn();
    const st = performance.now();
    (function step(now){
      const t = now - st;
      if(t < E.dot){ const k = t/E.dot; setV('--lo', easeOut(k).toFixed(3)); setV('--lw', .012); setV('--lh', 7); }
      else if(t < E.line){ const k = (t - E.dot)/(E.line - E.dot); setV('--lo', 1); setV('--lw', (.012 + easeOut(k)*.988).toFixed(4)); setV('--lh', (7 - k*4).toFixed(1)); }
      else if(t < E.open){
        const k = (t - E.line)/(E.open - E.line), e = 1 - Math.pow(1 - k, 3);
        crt.style.background = 'transparent'; setV('--lo', (1 - k).toFixed(3));
        target.style.transform = 'scaleY(' + Math.max(.004, e).toFixed(4) + ')'; target.style.filter = 'brightness(' + (4 - 2.6*e).toFixed(2) + ') saturate(' + (.4 + .6*e).toFixed(2) + ')';
      }
      else if(t < E.settle){ const k = (t - E.open)/(E.settle - E.open); target.style.transform = ''; target.style.filter = 'brightness(' + (1.4 - .4*easeOut(k)).toFixed(2) + ')'; setV('--lo', 0); }
      else { target.style.filter = ''; target.style.transform = ''; crt.style.display = 'none'; ['--lo', '--lw', '--lh'].forEach(k => crt.style.removeProperty(k)); done && done(); return; }
      requestAnimationFrame(step);
    })(st);
  }

  function disposeEdit(){
    playing = false; edit.classList.remove('is-on'); edit.style.display = 'none';
    if(R3){ R3.dispose(); try{ R3.forceContextLoss(); }catch(e){} R3 = null; }
  }
  function openDeck(){
    const site = $('#site');
    Deck.prepare().then(() => {});
    site.classList.add('is-on'); site.style.visibility = 'hidden';
    // wait for the world to be loaded (max ~6 s) so it switches on to the finished picture
    const st = performance.now();
    (function wait(){
      if(World.ready || performance.now() - st > 6000){
        if(q.has('notv')){ Deck.enter(); site.style.visibility = ''; return; }      // ?notv: no switch-on effect (for checking slides)
        Deck.enter(); requestAnimationFrame(() => tvOn(site, () => { site.style.visibility = ''; }));
      } else setTimeout(wait, 120);
    })();
  }
  function finish(){
    if(window.Sfx) Sfx.stopScore(.4);
    tvOff(edit, () => { disposeEdit(); setTimeout(openDeck, 380); });
  }
  function skip(){
    if(ended) return; ended = true;
    if(playing){ if(window.Sfx) Sfx.stopScore(.2); fin.classList.remove('on'); tvOff(edit, () => { disposeEdit(); setTimeout(openDeck, 300); }); }
    else { gate.classList.add('is-gone'); setTimeout(() => gate.style.display = 'none', 600); if(window.Sfx) Sfx.unlock(); Deck.prepare(); openDeck(); }
  }

  $('#gatePlay').addEventListener('click', play);
  $('#gateSkip').addEventListener('click', skip);
  $('#edSkip').addEventListener('click', skip);
  addEventListener('keydown', e => { if(gate.style.display !== 'none' && !gate.classList.contains('is-gone') && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); play(); } else if(playing && e.key === 'Escape') skip(); });
  addEventListener('resize', () => { if(playing) sizePaint(); });
  Models.prefetch(['assets/models/head.glb', 'assets/models/low-island.glb', 'assets/models/fairy-island.glb']);

  // ?deck (or a deep link like #3) opens the presentation straight away; ?edit plays the edit at once
  const h = parseInt(location.hash.slice(1), 10);
  if(q.has('deck') || (h >= 2 && h <= 6)){ gate.style.display = 'none'; ended = true; Deck.prepare(); openDeck(); }
})();
