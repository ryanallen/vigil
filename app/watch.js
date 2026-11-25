// The night watch: live cameras on Psyche, wireless bulletins on the night's clock, things found by focusing on them,
// and a descent stop by stop. Everything said and shown comes from the script passed to run(); this file only plays it.
//
// Script shape:
//   start: 'HH:MM'            the night clock at the first beat
//   pace: seconds of real time per night minute
//   cameras: { id: { name, place } }            cameras the player can switch between, once a beat opens them
//   beats: [ { at: 'HH:MM', open?: [camIds], show?: { cam, photo }, cut?: camId, bulletin?: { from, text },
//              until?: { found: revealId } | { cam: camId } | { choose: true } } ]
//   reveals: [ { id, cam, photo?, x, y, r, text } ]     found by holding focus on (x, y) within r, in photo space
//   descent: { first: stopId, stops: { id: { photo, cam, text, choices: [ { label, to } ] } } }
//   endings: { id: { title, text, photo? } }
import { mount as depth } from './depthview.js';

const $ = s => document.querySelector(s);
const media = (n, w) => new URL(`../media/${n}-${w}.webp`, import.meta.url).href;
const depthOf = n => new URL(`../media/${n}-depth.webp`, import.meta.url).href;
const big = () => Math.min(innerWidth, 1600) * Math.min(2, devicePixelRatio || 1) > 1000 ? 1600 : 800;
const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const hhmm = n => `${String(Math.floor(n / 60) % 24).padStart(2, '0')}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function run(S, root) {
  const view = depth(root.querySelector('.cam-canvas'));
  const photoOf = {};                      // camera id -> the photo it shows now
  const open = new Set(), found = new Set();
  let current = null, night = mins(S.start), beat = 0, waiting = null, lastTick = performance.now();

  // ---- Cameras ----------------------------------------------------------------
  const strip = root.querySelector('.cams');
  const label = root.querySelector('.cam-label');
  function drawStrip() {
    strip.innerHTML = [...open].map(id => `<button type="button" data-cam="${id}" aria-pressed="${id === current}">
      <img src="${media(photoOf[id], 800)}" alt=""><span>${S.cameras[id].name}</span></button>`).join('');
  }
  strip.addEventListener('click', e => { const b = e.target.closest('[data-cam]'); if (b) cut(b.dataset.cam); });
  function cut(id) {
    if (!photoOf[id]) return;
    current = id;
    root.classList.remove('cutting'); void root.offsetWidth; root.classList.add('cutting');
    label.innerHTML = `<i></i>${S.cameras[id].place} · ${S.cameras[id].name}`;
    if (view) view.show(media(photoOf[id], big()), depthOf(photoOf[id]));
    else root.querySelector('.cam-fallback').src = media(photoOf[id], big());
    drawStrip();
    if (waiting && waiting.cam === id) advance();
  }

  // ---- Bulletins ----------------------------------------------------------------
  const wire = root.querySelector('.wire');
  function bulletin({ from, text }) {
    const li = document.createElement('li');
    li.innerHTML = `<b>${hhmm(night)} · ${from}</b><span></span>`;
    wire.prepend(li);
    while (wire.children.length > 3) wire.lastChild.remove();
    typeOut(li.querySelector('span'), text);
  }
  function typeOut(el, text) {
    if (still) { el.textContent = text; return; }
    let i = 0; const t = setInterval(() => { i += 2; el.textContent = text.slice(0, i); if (i >= text.length) clearInterval(t); }, 28);
  }

  // ---- Finding things by focus ------------------------------------------------------
  const mark = root.querySelector('.reveal');
  let held = null, heldSince = 0;
  function watchFocus(now) {
    if (!view || !current) return;
    const f = view.focus();
    const r = S.reveals.find(r => !found.has(r.id) && r.cam === current && (!r.photo || r.photo === photoOf[current]) && Math.hypot(f.x - r.x, (f.y - r.y) * 0.5625) < r.r);
    if (!r || !f.settled) { held = null; mark.hidden = true; return; }
    if (held !== r) { held = r; heldSince = now; }
    const k = Math.min(1, (now - heldSince) / 1100);
    mark.hidden = false; mark.style.setProperty('--k', k);
    place(mark, r.x, r.y);
    if (k >= 1) {
      found.add(r.id); held = null; mark.hidden = true;
      const n = document.createElement('p'); n.className = 'note'; place(n, r.x, r.y); root.querySelector('.notes').append(n);
      typeOut(n, r.text);
      setTimeout(() => n.classList.add('kept'), 9000);
      if (waiting && waiting.found === r.id) advance();
    }
  }
  // Photo space to screen: the depth view shows the photo at scale 0.9 of the canvas, cover-fitted.
  function place(el, x, y) {
    const c = root.querySelector('.cam-canvas').getBoundingClientRect(), a = 16 / 9, v = c.width / c.height, m = 0.9;
    const sx = v > a ? m : m * v / a, sy = v > a ? m * a / v : m;
    el.style.left = ((x - 0.5) / sx + 0.5) * 100 + '%'; el.style.top = ((y - 0.5) / sy + 0.5) * 100 + '%';
  }

  // ---- Beats --------------------------------------------------------------------------
  function play(b) {
    if (b.show) { photoOf[b.show.cam] = b.show.photo; if (b.show.cam === current) cut(current); }
    (b.open || []).forEach(id => open.add(id));
    if (b.cut || !current) cut(b.cut || [...open][0]);
    drawStrip();
    if (b.bulletin) bulletin(b.bulletin);
    if (b.descend) descend(S.descent.first);
    waiting = b.until || null;
  }
  function advance() { waiting = null; }
  function tick(now) {
    const dt = (now - lastTick) / 1000; lastTick = now;
    if (!waiting && !descending) {
      night += dt / S.pace;
      while (beat < S.beats.length && mins(S.beats[beat].at) <= night && !waiting && !descending) play(S.beats[beat++]);
    }
    root.querySelector('.clock').textContent = hhmm(night);
    watchFocus(now);
    requestAnimationFrame(tick);
  }

  // ---- The descent ----------------------------------------------------------------------
  let descending = false;
  const choices = root.querySelector('.choices');
  function descend(id) {
    descending = true;
    const stop = S.descent.stops[id];
    if (stop.ending) return end(stop.ending);
    photoOf[stop.cam] = stop.photo; open.clear(); open.add(stop.cam); cut(stop.cam);
    bulletin({ from: stop.from || S.cameras[stop.cam].name, text: stop.text });
    choices.innerHTML = stop.choices.map((c, i) => `<button type="button" data-i="${i}">${c.label}</button>`).join('');
    choices.onclick = e => { const b = e.target.closest('[data-i]'); if (!b) return; choices.innerHTML = ''; setTimeout(() => descend(stop.choices[b.dataset.i].to), still ? 0 : 900); };
  }
  function end(id) {
    const E = S.endings[id];
    root.querySelector('.ending').innerHTML = `<h2>${E.title}</h2><p>${E.text}</p><p class="count">${found.size} of ${S.reveals.length} found</p>`;
    root.classList.add('ended');
  }

  play(S.beats[beat++]);
  requestAnimationFrame(tick);
  return { cut, found };
}
