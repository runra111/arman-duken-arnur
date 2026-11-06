/* The dream world behind the slides: the lilac skybox with planets, a sea of clouds, floating islands with
   waterfalls, a rainbow, sky lanterns, fireflies and a phoenix circling the islands. Each slide has a camera
   spot; the camera flies between them. */
(function(){
  const W = window.World = { ready:false };
  const canvas = document.getElementById('world');
  let renderer, scene, cam, t = 0, last = 0, running = false;
  const updaters = [], bobs = [];
  const mouse = { x:0, y:0, sx:0, sy:0 };
  let anchor = null, bird = null, birdMix = null, slide = 0, main = null, mainScale = 1, mainTarget = 1;

  // camera spots per slide: [position, look-at]; the main island sits at the origin (about 20 units wide)
  const SPOTS = [
    [[-21, 6, 40], [-17, 3.5, 0]],         // 1 title: island to the right of the text
    [[24, 1, 26], [11, -2, 0]],            // 2 where: closer, the waterfall side, island on the left
    [[-6, 16, 46], [-14, 18, -40]],        // 3 products: up in the sky, calm background
    [[30, 10, -14], [-6, 10, -58]],        // 4 prices: towards the far islands and planets
    [[44, 18, 30], [-40, 34, -120]],       // 5 conditions: high above, the big planet and the island chain on the right
    [[0, 9, 62], [0, 6, 0]]                // 6 finale: wide, the phoenix passes close
  ];
  const cur = { p:new THREE.Vector3(...SPOTS[0][0]), l:new THREE.Vector3(...SPOTS[0][1]) };
  let fly = null;

  /* ---- sky: the lilac skybox (equirectangular) ---- */
  function sky(){
    const tex = new THREE.TextureLoader().load('assets/sky/sky-alien.jpg'); tex.encoding = THREE.sRGBEncoding;
    const s = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), new THREE.MeshBasicMaterial({ map:tex, side:THREE.BackSide, fog:false, toneMapped:false, depthWrite:false }));
    s.rotation.y = -2.1; s.renderOrder = -10; s.frustumCulled = false; scene.add(s);
    updaters.push(() => s.position.copy(cam.position));
  }

  /* ---- planets (the Kenney planet pictures as distant billboards) ---- */
  function planets(){
    const L = new THREE.TextureLoader();
    [['planet1', -230, 120, -340, 120, .9], ['planet2', 170, 150, -390, 52, .6], ['planet9', 30, 100, -300, 34, .8],
     ['planet7', 330, 70, -160, 72, .7], ['planet5', -100, 76, -270, 24, 1], ['planet3', -320, 70, 60, 90, .7], ['planet0', 120, 210, -250, 30, .9]]
    .forEach(([n, x, y, z, s, sp]) => {
      const tx = L.load('assets/sky/' + n + '.png'); tx.encoding = THREE.sRGBEncoding;
      const m = new THREE.SpriteMaterial({ map:tx, fog:false, toneMapped:false, transparent:true, depthWrite:false, opacity:.96 });
      const p = new THREE.Sprite(m); p.position.set(x, y, z); p.scale.set(s, s, 1); p.renderOrder = -5; scene.add(p);
      const b = y, ph = Math.random()*6; updaters.push(() => { m.rotation = t*.01*sp; p.position.y = b + Math.sin(t*.1 + ph)*2; });
    });
  }

  function clouds(){
    const tex = Models.cloudTex();
    const mk = (x, y, z, s, col, op) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, color:col, transparent:true, depthWrite:false, opacity:op, fog:true })); sp.position.set(x, y, z); sp.scale.set(s, s*.55, 1); scene.add(sp); return sp; };
    const pal = ['#fff6fb', '#ffe0ef', '#ffd3e4', '#ecdcff', '#ffe2d2'];
    for(let i = 0; i < 230; i++){                              // the sea of clouds
      const a = Math.random()*Math.PI*2, r = 18 + Math.pow(Math.random(), .7)*300;
      mk(Math.cos(a)*r, -26 - Math.random()*14, Math.sin(a)*r, 40 + Math.random()*70, pal[i % pal.length], .8 + Math.random()*.2);
    }
    const drift = [];
    for(let i = 0; i < 34; i++){                               // loose clouds at island height, never in front of a camera spot
      const a = Math.random()*Math.PI*2, r = 40 + Math.random()*200, cx = Math.cos(a)*r, cz = Math.sin(a)*r;
      if(SPOTS.some(s => Math.hypot(s[0][0] - cx, s[0][2] - cz) < 34)){ i--; continue; }
      const sp = mk(cx, -6 + Math.random()*40, cz, 16 + Math.random()*30, pal[i % pal.length], .55 + Math.random()*.3);
      sp.userData.v = .4 + Math.random()*1.2; drift.push(sp);
    }
    updaters.push(dt => drift.forEach(s => { s.position.x += s.userData.v*dt; if(s.position.x > 260) s.position.x = -260; }));
  }

  function fireflies(){
    const n = 600, pos = new Float32Array(n*3), col = new Float32Array(n*3), ph = new Float32Array(n);
    const pal = ['#fff2b0', '#ffc2e2', '#bff4ff', '#e2d4ff'].map(c => new THREE.Color(c));
    for(let i = 0; i < n; i++){
      const a = Math.random()*Math.PI*2, r = 6 + Math.random()*90;
      pos.set([Math.cos(a)*r, -20 + Math.random()*50, Math.sin(a)*r], i*3); const c = pal[i % 4]; col.set([c.r, c.g, c.b], i*3); ph[i] = Math.random()*20;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
    const m = new THREE.ShaderMaterial({ transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, uniforms:{ time:{ value:0 }, px:{ value:1 }, tex:{ value:Models.dotTex() } },
      vertexShader:`attribute vec3 color; attribute float ph; uniform float time, px; varying vec3 vC; varying float vA;
        void main(){ vec3 p = position + vec3(sin(time*.4 + ph)*1.5, sin(time*.6 + ph*1.7)*1.2, cos(time*.35 + ph)*1.5); vC = color; vA = .35 + .65*pow(.5 + .5*sin(time*2. + ph*3.), 3.);
          vec4 mv = modelViewMatrix*vec4(p,1.); gl_PointSize = px*80./-mv.z; gl_Position = projectionMatrix*mv; }`,
      fragmentShader:'uniform sampler2D tex; varying vec3 vC; varying float vA; void main(){ gl_FragColor = vec4(vC, texture2D(tex, gl_PointCoord).a*vA); }' });
    scene.add(new THREE.Points(g, m));
    updaters.push(() => { m.uniforms.time.value = t; m.uniforms.px.value = renderer.getPixelRatio(); });
  }

  /* ---- sky lanterns drifting up between the islands ---- */
  function lanterns(){
    const body = new THREE.CylinderGeometry(.42, .3, 1, 8, 1, true);
    const mat = new THREE.MeshStandardMaterial({ color:'#ff8a3d', emissive:'#ff5a1f', emissiveIntensity:.9, side:THREE.DoubleSide, flatShading:true });
    const glowM = new THREE.SpriteMaterial({ map:Models.dotTex(), color:'#ff9a3c', transparent:true, depthWrite:false, opacity:.45 });
    const list = [];
    for(let i = 0; i < 28; i++){
      const g = new THREE.Group(), m = new THREE.Mesh(body, mat), gl = new THREE.Sprite(glowM); gl.scale.set(1.9, 1.9, 1); g.add(m, gl);
      const a = Math.random()*Math.PI*2, r = 14 + Math.random()*110;
      g.position.set(Math.cos(a)*r, -24 + Math.random()*60, Math.sin(a)*r); g.scale.setScalar(.7 + Math.random()*.6);
      g.userData = { v:.6 + Math.random()*.9, ph:Math.random()*6, x:g.position.x, z:g.position.z };
      scene.add(g); list.push(g);
    }
    updaters.push(dt => list.forEach(g => { const u = g.userData; g.position.y += u.v*dt; if(g.position.y > 44) g.position.y = -26;
      g.position.x = u.x + Math.sin(t*.3 + u.ph)*1.6; g.position.z = u.z + Math.cos(t*.25 + u.ph)*1.6; g.rotation.y += dt*.3; }));
  }

  /* ---- a soft rainbow behind the big waterfall ---- */
  function rainbow(at){
    const geo = new THREE.RingGeometry(15, 19.5, 96, 1, 0, Math.PI);
    const m = new THREE.ShaderMaterial({ transparent:true, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, uniforms:{ time:{ value:0 } },
      vertexShader:'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader:`varying vec2 vP; uniform float time;
        vec3 hsv(float h){ return clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.); }
        void main(){ float r = (length(vP) - 15.)/4.5; float edge = smoothstep(0., .18, r)*smoothstep(1., .82, r);
          float side = smoothstep(0., .3, vP.y/19.5); gl_FragColor = vec4(hsv(.8 - r*.8)*edge*side*(.32 + .05*sin(time)), 1.); }` });
    const rb = new THREE.Mesh(geo, m); rb.position.copy(at); rb.rotation.y = .5; scene.add(rb);
    updaters.push(() => m.uniforms.time.value = t);
  }

  const ray = new THREE.Raycaster();
  function surfaceY(root, x, z){                // the island's top at (x, z), in world units
    root.updateMatrixWorld(true); ray.set(new THREE.Vector3(x, 200, z), new THREE.Vector3(0, -1, 0));
    const meshes = []; root.traverse(o => { if(o.isMesh && !o.userData.water) meshes.push(o); });
    const hit = ray.intersectObjects(meshes, false)[0]; return hit ? hit.point.y : null;
  }
  // islands only float: up and down, and a very slight sway - they never spin
  function bob(obj, amp, speed){ const b = obj.position.y, ph = Math.random()*6, r0 = obj.rotation.y;
    bobs.push(() => { obj.position.y = b + Math.sin(t*speed + ph)*amp; obj.rotation.z = Math.sin(t*speed*.7 + ph)*.012; obj.rotation.x = Math.cos(t*speed*.6 + ph)*.01; obj.rotation.y = r0; }); }

  function lipOf(root){                         // the lowest point of an island's river, in the root's own space
    root.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(); let lip = null;
    root.traverse(o => { if(o.isMesh && o.userData.water){ const p = o.geometry.attributes.position, v = new THREE.Vector3(); for(let i = 0; i < p.count; i++){ v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); if(!lip || v.y < lip.y) lip = v.clone(); } } });
    return lip && lip.applyMatrix4(inv);
  }

  async function islands(){
    const [low, fairy] = await Promise.all([Models.gltf('assets/models/low-island.glb'), Models.gltf('assets/models/fairy-island.glb')]);
    const isl = Models.normalize(Models.fixIsland(low.scene, 'low'), 20);
    main = new THREE.Group(); main.add(isl); scene.add(main);
    const lip = lipOf(main);
    if(lip){ const f = Models.makeFall(34, 2.6); f.position.copy(lip).add(new THREE.Vector3(0, .6, .4)); main.add(f); updaters.push(() => f.userData.update(t, cam)); rainbow(new THREE.Vector3(lip.x - 2, -18, lip.z - 10)); }
    anchor = new THREE.Object3D(); const top = surfaceY(main, 0, 0); anchor.position.set(0, (top == null ? 8 : top) + 1.5, 0); main.add(anchor);
    bob(main, .45, .5);

    // the fairy islands, with painted stone: a big companion and a ring of far ones, some with falls
    const base = Models.normalize(Models.fixIsland(fairy.scene, 'fairy'), 1);
    const place = (x, y, z, s, fall, ry) => {
      const g = base.clone(); g.scale.setScalar(s); g.position.set(x, y, z); g.rotation.y = ry || 0; scene.add(g);
      bob(g, s*.02, .3 + Math.random()*.4); return g;
    };
    place(-32, 9, -22, 17, true, .4);
    place(36, 15, -46, 12, true, 2.2);
    place(-58, 22, -92, 22, true, 1.1);
    place(14, 28, -120, 16, false, 3.3);
    place(70, 4, -10, 10, true, 4.4);
    place(-84, -2, 10, 14, false, .9);
    place(-18, 32, -64, 9, false, 5.1);
    place(54, 36, -88, 8, false, 2.7);
    place(-110, 44, -170, 18, true, 1.9);
    // far copies of the waterfall island
    [[96, 6, -150, .7, 2], [-130, 12, -120, .55, 4], [-190, 30, -230, .8, 1]].forEach(([x, y, z, s, r]) => {
      const c = isl.clone(); c.scale.multiplyScalar(s); const h = new THREE.Group(); h.add(c); h.position.set(x, y, z); h.rotation.y = r; scene.add(h); bob(h, .5, .4);
      const lp = lipOf(h); if(lp){ const f = Models.makeFall(34*s, 2.6*s); f.position.copy(lp); h.add(f); updaters.push(() => f.userData.update(t + x, cam)); }
    });
  }

  /* ---- the phoenix: circles the islands, leaves a trail of embers ---- */
  const TRAIL = 220, trailPos = new Float32Array(TRAIL*3), trailAge = new Float32Array(TRAIL).fill(9);
  let trailI = 0, trailGeo = null;
  async function loadBird(){
    const b = await Models.firebird();
    birdMix = b.mix; bird = new THREE.Group(); bird.rotation.order = 'YXZ'; bird.add(Models.fitSkinned(b.obj, 6.5)); scene.add(bird);
    trailGeo = new THREE.BufferGeometry(); trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3)); trailGeo.setAttribute('age', new THREE.BufferAttribute(trailAge, 1));
    const m = new THREE.ShaderMaterial({ transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, uniforms:{ px:{ value:1 }, tex:{ value:Models.dotTex() } },
      vertexShader:'attribute float age; uniform float px; varying float vA; void main(){ vA = clamp(1. - age/1.6, 0., 1.); vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = px*(40. + 60.*vA)*vA/-mv.z; gl_Position = projectionMatrix*mv; }',
      fragmentShader:'uniform sampler2D tex; varying float vA; void main(){ vec3 c = mix(vec3(1.,.35,.1), vec3(1.,.9,.5), vA); gl_FragColor = vec4(c, texture2D(tex, gl_PointCoord).a*vA); }' });
    const pts = new THREE.Points(trailGeo, m); pts.frustumCulled = false; scene.add(pts);
    updaters.push(() => m.uniforms.px.value = renderer.getPixelRatio());
  }
  W.birdYaw = -Math.PI/2;                         // the model's head points along +X: turn it to face where it flies
  let orbitR = 26;
  const bp = new THREE.Vector3(), bn = new THREE.Vector3(), tail = new THREE.Vector3();
  function birdPath(tt, out){ const a = tt*.22; return out.set(Math.sin(a)*orbitR, 8 + Math.sin(a*2)*3, Math.cos(a)*orbitR*.85 - 2); }

  function frame(now){
    requestAnimationFrame(frame);
    if(!running) return;
    const dt = Math.min(.05, (now - (last || now))/1000); last = now; t += dt;
    updaters.forEach(f => f(dt)); bobs.forEach(f => f());
    if(main){ mainScale += (mainTarget - mainScale)*.05; main.scale.setScalar(mainScale); }
    if(fly){
      const k = Math.min(1, (now - fly.t0)/fly.d), e = k < .5 ? 4*k*k*k : 1 - Math.pow(-2*k + 2, 3)/2;
      cur.p.lerpVectors(fly.p0, fly.p1, e); cur.p.y += Math.sin(Math.PI*e)*fly.lift; cur.l.lerpVectors(fly.l0, fly.l1, e);
      if(k >= 1) fly = null;
    }
    mouse.sx += (mouse.x - mouse.sx)*.04; mouse.sy += (mouse.y - mouse.sy)*.04;
    cam.position.set(cur.p.x + Math.sin(t*.2)*.6 + mouse.sx*1.6, cur.p.y + Math.sin(t*.27)*.4 - mouse.sy*.9, cur.p.z);
    cam.lookAt(cur.l.x + mouse.sx*.8, cur.l.y - mouse.sy*.5, cur.l.z);
    if(bird){
      birdMix.update(dt);
      orbitR += ((slide === 5 ? 40 : slide === 4 ? 30 : 26) - orbitR)*.01;
      birdPath(t, bp); birdPath(t + .2, bn);
      bird.position.copy(bp);
      bird.rotation.y = Math.atan2(bn.x - bp.x, bn.z - bp.z) + W.birdYaw;
      bird.rotation.x = Math.sin(t*.22)*.05 + .2;            // leaning into the turn (around its own length)
      // embers fall from behind the tail
      for(let i = 0; i < TRAIL; i++) trailAge[i] += dt;
      for(let k = 0; k < 3; k++){ tail.set(-2 - Math.random()*1.6, (Math.random() - .5)*.8, (Math.random() - .5)*1.4).applyEuler(bird.rotation).add(bp);
        trailPos.set([tail.x, tail.y, tail.z], trailI*3); trailAge[trailI] = Math.random()*.4; trailI = (trailI + 1) % TRAIL; }
      for(let i = 0; i < TRAIL; i++) trailPos[i*3 + 1] -= dt*.6;
      trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.age.needsUpdate = true;
    }
    renderer.render(scene, cam);
    if(anchor && W.onPin){
      const v = new THREE.Vector3(); anchor.getWorldPosition(v); v.project(cam);
      W.onPin((v.x*.5 + .5)*innerWidth, (-v.y*.5 + .5)*innerHeight, v.z < 1);
    }
  }

  function size(){
    const w = innerWidth, h = innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6)); renderer.setSize(w, h, false);
    cam.aspect = w/h; cam.fov = w/h < 1 ? 62 : 45; cam.updateProjectionMatrix();
  }

  W.init = async function(){
    renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
    scene = new THREE.Scene(); scene.fog = new THREE.Fog('#efc4d8', 120, 520);
    cam = new THREE.PerspectiveCamera(45, 1, .1, 2000);
    size(); addEventListener('resize', size);
    scene.add(new THREE.HemisphereLight('#d7c6ff', '#ffa9bf', .85));
    const sun = new THREE.DirectionalLight('#fff0dc', 1.5); sun.position.set(60, 50, -40); scene.add(sun);
    const fill = new THREE.DirectionalLight('#b9c8ff', .5); fill.position.set(-40, 20, 50); scene.add(fill);
    scene.add(new THREE.AmbientLight('#ffffff', .15));
    sky(); planets(); clouds(); fireflies();
    addEventListener('pointermove', e => { mouse.x = e.clientX/innerWidth - .5; mouse.y = e.clientY/innerHeight - .5; });
    requestAnimationFrame(frame);
    await islands();
    loadBird().catch(e => console.warn('phoenix', e));
    W.ready = true;
  };
  W.start = () => { running = true; last = 0; };
  W.stop = () => { running = false; };
  W.setBig = big => { mainTarget = big ? 1 : .45; };
  W.go = (i, instant) => {
    slide = i; const s = SPOTS[i] || SPOTS[0];
    const p1 = new THREE.Vector3(...s[0]), l1 = new THREE.Vector3(...s[1]);
    if(instant){ cur.p.copy(p1); cur.l.copy(l1); fly = null; return; }
    fly = { p0:cur.p.clone(), l0:cur.l.clone(), p1, l1, t0:performance.now(), d:2300, lift:Math.min(10, cur.p.distanceTo(p1)*.12) };
  };
  W.spots = SPOTS;
  W.debug = () => ({ scene, cam, renderer, bird, cur });
})();
