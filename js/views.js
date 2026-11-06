/* The product "pictures" on slides 3 and 4 are small live 3D scenes. One transparent canvas lies over the slides and
   each scene is drawn inside the rectangle of its [data-view] box; the object grows in when its card appears. */
(function(){
  const V = window.Views = {};
  const canvas = document.getElementById('views');
  let renderer = null, running = false, t = 0, last = 0, built = false;
  const scenes = {};             // name -> { scene, cam, obj, update }
  const state = new WeakMap();   // element -> { a: appear 0..1 }

  function lights(s, warm){
    s.add(new THREE.HemisphereLight(warm ? '#ffe9d6' : '#dcd2ff', '#ff9fc4', .8));
    const d = new THREE.DirectionalLight('#fff4e0', 1.3); d.position.set(3, 5, 4); s.add(d);
    const r = new THREE.DirectionalLight('#9fd8ff', .7); r.position.set(-4, 2, -3); s.add(r);
  }
  function mk(name, build){
    const s = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, .8, .05, 200);
    const o = { scene:s, cam, obj:new THREE.Group(), update:null, dist:6, y:0 }; s.add(o.obj); scenes[name] = o;
    build(o).catch(e => console.warn('view ' + name, e));
  }

  function build(){
    if(built) return; built = true;
    mk('bird', async o => {
      lights(o.scene, true);
      const b = await Models.firebird();
      o.obj.add(Models.fitSkinned(b.obj, 3.6)); o.dist = 7; o.y = 0;
      o.update = dt => { b.mix.update(dt); o.obj.rotation.y = .9 + Math.sin(t*.4)*.35; o.obj.position.y = Math.sin(t*1.6)*.12; };
    });
    mk('island', async o => {
      lights(o.scene);
      const g = await Models.gltf('assets/models/fairy-island.glb');
      o.obj.add(Models.normalize(Models.fixIsland(g.scene, 'fairy'), 3)); o.dist = 4.6;
      o.update = () => { o.obj.rotation.y = t*.35; o.obj.position.y = Math.sin(t*1.2)*.08; };
    });
    mk('fall', async o => {
      lights(o.scene, true);
      const g = await Models.gltf('assets/models/low-island.glb');
      const isl = Models.normalize(Models.fixIsland(g.scene, 'low'), 3); o.obj.add(isl); isl.position.y += .6;
      // the river's lowest point in the island's own space, so the fall stays glued to it however the card scales
      isl.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(isl.matrixWorld).invert(); let lip = null;
      isl.traverse(m => { if(m.isMesh && m.userData.water){ const p = m.geometry.attributes.position, v = new THREE.Vector3(); for(let i = 0; i < p.count; i++){ v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); if(!lip || v.y < lip.y) lip = v.clone(); } } });
      if(lip){ lip.applyMatrix4(inv); const f = Models.makeFall(2.2, .3); f.position.copy(lip).add(new THREE.Vector3(0, .05, .03)); isl.add(f); o.fall = f; }
      o.dist = 8; o.y = -.2;
      o.update = () => { o.obj.rotation.y = -.5 + Math.sin(t*.3)*.6; if(o.fall) o.fall.userData.update(t, o.cam); };
    });
    mk('dream', async o => {
      const [g, sk] = await Promise.all([Models.gltf('assets/models/head.glb'), Models.skull()]);
      const h = Models.hologram(g.scene, sk, { size:5, every:3, col:'#7fb4ff' }); o.obj.add(h); o.dist = 6.4; o.y = .1;
      o.update = () => { h.userData.mat.uniforms.time.value = t; h.userData.pts.material.uniforms.time.value = t; o.obj.rotation.y = Math.sin(t*.5)*.7; };
    });
    mk('space', async o => {
      o.scene.add(new THREE.AmbientLight('#8070c0', .35)); const d = new THREE.DirectionalLight('#ffe0c0', 2.2); d.position.set(4, 2, 3); o.scene.add(d);
      const p = Models.planet(); o.obj.add(p); o.dist = 9; o.y = 0;
      o.update = () => { p.userData.update(t); o.obj.rotation.x = .15; };
    });
  }

  function frame(now){
    requestAnimationFrame(frame);
    if(!running || !renderer) return;
    const dt = Math.min(.05, (now - (last || now))/1000); last = now; t += dt;
    const w = innerWidth, h = innerHeight, pr = renderer.getPixelRatio();
    renderer.setScissorTest(false); renderer.clear();
    const els = document.querySelectorAll('.slide.is-active [data-view], .slide.is-leaving [data-view]');
    const done = new Set();
    els.forEach(el => {
      const v = scenes[el.dataset.view]; if(!v) return;
      const box = el.closest('[data-r]') || el, op = +getComputedStyle(box).opacity, leaving = !!el.closest('.slide.is-leaving');
      let st = state.get(el); if(!st){ st = { a:0 }; state.set(el, st); }
      st.a += ((op > .35 && !leaving ? 1 : 0) - st.a)*(leaving ? .25 : .07);
      if(st.a < .01) return;
      const r = el.getBoundingClientRect(); if(r.bottom < 0 || r.top > h || r.width < 4) return;
      if(!done.has(v)){ if(v.update) v.update(dt); done.add(v); }
      const k = st.a, s = k < 1 ? 1 + 2.4*Math.pow(k - 1, 3) + 1.4*Math.pow(k - 1, 2) : 1;        // ease-out-back
      v.obj.scale.setScalar(Math.max(.001, s));
      v.cam.aspect = r.width/r.height; v.cam.position.set(0, v.y + .6, v.dist*(r.width/r.height < .9 ? 1.15 : 1)); v.cam.lookAt(0, v.y, 0); v.cam.updateProjectionMatrix();
      const x = r.left, y = h - r.bottom;
      renderer.setViewport(x, y, r.width, r.height); renderer.setScissor(x, y, r.width, r.height); renderer.setScissorTest(true);
      renderer.render(v.scene, v.cam);
    });
    renderer.setScissorTest(false);
  }

  V.start = () => {
    if(!renderer){
      renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
      renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.autoClear = false;
      renderer.setClearColor(0x000000, 0);
      const size = () => { renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75)); renderer.setSize(innerWidth, innerHeight, false); };
      size(); addEventListener('resize', size); build(); requestAnimationFrame(frame);
    }
    running = true; last = 0;
  };
  V.stop = () => { running = false; if(renderer){ renderer.setScissorTest(false); renderer.clear(); } };
  V.warm = () => { if(!renderer) { V.start(); V.stop(); } };
})();
