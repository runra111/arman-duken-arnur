/* All sound is synthesized here (no audio files): the dreamy score of the edit, hits on the cuts, the old-TV
   switch-off / switch-on, a soft ambient bed for the slides and small chimes. */
(function(){
  let ctx = null, master = null, verb = null, verbIn = null, on = true, amb = null, edGain = null;
  const N = n => 440*Math.pow(2, (n - 69)/12);           // midi -> Hz

  function init(){
    if(ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = .9;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    // a long soft reverb made from decaying noise
    verb = ctx.createConvolver(); const len = ctx.sampleRate*3.4, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for(let c = 0; c < 2; c++){ const d = ir.getChannelData(c); for(let i = 0; i < len; i++) d[i] = (Math.random()*2 - 1)*Math.pow(1 - i/len, 2.6); }
    verb.buffer = ir; verbIn = ctx.createGain(); verbIn.gain.value = .55; verbIn.connect(verb); verb.connect(master);
    return true;
  }
  function out(node, wet){ node.connect(master); if(wet){ const g = ctx.createGain(); g.gain.value = wet; node.connect(g); g.connect(verbIn); } }
  function env(g, t, a, d, peak, hold){
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    if(hold) g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + (hold || 0) + d);
  }
  let noiseBuf = null;
  function noise(t, dur, type, f0, f1, peak, a, dest, wet){
    if(!noiseBuf){ noiseBuf = ctx.createBuffer(1, ctx.sampleRate*2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for(let i = 0; i < d.length; i++) d[i] = Math.random()*2 - 1; }
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = type === 'bandpass' ? 1.4 : .7;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); env(g, t, a || .01, Math.max(.02, dur - (a || .01)), peak);
    s.connect(f); f.connect(g); if(dest) g.connect(dest); else out(g, wet || 0);
    s.start(t); s.stop(t + dur + .05);
  }
  // one soft "music box" note
  function bell(t, midi, vol, dest){
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = N(midi); o2.frequency.value = N(midi)*2.003;
    const g2 = ctx.createGain(); g2.gain.value = .25;
    o.connect(g); o2.connect(g2); g2.connect(g); env(g, t, .006, 1.4, vol || .12);
    if(dest) g.connect(dest); else out(g, .7);
    o.start(t); o2.start(t); o.stop(t + 1.6); o2.stop(t + 1.6);
  }
  // a pad chord: detuned saws through a slowly opening low-pass
  function pad(t, notes, dur, vol, dest, cutoff){
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = .8;
    f.frequency.setValueAtTime(cutoff ? cutoff*.5 : 380, t); f.frequency.linearRampToValueAtTime(cutoff || 1300, t + dur*.6);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(1.2, dur*.4));
    g.gain.setValueAtTime(vol, t + dur - .6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + .9);
    f.connect(g); if(dest) g.connect(dest); else out(g, .8);
    notes.forEach(m => [-7, 0, 7].forEach(cents => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = N(m); o.detune.value = cents;
      const og = ctx.createGain(); og.gain.value = .08; o.connect(og); og.connect(f); o.start(t); o.stop(t + dur + 1);
    }));
  }
  function thump(t, f0, f1, dur, vol, dest){
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); env(g, t, .004, dur, vol); o.connect(g); if(dest) g.connect(dest); else out(g, .15); o.start(t); o.stop(t + dur + .05);
  }

  const Sfx = {
    get on(){ return on; },
    get ctx(){ return ctx; },
    unlock(){ if(!init()) return; if(ctx.state !== 'running') ctx.resume(); },
    setOn(v){ on = v; if(ctx) master.gain.setTargetAtTime(v ? .9 : 0, ctx.currentTime, .08); },

    /* the score of the edit; T = seconds of the cut points (from edit.js) */
    score(T){
      if(!ctx) return; const t0 = ctx.currentTime + .05;
      edGain = ctx.createGain(); edGain.gain.value = 1; out(edGain, 0);
      const vg = ctx.createGain(); vg.gain.value = .6; edGain.connect(vg); vg.connect(verbIn);
      const beat = .625;
      // pads: Fmaj7 · Am7 · Dm9 · Bbmaj7 (then a held C for the question)
      const chords = [[53, 57, 60, 64], [57, 60, 64, 67], [50, 53, 57, 60, 64], [46, 50, 53, 57]];
      chords.forEach((c, i) => pad(t0 + i*2.5*1.4, c, 2.5*1.4 + .4, .09, edGain, 1500));
      pad(t0 + T.F, [48, 55, 60, 64], 4.2, .07, edGain, 900);
      // music box arpeggio over everything until the question
      const arp = [[65, 69, 72, 76], [69, 72, 76, 79], [62, 65, 69, 72, 76], [70, 74, 77, 81]];
      for(let k = 0, t = 0; t < T.F - .3; k++, t = k*beat/2){
        const ch = arp[Math.min(3, Math.floor(t/(2.5*1.4)))]; const n = ch[(k*3 + (k >> 2)) % ch.length] + (k % 8 === 7 ? 12 : 0);
        bell(t0 + t, n, k % 4 === 0 ? .1 : .055, edGain);
      }
      // the cuts
      noise(t0 + T.B - 1.1, 1.1, 'bandpass', 300, 5200, .22, 1.0, edGain);                // riser into "АРМАН"
      [0, 1, 2, 3, 4].forEach(i => {                                                         // the five painted letters
        const t = t0 + T.B + i*T.step; thump(t, 140, 48, .35, .7, edGain); noise(t, .12, 'lowpass', 2400, 400, .35, .002, edGain);
      });
      if(T.C < T.F){                                                                         // the 3D shots (cut for now)
        noise(t0 + T.C, .5, 'highpass', 900, 7000, .28, .005, edGain); thump(t0 + T.C, 90, 30, .9, .8, edGain);
        for(let i = 0; i < 6; i++) noise(t0 + T.C + .05 + i*.07, .04, 'bandpass', 3000 + i*500, 6000, .12, .002, edGain);
        thump(t0 + T.D, 70, 28, 1.4, .9, edGain); noise(t0 + T.D, 1.2, 'lowpass', 1800, 200, .18, .01, edGain);
      }
      for(let i = 0; i < 10; i++) bell(t0 + T.E + i*.09, 84 + [0, 4, 7, 11, 12, 16, 19, 23, 24, 28][i], .05, edGain);       // sparkle cascade
      noise(t0 + T.F - 1.6, 1.6, 'bandpass', 6000, 400, .16, 1.5, edGain);                  // reverse swell into the question
      thump(t0 + T.F, 55, 30, 2.2, .6, edGain);
    },
    stamp(v){                                    // one painted letter hitting the paper
      if(!ctx || !on) return; const t = ctx.currentTime, k = v == null ? 1 : v;
      thump(t, 150, 50, .28, .45*k, edGain); noise(t, .09, 'lowpass', 2600, 500, .22*k, .002, edGain);
    },
    stopScore(fade){ if(!ctx || !edGain) return; edGain.gain.setTargetAtTime(0.0001, ctx.currentTime, (fade || .3)/3); },

    crtOff(){                                    // static, a falling whine, a thump, the high hum of the dot
      if(!ctx || !on) return; const t = ctx.currentTime;
      noise(t, .62, 'bandpass', 1500, 6500, .3, .25);
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(7000, t + .62); o.frequency.exponentialRampToValueAtTime(180, t + .95);
      const g = ctx.createGain(); env(g, t + .62, .01, .36, .16); o.connect(g); out(g); o.start(t + .62); o.stop(t + 1.1);
      thump(t + .95, 90, 35, .45, .8);
      const w = ctx.createOscillator(); w.type = 'sine'; w.frequency.value = 15000; const wg = ctx.createGain(); env(wg, t + 1.0, .01, .7, .03); w.connect(wg); out(wg); w.start(t + 1); w.stop(t + 1.8);
    },
    crtOn(){                                     // the reverse: a dot, a rising whine, the picture blooms open
      if(!ctx || !on) return; const t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(5200, t + .5);
      const g = ctx.createGain(); env(g, t, .02, .5, .1); o.connect(g); out(g, .3); o.start(t); o.stop(t + .6);
      noise(t + .35, .9, 'bandpass', 500, 7000, .14, .3, null, .6);
      [72, 76, 79, 84, 88].forEach((m, i) => bell(t + .5 + i*.07, m, .07));
    },
    whoosh(){ if(!ctx || !on) return; const t = ctx.currentTime; noise(t, 1.1, 'bandpass', 300, 2600, .09, .45, null, .5); },
    chime(i){ if(!ctx || !on) return; const t = ctx.currentTime; const s = [[72, 79], [74, 81], [76, 83], [77, 84], [79, 86], [81, 88]][i % 6]; bell(t + .25, s[0], .06); bell(t + .36, s[1], .05); },
    sparkle(){ if(!ctx || !on) return; const t = ctx.currentTime; for(let i = 0; i < 5; i++) bell(t + i*.05, 88 + [0, 3, 7, 10, 12][i], .035); },

    /* the bed under the slides: slow chords and a few music-box notes, quiet */
    ambient(){
      if(!ctx || amb) return; amb = { g:ctx.createGain(), timer:0 }; amb.g.gain.value = 0; out(amb.g, 0);
      const vg = ctx.createGain(); vg.gain.value = .9; amb.g.connect(vg); vg.connect(verbIn);
      amb.g.gain.setTargetAtTime(.55, ctx.currentTime, 1.5);
      const prog = [[53, 57, 60, 64], [50, 53, 57, 62], [46, 50, 53, 57], [48, 52, 55, 60]];
      const mel = [[72, 76, 79], [69, 74, 77], [70, 74, 77], [72, 76, 79, 84]];
      let k = 0, next = ctx.currentTime + .1;
      const tick = () => {
        while(next < ctx.currentTime + 1.5){
          const c = k % 4; pad(next, prog[c], 6.4, .045, amb.g, 900);
          for(let j = 0; j < 4; j++) if(Math.random() < .7) bell(next + .8 + j*1.4 + Math.random()*.3, mel[c][(Math.random()*mel[c].length) | 0], .035, amb.g);
          next += 6.4; k++;
        }
      };
      tick(); amb.timer = setInterval(tick, 500);
    }
  };
  window.Sfx = Sfx;
})();
