// Vigil's 3D view of the house photograph, for the zoom. The moor is a mesh traced from the photograph's depth, the house real
// geometry measured from it (house-fit.json); both take their colour from the photograph projected from its own camera, so from
// that camera this view is the photograph. It draws through exactly the live page's look (depthview.js: focus racked to the
// depth under the pointer, the tilt-shift band, the soft edges), using the same depth map, the same focus point and the same
// drift, so the hand-over from the flat photograph to this does not show. Past the hand-over the camera moves in along its own
// line of sight to the lit window; where the photograph runs out of pixels, Codex's textures take over in the photograph's colours.
// mountEngine(canvas) -> { draw(view), centre } or null without WebGL2.
const V = '1795704836';
export async function mountEngine(canvas) {
  const cv = canvas, gl = cv.getContext('webgl2', { antialias: false, alpha: true, premultipliedAlpha: false });
  if (!gl) return null;
  const J = await (await fetch('house-fit.json?v=' + V)).json();
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
  uniform mat4 view, proj; uniform vec3 uEye; out vec3 wp; out vec3 c; out vec2 tu;
  void main(){
    vec3 p = pos;
    if (col.y > 12.5 && col.y < 13.5) p.y -= tuv.x * (1. - smoothstep(110., 40., distance(p.xz, uEye.xz)));
    wp = p; c = col; tu = tuv; gl_Position = proj * view * vec4(p, 1.);
  }`;
  // Colour: the photograph projected from its camera (uR, uC, uF). col.x > 0.5 marks a face the photograph cannot see
  // (it takes the flat colour col.yz-coded instead); the window's glass glows warm.
  // Colour: the photograph projected from its own camera. Where one photo pixel covers more than a screen pixel, the photo has
  // run out of detail, so a Codex texture takes over there, scaled to the photo's own local colour (detail transfer), so the
  // colour never shifts. c.x: 1 = a face the photograph never saw (the texture alone, tinted to the house's whitewash);
  // c.y: material (0 ground, 1 wall, 2 roof, 3 window frame and glass).
  const FS = `#version 300 es
  precision highp float;
  in vec3 wp; in vec3 c; in vec2 tu; uniform sampler2D photo, tWall, tRoof, tGround, tWin, tAtlas, tWallH, tRWall, tFloor, tCeil, tDesk, tLamp, tChair, tCurtain;
  uniform vec3 uEye, uLamp;
  uniform mat3 uR; uniform vec3 uC; uniform float uF; uniform vec2 uSize; uniform vec4 avg[3]; uniform vec4 win; uniform float houseW, s0;
  uniform sampler2D dmap; uniform vec4 rects[9]; uniform vec3 eavg[9];
  layout(location = 0) out vec4 o; layout(location = 1) out vec4 od;
  vec3 detail(int m, out vec3 a){
    vec3 n = normalize(cross(dFdx(wp), dFdy(wp)));
    if (m == 0) { a = avg[0].rgb; return texture(tGround, wp.xz / 2.).rgb; }
    if (m == 2) { a = avg[2].rgb; return texture(tRoof, vec2(wp.z, length(vec2(wp.x - houseW * .5, wp.y))) / 2.).rgb; }
    // Whitewash over rough stone: Codex's wall with its height map lit from the dusk sky above, so the relief reads up close.
    vec2 wu = (abs(n.z) > abs(n.x) ? wp.xy : wp.zy) / 2.;
    float h0 = texture(tWallH, wu).r, hu = texture(tWallH, wu + vec2(0., .004)).r, hs = texture(tWallH, wu + vec2(.004, 0.)).r;
    a = avg[1].rgb; return texture(tWall, wu).rgb * clamp(1. + (hu - h0) * 3. + (hs - h0) * 1.2, .6, 1.3);
  }
  void main(){
    vec3 q = uR * (wp - uC);
    vec2 px = vec2(uSize.x * .5 + uF * q.x / q.z, uSize.y * .5 - uF * q.y / q.z), uv = px / uSize;
    // Derivatives first, in uniform control flow: a texture read after a per-pixel branch has no defined mip level and comes out blurred.
    vec2 gx = dFdx(uv), gy = dFdy(uv); float fw = max(fwidth(px.x), fwidth(px.y)) / s0;
    vec3 sharp = textureGrad(photo, uv, gx, gy).rgb;
    od = vec4(textureLod(dmap, clamp(uv, 0., 1.), 0.).r);
    int m = int(c.y + .5);
    float near = smoothstep(.35, .12, fw);          // 0 while the photograph has the detail, 1 once the camera is well past it
    vec3 nrm = normalize(cross(dFdx(wp), dFdy(wp))); nrm *= sign(dot(nrm, uEye - wp));
    if (m == 13) {                                  // grass: the moor's own colour there, darker at the root, paler and drier at the tip
      vec3 tone = textureLod(photo, uv, 4.).rgb;
      vec3 col = tone * mix(.5, 1.35, tu.y) * (.8 + .4 * c.z) * mix(vec3(1.), vec3(1.08, 1.04, .86), tu.y * c.z);
      vec3 lw = vec3(win.x * .5 + win.y * .5, win.z * .5 + win.w * .5, .3) - wp; float dw = length(lw);
      col += vec3(1., .55, .22) * .5 * step(wp.z, 0.) / (1. + dw * dw * 1.2);
      o = vec4(col, 1.); return;
    }
    if (m == 12) {                                  // Codex's elevations of this house, measured to it, in the photograph's dusk colour
      int id = int(c.z + .5); vec4 r_ = rects[id];
      vec3 t = textureGrad(tAtlas, r_.xy + clamp(tu, 0., 1.) * r_.zw, dFdx(tu) * r_.zw, dFdy(tu) * r_.zw).rgb;
      if ((id == 8 || id == 7) && max(t.r, max(t.g, t.b)) < .07) discard;
      vec3 tone = textureLod(photo, uv, 3.).rgb;
      vec3 col = c.x > .5 ? t * vec3(.5, .54, .6) * .55 : tone * t / eavg[id];
      if (id == 0) {
        vec3 lw = vec3(win.x * .5 + win.y * .5, win.z * .5 + win.w * .5, .3) - wp; float dw = length(lw);
        col += vec3(1., .55, .22) * .35 * max(0., dot(nrm, lw / dw)) / (1. + dw * dw * 1.6);
      }
      o = vec4(mix(sharp, col, near), 1.); return;
    }
    if (m == 11) {                                  // Codex's lamp, chair and curtain, cut out of their black and lit by the lamp
      vec3 t = c.z < .5 ? texture(tLamp, tu).rgb : c.z < 1.5 ? texture(tChair, tu).rgb : texture(tCurtain, tu).rgb;
      if (max(t.r, max(t.g, t.b)) < .07) discard;
      vec3 l = uLamp - wp; float dl = length(l);
      vec3 lit = vec3(1., .66, .38) * min(1.15, 1.6 / (1. + dl * dl * .8) + .35);
      o = vec4(c.z < .5 ? t * 1.25 : t * lit, 1.); return;
    }
    if (m == 10) {                                  // the panel: dark glass with the camera pictures faint in it, rows of them
      vec2 g = fract(tu * vec2(3., 2.)); float cell = step(.06, g.x) * step(g.x, .94) * step(.08, g.y) * step(g.y, .92);
      o = vec4(vec3(.05, .07, .09) + vec3(.16, .22, .26) * cell * (.6 + .4 * sin(tu.y * 300.)), 1.); return;
    }
    if (m == 6 || m == 7 || m == 9) {               // the room behind the window, lit only by the desk lamp
      // Codex's room: whitewashed stone walls, the plank floor, the timber ceiling, the worn desk.
      vec2 wuv = (abs(nrm.z) > abs(nrm.x) ? wp.xy : wp.zy) / 2.;
      vec3 alb = m == 7 ? texture(tDesk, (abs(nrm.y) > .5 ? wp.xz : wuv * 2.) ).rgb
               : c.z > 1.5 ? texture(tFloor, wp.xz / 2.).rgb : c.z > .5 ? texture(tCeil, wp.xz / 2.).rgb : texture(tRWall, wuv).rgb;
      vec3 l = uLamp - wp; float dl = length(l);
      vec3 lit = vec3(1., .62, .3) * (9. * max(0., dot(nrm, l / dl)) / (1. + dl * dl * .7) + .3);   // the lamp, and its light thrown round the small white room   // the lamp, and its light thrown back round the small whitewashed room
      o = vec4(m == 9 ? vec3(1., .78, .45) * 1.6 : alb * lit, 1.); return;
    }
    if (m == 8) {                                   // the stone reveal round the window: whitewash, warm toward the room
      vec3 a8, d8 = detail(1, a8); float inward = clamp(wp.z / .4, 0., 1.);
      vec3 col = d8 / a8 * vec3(.62, .65, .7) * mix(.55, .9, inward) + vec3(.35, .2, .08) * inward * inward;
      o = vec4(mix(sharp, col, near), 1.); return;
    }
    if (m == 3) {                                   // the gable window: Codex's frame, warm lit glass behind it
      vec2 wu = vec2((wp.x - win.x) / (win.y - win.x), 1. - (wp.y - win.z) / (win.w - win.z));
      vec3 f = texture(tWin, mix(vec2(.053, .045), vec2(.944, .954), wu)).rgb; float frame = smoothstep(.06, .16, max(f.r, max(f.g, f.b)));
      // Old glass: the room shows through it, the dusk sky faint on the upper panes; far off it is the photograph's window.
      vec4 glass = vec4(vec3(.55, .6, .68), .1 + .14 * smoothstep(.6, .0, wu.y));
      vec4 near4 = mix(glass, vec4(f * .45, 1.), frame);
      o = mix(vec4(sharp, 1.), near4, near); return;
    }
    vec3 a, d = detail(m, a);
    float k = m == 0 ? smoothstep(1., .55, fw) : smoothstep(.35, .12, fw);   // 0 until the camera is well closer than the photo's
    if (c.x > .5) { o = vec4(d * vec3(.62, .66, .72) / a * (c.z > 0. ? c.z : .55), 1.); return; }
    vec3 soft = textureLod(photo, uv, m == 0 ? 5. : 1.5).rgb;
    vec3 base = mix(sharp, soft * d / a, k);
    vec3 lw = vec3(win.x * .5 + win.y * .5, win.z * .5 + win.w * .5, .3) - wp; float dw = length(lw);
    float facing = max(0., dot(nrm, lw / dw)) * step(wp.z, .05);
    base += vec3(1., .55, .22) * .55 * facing / (1. + dw * dw * 1.6) * near * (m == 0 ? 1. : .6);
    o = vec4(base, 1.);
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
  const tv = new Float32Array(await (await fetch('terrain.f32?v=' + V)).arrayBuffer()), ti = new Uint32Array(await (await fetch('terrain.u32?v=' + V)).arrayBuffer());
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
  // The gable wall, with the window's opening through it.
  const W_ = J.window, DEP = .4, GZ = .28;
  // Elevation faces: e(a, b, c, d, id, uv, hidden), uv the elevation's [u0, v0, u1, v1] for corners a and c.
  const e = (a, b, c, d, id, uv, hid = false) => { shade = id; quad(a, b, c, d, hid, 12, uv); shade = 0; };
  const GH = 5.0, gu = (x, y) => [x / w, 1 - y / GH];     // the gable elevation is 5.6 m wide, 5.0 m tall
  const ge = (x0, y0, x1, y1) => e([x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0], 0, [...gu(x0, y0), ...gu(x1, y1)]);
  ge(0, 0, w, W_.y0); ge(0, W_.y1, w, h); ge(0, W_.y0, W_.x0, W_.y1); ge(W_.x1, W_.y0, w, W_.y1);
  // The reveal: the stone's thickness round the opening.
  quad([W_.x0, W_.y0, 0], [W_.x0, W_.y0, DEP], [W_.x0, W_.y1, DEP], [W_.x0, W_.y1, 0], false, 8); quad([W_.x1, W_.y0, DEP], [W_.x1, W_.y0, 0], [W_.x1, W_.y1, 0], [W_.x1, W_.y1, DEP], false, 8);
  quad([W_.x0, W_.y0, 0], [W_.x1, W_.y0, 0], [W_.x1, W_.y0, DEP], [W_.x0, W_.y0, DEP], false, 8); quad([W_.x0, W_.y1, DEP], [W_.x1, W_.y1, DEP], [W_.x1, W_.y1, 0], [W_.x0, W_.y1, 0], false, 8);
  // The room behind it (whitewashed, a timber ceiling, a plank floor), the watch desk under the window with its lamp, and the
  // empty chair pushed back.
  const RX0 = DEP, RX1 = w - DEP, RZ0 = DEP, RZ1 = L - DEP, RY0 = .05, RY1 = 2.3;
  shade = 0; quad([RX0, RY0, RZ1], [RX1, RY0, RZ1], [RX1, RY1, RZ1], [RX0, RY1, RZ1], false, 6); quad([RX0, RY0, RZ0], [RX0, RY0, RZ1], [RX0, RY1, RZ1], [RX0, RY1, RZ0], false, 6);
  quad([RX1, RY0, RZ1], [RX1, RY0, RZ0], [RX1, RY1, RZ0], [RX1, RY1, RZ1], false, 6);
  shade = 2; quad([RX0, RY0, RZ0], [RX1, RY0, RZ0], [RX1, RY0, RZ1], [RX0, RY0, RZ1], false, 6);
  shade = 1; quad([RX0, RY1, RZ1], [RX1, RY1, RZ1], [RX1, RY1, RZ0], [RX0, RY1, RZ0], false, 6);
  const DX = (W_.x0 + W_.x1) / 2; shade = 0;
  const blk = (x0, y0, z0, x1, y1, z1, m) => { quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], false, m); quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], false, m);
    quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], false, m); quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], false, m); quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], false, m); };
  blk(DX - .95, .71, RZ0, DX + .95, .76, RZ0 + .62, 7);
  for (const [lx, lz] of [[-.92, .02], [.86, .02], [-.92, .54], [.86, .54]]) blk(DX + lx, RY0, RZ0 + lz, DX + lx + .06, .71, RZ0 + lz + .06, 7);
  // Lamp, chair and curtain as cut-out cards facing the window: the lamp on the desk's left, the chair pushed back, the curtain drawn
  // to the window's left inside the glass.
  const card = (x0, y0, x1, y1, z_, code) => { shade = code; quad([x0, y0, z_], [x1, y0, z_], [x1, y1, z_], [x0, y1, z_], false, 11, [0, 1, 1, 0]); shade = 0; };
  card(DX - .42, .74, DX + .2, 1.36, RZ0 + .24, 0);
  card(DX - .15, -.04, DX + .98, 1.09, RZ0 + 1.25, 1);
  card(W_.x0 - .32, .62, W_.x0 + .43, 2.22, RZ0 + .08, 2);
  quad([DX - .12, .763, RZ0 + .1], [DX + .6, .763, RZ0 + .1], [DX + .6, .763, RZ0 + .46], [DX - .12, .763, RZ0 + .46], false, 10, [0, 1, 1, 0]);
  // The glass and frame, set back in the reveal; drawn after everything else, so the room shows through it.
  const glass = { P: [W_.x0, W_.y0, GZ, W_.x1, W_.y0, GZ, W_.x1, W_.y1, GZ, W_.x0, W_.y1, GZ], C: [0, 3, 0, 0, 3, 0, 0, 3, 0, 0, 3, 0], T: [0, 1, 1, 1, 1, 0, 0, 0], I: [0, 1, 2, 0, 2, 3] };
  // The long sides (6.6 m x 2.4 m, the window gable at the elevation's left), the back gable, the gable peaks, the roof slopes.
  e([w, 0, 0], [w, 0, L], [w, h, L], [w, h, 0], 2, [0, 1, 1, 0]); e([0, 0, L], [0, 0, 0], [0, h, 0], [0, h, L], 2, [1, 1, 0, 0], true);
  e([w, 0, L], [0, 0, L], [0, h, L], [w, h, L], 1, [0, 1, 1, 1 - h / GH], true);
  { const k_ = P.length / 3; for (const [v_, uv_] of [[[0, h, 0], gu(0, h)], [[w, h, 0], gu(w, h)], [[w / 2, r, 0], gu(w / 2, r)]]) { P.push(...v_); Cc.push(0, 12, 0); T.push(...uv_); } I.push(k_, k_ + 1, k_ + 2); }
  { const k_ = P.length / 3; for (const [v_, uv_] of [[[w, h, L], [0, 1 - h / GH]], [[0, h, L], [1, 1 - h / GH]], [[w / 2, r, L], [.5, 1 - r / GH]]]) { P.push(...v_); Cc.push(1, 12, 1); T.push(...uv_); } I.push(k_, k_ + 1, k_ + 2); }
  e([w + o, h - o * .55, -o], [w + o, h - o * .55, L + o], [w / 2, r + .05, L + o], [w / 2, r + .05, -o], 3, [0, 1, 1, 0]);
  e([w / 2, r + .05, -o], [w / 2, r + .05, L + o], [-o, h - o * .55, L + o], [-o, h - o * .55, -o], 3, [0, 0, 1, 1], true);
  // A box whose faces all take one elevation (front -z, +x, top, -x, back +z); seen says which the photograph saw.
  const ebox = (x0, y0, z0, x1, y1, z1, id, idSide = id, idTop = id, seen = [1, 1, 1, 1, 1]) => {
    e([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], id, [0, 1, 1, 0], !seen[0]);
    e([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], idSide, [0, 1, 1, 0], !seen[1]);
    e([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], idTop, [0, 1, 1, 0], !seen[2]);
    e([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], idSide, [0, 1, 1, 0], !seen[3]);
    e([x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], id, [0, 1, 1, 0], !seen[4]);
  };
  const [chx, chy, chz, chw] = J.chimney; ebox(chx - chw / 2, chy - 1.3, chz - chw / 2, chx + chw / 2, chy, chz + chw / 2, 4, 4, 4, [1, 1, 1, 0, 0]);
  // The low shed against the gable's left end, its lean-to roof, and the fence posts on the traced ground with their wire.
  { const [sx, sy] = J.shed; ebox(sx, 0, -1.2, 0, sy, -.05, 5, 6, 3, [1, 0, 1, 1, 0]);
    e([sx - .08, sy, -1.3], [.05, sy + .12, -1.3], [.05, sy + .12, 0], [sx - .08, sy, 0], 3, [0, 1, 1, 0]); }
  const posts = J.posts.slice().sort((a_, b_) => a_[0] - b_[0]);
  for (const [px, py, pz] of posts) ebox(px - .05, py - .1, pz - .05, px + .05, py + 1.1, pz + .05, 7, 7, 7, [1, 1, 1, 0, 0]);
  for (let i = 0; i + 1 < posts.length; i++) { const [a_, b_] = [posts[i], posts[i + 1]];
    e([a_[0], a_[1] + .35, a_[2]], [b_[0], b_[1] + .35, b_[2]], [b_[0], b_[1] + 1.0, b_[2]], [a_[0], a_[1] + 1.0, a_[2]], 8, [0, 1, 1, 0]); }
  const house = mesh(new Float32Array(P), new Float32Array(Cc), new Uint16Array(I), new Float32Array(T));
  // The ground's height round the house, from the traced moor, on a half-metre grid.
  const GX0 = -40, GZ0 = -80, GS = .5, GNX = 180, GNZ = 170, gsum = new Float32Array(GNX * GNZ), gn = new Float32Array(GNX * GNZ);
  for (let i = 0; i < nv; i++) { const gx = Math.floor((tp[i * 3] - GX0) / GS), gz = Math.floor((tp[i * 3 + 2] - GZ0) / GS);
    if (gx >= 0 && gz >= 0 && gx < GNX && gz < GNZ) { gsum[gz * GNX + gx] += tp[i * 3 + 1]; gn[gz * GNX + gx]++; } }
  const groundY = (x, z) => { let best = 0, bw = 0; const gx = (x - GX0) / GS, gz = (z - GZ0) / GS;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const ix = Math.floor(gx) + dx, iz = Math.floor(gz) + dz;
      if (ix < 0 || iz < 0 || ix >= GNX || iz >= GNZ || !gn[iz * GNX + ix]) continue; const wgt = 1 / (.2 + Math.hypot(ix + .5 - gx, iz + .5 - gz)); best += gsum[iz * GNX + ix] / gn[iz * GNX + ix] * wgt; bw += wgt; }
    return bw ? best / bw : 0; };
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const GP = [], GC = [], GT = [], GI = [];
  for (let n = 0; n < 22000; n++) {
    const cx = GX0 + 4 + rnd() * 80, cz = GZ0 + 4 + rnd() * 78;
    if (cx > J.shed[0] - .3 && cx < w + .3 && cz > -1.5 && cz < L + .3) continue;
    const big = rnd() ** 2, blades = 10 + Math.floor(big * 22), dry = rnd();   // mostly low turf, now and then a tall tussock
    for (let b = 0; b < blades; b++) {
      const a = rnd() * 6.283, rr = Math.sqrt(rnd()) * (.14 + big * .22), x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
      const y = groundY(x, z) - .02, hgt = (.07 + big * .38) * (.6 + rnd() * .6), lean = (rnd() - .5) * .25 + Math.cos(a) * .1, wd = .012 + rnd() * .01;
      const dx = Math.cos(a + 1.57) * wd, dz = Math.sin(a + 1.57) * wd, tx = Math.cos(a) * lean * hgt, tz = Math.sin(a) * lean * hgt;
      const k = GP.length / 3;
      GP.push(x - dx, y, z - dz, x + dx, y, z + dz, x + tx, y + hgt, z + tz); GC.push(0, 13, dry, 0, 13, dry, 0, 13, dry);
      GT.push(0, 0, 0, 0, hgt, 1); GI.push(k, k + 1, k + 2);
    }
  }
  const grass = mesh(new Float32Array(GP), new Float32Array(GC), new Uint32Array(GI), new Float32Array(GT));
  const pane = mesh(new Float32Array(glass.P), new Float32Array(glass.C), new Uint16Array(glass.I), new Float32Array(glass.T));
  const LAMP = [DX - .11, 1.24, RZ0 + .2];

  // The moor takes the clean plate (the photograph with the house, shed, posts and light spill painted out) so the ground
  // behind the house is there when the house moves against it; the house takes the photograph itself.
  async function texture(src) {
    const t = gl.createTexture(), im = new Image(); im.src = src; await im.decode();
    gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
    gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  const photoTex = await texture('../media/photo-home-earth-2400.webp'), cleanTex = await texture('clean.webp?v=' + V), dmapTex = await texture('../media/photo-home-earth-depth.webp');
  terrain.tex = cleanTex; grass.tex = cleanTex; house.tex = photoTex; backdrop.tex = cleanTex; pane.tex = photoTex;
  async function tiled(src) {               // a repeating Codex texture, and its average colour for the detail transfer
    const t = await texture(src); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameterf(gl.TEXTURE_2D, gl.getExtension('EXT_texture_filter_anisotropic')?.TEXTURE_MAX_ANISOTROPY_EXT ?? 0x84FE, 8);
    const im = new Image(); im.src = src; await im.decode(); const c2 = new OffscreenCanvas(1, 1).getContext('2d'); c2.drawImage(im, 0, 0, 1, 1);
    const [r_, g_, b_] = c2.getImageData(0, 0, 1, 1).data; t.avg = [r_ / 255, g_ / 255, b_ / 255, 1]; return t;
  }
  const tGround = await tiled('tex/moor_ground.webp?v=' + V), tWall = await tiled('tex/wall.webp?v=' + V), tRoof = await tiled('tex/roof.webp?v=' + V), tWin = await texture('tex/gable_window.webp?v=' + V), tAtlas = await texture('tex/house_atlas.webp?v=' + V), tWallH = await tiled('tex/wall_height.webp?v=' + V), tRWall = await tiled('tex/room_wall.webp?v=' + V), tFloor = await tiled('tex/floor.webp?v=' + V), tCeil = await tiled('tex/ceiling.webp?v=' + V), tDesk = await tiled('tex/desk_wood.webp?v=' + V), tLamp = await texture('tex/lamp.webp?v=' + V), tChair = await texture('tex/chair.webp?v=' + V), tCurtain = await texture('tex/curtain.webp?v=' + V);


  const AT = await (await fetch('tex/house_atlas.json?v=' + V)).json();
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
    // Over the last stretch the camera swings round to face the window square-on and the window moves to the middle of the screen.
    const u_ = Math.min(1, Math.max(0, (dolly - .55) / .45)), e = u_ * u_ * (3 - 2 * u_);
    const front = [WC[0] + tx * .2, WC[1] + .6 + ty * .2, -Dc * .9], AIM = [WC[0], WC[1] - .3, .9];
    const pos0 = pos.slice();
    pos = pos.map((x_, i) => x_ * (1 - e) + front[i] * e);
    const fz_ = [0, 1, 2].map(i => R0[2][i] * (1 - e) + (AIM[i] - pos[i]) / Math.hypot(AIM[0] - pos[0], AIM[1] - pos[1], AIM[2] - pos[2]) * e);
    const fn = Math.hypot(...fz_), F2 = fz_.map(x_ => x_ / fn), up = [0, 1, 2].map(i => R0[1][i] * (1 - e) + [0, 1, 0][i] * e);
    const X2 = [up[1] * F2[2] - up[2] * F2[1], up[2] * F2[0] - up[0] * F2[2], up[0] * F2[1] - up[1] * F2[0]], xn = Math.hypot(...X2), X3 = X2.map(x_ => x_ / xn);
    const Y3 = [F2[1] * X3[2] - F2[2] * X3[1], F2[2] * X3[0] - F2[0] * X3[2], F2[0] * X3[1] - F2[1] * X3[0]], RC = [X3, Y3, F2];
    // Where the window sits on screen: where the photograph's framing puts it, gliding to the centre as the camera swings round.
    // The projection's offset is solved each frame so the window is exactly there, whatever the camera's turn so far.
    const b0 = be - tx / Dc, d0 = de - ty / Dc;
    const wr0 = [0, 1, 2].map(i => R0[i][0] * (WC[0] - pos0[0]) + R0[i][1] * (WC[1] - pos0[1]) + R0[i][2] * (WC[2] - pos0[2]));
    const sx0 = (wr0[0] / wr0[2] - b0) / al, sy0 = (wr0[1] / wr0[2] - d0) / ga;
    const tgt = [sx0 * (1 - e), sy0 * (1 - e)];
    const wrc = [0, 1, 2].map(i => RC[i][0] * (WC[0] - pos[0]) + RC[i][1] * (WC[1] - pos[1]) + RC[i][2] * (WC[2] - pos[2]));
    const b2 = wrc[0] / wrc[2] - al * tgt[0], d2 = wrc[1] / wrc[2] - ga * tgt[1];
    const v = new Float32Array(16), tr = [0, 1, 2].map(i => -(RC[i][0] * pos[0] + RC[i][1] * pos[1] + RC[i][2] * pos[2]));
    for (let i = 0; i < 3; i++) { for (let j = 0; j < 3; j++) v[j * 4 + i] = (i === 2 ? -1 : 1) * RC[i][j]; v[12 + i] = (i === 2 ? -1 : 1) * tr[i]; }
    v[15] = 1;
    const n = .05, fz = 80000;
    const p = new Float32Array([1 / al, 0, 0, 0, 0, 1 / ga, 0, 0, b2 / al, d2 / ga, -(fz + n) / (fz - n), -1, 0, 0, -2 * fz * n / (fz - n), 0]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, fw_, fh_);
    gl.clearBufferfv(gl.COLOR, 0, [.36, .4, .46, 1]); gl.clearBufferfv(gl.COLOR, 1, [0, 0, 0, 0]); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    gl.useProgram(prog); gl.uniformMatrix4fv(U('view'), false, v); gl.uniformMatrix4fv(U('proj'), false, p);
    gl.uniformMatrix3fv(U('uR'), true, R0.flat()); gl.uniform3fv(U('uC'), C0); gl.uniform1f(U('uF'), F); gl.uniform2f(U('uSize'), PW, PH);
    gl.uniform4fv(U('avg'), [...tGround.avg, ...tWall.avg, ...tRoof.avg]); gl.uniform4f(U('win'), win.x0, win.x1, win.y0, win.y1); gl.uniform1f(U('houseW'), J.w);
    [['tGround', tGround], ['tWall', tWall], ['tRoof', tRoof], ['tWin', tWin], ['tAtlas', tAtlas], ['dmap', dmapTex], ['tWallH', tWallH], ['tRWall', tRWall], ['tFloor', tFloor], ['tCeil', tCeil], ['tDesk', tDesk], ['tLamp', tLamp], ['tChair', tChair], ['tCurtain', tCurtain]].forEach(([nm, t_], i) => { gl.activeTexture(gl.TEXTURE1 + i); gl.bindTexture(gl.TEXTURE_2D, t_); gl.uniform1i(U(nm), 1 + i); });
    gl.uniform1i(U('photo'), 0); gl.activeTexture(gl.TEXTURE0);
    // Photograph pixels per screen pixel at the hand-over: the textures take over only well past that.
    gl.uniform1f(U('s0'), PW * ax * 2 / cv.width);
    gl.depthMask(false); gl.bindTexture(gl.TEXTURE_2D, backdrop.tex); gl.bindVertexArray(backdrop.vao); gl.drawElements(gl.TRIANGLES, backdrop.n, backdrop.type, 0); gl.depthMask(true);
    gl.uniform4fv(U('rects'), AT.rects.flat()); gl.uniform3fv(U('eavg'), AT.avg.flat());
    gl.uniform3fv(U('uEye'), pos); gl.uniform3fv(U('uLamp'), LAMP);
    for (const m of [terrain, grass, house]) { gl.bindTexture(gl.TEXTURE_2D, m.tex); gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.n, m.type, 0); }
    gl.depthMask(false); gl.bindTexture(gl.TEXTURE_2D, pane.tex); gl.bindVertexArray(pane.vao); gl.drawElements(gl.TRIANGLES, pane.n, pane.type, 0); gl.depthMask(true);
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
