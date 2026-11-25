// The air in front of a photograph: drifting dust, the drill's spray while it runs, a billowing plume when the bearing
// fails, haze settling after, and the work lights breathing. One 2D canvas over the photo; nothing loads.
// mount(canvas) → { set(state) }. Positions are fractions of the frame, read off the Shaft 3 photographs.

const HEAD = [0.585, 0.56];   // where Drill 7's head meets the ground
const LIGHTS = [[0.52, 0.58], [0.63, 0.57], [0.57, 0.62], [0.66, 0.62]]; // the crew's work lights

export function mount(canvas) {
  const g = canvas.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, state = 'seized', since = performance.now(), raf = 0, visible = true, last = 0;
  const motes = [], puffs = [];
  // One soft puff and one light glow, drawn once and stamped many times: far cheaper than a gradient per puff.
  const sprite = (inner, outer) => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const rg = x.createRadialGradient(64, 64, 0, 64, 64, 64); rg.addColorStop(0, inner); rg.addColorStop(0.45, outer); rg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = rg; x.fillRect(0, 0, 128, 128); return c; };
  const DUST = sprite('rgba(150,146,140,1)', 'rgba(150,146,140,.35)'), GLOW = sprite('rgba(255,236,200,1)', 'rgba(255,236,200,.25)');
  const rnd = (a, b) => a + Math.random() * (b - a);

  const resize = () => {
    const r = Math.min(2, devicePixelRatio || 1);
    W = Math.round(canvas.clientWidth * r); H = Math.round(canvas.clientHeight * r);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  };
  // Dust motes at three depths: near ones big, soft and fast; far ones small and slow.
  for (let i = 0; i < 70; i++) motes.push({ x: Math.random(), y: Math.random(), z: Math.random() ** 2, p: Math.random() * 6.28 });

  function puff(x, y, size, rise, life, shade) {
    puffs.push({ x, y, r: size, vx: rnd(-0.004, 0.004), vy: -rise * rnd(0.6, 1.2), grow: rnd(0.02, 0.05), life, age: 0, shade });
  }

  function step(dt, now) {
    const t = (now - since) / 1000;
    // Sources by state.
    if (state === 'running' || state === 'cleared') {
      if (Math.random() < dt * 9) puff(HEAD[0] + rnd(-0.02, 0.02), HEAD[1], rnd(0.008, 0.016), 0.025, rnd(2.5, 4), 150);
    }
    if (state === 'failed') {
      const k = Math.max(0, 1 - t / 6); // a burst that eases off over six seconds
      if (puffs.length < 260 && Math.random() < dt * (110 * k + 10)) puff(HEAD[0] + rnd(-0.05, 0.05), HEAD[1] + rnd(-0.03, 0.02), rnd(0.01, 0.03), 0.04 + 0.1 * k * Math.random(), rnd(4, 8), 0);
    }
    if (state === 'closed' && Math.random() < dt * 2) puff(HEAD[0] + rnd(-0.12, 0.12), HEAD[1] + rnd(-0.04, 0.02), rnd(0.03, 0.06), 0.004, rnd(6, 10), 150);
    if (state === 'seized' && Math.random() < dt * 0.8) puff(HEAD[0] + rnd(-0.02, 0.02), HEAD[1], rnd(0.01, 0.02), 0.006, rnd(4, 6), 140);

    for (const p of puffs) { p.age += dt; p.x += (p.vx + Math.sin(p.age * 1.3 + p.y * 40) * 0.004) * dt; p.y += p.vy * dt; p.vy *= 1 - dt * 0.4; p.r += p.grow * dt; }
    for (let i = puffs.length - 1; i >= 0; i--) if (puffs[i].age > puffs[i].life) puffs.splice(i, 1);
    for (const m of motes) {
      m.x += (0.004 + m.z * 0.012) * dt; m.y += Math.sin(now / 2400 + m.p) * 0.0009 * dt * 60 * 0.016;
      if (m.x > 1.05) { m.x = -0.05; m.y = Math.random(); }
    }
  }

  function draw(now) {
    g.clearRect(0, 0, W, H);
    // Work lights breathe a little while the crew is at the drill.
    if (['fitted', 'hot', 'out', 'running'].includes(state)) {
      g.globalCompositeOperation = 'lighter';
      LIGHTS.forEach(([x, y], i) => { const r = W * 0.05; g.globalAlpha = 0.05 + 0.025 * Math.sin(now / 700 + i * 1.7); g.drawImage(GLOW, x * W - r, y * H - r, r * 2, r * 2); });
      g.globalCompositeOperation = 'source-over';
    }
    // Dust and spray: soft puffs, fading in and out over their life.
    for (const p of puffs) {
      const k = p.age / p.life, r = p.r * W;
      g.globalAlpha = Math.sin(Math.PI * Math.min(1, k)) * 0.22;
      g.drawImage(DUST, p.x * W - r, p.y * H - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
    // Motes: tiny lit specks; near ones larger and fainter, as if out of focus.
    for (const m of motes) {
      const r = (0.6 + m.z * 3.2) * (W / 1400), a = 0.18 + (1 - m.z) * 0.22;
      g.fillStyle = `rgba(235,232,224,${a * (0.6 + 0.4 * Math.sin(now / 900 + m.p))})`;
      g.beginPath(); g.arc(m.x * W, m.y * H, r, 0, 6.283); g.fill();
    }
  }

  function frame(now) {
    raf = 0;
    if (!visible || document.hidden) return;
    resize();
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    step(dt, now); draw(now);
    raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!still && !raf) { last = 0; raf = requestAnimationFrame(frame); } };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }).observe(canvas);
  document.addEventListener('visibilitychange', kick);
  kick();
  return { set(s) { if (s !== state) { state = s; since = performance.now(); } kick(); } };
}
