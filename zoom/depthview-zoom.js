// A photograph that behaves like a 3D space: its depth map shifts near parts more than far ones as the camera moves,
// and focus follows the depth under the pointer, so what you point at racks sharp and the rest falls soft: the
// tilt-shift miniature look, made live from sharp photographs.
// No models, no library: one WebGL2 pass. Idle, the camera drifts and the focus wanders on its own.
// mount(canvas) → { show(colourUrl, depthUrl), zoom(z, centre), state() } or null when WebGL2 isn't there.
// This copy also zooms: the picture magnifies about one point (the lit window) by z, its parallax shrinking with it, and
// state() hands its focus and drift to the 3D view that takes over when the photograph runs out of detail.

const VS = `#version 300 es
in vec2 p; out vec2 uv;
void main() { uv = p * 0.5 + 0.5; uv.y = 1.0 - uv.y; gl_Position = vec4(p, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D c0, d0, c1, d1, v1;
uniform float useV;   // the live picture plays a video loop: its sharp image comes from v1, its soft levels from the photo
uniform vec2 cam, scale, fpt, zc;
uniform float zoom, resw;
uniform float mixv, pull, strength, band, tilt, tm;
// Live light on the current photo: up to eight soft regions (x, y, radius, strength) that flicker, pulse or blink on
// a loop, so lamps, LEDs and glows breathe the way real ones do. Kinds: 0 flicker, 1 slow pulse, 2 blink, 3 steady.
uniform vec4 L[8]; uniform float LK[8]; uniform int LN;
float wave(float k, float i) {
  float t = tm + i * 7.31;
  if (k < 0.5) { float n = sin(t * 13.0) * 0.5 + sin(t * 29.7 + 1.1) * 0.3 + sin(t * 3.1) * 0.2; return n * 0.5 - step(0.985, fract(sin(floor(t * 9.0) * 91.7 + i) * 4375.5)) * 1.6; }
  if (k < 1.5) return sin(t * 1.3);
  if (k > 2.5) return 1.0;   // 3: steady, for a light that is off (negative strength) or on
  return smoothstep(0.2, 0.3, fract(t * 0.45)) - smoothstep(0.6, 0.7, fract(t * 0.45));
}
vec3 lit(vec3 col, vec2 q) {
  float g = 0.0;
  for (int i = 0; i < 8; i++) { if (i >= LN) break; vec2 d = (q - L[i].xy) * vec2(1.0, 0.5625); g += L[i].w * wave(LK[i], float(i)) * smoothstep(L[i].z, 0.0, length(d)); }
  return col * max(0.0, 1.0 + g);
}
// Steep parallax: step along the camera's offset until the ray meets the depth surface, so near edges cover what's
// behind them instead of smearing.
vec2 march(sampler2D d, vec2 q) {
  vec2 off = cam * strength / zoom;
  const int N = 20;
  vec2 s = q;
  for (int i = 0; i <= N; i++) {
    float layer = 1.0 - float(i) / float(N);
    s = q - off * (layer - 0.35);
    if (texture(d, s).r >= layer) break;
  }
  return s;
}
// The miniature look, done here rather than in the photograph: a band of sharpness across the depth under the pointer,
// and a band across the screen at the pointer's height; past either, the picture goes soft, more the further it is.
// The photos themselves are sharp front to back, so focus can rack to anything, near rocks included.
vec3 shade(sampler2D c, sampler2D d, vec2 q, float vid) {
  vec2 s = march(d, q);
  float depth = texture(d, s).r;
  float focus = texture(d, zc + ((fpt - 0.5) * scale + 0.5 - zc) / zoom).r;
  float byDepth = max(0.0, abs(depth - focus) - band) * 7.0;
  float byScreen = smoothstep(0.12, 0.55, abs(uv.y - fpt.y)) * 2.2;
  float lod = clamp(max(byDepth, byScreen) * tilt, 0.0, 3.4) + pull;
  // The softness is sized on the screen, as it is on a 2400-pixel photograph unmagnified, so it stays the same size however
  // far the picture is magnified and however many pixels the photograph has; what is in focus takes the photograph's
  // finest pixels the screen can show.
  float tw = float(textureSize(c, 0).x);
  float fine = max(1.0, tw * scale.x / (resw * zoom));
  lod = log2(fine + (exp2(lod) - 1.0) * tw / 2400.0 / zoom);
  // A small disc of taps at that level, so deep blur reads as a lens and not as blocky mip squares; in focus the disc closes.
  vec2 px = (exp2(lod) - 0.8 * fine) / vec2(textureSize(c, 0));
  vec3 col = textureLod(c, s, lod).rgb * 0.36;
  col += textureLod(c, s + px * vec2( 0.9,  0.3), lod).rgb * 0.16;
  col += textureLod(c, s + px * vec2(-0.3,  0.9), lod).rgb * 0.16;
  col += textureLod(c, s + px * vec2(-0.9, -0.3), lod).rgb * 0.16;
  col += textureLod(c, s + px * vec2( 0.3, -0.9), lod).rgb * 0.16;
  if (vid > 0.5) col = mix(texture(v1, s).rgb, col, clamp(lod / 1.4, 0.0, 1.0));
  return col;
}
void main() {
  vec2 q = (uv - 0.5) * scale + 0.5;
  q = zc + (q - zc) / zoom;
  vec3 a = shade(c0, d0, q, 0.0), b = shade(c1, d1, q, useV);
  vec3 col = mix(a, lit(b, q), mixv);
  float v = smoothstep(0.95, 0.35, length((uv - 0.5) * vec2(1.0, 0.8)));
  o = vec4(col * mix(0.86, 1.0, v), 1.0);
}`;

export function mount(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false });
  if (!gl) return null;
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); return x; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(pr, n);
  ['c0', 'd0', 'c1', 'd1', 'v1'].forEach((n, i) => gl.uniform1i(U(n), i));

  const solid = v => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([v, v, v, 255])); return t; };
  const black = solid(0), flat = solid(128);
  const texOf = img => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const load = url => new Promise(res => { if (!url) return res(null); const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = () => res(null); i.src = url; });
  // A loop instead of a still: a muted video that repeats, uploaded to its texture every frame; the depth map stays the
  // photo's, since the loops move little and begin and end on that photo.
  const loadVideo = url => new Promise(res => {
    const v = document.createElement('video'); v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous';
    v.oncanplay = () => { v.oncanplay = null; v.play().catch(() => {}); res(v); }; v.onerror = () => res(null); v.src = url;
  });
  let movie = null, movieFresh = false, movieUp = false;
  const vtex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, vtex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const onVideoFrame = v => { const f = () => { if (movie !== v) return; movieFresh = true; v.requestVideoFrameCallback ? v.requestVideoFrameCallback(f) : setTimeout(f, 42); }; f(); };

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let a = { c: black, d: flat }, b = a, mix = 1, fadeAt = 0, aspect = 16 / 9;
  let cam = [0, 0], camGoal = null, fp = [0.5, 0.6], fpGoal = null, pull = 0;
  let Z = 1, ZC = [0.5, 0.5];
  let visible = true, raf = 0, t0 = performance.now(), last = 0, sc = [0.9, 0.9];

  const resize = () => {
    const r = Math.min(2, devicePixelRatio || 1), w = Math.round(canvas.clientWidth * r), h = Math.round(canvas.clientHeight * r);
    if (w && h && (canvas.width !== w || canvas.height !== h)) { canvas.width = w; canvas.height = h; }
  };
  const frame = now => {
    raf = 0;
    if (!visible || document.hidden) return;
    resize();
    const t = (now - t0) / 1000, dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    // Idle: a slow drift and a wandering focus, like a camera on a long lens held by someone.
    const idleCam = still ? [0, 0] : [Math.sin(t * 0.17) * 0.55, Math.sin(t * 0.11 + 1.3) * 0.35];
    const idleFp = [0.5 + Math.sin(t * 0.07) * 0.18, 0.6 + Math.sin(t * 0.05 + 2) * 0.12];
    const cg = camGoal || idleCam, fg = fpGoal || idleFp;
    const k = 1 - Math.exp(-dt * 4);
    cam[0] += (cg[0] - cam[0]) * k; cam[1] += (cg[1] - cam[1]) * k;
    fp[0] += (fg[0] - fp[0]) * k * 0.7; fp[1] += (fg[1] - fp[1]) * k * 0.7;
    if (mix < 1) mix = Math.min(1, (now - fadeAt) / 1500);
    pull = Math.max(0, pull - dt * 2.2);
    gl.viewport(0, 0, canvas.width, canvas.height);
    // Cover the canvas with the photo, leaving a margin the parallax can move into.
    const view = canvas.width / canvas.height, m = 0.9;
    sc = [view > aspect ? m : m * view / aspect, view > aspect ? m * aspect / view : m];
    gl.uniform2f(U('scale'), sc[0], sc[1]);
    gl.uniform2f(U('cam'), cam[0] * 0.022, cam[1] * 0.014);
    gl.uniform2f(U('fpt'), fp[0], fp[1]);
    gl.uniform1f(U('resw'), canvas.width); gl.uniform1f(U('zoom'), Z); gl.uniform2f(U('zc'), ZC[0], ZC[1]);
    gl.uniform1f(U('strength'), 1.0);
    gl.uniform1f(U('band'), 0.06);
    gl.uniform1f(U('tilt'), 1.0);
    gl.uniform1f(U('mixv'), mix);
    gl.uniform1f(U('pull'), pull);
    gl.uniform1f(U('tm'), t);
    gl.uniform1i(U('LN'), lights.length);
    if (lights.length) { gl.uniform4fv(U('L'), lights.flatMap(l => [l.x, l.y, l.r, l.a])); gl.uniform1fv(U('LK'), lights.map(l => ({ flicker: 0, pulse: 1, blink: 2, steady: 3 })[l.kind] ?? 0)); }
    // the loop's newest frame goes up only when the video has one, into its own texture with no mip levels
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, vtex);
    if (movie && movieFresh && movie.readyState >= 2) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, movie); movieFresh = false; movieUp = true; }
    gl.uniform1f(U('useV'), movie && movieUp && mix >= 1 ? 1 : 0);
    [a.c, a.d, b.c, b.d].forEach((x, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, x); });
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (!still || mix < 1 || pull > 0 || camGoal || movie) raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };

  const host = canvas.parentElement;
  const aim = e => {
    const r = host.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    camGoal = [(x - 0.5) * 2, (y - 0.5) * 2]; fpGoal = [x, y]; kick();
  };
  host.addEventListener('pointermove', aim);
  // A tap racks focus to what was tapped and holds it there; the phone's tilt still moves the camera.
  host.addEventListener('pointerdown', aim);
  host.addEventListener('pointerleave', e => { camGoal = null; if (e.pointerType !== 'touch') fpGoal = null; kick(); });
  host.addEventListener('pointerup', e => { if (e.pointerType === 'touch') { camGoal = null; kick(); } });
  addEventListener('deviceorientation', e => {
    if (e.gamma == null || !visible) return;
    camGoal = [Math.max(-1, Math.min(1, e.gamma / 20)), Math.max(-1, Math.min(1, (e.beta - 50) / 20))]; kick();
  });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) kick(); }).observe(canvas);
  document.addEventListener('visibilitychange', kick);
  new ResizeObserver(kick).observe(canvas);

  let lights = [];
  let want = '';
  return {
    zoom(z, centre) { Z = z; ZC = centre; kick(); },
    // The same photograph with more pixels takes the place of the one showing, with no fade, once it has loaded.
    async sharpen(colour) {
      const key = want, ci = await load(colour);
      if (!ci || want !== key || Math.max(ci.width, ci.height) > gl.getParameter(gl.MAX_TEXTURE_SIZE)) return;
      const t = texOf(ci); if (a === b) a = b = { c: t, d: b.d }; else b = { c: t, d: b.d }; kick();
    },
    // The focus point and the drift, in the canvas's 0–1 space (y down), and the scale the photo is drawn at.
    state() { return { fp: fp.slice(), cam: cam.slice(), sc: sc.slice() }; },
    // Where focus sits, in the photo's own 0–1 space, and whether it has settled there.
    focus() { return { x: (fp[0] - 0.5) * sc[0] + 0.5, y: (fp[1] - 0.5) * sc[1] + 0.5, settled: !!fpGoal && Math.hypot(fp[0] - fpGoal[0], fp[1] - fpGoal[1]) < 0.02 }; },
    // lights: [{ x, y, r, a, kind: 'flicker' | 'pulse' | 'blink' }] in the photo's own 0–1 space
    // loop: a video URL that plays in place of the still once it can, starting on the same picture
    async show(colour, depth, lit = [], loop = null) {
      const key = colour + '|' + depth + '|' + loop; lights = lit.slice(0, 8); if (key === want) return; want = key;
      const [ci, di] = await Promise.all([load(colour), load(depth)]);
      if (want !== key || !ci) return;
      aspect = ci.width / ci.height;
      const n = { c: texOf(ci), d: di ? texOf(di) : flat };
      if (movie) { movie.pause(); movie.removeAttribute('src'); movie.load(); movie = null; movieUp = false; }
      if (loop && !still) loadVideo(loop).then(v => { if (!v || want !== key) return; movie = v; movieUp = false; onVideoFrame(v); kick(); });
      if (a.c === black) { a = b = n; mix = 1; }
      else { a = mix < 0.5 ? a : b; b = n; mix = 0; fadeAt = performance.now(); pull = 1.6; }
      kick();
    },
  };
}
