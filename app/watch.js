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
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function run(S, root, { onWall } = {}) {
  const $ = s => root.querySelector(s);
  pre = S.media ? S.media + '-' : '';
  const view = depth($('.cam-canvas'));
  if (!view) $('.cam-fallback').hidden = false;
  air($('.atmos')).set('still');

  let list, offset = 0, night, beat, held, heldSince, current, photoOf, open, found, waiting, mode, stop, lastTick, ff;
  function reset() {
    list = S.beats; offset = 0; night = mins(S.start); beat = 0; held = null; current = null; ff = null;
    photoOf = {}; open = new Set(); found = new Set(); waiting = false; mode = 'night'; stop = null;
    $('.wire').innerHTML = ''; $('.notes').innerHTML = ''; $('.panel').innerHTML = ''; root.classList.remove('ended');
    $('.hint').textContent = touch ? S.hint.touch : S.hint.pointer; $('.hint').hidden = false;
    $('.lag').textContent = S.lagLine || '';
    const w = $('.to-wall'); w.textContent = S.wallLabel || 'Return to the wall'; w.onclick = () => onWall && onWall();
  }

  // ---- Cameras -----------------------------------------------------------------
  function drawStrip() {
    $('.cams').innerHTML = [...open].map(id => `<button type="button" data-cam="${id}" aria-pressed="${id === current}">
      <img src="${media(photoOf[id], 800)}" alt="" loading="lazy"><span>${esc(S.cameras[id].name)}</span></button>`).join('');
  }
  $('.cams').addEventListener('click', e => { const b = e.target.closest('[data-cam]'); if (b) cut(b.dataset.cam); });
  function cut(id) {
    if (!photoOf[id]) return;
    const changed = id !== current;
    current = id;
    if (changed) { root.classList.remove('cutting'); void root.offsetWidth; root.classList.add('cutting'); }
    const p = photoOf[id];
    if (view) view.show(media(p, size()), depthOf(p)); else $('.cam-fallback').src = media(p, size());
    stamp(); drawStrip();
  }
  // The camera's own time: Kirra's clock, a link's length behind Home's.
  function stamp() { if (current) $('.cam-label').innerHTML = `<i></i>${esc(S.cameras[current].name)} · ${esc(S.place)} · ${hhmm(night - (S.lag || 0))}`; }
  function show(map) {
    for (const [cam, p] of Object.entries(map)) { photoOf[cam] = p; if (cam === current) cut(cam); }
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

  // ---- Focus reveals -----------------------------------------------------------------
  // Photo space to screen: the depth view shows the photo cover-fitted at 0.9 of the canvas.
  function place(el, x, y) {
    const c = $('.cam-canvas').getBoundingClientRect(), a = 16 / 9, v = c.width / c.height, m = 0.9;
    const sx = v > a ? m : m * v / a, sy = v > a ? m * a / v : m;
    el.style.left = ((x - 0.5) / sx + 0.5) * 100 + '%'; el.style.top = ((y - 0.5) / sy + 0.5) * 100 + '%';
  }
  function watchFocus(now) {
    const mark = $('.reveal');
    if (!view || !current || mode === 'ended') { mark.hidden = true; return; }
    const f = view.focus(), p = photoOf[current];
    const r = S.reveals.find(r => !found.has(r.id) && r.photo === p && Math.hypot(f.x - r.x, (f.y - r.y) * 0.5625) < r.r);
    if (!r || !f.settled) { held = null; mark.hidden = true; return; }
    if (held !== r) { held = r; heldSince = now; }
    const k = Math.min(1, (now - heldSince) / 1100);
    mark.hidden = false; mark.style.setProperty('--k', k); place(mark, r.x, r.y);
    if (k < 1) return;
    found.add(r.id); held = null; mark.hidden = true; $('.hint').hidden = true;
    const n = document.createElement('p'); n.className = 'note'; place(n, r.x, r.y); $('.notes').append(n);
    typeOut(n, r.text);
    setTimeout(() => n.classList.add('kept'), 9000);
  }

  // ---- The night ----------------------------------------------------------------------
  function play(b) {
    if (b.ifWaiting && mode !== 'night') return;
    if (b.show) show(b.show);
    (b.open || []).forEach(id => open.add(id));
    if (b.cut || !current) cut(b.cut || [...open][0]);
    drawStrip();
    if (b.say) bulletin(b.from, b.say);
    if (b.text) $('.lag').textContent = b.text;
    if (b.choose) { panel(b.note ? `<p class="offer">${esc(b.note)}</p>` : ''); b.choose.forEach(([label, to]) => addControl(label, () => take(to))); }
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
    const E = S.endings[id]; mode = 'ended'; panel('');
    $('.ending').innerHTML = `<p class="when">${hhmm(night)} · Home, Earth</p><h2>${esc(E.title)}</h2><p>${esc(E.text)}</p>`
      + (E.last ? `<p class="last"></p>` : '')
      + `<p class="count">${found.size} of ${S.reveals.length} details read</p><div class="end-controls"></div>`;
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
    stamp();
    watchFocus(now);
    requestAnimationFrame(tick);
  }

  reset();
  lastTick = performance.now();
  play(list[beat++]);
  requestAnimationFrame(tick);
}
