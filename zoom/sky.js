// The sky over the moor: a deck of cloud drifting on one wind, lit by a low sun behind it, with shafts of its light falling
// through the gaps, and the cloud's shadows passing over the land. The way planetary.html in the game makes its clouds
// (shape noise eroded by detail noise, coverage that gathers and parts, Beer and powder light, a two-lobe phase), cut down
// to what this one view needs. Two passes at half resolution: the cloud, and the shafts swept out from the sun across it.
// createSky(gl) -> { render(view), cloud, rays } ; view: { w, h, scale, zoom, zc, time } ; textures read by the page's shader.

const VS = `#version 300 es
layout(location = 0) in vec2 p; out vec2 uv;
void main() { uv = p * 0.5 + 0.5; uv.y = 1.0 - uv.y; gl_Position = vec4(p, 0.0, 1.0); }`;

// the photograph's fitted camera: its rotation (camera to world) and focal length in its own pixels
const CAMERA = `
const mat3 CAM = mat3(0.828835, -0.023750, 0.558988, -0.000549, 0.999064, 0.043263, -0.559492, -0.036165, 0.828046);
const vec2 PHOTO = vec2(1672.0, 941.0); const float FOC = 2296.89;
uniform vec2 scale, zc; uniform float zoom, time; uniform vec3 sun;
vec3 rayAt(vec2 uv) {
  vec2 q = (uv - 0.5) * scale + 0.5; q = zc + (q - zc) / zoom;
  return normalize(CAM * vec3((q.x - 0.5) * PHOTO.x / FOC, -(q.y - 0.5) * PHOTO.y / FOC, 1.0));
}`;

const FS_CLOUD = `#version 300 es
precision highp float; precision highp sampler3D;
in vec2 uv; layout(location = 0) out vec4 cloud; layout(location = 1) out vec4 light;
uniform sampler3D N;
${CAMERA}
const float CL0 = 0.9, CL1 = 3.2;                 // the deck, km above the moor
float remap(float v, float a, float b, float c, float d) { return c + (v - a) / (b - a) * (d - c); }
vec3 wind() { return vec3(time * 0.11, 0.0, time * 0.035); }
float density(vec3 p, bool detail) {
  float h = (p.y - CL0) / (CL1 - CL0);
  if (h < 0.0 || h > 1.0) return 0.0;
  vec3 w = p + wind();
  vec4 c = texture(N, w * vec3(0.018, 0.0, 0.018) + vec3(0.37, 0.5, 0.71));          // coverage, gathering and parting
  float cov = smoothstep(0.32, 0.72, c.b);
  float prof = smoothstep(0.0, 0.14, h) * (1.0 - smoothstep(0.45, 1.0, h));             // flat bellies, rounded tops
  float shape = texture(N, w * 0.16 + vec3(0.0, h * 0.3, 0.0)).r;
  float d = remap(shape * prof, 1.0 - cov, 1.0, 0.0, 1.0);
  if (d <= 0.0) return 0.0;
  if (detail) {
    float e = texture(N, (w + vec3(0.0, time * 0.01, 0.0)) * 0.85).g;
    d = remap(d, mix(e, 1.0 - e, clamp(h * 3.0, 0.0, 1.0)) * 0.32, 1.0, 0.0, 1.0);    // wisps below, billows above
  }
  return clamp(d * 3.0, 0.0, 1.0);
}
float hg(float c, float g) { float g2 = g * g; return (1.0 - g2) / (12.566 * pow(max(1.0 + g2 - 2.0 * g * c, 1e-4), 1.5)); }
float toSun(vec3 p) {                              // optical depth toward the sun, four steps lengthening
  float od = 0.0, s = 0.12;
  for (int i = 0; i < 4; i++) { p += sun * s; od += density(p, false) * s; s *= 1.9; }
  return od;
}
void main() {
  vec3 rd = rayAt(uv), ro = vec3(0.0, 0.021, 0.0);
  // a random start along each ray, new each frame, so the march leaves noise that the eye averages and not a pattern
  float j = fract(sin(dot(gl_FragCoord.xy + fract(time * 7.13) * 91.7, vec2(12.9898, 78.233))) * 43758.5453);
  if (rd.y <= 0.0) {
    // the moor: where along this ray the ground lies (near enough, a plane at its height), and how much cloud stands
    // between it and the sun: the shadow passing over it
    float t = min(ro.y / max(-rd.y, 1e-4), 40.0);
    vec3 g = ro + rd * t;
    vec3 s0 = g + sun * ((CL0 + 0.25) / max(sun.y, 0.05));
    float od = 0.0;
    for (int i = 0; i < 6; i++) od += density(s0 + sun * (float(i) + j) * 0.35, false) * 0.35;
    cloud = vec4(exp(-od * 5.0), 0.0, 0.0, 0.0); light = vec4(0.0);
    return;
  }
  float t0 = (CL0 - ro.y) / rd.y, t1 = min((CL1 - ro.y) / rd.y, 55.0);
  const int STEPS = 36;
  float dt = (t1 - t0) / float(STEPS), cosT = dot(rd, sun);
  float ph = mix(hg(cosT, -0.2), hg(cosT, 0.78), 0.7) * 12.566;
  vec3 sunC = vec3(1.0, 0.78, 0.62) * 1.15, ambTop = vec3(0.44, 0.48, 0.58), ambBot = vec3(0.26, 0.28, 0.34);
  vec3 C = vec3(0.0); float T = 1.0;
  for (int i = 0; i < STEPS; i++) {
    vec3 p = ro + rd * (t0 + (float(i) + j) * dt);
    float d = density(p, true);
    if (d > 0.003) {
      float h = (p.y - CL0) / (CL1 - CL0), od = toSun(p);
      float beer = exp(-od * 4.0) + 0.5 * exp(-od * 1.6), powder = 1.0 - exp(-d * 6.0);
      vec3 S = sunC * beer * mix(1.0, powder, 0.6) * ph + mix(ambBot, ambTop, h);
      S = max(S, vec3(0.2, 0.21, 0.25));                                                   // never black
      float a = 1.0 - exp(-d * dt * 7.0);
      C += T * a * S; T *= 1.0 - a; if (T < 0.02) break;
    }
  }
  // haze toward the horizon softens the far deck into the sky
  float haze = exp(-max(t0, 0.0) * 0.055);
  cloud = vec4(C * haze, (1.0 - T) * haze);
  // the sun's light where the sky lets it through: what the shafts are swept from
  float glow = pow(max(cosT, 0.0), 30.0) * 0.9 + pow(max(cosT, 0.0), 5.0) * 0.12;
  light = vec4(glow * (1.0 - cloud.a * 0.92), 0.0, 0.0, 1.0);
}`;

const FS_RAYS = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D L; uniform vec2 sunUV;
void main() {
  // shafts: the light gathered along the line to the sun, falling off with distance along it
  vec2 tc = vec2(uv.x, 1.0 - uv.y);                 // the textures' own orientation, row 0 at the bottom
  vec2 d = (sunUV - tc) / 48.0; vec2 p = tc; float a = 0.0, w = 1.0;
  float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  p += d * j;
  for (int i = 0; i < 48; i++) { a += texture(L, p).r * w; w *= 0.965; p += d; }
  o = vec4(a / 22.0, 0.0, 0.0, 1.0);
}`;

// A tileable 3D noise: r a Perlin-Worley shape, g a finer Worley fbm for detail, b a slow value noise for coverage.
function noiseVolume(S) {
  const data = new Uint8Array(S * S * S * 4);
  const hash = (x, y, z, s) => { let h = (x * 374761393 + y * 668265263 + z * 2147483647 + s * 1442695041) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const worley = (x, y, z, cells, seed) => {
    const px = x * cells, py = y * cells, pz = z * cells, ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz); let best = 9;
    for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx, cy = iy + dy, cz = iz + dz, wx = ((cx % cells) + cells) % cells, wy = ((cy % cells) + cells) % cells, wz = ((cz % cells) + cells) % cells;
      const fx = cx + hash(wx, wy, wz, seed) - px, fy = cy + hash(wx, wy, wz, seed + 1) - py, fz = cz + hash(wx, wy, wz, seed + 2) - pz;
      const d = fx * fx + fy * fy + fz * fz; if (d < best) best = d;
    }
    return 1 - Math.min(1, Math.sqrt(best));
  };
  const value = (x, y, z, cells, seed) => {
    const px = x * cells, py = y * cells, pz = z * cells, ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz);
    const fx = px - ix, fy = py - iy, fz = pz - iz, s = t => t * t * (3 - 2 * t), ux = s(fx), uy = s(fy), uz = s(fz);
    const g = (a, b, c) => hash(((a % cells) + cells) % cells, ((b % cells) + cells) % cells, ((c % cells) + cells) % cells, seed);
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(g(ix, iy, iz), g(ix + 1, iy, iz), ux), l(g(ix, iy + 1, iz), g(ix + 1, iy + 1, iz), ux), uy),
             l(l(g(ix, iy, iz + 1), g(ix + 1, iy, iz + 1), ux), l(g(ix, iy + 1, iz + 1), g(ix + 1, iy + 1, iz + 1), ux), uy), uz);
  };
  let k = 0;
  for (let z = 0; z < S; z++) for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, w = z / S;
    const pv = value(u, v, w, 4, 1) * 0.5 + value(u, v, w, 8, 2) * 0.3 + value(u, v, w, 16, 3) * 0.2;
    const wf = worley(u, v, w, 4, 10) * 0.625 + worley(u, v, w, 8, 20) * 0.25 + worley(u, v, w, 16, 30) * 0.125;
    const shape = Math.min(1, Math.max(0, pv * 0.55 + wf * 0.75 - 0.25));
    const detail = worley(u, v, w, 8, 40) * 0.625 + worley(u, v, w, 16, 50) * 0.25 + worley(u, v, w, 32, 60) * 0.125;
    const cov = value(u, v, w, 2, 7) * 0.65 + value(u, v, w, 4, 8) * 0.35;
    data[k++] = shape * 255; data[k++] = detail * 255; data[k++] = cov * 255; data[k++] = 255;
  }
  return data;
}

export function createSky(gl) {
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(x)); return x; };
  const prog = fs => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p); return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null; };
  const pc = prog(FS_CLOUD), pr = prog(FS_RAYS);
  if (!pc || !pr) return null;
  const S = 64, vol = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_3D, vol);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, S, S, S, 0, gl.RGBA, gl.UNSIGNED_BYTE, noiseVolume(S));
  gl.generateMipmap(gl.TEXTURE_3D);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.REPEAT], [gl.TEXTURE_WRAP_T, gl.REPEAT], [gl.TEXTURE_WRAP_R, gl.REPEAT]]) gl.texParameteri(gl.TEXTURE_3D, k, v);
  const target = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); return t; };
  const cloud = target(), light = target(), rays = target();
  const fbC = gl.createFramebuffer(), fbR = gl.createFramebuffer();
  let W = 0, H = 0, fresh = true, lastZ = 0;
  const size = (w, h) => {
    if (w === W && h === H) return; W = w; H = h; fresh = true;
    for (const t of [cloud, light, rays]) { gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbC);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, cloud, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, light, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbR);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rays, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };
  // the sun: low in the west behind the deck, a little left of the house as the photograph looks
  const sun = (() => { const v = [-0.62, 0.11, 0.78], l = Math.hypot(...v); return v.map(x => x / l); })();
  const M = [0.828835, -0.023750, 0.558988, -0.000549, 0.999064, 0.043263, -0.559492, -0.036165, 0.828046];   // camera to world, by columns
  const U = (p, n) => gl.getUniformLocation(p, n);
  return {
    cloud, rays, sun,
    render(v) {
      const w = Math.max(64, Math.round(v.w * v.res)), h = Math.max(36, Math.round(v.h * v.res));
      size(w, h);
      // where the sun falls on the screen: into the camera's frame, onto the photograph, through the zoom
      const c = [0, 1, 2].map(i => M[i * 3] * sun[0] + M[i * 3 + 1] * sun[1] + M[i * 3 + 2] * sun[2]);
      const qx = 0.5 + c[0] / c[2] * 2296.89 / 1672, qy = 0.5 - c[1] / c[2] * 2296.89 / 941;
      const px_ = v.zc[0] + (qx - v.zc[0]) * v.zoom, py_ = v.zc[1] + (qy - v.zc[1]) * v.zoom;
      const sunUV = [(px_ - 0.5) / v.scale[0] + 0.5, (py_ - 0.5) / v.scale[1] + 0.5];
      gl.viewport(0, 0, w, h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbC); gl.useProgram(pc);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_3D, vol); gl.uniform1i(U(pc, 'N'), 0);
      gl.uniform2f(U(pc, 'scale'), v.scale[0], v.scale[1]); gl.uniform2f(U(pc, 'zc'), v.zc[0], v.zc[1]);
      gl.uniform1f(U(pc, 'zoom'), v.zoom); gl.uniform1f(U(pc, 'time'), v.time); gl.uniform3f(U(pc, 'sun'), ...sun);
      // each frame's march blended into the last few, so its random starts average out; all at once while the view moves
      const k = fresh || Math.abs(v.zoom - lastZ) > 1e-4 ? 1 : 0.22; fresh = false; lastZ = v.zoom;
      gl.enable(gl.BLEND); gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA); gl.blendColor(0, 0, 0, k);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.disable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbR); gl.useProgram(pr);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, light); gl.uniform1i(U(pr, 'L'), 0);
      gl.uniform2f(U(pr, 'sunUV'), sunUV[0], 1 - sunUV[1]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return sunUV;
    },
  };
}
