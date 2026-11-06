/* Shared 3D pieces: loading the user's models, materials, the waterfall, the phoenix, the hologram head. */
(function(){
  const M = window.Models = {};
  const bufs = {};
  // fetch each file once; parse a fresh copy for every scene that needs one (a skinned dragon can't be in two scenes)
  M.gltf = url => {
    if(!bufs[url]) bufs[url] = fetch(url).then(r => { if(!r.ok) throw new Error(url + ' ' + r.status); return r.arrayBuffer(); });
    return bufs[url].then(b => new Promise((res, rej) => new THREE.GLTFLoader().parse(b, '', res, rej)));
  };
  M.prefetch = urls => urls.forEach(u => { if(!bufs[u]) bufs[u] = fetch(u).then(r => r.arrayBuffer()); });

  M.normalize = (obj, size, axis) => {        // centre on the origin and scale the largest side (or a given axis) to `size`
    obj.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(obj), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    const k = size/(axis ? s[axis] : Math.max(s.x, s.y, s.z));
    obj.scale.multiplyScalar(k); obj.position.sub(c.multiplyScalar(k));
    const g = new THREE.Group(); g.add(obj); return g;
  };

  // the dragon's bones are in other units than its mesh: measure the posed (skinned) shape and fit that
  M.fitSkinned = (obj, size) => {
    const holder = new THREE.Group(); holder.add(obj); holder.updateMatrixWorld(true);
    const b = new THREE.Box3(), v = new THREE.Vector3();
    obj.traverse(o => { if(!o.isSkinnedMesh) return; o.skeleton.update(); const p = o.geometry.attributes.position;
      for(let i = 0; i < p.count; i += 23){ v.fromBufferAttribute(p, i); o.boneTransform(i, v); v.applyMatrix4(o.matrixWorld); b.expandByPoint(v); } });
    if(b.isEmpty()) return M.normalize(obj, size);
    const s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3()), k = size/Math.max(s.x, s.y, s.z);
    obj.scale.multiplyScalar(k); obj.position.sub(c.multiplyScalar(k));
    return holder;
  };

  // the phoenix: feathers are cut out by the texture's alpha, the glow map makes it shine
  M.firebird = (url) => M.gltf(url || 'assets/models/phoenix.glb').then(g => {
    const d = g.scene;
    d.traverse(o => { if(!o.isMesh) return; o.frustumCulled = false; const m = o.material; if(!m) return;
      m.transparent = false; m.alphaTest = .45; m.side = THREE.DoubleSide; m.roughness = .55; m.metalness = 0;
      if(m.emissiveMap){ m.emissive = new THREE.Color('#ffffff'); m.emissiveIntensity = 1.4; } m.needsUpdate = true; });
    const clip = g.animations[0];
    if(clip) clip.tracks = clip.tracks.filter(t => !/b_Root\.position/i.test(t.name));     // fly in place; the path moves the bird
    const mix = new THREE.AnimationMixer(d); if(clip) mix.clipAction(clip).play(); mix.update(.01);
    return { obj:d, mix };
  });

  /* ---- textures drawn on canvases ---- */
  let _cloud = null, _dot = null;
  M.cloudTex = () => {
    if(_cloud) return _cloud;
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    const blob = (cx, cy, r, a) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, 'rgba(255,255,255,' + a + ')'); g.addColorStop(.6, 'rgba(255,255,255,' + a*.55 + ')'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); };
    blob(128, 140, 110, .55); for(let i = 0; i < 14; i++){ const a = Math.random()*Math.PI*2, d = Math.random()*55; blob(128 + Math.cos(a)*d*1.3, 128 + Math.sin(a)*d*.6 - 10, 38 + Math.random()*40, .5); }
    _cloud = new THREE.CanvasTexture(c); return _cloud;
  };
  M.dotTex = () => {
    if(_dot) return _dot;
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); _dot = new THREE.CanvasTexture(c); return _dot;
  };

  // dreamier rock: greys and browns drift towards lavender (top) and coral-peach (bottom); green grass stays green
  M.pastel = geo => {
    const c = geo.attributes.color, p = geo.attributes.position; geo.computeBoundingBox();
    const y0 = geo.boundingBox.min.y, y1 = geo.boundingBox.max.y, col = new THREE.Color(), hsl = {};
    const top = new THREE.Color('#8f6ee8').convertSRGBToLinear(), mid = new THREE.Color('#ff6f9f').convertSRGBToLinear(), bot = new THREE.Color('#ff8a55').convertSRGBToLinear(), tint = new THREE.Color();
    for(let i = 0; i < c.count; i++){
      col.setRGB(c.getX(i), c.getY(i), c.getZ(i)); col.getHSL(hsl);
      const k = (p.getY(i) - y0)/(y1 - y0 || 1);
      tint.copy(k > .5 ? mid : bot).lerp(k > .5 ? top : mid, k > .5 ? (k - .5)*2 : k*2);
      const green = hsl.h > .15 && hsl.h < .45 && hsl.s > .25;
      if(green) col.offsetHSL(0, .15, .05); else col.lerp(tint, .72);
      c.setXYZ(i, Math.min(1, col.r), Math.min(1, col.g), Math.min(1, col.b));
    }
    c.needsUpdate = true;
  };

  // the fairy island's plain white stone gets painted facets: a lilac-to-rose gradient with a little variation per face
  M.facet = (o, light) => {
    if(o.userData.faceted) return; o.userData.faceted = true;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry; o.geometry = g;
    g.computeBoundingBox(); g.computeVertexNormals();
    const p = g.attributes.position, n = p.count, col = new Float32Array(n*3), c = new THREE.Color();
    // faces looking up become grass, the cliffs are violet-to-coral stone, the underside a deep plum
    const grass = new THREE.Color('#6fd34f'), grass2 = new THREE.Color('#b6e85a');
    const top = new THREE.Color(light > .9 ? '#9b7cf0' : '#7d5fd6'), mid = new THREE.Color('#ff7fae'), bot = new THREE.Color('#5a3a9e');
    const y0 = g.boundingBox.min.y, y1 = g.boundingBox.max.y, a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3(), nrm = new THREE.Vector3();
    for(let f = 0; f < n; f += 3){
      a.fromBufferAttribute(p, f); b.fromBufferAttribute(p, f + 1); d.fromBufferAttribute(p, f + 2);
      nrm.fromBufferAttribute(g.attributes.normal, f);          // non-indexed: this is the face's own normal
      const y = (a.y + b.y + d.y)/3, k = (y - y0)/(y1 - y0 || 1);
      if(nrm.y > .72 && k > .45) c.copy(grass).lerp(grass2, Math.random()*.6);
      else if(k > .5) c.copy(mid).lerp(top, (k - .5)*2);
      else c.copy(bot).lerp(mid, k*2);
      c.offsetHSL((Math.random() - .5)*.03, 0, (Math.random() - .5)*.1);
      c.convertSRGBToLinear();                                   // vertex colours are linear; the picked hex colours are sRGB
      for(let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (f + j)*3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  };

  /* ---- the islands from the user's .blend files: give them proper materials ---- */
  M.fixIsland = (root, kind) => {
    root.traverse(o => {
      if(!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const out = mats.map(m => {
        const col = m.color ? m.color.clone() : new THREE.Color('#fff');
        const vc = !!o.geometry.attributes.color;
        if(kind === 'low' && m.name === 'Material.001'){                                         // the river and its fall
          o.userData.water = true;
          return new THREE.MeshStandardMaterial({ color:'#62c9ff', emissive:'#1d86c9', emissiveIntensity:.3, roughness:.15, metalness:.1, transparent:true, opacity:.88, flatShading:true });
        }
        if(kind === 'low' && m.name === 'Material.009'){                                         // a flat cloud ring under the island
          return new THREE.MeshStandardMaterial({ color:'#fff4fb', emissive:'#ffd6ec', emissiveIntensity:.25, roughness:1, transparent:true, opacity:.9, flatShading:true });
        }
        if(vc && !o.userData.pastel){ M.pastel(o.geometry); o.userData.pastel = true; }
        if(!vc && kind === 'low'){ const hsl = {}; col.getHSL(hsl); col.setHSL(hsl.h, Math.min(1, hsl.s*1.1), Math.max(hsl.l, hsl.s > .5 && hsl.h > .2 && hsl.h < .45 ? .22 : .2)); }
        const mm = new THREE.MeshStandardMaterial({ color:vc ? new THREE.Color('#fff') : col, vertexColors:vc, roughness:.85, metalness:0, flatShading:true });
        if(kind === 'fairy'){                                                                     // white stone turns lilac, crystals glow a little
          const hsl = {}; col.getHSL(hsl);
          if(hsl.s < .12){ M.facet(o, hsl.l); mm.vertexColors = true; mm.color.set('#ffffff'); }
          else if(hsl.h > .5 && hsl.h < .85){ mm.emissive = col.clone(); mm.emissiveIntensity = .3; mm.roughness = .4; }
        }
        return mm;
      });
      o.material = Array.isArray(o.material) ? out : out[0];
      o.castShadow = o.receiveShadow = false;
    });
    return root;
  };

  /* ---- waterfall: a scrolling ribbon that always turns to the camera, with mist at the bottom ---- */
  const fallMat = () => new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, side:THREE.DoubleSide,
    uniforms:{ time:{ value:0 }, op:{ value:1 } },
    vertexShader:'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader:`varying vec2 vUv; uniform float time, op;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        float x = vUv.x, y = vUv.y;
        float s = n(vec2(x*14., y*5. + time*3.2))*.6 + n(vec2(x*31., y*9. + time*4.6))*.4;
        float edge = smoothstep(0., .22, x)*smoothstep(1., .78, x);
        float top = smoothstep(1., .96, y), bot = smoothstep(0., .35, y);
        vec3 c = mix(vec3(.62,.9,1.), vec3(1.), smoothstep(.45, .85, s));
        float a = (.28 + .5*smoothstep(.3, .9, s))*edge*top*bot*op;
        gl_FragColor = vec4(c, a);
      }`
  });
  M.makeFall = (height, width) => {
    const g = new THREE.Group();
    const geo = new THREE.PlaneGeometry(width, height, 1, 1); geo.translate(0, -height/2, 0);
    const mat = fallMat(), rib = new THREE.Mesh(geo, mat); g.add(rib);
    const mist = [];
    for(let i = 0; i < 5; i++){
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:M.cloudTex(), color:'#ffffff', transparent:true, depthWrite:false, opacity:.75 }));
      sp.position.set((Math.random() - .5)*width*1.4, -height + Math.random()*width*.6, (Math.random() - .5)*width*.6);
      const s = width*(2.2 + Math.random()*1.6); sp.scale.set(s, s*.7, 1); sp.userData.ph = Math.random()*6; sp.userData.s = s; g.add(sp); mist.push(sp);
    }
    // drops leaving the lip
    const n = 140, pos = new Float32Array(n*3), seed = new Float32Array(n);
    for(let i = 0; i < n; i++){ seed[i] = Math.random(); pos[i*3] = (Math.random() - .5)*width; pos[i*3 + 2] = (Math.random() - .5)*width*.3; }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(pg, new THREE.PointsMaterial({ map:M.dotTex(), size:width*.12, color:'#e8fbff', transparent:true, depthWrite:false, opacity:.9 }));
    g.add(pts);
    const v = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler();
    g.userData.update = (t, cam) => {
      mat.uniforms.time.value = t;
      g.getWorldPosition(v); const dx = cam.position.x - v.x, dz = cam.position.z - v.z;     // turn around the vertical axis only
      g.getWorldQuaternion(q); e.setFromQuaternion(q, 'YXZ');
      rib.rotation.y = Math.atan2(dx, dz) - e.y;
      mist.forEach(s => { const k = .5 + .5*Math.sin(t*.8 + s.userData.ph); s.material.opacity = .45 + .35*k; s.scale.set(s.userData.s*(1 + .12*k), s.userData.s*.7*(1 + .12*k), 1); });
      for(let i = 0; i < n; i++){ const k = (seed[i] + t*.35) % 1; pos[i*3 + 1] = -k*k*height*.9; }
      pg.attributes.position.needsUpdate = true;
    };
    return g;
  };

  /* ---- the hologram head with the point-cloud skull (edit + "Қалаған түс" card) ---- */
  M.skull = (() => { let p = null; return () => p || (p = fetch('assets/models/skull.bin').then(r => r.arrayBuffer()).then(b => {
    const n = new DataView(b).getUint32(0, true), q = new Int16Array(b, 4, n*3), pos = new Float32Array(n*3);
    for(let i = 0; i < n; i++){ pos[i*3] = q[i*3]/32767; pos[i*3 + 1] = q[i*3 + 2]/32767; pos[i*3 + 2] = -q[i*3 + 1]/32767; }   // Z-up scan -> Y-up
    return { n, pos };
  })); })();

  M.holoMat = (col, amp) => new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
    uniforms:{ col:{ value:new THREE.Color(col || '#6fb0ff') }, time:{ value:0 }, amp:{ value:amp == null ? 1 : amp } },
    vertexShader:`varying vec3 vN, vV; varying float vY; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vY = (modelMatrix*vec4(position,1.)).y; gl_Position = projectionMatrix*mv; }`,
    fragmentShader:`uniform vec3 col; uniform float time, amp; varying vec3 vN, vV; varying float vY;
      void main(){ float f = pow(1. - abs(dot(normalize(vN), normalize(vV))), 2.); float scan = smoothstep(.0, .9, sin(vY*38. - time*5.));
        gl_FragColor = vec4(col*(f*1.3 + .05 + scan*.05*f) + vec3(.8,.9,1.)*pow(f,5.)*.6, 1.)*amp; }`
  });
  M.pointsMat = (size, extra) => new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    uniforms:Object.assign({ time:{ value:0 }, size:{ value:size }, morph:{ value:0 }, amp:{ value:1 }, spin:{ value:0 } }, extra || {}),
    vertexShader:`attribute vec3 tgt; attribute float rnd; uniform float time, size, morph, spin; varying vec3 vC; varying float vA;
      vec3 hsv(float h){ return clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.); }
      void main(){
        float m = smoothstep(rnd*.45, rnd*.45 + .55, morph);
        vec3 p = mix(position, tgt, m);
        float a = spin*(1. + max(0., 2.-length(tgt.xz))*.4)*m; p.xz = mat2(cos(a), -sin(a), sin(a), cos(a))*p.xz;
        p += vec3(sin(time*1.3 + rnd*40.), cos(time*1.1 + rnd*30.), sin(time*.9 + rnd*20.))*.012*(1. + m*3.);
        vec3 skull = mix(vec3(1.,.28,.42), vec3(1.,.62,.75), smoothstep(-.6,.8,position.y));
        vec3 dream = mix(hsv(fract(atan(tgt.z, tgt.x)/6.2832 + rnd*.15)), vec3(1.), .35);
        vC = mix(skull, dream, m); vA = (.55 + .45*sin(time*3. + rnd*60.))*(1. - m*.62);
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_PointSize = size*(1. + m*.8)/-mv.z; gl_Position = projectionMatrix*mv; }`,
    fragmentShader:`uniform float amp; varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord - .5; float r = length(d); if(r > .5) discard; gl_FragColor = vec4(vC*(1. - r*2.)*vA*amp, 1.); }`
  });
  M.skullPoints = (sk, size, every) => {
    const step = every || 1, n = Math.floor(sk.n/step), pos = new Float32Array(n*3), tgt = new Float32Array(n*3), rnd = new Float32Array(n);
    for(let i = 0; i < n; i++){
      const j = i*step; pos[i*3] = sk.pos[j*3]; pos[i*3 + 1] = sk.pos[j*3 + 1]; pos[i*3 + 2] = sk.pos[j*3 + 2];
      const r = Math.pow(Math.random(), .6)*3.6, arm = (i % 3)*2.094, a = arm + r*1.25 + (Math.random() - .5)*.5;   // a three-armed swirl
      tgt[i*3] = Math.cos(a)*r; tgt[i*3 + 1] = (Math.random() - .5)*.16*(3.8 - r); tgt[i*3 + 2] = Math.sin(a)*r; rnd[i] = Math.random();
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('tgt', new THREE.BufferAttribute(tgt, 3)); g.setAttribute('rnd', new THREE.BufferAttribute(rnd, 1));
    return new THREE.Points(g, M.pointsMat(size));
  };
  M.hologram = (head, sk, opts) => {          // head: a parsed gltf scene; sk: skull data
    const o = opts || {}, g = new THREE.Group(), mat = M.holoMat(o.col, o.amp);
    head.traverse(m => { if(m.isMesh){ m.material = mat; } });
    const h = M.normalize(head, 2.2, 'y'); g.add(h);
    const pts = M.skullPoints(sk, o.size || 9, o.every || 1); pts.rotation.y = Math.PI; pts.scale.setScalar(o.skull || .57); pts.position.set(0, o.skullY == null ? .44 : o.skullY, o.skullZ == null ? -.02 : o.skullZ); g.add(pts);
    g.userData = { mat, pts };
    return g;
  };

  /* ---- a ringed planet for the "space" card ---- */
  M.planet = () => {
    const g = new THREE.Group();
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d');
    const bands = ['#ffb48a', '#ff8fb8', '#ffd59a', '#c99bff', '#ff9e7a', '#ffe0b0', '#b58cff'];
    for(let y = 0; y < 256; y += 4){ x.fillStyle = bands[Math.floor((y + Math.sin(y*.09)*14)/22) % bands.length]; x.globalAlpha = .9; x.fillRect(0, y, 512, 5); }
    x.globalAlpha = .25; for(let i = 0; i < 60; i++){ x.fillStyle = Math.random() < .5 ? '#fff' : '#6a3fb0'; x.beginPath(); x.ellipse(Math.random()*512, Math.random()*256, 20 + Math.random()*60, 2 + Math.random()*5, 0, 0, 7); x.fill(); }
    const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
    const p = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshStandardMaterial({ map:tex, roughness:.8 })); g.add(p);
    const rc = document.createElement('canvas'); rc.width = 256; rc.height = 4; const rx = rc.getContext('2d');
    for(let i = 0; i < 256; i++){ rx.fillStyle = 'rgba(255,' + (200 + Math.random()*55 | 0) + ',' + (190 + Math.random()*60 | 0) + ',' + (Math.random()*.7 + .15)*(i > 20 && i < 250 ? 1 : 0) + ')'; rx.fillRect(i, 0, 1, 4); }
    const rt = new THREE.CanvasTexture(rc);
    const rg = new THREE.RingGeometry(1.35, 2.3, 96, 1), uv = rg.attributes.uv, pa = rg.attributes.position;
    for(let i = 0; i < uv.count; i++){ const r = Math.hypot(pa.getX(i), pa.getY(i)); uv.setXY(i, (r - 1.35)/(2.3 - 1.35), .5); }
    const ring = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ map:rt, transparent:true, side:THREE.DoubleSide, depthWrite:false }));
    ring.rotation.x = -Math.PI/2 + .35; ring.rotation.y = .2; g.add(ring);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(.16, 20, 16), new THREE.MeshStandardMaterial({ color:'#e8e2ff', roughness:.9 })); g.add(moon);
    // stars
    const n = 300, sp = new Float32Array(n*3); for(let i = 0; i < n; i++){ const v = new THREE.Vector3().randomDirection ? new THREE.Vector3().randomDirection() : new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize(); v.multiplyScalar(8 + Math.random()*4); sp.set([v.x, v.y, v.z], i*3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    g.add(new THREE.Points(sg, new THREE.PointsMaterial({ map:M.dotTex(), size:.18, color:'#fff', transparent:true, depthWrite:false })));
    g.userData.update = t => { p.rotation.y = t*.25; moon.position.set(Math.cos(t*.7)*2.7, Math.sin(t*.7)*.5, Math.sin(t*.7)*2.7); };
    return g;
  };
})();
