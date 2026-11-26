// The night watch. One live camera fills the screen: a photograph that moves in depth with the pointer and racks focus
// to what you point at. Pictures and wireless bulletins arrive on the night's clock; some details can only be read by
// holding focus on them; when the bulletins stop, the last robot goes down one route at a time, each picture arriving
// a round trip later. A beat can offer a choice that leads to an ending or to a branch of further timed beats.
// Everything said and shown comes from the story passed to run() (see kirra.js); this only plays it.
import { mount as depth } from './depthview.js';
import { mount as air } from './atmos.js';

let pre = '';   // a story's photos are media/watch-<story>-<ID>; Kirra's, the first, are media/watch-<ID>
const media = (id, w) => new URL(`../media/watch-${pre}${id}-${w}.webp`, import.meta.url).href;
const depthOf = id => new URL(`../media/watch-${pre}${id}-depth.webp`, import.meta.url).href;
const size = () => Math.min(innerWidth, 1600) * Math.min(2, devicePixelRatio || 1) > 1000 ? 1600 : 800;
const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const hhmm = n => `${String(Math.floor(n / 60) % 24).padStart(2, '0')}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touch = matchMedia('(hover: none)').matches;
// How to look, the same in every watch: details are marked by pings that open when the pointer rests on them.
const HINT = { pointer: 'Rest the pointer on a ping to read what is there. Switch cameras along the bottom.', touch: 'Tap a ping to read what is there. Switch cameras below.' };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function run(S, root, { onWall } = {}) {
  const $ = s => root.querySelector(s);
  pre = S.media ? S.media + '-' : '';
  const view = depth($('.cam-canvas'));
  if (!view) $('.cam-fallback').hidden = false;
  air($('.atmos')).set('still');

  let beside = null, fresh = new Set(), list, offset = 0, night, beat, current, photoOf, open, found, waiting, mode, stop, lastTick, ff;
  function reset() {
    list = S.beats; offset = 0; night = mins(S.start); beat = 0; current = null; ff = null;
    keeping = null; kept = null; failed = []; dark = new Set(); beside = null; photoOf = {}; fresh = new Set(); open = new Set(); found = new Set(); waiting = false; mode = 'night'; stop = null;
    $('.wire').innerHTML = ''; $('.notes').innerHTML = ''; $('.panel').innerHTML = ''; root.classList.remove('ended');
    $('.hint').textContent = touch ? HINT.touch : HINT.pointer; $('.hint').hidden = false;
    $('.lag').textContent = S.lagLine || '';
    const w = $('.to-wall'); w.textContent = S.wallLabel || 'Return to the wall'; w.onclick = () => onWall && onWall();
  }

  // ---- Cameras -----------------------------------------------------------------
  function drawStrip() {
    $('.cams').innerHTML = [...open].map(id => `<button type="button" data-cam="${id}" aria-pressed="${id === current}"${fresh.has(id) ? ' class="fresh"' : ''}>
      <img src="${media(photoOf[id], 800)}" alt="" loading="lazy"><span>${esc(S.cameras[id].name)}</span></button>`).join('');
  }
  $('.cams').addEventListener('click', e => { const b = e.target.closest('[data-cam]'); if (b) cut(b.dataset.cam); });
  function cut(id) {
    if (!photoOf[id]) return;
    const changed = id !== current;
    current = id; fresh.delete(id);
    if (changed) { root.classList.remove('cutting'); void root.offsetWidth; root.classList.add('cutting'); }
    const p = photoOf[id];
    if (view) view.show(media(p, size()), depthOf(p), litFor(p)); else $('.cam-fallback').src = media(p, size());
    stamp(); drawStrip(); drawPings();
  }
  // The camera's own time: Kirra's clock, a link's length behind Home's.
  function stamp() { if (current) $('.cam-label').innerHTML = `<i></i>${esc(S.cameras[current].name)} · ${esc(S.place)} · ${hhmm(night - (S.lag || 0))}`; }
  // A second camera held beside the live one, a plain still at the side, never a crossfade (Halcyon's two pictures).
  function drawBeside() {
    const el = $('.beside'); el.hidden = !beside || !photoOf[beside];
    if (!el.hidden) el.innerHTML = `<img src="${media(photoOf[beside], 800)}" alt=""><span>${esc(S.cameras[beside].name)}</span>`;
  }
  function show(map) {
    // a camera that isn't on screen gets a quiet mark when its picture changes; it never pulls you away from what you're focused on
    for (const [cam, p] of Object.entries(map)) { const was = photoOf[cam]; photoOf[cam] = p; if (cam === current) cut(cam); else if (was && was !== p) fresh.add(cam); }
    if (beside) drawBeside();
  }

  // ---- Wireless ------------------------------------------------------------------
  function bulletin(from, text, then) {
    const li = document.createElement('li');
    li.innerHTML = `<b>${hhmm(night)} · ${esc(from)}</b><span></span>`;
    $('.wire').prepend(li);
    while ($('.wire').children.length > 3) $('.wire').lastChild.remove();
    typeOut(li.querySelector('span'), text, then && (() => setTimeout(() => {
      const s = document.createElement('span'); s.className = 'then'; li.append(s); typeOut(s, then);
    }, 1600)));
  }
  function typeOut(el, text, done) {
    if (still) { el.textContent = text; done && done(); return; }
    let i = 0; const t = setInterval(() => { i += 2; el.textContent = text.slice(0, i); if (i >= text.length) { clearInterval(t); done && done(); } }, 30);
  }

  // ---- Places of interest ------------------------------------------------------------
  // Each unread detail in the picture on screen shows a small ping. Resting the pointer on it fills a ring around it;
  // when the ring closes it blips and the detail opens. Moving away lets the ring drain back. A tap starts the fill.
  // Photo space to screen: the depth view shows the photo cover-fitted at 0.9 of the canvas.
  function place(el, x, y) {
    const c = $('.cam-canvas').getBoundingClientRect(), a = 16 / 9, v = c.width / c.height, m = 0.9;
    const sx = v > a ? m : m * v / a, sy = v > a ? m * a / v : m;
    el.style.left = ((x - 0.5) / sx + 0.5) * 100 + '%'; el.style.top = ((y - 0.5) / sy + 0.5) * 100 + '%';
  }
  const FILL = 1100;   // milliseconds for the ring to close
  let pings = [];
  function drawPings() {
    const box = $('.pings'); box.innerHTML = ''; pings = [];
    if (!current || mode === 'ended') return;
    const p = photoOf[current];
    for (const r of S.reveals) {
      if (found.has(r.id) || r.photo !== p) continue;
      const el = document.createElement('button'); el.type = 'button'; el.className = 'ping'; el.setAttribute('aria-label', 'A detail to read');
      el.innerHTML = '<i></i><svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="19"/></svg>';
      place(el, r.x, r.y); box.append(el);
      const ping = { r, el, k: 0, over: false };
      el.addEventListener('pointerenter', () => { ping.over = true; });
      el.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') ping.over = false; });
      el.addEventListener('pointerdown', () => { ping.over = true; });
      el.addEventListener('focus', () => { ping.over = true; });
      el.addEventListener('blur', () => { ping.over = false; });
      pings.push(ping);
    }
  }
  function tickPings(dt) {
    for (const p of pings) {
      if (p.done) continue;
      p.k = Math.max(0, Math.min(1, p.k + (p.over ? dt : -dt * 1.6) / (FILL / 1000)));
      p.el.style.setProperty('--k', p.k.toFixed(3));
      p.el.classList.toggle('filling', p.k > 0);
      if (p.k >= 1) openDetail(p);
    }
  }
  function openDetail(p) {
    const r = p.r; p.done = true; found.add(r.id); $('.hint').hidden = true;
    p.el.classList.add('blip'); setTimeout(() => p.el.remove(), 450);
    const n = document.createElement('p'); n.className = 'note'; place(n, r.x, r.y); $('.notes').append(n);
    typeOut(n, r.text);
    // some details open a way forward when they are read (Tethys: "Go to the buoy.")
    if (r.unlock) { const [label, to] = r.unlock, b = S.beats.find(b => b.id === to); if (b && mins(b.at) > night) { addControl(label, () => { night = mins(b.at); }); $('.panel').lastChild.classList.add('unlock'); } }
    setTimeout(() => n.classList.add('kept'), 9000);
  }

  // ---- The night ----------------------------------------------------------------------
  function play(b) {
    if (b.ifWaiting && mode !== 'night') return;
    $('.panel').querySelectorAll('.unlock').forEach(u => u.remove());
    if (b.show) show(b.show);
    (b.open || []).forEach(id => open.add(id));
    if (b.cut || !current) cut(b.cut || [...open][0]);
    drawStrip();
    if (b.say) bulletin(b.from, b.say);
    if (b.text) $('.lag').textContent = b.text;
    if ('beside' in b) { beside = b.beside; drawBeside(); }
    if (b.choose) { panel(b.note ? `<p class="offer">${esc(b.note)}</p>` : ''); b.choose.forEach(([label, to, sub]) => { addControl(label, () => take(to)); if (sub) { const p = document.createElement('p'); p.className = 'sub'; p.textContent = sub; $('.panel').append(p); } }); }
    if (b.keep) keepPair(b.keep);
    if (b.fail) { failed = [...failed, ...b.fail]; lightsOff([...failed, ...(kept ? [kept] : [])]); }
    if (b.route) offerRoute();
    if (b.leave) addControl(S.route.leave, () => end('surface'));
    if (b.end) setTimeout(() => end(b.end), (b.hold || 3) * 1000);   // a beat that closes the watch after its picture has been seen
  }
  function panel(html) { $('.panel').innerHTML = html; }
  function addControl(label, fn) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = fn; $('.panel').append(b);
  }
  function offerRoute() {
    panel(`<p class="offer">${esc(S.route.note)}</p>`);
    addControl(S.route.offer, () => go(S.route.first));
    addControl(S.route.keep, () => { panel(''); addControl(S.route.offer, () => go(S.route.first)); });
  }

  // A light that is off is dark in every photo that shows it: a story's `sources` name, per light, the patch of each
  // photo it lights; while that light is off its patch is drawn dark, and its own flicker stops.
  let dark = new Set();
  function litFor(p) {
    const src = S.sources || {}, out = [];
    for (const l of (S.lights || {})[p] || []) if (!l.src || !dark.has(l.src)) out.push(l);
    for (const [name, spots] of Object.entries(src)) if (dark.has(name)) for (const sp of spots) if (sp.photo === p) out.push({ ...sp, kind: 'steady', a: -(sp.a ?? 0.7) });
    return out;
  }
  function lightsOff(names) { dark = new Set(names); if (current) cut(current); }

  // Home's lights: a pair kept on, changeable while power lasts, and the reserve's own estimate counting down to the
  // minute the script says it fails. Which pair is kept changes nothing the script doesn't; the choice is the player's.
  let keeping = null, kept = null, failed = [];
  function keepPair(k) {
    const box = document.createElement('div'); box.className = 'keep';
    box.innerHTML = (k.note ? `<p class="offer">${esc(k.note)}</p>` : '') + k.options.map((o, i) => `<button type="button" aria-pressed="false" data-k="${i}">${esc(o)}</button>`).join('');
    box.onclick = e => { const t = e.target.closest('[data-k]'); if (!t) return; box.querySelectorAll('[data-k]').forEach(x => x.setAttribute('aria-pressed', x === t)); kept = k.off[+t.dataset.k]; lightsOff([...failed, kept]); };
    $('.panel').prepend(box); keeping = k;
  }
  function readout() {
    if (!keeping) return;
    const left = Math.max(0, Math.ceil(mins(keeping.until) - night));
    $('.lag').textContent = keeping.readout.replace('{n}', left);
    if (!left) { $('.panel .keep')?.remove(); keeping = null; }
  }

  // A choice at a beat: an ending, or a branch of timed beats that carries on from the night's clock.
  function take(to) {
    panel('');
    if (to.startsWith('end:')) return end(to.slice(4));
    const br = S.branches[to.replace(/^branch:/, '')];
    list = br; beat = 0; mode = 'night';
    offset = Math.max(0, night - mins(br[0].at));   // a branch chosen late starts now, its beats keeping their spacing
  }

  // ---- The descent ------------------------------------------------------------------------
  function go(to) {
    if (to.startsWith('end:')) return end(to.slice(4));
    mode = 'descent'; panel('');
    // Every route is a round trip: out to Kirra, a minute's move, and the picture back.
    const due = night + S.route.trip;
    panel(`<p class="offer">${esc(S.route.sent)} ${hhmm(due)}</p>`);
    fastForward(due, () => arrive(to));
  }
  function arrive(id) {
    stop = id; const st = S.route.stops[id];
    const cam = st.cam || 'front';
    photoOf[cam] = st.photo; open = new Set([cam, ...(st.rear || cam === 'rear' ? ['rear'] : [])]);
    if (st.rear) photoOf.rear = photoOf.rear || st.photo;
    cut(cam);
    if (st.say) bulletin('Robot', st.say, st.then);
    if (st.sound) setTimeout(() => bulletin('Received sound', st.sound), 2600);
    panel('');
    if (st.next) return setTimeout(() => go(st.next), (st.hold || 2.5) * 1000);
    st.choices.forEach(([label, to]) => addControl(label, () => go(to)));
  }
  // The clock runs fast to the time the next picture is due; nobody sits through twenty-three real minutes.
  function fastForward(to, done) { ff = { from: night, to, t0: performance.now(), dur: still ? 0 : 3200, done }; }

  // ---- Endings ------------------------------------------------------------------------------
  function end(id) {
    const E = S.endings[id]; mode = 'ended'; panel(''); drawPings();
    $('.ending').innerHTML = `<p class="when">${hhmm(night)} · Home, Earth</p><h2>${esc(E.title)}</h2><p>${esc(E.text)}</p>`
      + (E.last ? `<p class="last"></p>` : '')
      + `<p class="count">${found.size} of ${S.reveals.length} details read</p>`
      + (S.after ? `<div class="after">${S.after.line ? `<p>${esc(S.after.line)}</p>` : ''}${S.after.button ? `<button type="button">${esc(S.after.button)}</button>` : ''}</div>` : '')
      + `<div class="end-controls"></div>`;
    // back at Home after the watch: one plain line, or one plain act, from the story (see each story's `after`)
    const ab = $('.ending .after button'); if (ab) ab.onclick = () => ab.remove();
    root.classList.add('ended');
    if (E.last) setTimeout(() => typeOut($('.ending .last'), E.last), 2400);
    for (const [label, act] of E.controls) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label; $('.end-controls').append(b);
      b.onclick = () => {
        root.classList.remove('ended');
        if (act === 'wall') { mode = 'ended'; onWall && onWall(); }
        else if (act === 'restart') { reset(); play(list[beat++]); }
        else if (act.startsWith('branch:') || act.startsWith('beat:')) {   // reopen a choice at its own time
          const [kind, name] = act.split(':'); mode = 'night';
          if (kind === 'branch') take(name); else { const b = S.beats.find(b => b.id === name); list = S.beats; offset = 0; beat = S.beats.indexOf(b); night = mins(b.at); play(list[beat++]); }
        }
        else if (act === 'resume') { mode = 'descent'; arrive(stop && S.route.stops[stop] && !S.route.stops[stop].next ? stop : S.route.first); }
        else if (act === 'route') { mode = 'descent'; stop = null; go(S.route.first); }
      };
    }
  }

  // ---- Clock --------------------------------------------------------------------------------
  function tick(now) {
    const dt = Math.min(0.1, (now - lastTick) / 1000); lastTick = now;
    if (ff) {
      const k = Math.min(1, (now - ff.t0) / Math.max(1, ff.dur));
      night = ff.from + (ff.to - ff.from) * (1 - Math.pow(1 - k, 3));
      if (k >= 1) { const d = ff.done; ff = null; d(); }
    } else if (mode === 'night' && beat < list.length) {
      night += dt / S.pace;
      while (mode === 'night' && beat < list.length && mins(list[beat].at) + offset <= night) play(list[beat++]);
    } else if (mode !== 'ended') night += dt / 60; // once the bulletins stop, and between pictures, Home's clock runs at its real pace
    $('.clock').textContent = hhmm(night);
    stamp(); readout();
    tickPings(dt);
    requestAnimationFrame(tick);
  }

  // Before the night starts, one card says where you are, what is happening and what you can do; the night waits on it.
  function brief(go) {
    const c = $('.brief'); const first = S.beats[0];
    if (first.show) { show(first.show); (first.open || []).forEach(id => open.add(id)); cut(first.cut || [...open][0]); }
    c.innerHTML = `<p class="when">${esc(S.start)} · ${esc(S.place)}</p><h2>${esc(S.title)}</h2>`
      + (first.text ? `<p>${esc(first.text)}</p>` : '') + (S.lagLine ? `<p>${esc(S.lagLine)}</p>` : '')
      + `<ul><li>${esc(touch ? HINT.touch : HINT.pointer)}</li><li>Pictures and messages arrive on the clock. A small dot on a camera means its picture has changed.</li><li>When a choice comes, it changes what happens.</li></ul>`
      + `<button type="button">Begin</button>`;
    c.hidden = false; c.querySelector('button').onclick = () => { c.hidden = true; go(); }; c.querySelector('button').focus();
  }
  reset();
  brief(() => { lastTick = performance.now(); play(list[beat++]); requestAnimationFrame(tick); });
}
