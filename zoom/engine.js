// Vigil's 3D view of the house photograph, for the zoom. The moor is a mesh traced from the photograph's depth, the house real
// geometry measured from it (house-fit.json); both take their colour from the photograph projected from its own camera, so from
// that camera this view is the photograph. It draws through exactly the live page's look (depthview.js: focus racked to the
// depth under the pointer, the tilt-shift band, the soft edges), using the same depth map, the same focus point and the same
// drift, so the hand-over from the flat photograph to this does not show. Past the hand-over the camera moves in along its own
// line of sight to the lit window; where the photograph runs out of pixels, Codex's textures take over in the photograph's colours.
// mountEngine(canvas) -> { draw(view), centre } or null without WebGL2.
export async function mountEngine(canvas) {
  const cv = canvas, gl = cv.getContext('webgl2', { antialias: false, alpha: true, premultipliedAlpha: false });
  if (!gl) return null;
  const J = await (await fetch('house-fit.json')).json();
  const [PW, PH] = J.size, F = J.f;
  function rot(yaw, pitch, roll) {
    const [cy, sy, cp, sp, cr, sr] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch), Math.cos(roll), Math.sin(roll)];
    const Ry = [[cy, 0, -sy], [0, 1, 0], [sy, 0, cy]], Rx = [[1, 0, 0], [0, cp, sp], [0, -sp, cp]], Rz = [[cr, -sr, 0], [sr, cr, 0], [0, 0, 1]];
    const mul = (A, B) => A.map(r => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
    return mul(Rz, mul(Rx, Ry));
  }
  const R0 = rot(J.yaw, J.pitch, J.roll), C0 = J.cam;
  function shader(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(s); return s; }
  function program(vs, fs) { const p = gl.createProgram(); gl.attachShader(p, shader(gl.VERTEX_SHADER, vs)); gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw gl.getProgramInfoLog(p); return p; }
  const VS = `#version 300 es
  in vec3 pos; in vec3 col; in vec2 tuv;
  uniform mat4 view, proj; out vec3 wp; out vec3 c; out vec2 tu;
  void main(){ wp = pos; c = col; tu = tuv; gl_Position = proj * view * vec4(pos, 1.); }`;
  // Colour: the photograph projected from its camera (uR, uC, uF). col.x > 0.5 marks a face the photograph cannot see
  // (it takes the flat colour col.yz-coded instead); the window's glass glows warm.
  // Colour: the photograph projected from its own camera. Where one photo pixel covers more than a screen pixel, the photo has
  // run out of detail, so a Codex texture takes over there, scaled to the photo's own local colour (detail transfer), so the
  // colour never shifts. c.x: 1 = a face the photograph never saw (the texture alone, tinted to the house's whitewash);
  // c.y: material (0 ground, 1 wall, 2 roof, 3 window frame and glass).
  const FS = `#version 300 es
  precision highp float;
  in vec3 wp; in vec3 c; in vec2 tu; uniform sampler2D photo, tWall, tRoof, tGround, tWin, tSide, tPatch;
  uniform mat3 uR; uniform vec3 uC; uniform float uF; uniform vec2 uSize; uniform vec4 avg[3]; uniform vec4 win; uniform float houseW, s0;
  uniform sampler2D dmap;
  layout(location = 0) out vec4 o; layout(location = 1) out vec4 od;
  vec3 detail(int m, out vec3 a){
    vec3 n = normalize(cross(dFdx(wp), dFdy(wp)));
    if (m == 0) { a = avg[0].rgb; return texture(tGround, wp.xz / 2.).rgb; }
    if (m == 2) { a = avg[2].rgb; return texture(tRoof, vec2(wp.z, length(vec2(wp.x - houseW * .5, wp.y))) / 2.).rgb; }
    a = avg[1].rgb; return texture(tWall, (abs(n.z) > abs(n.x) ? wp.xy : wp.zy) / 2.).rgb;
  }
  void main(){
    vec3 q = uR * (wp - uC);
    vec2 px = vec2(uSize.x * .5 + uF * q.x / q.z, uSize.y * .5 - uF * q.y / q.z), uv = px / uSize;
    // Derivatives first, in uniform control flow: a texture read after a per-pixel branch has no defined mip level and comes out blurred.
    vec2 gx = dFdx(uv), gy = dFdy(uv); float fw = max(fwidth(px.x), fwidth(px.y)) / s0;
    vec3 sharp = textureGrad(photo, uv, gx, gy).rgb;
    od = vec4(textureLod(dmap, clamp(uv, 0., 1.), 0.).r);
    int m = int(c.y + .5);
    if (m == 3) {                                   // the gable window: Codex's frame, warm lit glass behind it
      vec2 wu = vec2((wp.x - win.x) / (win.y - win.x), 1. - (wp.y - win.z) / (win.w - win.z));
      vec3 f = texture(tWin, mix(vec2(.053, .045), vec2(.944, .954), wu)).rgb; float frame = smoothstep(.06, .16, max(f.r, max(f.g, f.b)));
      vec3 glass = vec3(1., .6, .26) * (.7 + .35 * (1. - length(wu - vec2(.45, .62))));   // lamp-lit from low inside
      glass = mix(glass, vec3(.55, .6, .68), .12 * smoothstep(.55, .0, wu.y));               // the dusk sky faintly on the upper panes
      o = vec4(mix(sharp, mix(glass, f * .45, frame), smoothstep(.35, .12, fw)), 1.); return;
    }
    if (m == 4 || m == 5) {                         // the long side's three openings and the stained patch under the gable's peak
      vec3 t = m == 4 ? texture(tSide, tu).rgb : texture(tPatch, tu).rgb;
      float k2 = smoothstep(.35, .12, fw);
      float edge = m == 5 ? smoothstep(0., .18, min(min(tu.x, 1. - tu.x), min(tu.y, 1. - tu.y))) * .7 : 1.;
      o = vec4(mix(sharp, t * (m == 4 ? .8 : .7), k2), m == 5 ? mix(1., edge, k2) : 1.); return;
    }
    vec3 a, d = detail(m, a);
    float k = smoothstep(.35, .12, fw);   // 0 until the camera is well closer than the photo's
    if (c.x > .5) { o = vec4(d * vec3(.62, .66, .72) / a * (c.z > 0. ? c.z : .55), 1.); return; }
    vec3 soft = textureLod(photo, uv, m == 0 ? 4. : 1.5).rgb;
    o = vec4(mix(sharp, soft * d / a, k), 1.);
  }`;
  const prog = program(VS, FS);

  // Meshes: positions and a per-vertex code (0 = photograph; 1 = flat grey for faces the photo never saw).
  function mesh(pos, col, idx, tuv = new Float32Array(pos.length / 3 * 2)) {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const put = (data, name, n) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); const l = gl.getAttribLocation(prog, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, 0, 0); };
    put(pos, 'pos', 3); put(col, 'col', 3); put(tuv, 'tuv', 2);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    return { vao, n: idx.length, type: idx instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT };
  }
  const tv = new Float32Array(await (await fetch('terrain.f32')).arrayBuffer()), ti = new Uint32Array(await (await fetch('terrain.u32')).arrayBuffer());
  const nv = tv.length / 5, tp = new Float32Array(nv * 3);
  for (let i = 0; i < nv; i++) tp.set(tv.subarray(i * 5, i * 5 + 3), i * 3);
  const terrain = mesh(tp, new Float32Array(nv * 3), ti);
  const SP = [], SI = [], NS = 48;
  for (let i = 0; i <= NS; i++) for (let j = 0; j <= NS * 2; j++) {
    const th = Math.PI * i / NS, ph = Math.PI * j / NS, R_ = 30000;
    SP.push(C0[0] + R_ * Math.sin(th) * Math.cos(ph), C0[1] + R_ * Math.cos(th), C0[2] + R_ * Math.sin(th) * Math.sin(ph));
    if (i < NS && j < NS * 2) { const a_ = i * (NS * 2 + 1) + j, b_ = a_ + NS * 2 + 1; SI.push(a_, b_, a_ + 1, a_ + 1, b_, b_ + 1); }
  }
  const backdrop = mesh(new Float32Array(SP), new Float32Array(SP.length), new Uint32Array(SI));

  // The house from the fit: walls, gables, roof with overhang, chimney, shed, posts. Faces the photograph saw keep its colour.
  const { w, L, wall: h, ridge: r } = J, P = [], Cc = [], I = [], T = [];
  let shade = 0;
  function quad(a, b, c, d, hidden, mat = 1, uv = [0, 1, 1, 0]) { const k = P.length / 3; for (const v of [a, b, c, d]) { P.push(...v); Cc.push(hidden ? 1 : 0, mat, shade); } T.push(uv[0], uv[1], uv[2], uv[1], uv[2], uv[3], uv[0], uv[3]); I.push(k, k + 1, k + 2, k, k + 2, k + 3); }
  function tri(a, b, c, hidden) { const k = P.length / 3; for (const v of [a, b, c]) { P.push(...v); Cc.push(hidden ? 1 : 0, 1, 0); T.push(0, 0); } I.push(k, k + 1, k + 2); }
  function box(x0, y0, z0, x1, y1, z1, seen = [1, 1, 1, 1, 1, 1]) { // seen: -z, +x, +y, -x, +z, -y
    quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], !seen[0]); quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], !seen[1]);
    quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], !seen[2]); quad([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], !seen[3]);
    quad([x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], !seen[4]);
  }
  const o = .25;
  quad([0, 0, 0], [w, 0, 0], [w, h, 0], [0, h, 0]);                 // gable wall (seen)
  quad([w, 0, 0], [w, 0, L], [w, h, L], [w, h, 0]);                 // long side (seen)
  quad([w, 0, L], [0, 0, L], [0, h, L], [w, h, L], true);           // back gable
  quad([0, 0, L], [0, 0, 0], [0, h, 0], [0, h, L], true);           // far long side
  tri([0, h, 0], [w, h, 0], [w / 2, r, 0]); tri([w, h, L], [0, h, L], [w / 2, r, L], true);
  quad([w + o, h - o * .55, -o], [w + o, h - o * .55, L + o], [w / 2, r + .05, L + o], [w / 2, r + .05, -o], false, 2);   // near roof slope
  quad([w / 2, r + .05, -o], [w / 2, r + .05, L + o], [-o, h - o * .55, L + o], [-o, h - o * .55, -o], true, 2);
  const W_ = J.window; quad([W_.x0, W_.y0, -.03], [W_.x1, W_.y0, -.03], [W_.x1, W_.y1, -.03], [W_.x0, W_.y1, -.03], false, 3); // far slope
  const [chx, chy, chz, chw] = J.chimney; box(chx - chw / 2, r - .3, chz - chw / 2, chx + chw / 2, chy, chz + chw / 2, [1, 1, 1, 0, 0, 0]);
  // The shed and the fence posts stay as the photograph has them, on the ground it was traced from.
  shade = 0;
  // The three openings on the long side (plane x = w) and the stain under the gable's peak, each with its piece of Codex's texture.
  const RUNS = [[.186, .281], [.453, .548], [.719, .814]];
  J.side_openings.slice().sort((p_, q_) => p_[0] - q_[0]).forEach(([z0, z1, y0, y1], i) => {
    const [u0, u1] = RUNS[i]; quad([w + .03, y0, z0], [w + .03, y0, z1], [w + .03, y1, z1], [w + .03, y1, z0], false, 4, [u0, .885, u1, .11]);
  });
  if (J.patch) { const [x0, y0, x1, y1] = J.patch; quad([x0, y0, -.02], [x1, y0, -.02], [x1, y1, -.02], [x0, y1, -.02], false, 5, [.027, .988, .969, .033]); }
  const house = mesh(new Float32Array(P), new Float32Array(Cc), new Uint16Array(I), new Float32Array(T));

  // The moor takes the clean plate (the photograph with the house, shed, posts and light spill painted out) so the ground
  // behind the house is there when the house moves against it; the house takes the photograph itself.
  async function texture(src) {
    const t = gl.createTexture(), im = new Image(); im.src = src; await im.decode();
    gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
    gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  const photoTex = await texture('../media/photo-home-earth-2400.webp'), dmapTex = await texture('../media/photo-home-earth-depth.webp');
  terrain.tex = photoTex; house.tex = photoTex; backdrop.tex = photoTex;
  async function tiled(src) {               // a repeating Codex texture, and its average colour for the detail transfer
    const t = await texture(src); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameterf(gl.TEXTURE_2D, gl.getExtension('EXT_texture_filter_anisotropic')?.TEXTURE_MAX_ANISOTROPY_EXT ?? 0x84FE, 8);
    const im = new Image(); im.src = src; await im.decode(); const c2 = new OffscreenCanvas(1, 1).getContext('2d'); c2.drawImage(im, 0, 0, 1, 1);
    const [r_, g_, b_] = c2.getImageData(0, 0, 1, 1).data; t.avg = [r_ / 255, g_ / 255, b_ / 255, 1]; return t;
  }
  const tGround = await tiled('tex/moor_ground.webp'), tWall = await tiled('tex/wall.webp'), tRoof = await tiled('tex/roof.webp'), tWin = await texture('tex/gable_window.webp'), tSide = await texture('tex/side_openings.webp'), tPatch = await texture('tex/gable_apex_patch.webp');


  const win = J.window, WC = [(win.x0 + win.x1) / 2, (win.y0 + win.y1) / 2, 0];
  const D0 = Math.hypot(WC[0] - C0[0], WC[1] - C0[1], WC[2] - C0[2]);
  // Where the window's centre is in the photograph (0-1, y down): the point the zoom magnifies about.
  const wq = [0, 1, 2].map(i => R0[i][0] * (WC[0] - C0[0]) + R0[i][1] * (WC[1] - C0[1]) + R0[i][2] * (WC[2] - C0[2]));
  const centre = [(PW / 2 + F * wq[0] / wq[2]) / PW, (PH / 2 - F * wq[1] / wq[2]) / PH];

  // The live page's look, as a pass over this render: depthview.js's shade(), less its parallax march.
  const post = program(`#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`, `#version 300 es
precision highp float;
in vec2 uv; uniform sampler2D col, dep; uniform vec2 fpt; uniform vec4 fig; uniform float band, pull, lodAdd; out vec4 o;
void main(){
  vec2 f = vec2((uv.x - fig.x) / fig.z, (1. - uv.y - fig.y) / fig.w);          // this pixel in the live page's canvas space (y down)
  vec2 fs = vec2(fig.x + fpt.x * fig.z, 1. - (fig.y + fpt.y * fig.w));       // the focus point on this canvas
  float depth = texture(dep, uv).r, focus = texture(dep, fs).r;
  float byDepth = max(0., abs(depth - focus) - band) * 7.;
  float byScreen = smoothstep(.12, .55, abs(f.y - fpt.y)) * 2.2;
  float lod = clamp(max(byDepth, byScreen), 0., 3.4) + pull;
  // Blur radius in screen pixels: what the live page's blur would be, less its sharpest pixel, so what is in focus stays as sharp
  // as this render is, and only what is out of focus softens.
  float rad = (exp2(lod) - 1.) * exp2(lodAdd), L = log2(1. + rad);
  vec2 px = (1. + rad) / vec2(textureSize(col, 0));
  vec3 c = textureLod(col, uv, L).rgb * .36;
  c += textureLod(col, uv + px * vec2( .9,  .3), L).rgb * .16;
  c += textureLod(col, uv + px * vec2(-.3,  .9), L).rgb * .16;
  c += textureLod(col, uv + px * vec2(-.9, -.3), L).rgb * .16;
  c += textureLod(col, uv + px * vec2( .3, -.9), L).rgb * .16;
  float v = smoothstep(.95, .35, length((f - .5) * vec2(1., .8)));
  o = vec4(c * mix(.86, 1., v), 1.);
}`);
  const qv = gl.createVertexArray(); gl.bindVertexArray(qv); gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(gl.getAttribLocation(post, 'p')); gl.vertexAttribPointer(gl.getAttribLocation(post, 'p'), 2, gl.FLOAT, false, 0, 0);
  let fbo = null, colTex, depTex, zb, fw_ = 0, fh_ = 0;
  function targets() {
    if (fbo && fw_ === cv.width && fh_ === cv.height) return;
    fw_ = cv.width; fh_ = cv.height;
    const make = (fmt, levels) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texStorage2D(gl.TEXTURE_2D, levels, fmt, fw_, fh_);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, levels > 1 ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
    colTex = make(gl.RGBA8, 1 + Math.floor(Math.log2(Math.max(fw_, fh_)))); depTex = make(gl.RGBA8, 1);
    zb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, zb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, fw_, fh_);
    fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colTex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, depTex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, zb);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
  }
  const U = n => gl.getUniformLocation(prog, n), UP = n => gl.getUniformLocation(post, n);

  // view: z, the magnification of the live page's photograph; dolly, 0-1, how far along its line of sight to the window the camera
  // has moved since the hand-over; fig, the live page's figure (left, top, width, height in CSS px); fp, cam and sc, the live
  // page's focus point, drift and photo scale (depthview state()).
  function draw({ z, dolly, fig, fp, cam, sc }) {
    const dpr = Math.min(2, devicePixelRatio || 1), Wc = innerWidth, Hc = innerHeight;
    if (cv.width !== Math.round(Wc * dpr) || cv.height !== Math.round(Hc * dpr)) { cv.width = Math.round(Wc * dpr); cv.height = Math.round(Hc * dpr); }
    targets();
    // Screen -> photograph exactly as the live page maps it: the figure, its 0.9 scale, then the zoom about the window.
    const [L_, T_, FW, FH] = fig;
    const ax = (Wc / 2) / FW * sc[0] / z, bx = centre[0] + (((Wc / 2 - L_) / FW - .5) * sc[0] + .5 - centre[0]) / z;
    const ay = -(Hc / 2) / FH * sc[1] / z, by = centre[1] + (((Hc / 2 - T_) / FH - .5) * sc[1] + .5 - centre[1]) / z;
    const al = PW / F * ax, be = PW / F * (bx - .5), ga = -PH / F * ay, de = -PH / F * (by - .5);
    // The camera: at the photograph's camera, then along the line to the window, the window's distance falling evenly in log scale
    // to where it fills most of the screen. The drift moves it a little about the window, as the live page's parallax does.
    const Dend = 1.35 / (1.15 * ga), Dc = D0 * Math.pow(Math.min(1, Dend / D0), dolly), k = 1 - Dc / D0;
    let pos = [0, 1, 2].map(i => C0[i] + (WC[i] - C0[i]) * k);
    const tx = -.29 * cam[0] / z, ty = .185 * cam[1] / z;
    pos = [0, 1, 2].map(i => pos[i] + R0[0][i] * tx + R0[1][i] * ty);
    const b2 = be - tx / Dc, d2 = de - ty / Dc;
    const v = new Float32Array(16), tr = [0, 1, 2].map(i => -(R0[i][0] * pos[0] + R0[i][1] * pos[1] + R0[i][2] * pos[2]));
    for (let i = 0; i < 3; i++) { for (let j = 0; j < 3; j++) v[j * 4 + i] = (i === 2 ? -1 : 1) * R0[i][j]; v[12 + i] = (i === 2 ? -1 : 1) * tr[i]; }
    v[15] = 1;
    const n = .05, fz = 80000;
    const p = new Float32Array([1 / al, 0, 0, 0, 0, 1 / ga, 0, 0, b2 / al, d2 / ga, -(fz + n) / (fz - n), -1, 0, 0, -2 * fz * n / (fz - n), 0]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, fw_, fh_);
    gl.clearBufferfv(gl.COLOR, 0, [.36, .4, .46, 1]); gl.clearBufferfv(gl.COLOR, 1, [0, 0, 0, 0]); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    gl.useProgram(prog); gl.uniformMatrix4fv(U('view'), false, v); gl.uniformMatrix4fv(U('proj'), false, p);
    gl.uniformMatrix3fv(U('uR'), true, R0.flat()); gl.uniform3fv(U('uC'), C0); gl.uniform1f(U('uF'), F); gl.uniform2f(U('uSize'), PW, PH);
    gl.uniform4fv(U('avg'), [...tGround.avg, ...tWall.avg, ...tRoof.avg]); gl.uniform4f(U('win'), win.x0, win.x1, win.y0, win.y1); gl.uniform1f(U('houseW'), J.w);
    [['tGround', tGround], ['tWall', tWall], ['tRoof', tRoof], ['tWin', tWin], ['tSide', tSide], ['tPatch', tPatch], ['dmap', dmapTex]].forEach(([nm, t_], i) => { gl.activeTexture(gl.TEXTURE1 + i); gl.bindTexture(gl.TEXTURE_2D, t_); gl.uniform1i(U(nm), 1 + i); });
    gl.uniform1i(U('photo'), 0); gl.activeTexture(gl.TEXTURE0);
    // Photograph pixels per screen pixel at the hand-over: the textures take over only well past that.
    gl.uniform1f(U('s0'), PW * ax * 2 / cv.width);
    gl.depthMask(false); gl.bindTexture(gl.TEXTURE_2D, backdrop.tex); gl.bindVertexArray(backdrop.vao); gl.drawElements(gl.TRIANGLES, backdrop.n, backdrop.type, 0); gl.depthMask(true);
    for (const m of [terrain, house]) { gl.bindTexture(gl.TEXTURE_2D, m.tex); gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.n, m.type, 0); }
    gl.bindTexture(gl.TEXTURE_2D, colTex); gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cv.width, cv.height); gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    gl.useProgram(post); gl.bindVertexArray(qv);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, colTex); gl.uniform1i(UP('col'), 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, depTex); gl.uniform1i(UP('dep'), 1);
    gl.uniform2f(UP('fpt'), fp[0], fp[1]); gl.uniform4f(UP('fig'), L_ / Wc, T_ / Hc, FW / Wc, FH / Hc);
    gl.uniform1f(UP('band'), .06); gl.uniform1f(UP('pull'), 0);
    // The live page blurs in the 2400 px photograph's pixels; the same blur here, in screen pixels.
    gl.uniform1f(UP('lodAdd'), Math.log2(FW * dpr * z / (sc[0] * 2400)));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.activeTexture(gl.TEXTURE0);
  }
  return { draw, centre };
}
