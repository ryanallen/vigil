// A camera's live view: a Blender scene, its Cycles light baked into textures, shown with three.js through a live
// tilt-shift lens. The camera is the scene's own Blender camera. It breathes (a slow, weighted drift, not a pan across
// a still) and leans toward the pointer or the phone's tilt, eased so it carries weight. The lens keeps a band sharp
// across the frame at the height of what you point at, and softens what lies above and below it and what lies nearer
// or farther than it, so places read as miniatures; the focus racks to the pointer and wanders when left alone.
// Drawing stops off screen; with reduced motion the camera and the focus hold still.
import * as THREE from '../vendor/three/three.module.min.js';
import { GLTFLoader } from '../vendor/three/loaders/GLTFLoader.js';

const LENS_VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const LENS_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor; uniform sampler2D tDepth;
uniform vec2 uFocus; uniform float uDebug; uniform float uBand, uSoft, uMaxLod, uNear, uFar, uAspect, uDepthK;
float lin(float d) { float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
void main() {
  float d = lin(texture2D(tDepth, vUv).r);
  float fd = lin(texture2D(tDepth, uFocus).r);
  float screen = smoothstep(uBand, uBand + uSoft, abs(vUv.y - uFocus.y));
  float depth = smoothstep(0.06, 0.06 + uDepthK, abs(log(d / fd)));
  float lod = max(screen, depth * 0.85) * uMaxLod;
  // five taps on a disc at that mip level read as a lens, not a box blur
  float r = exp2(lod) / 1600.0;
  vec4 c = textureLod(tColor, vUv, lod) * 0.36;
  c += textureLod(tColor, vUv + vec2( r, 0.0) * vec2(1.0, uAspect), lod) * 0.16;
  c += textureLod(tColor, vUv + vec2(-r, 0.0) * vec2(1.0, uAspect), lod) * 0.16;
  c += textureLod(tColor, vUv + vec2(0.0,  r) * vec2(1.0, uAspect), lod) * 0.16;
  c += textureLod(tColor, vUv + vec2(0.0, -r) * vec2(1.0, uAspect), lod) * 0.16;
  gl_FragColor = c;
  if (uDebug > 0.5) gl_FragColor = vec4(screen, depth, d / 20.0, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function mount(canvas, { onFrame } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  let cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.05, 20000);
  let base = null, aspect0 = 16 / 9, fov0 = 50;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const look = { x: 0, y: 0, tx: 0, ty: 0 };
  const focus = { x: 0.5, y: 0.55, tx: 0.5, ty: 0.55, idle: 0 };
  let visible = true, raf = 0, t0 = performance.now();

  // the scene renders into a linear, multisampled target with depth; the lens pass reads it and writes the screen
  const rt = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: 4, generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, depthTexture: new THREE.DepthTexture(16, 16) });
  const lens = new THREE.ShaderMaterial({
    vertexShader: LENS_VERT, fragmentShader: LENS_FRAG, depthTest: false, depthWrite: false, toneMapped: true,
    uniforms: { tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, uFocus: { value: new THREE.Vector2(0.5, 0.45) }, uDebug: { value: 0 },
      uBand: { value: 0.07 }, uSoft: { value: 0.32 }, uMaxLod: { value: 4.2 }, uNear: { value: 0.05 }, uFar: { value: 20000 },
      uAspect: { value: 16 / 9 }, uDepthK: { value: 0.9 } },
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), lens); quad.frustumCulled = false;
  const post = new THREE.Scene(); post.add(quad); const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    look.tx = x * 2 - 1; look.ty = y * 2 - 1; focus.tx = x; focus.ty = 1 - y; focus.idle = performance.now();
  });
  canvas.addEventListener('pointerleave', () => { look.tx = 0; look.ty = 0; });
  addEventListener('deviceorientation', e => {
    if (e.gamma == null) return;
    look.tx = Math.max(-1, Math.min(1, e.gamma / 25)); look.ty = Math.max(-1, Math.min(1, (e.beta - 45) / 25));
  });
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) loop(); }).observe(canvas);

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    const pr = Math.min(devicePixelRatio, 2);
    renderer.setPixelRatio(pr); renderer.setSize(w, h, false); rt.setSize(Math.round(w * pr), Math.round(h * pr));
    cam.aspect = w / h; lens.uniforms.uAspect.value = w / h;
    // keep the Blender frame's width in view on narrow screens, its height on wide ones
    const v = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov0) / 2) * Math.max(1, aspect0 / cam.aspect));
    cam.fov = THREE.MathUtils.radToDeg(v); cam.updateProjectionMatrix();
    lens.uniforms.uNear.value = cam.near; lens.uniforms.uFar.value = cam.far;
  }
  new ResizeObserver(resize).observe(canvas);

  const ease = (a, b, k) => a + (b - a) * k;
  const q = new THREE.Quaternion(), e3 = new THREE.Euler(0, 0, 0, 'YXZ');
  function frame(now) {
    raf = 0; if (!visible || !base) return;
    const t = (now - t0) / 1000;
    look.x = ease(look.x, look.tx, 0.035); look.y = ease(look.y, look.ty, 0.035);
    // left alone for a while, the focus wanders slowly across the middle of the frame
    if (!still && now - focus.idle > 6000) { focus.tx = 0.5 + Math.sin(t * 0.05) * 0.22; focus.ty = 0.45 + Math.sin(t * 0.037 + 1) * 0.12; }
    focus.x = ease(focus.x, focus.tx, still ? 1 : 0.06); focus.y = ease(focus.y, focus.ty, still ? 1 : 0.06);
    lens.uniforms.uFocus.value.set(focus.x, focus.y);
    // breathing: two slow incommensurate sways, centimetres and fractions of a degree, like a camera on a tripod head
    const bx = still ? 0 : Math.sin(t * 0.21) * 0.018 + Math.sin(t * 0.077) * 0.03;
    const by = still ? 0 : Math.sin(t * 0.17 + 1.3) * 0.012;
    cam.position.copy(base.pos).add(new THREE.Vector3(bx + look.x * 0.06, by - look.y * 0.03, 0).applyQuaternion(base.quat));
    e3.set(-look.y * 0.035 + (still ? 0 : Math.sin(t * 0.13) * 0.004), -look.x * 0.06 + (still ? 0 : Math.sin(t * 0.09) * 0.006), 0);
    cam.quaternion.copy(base.quat).multiply(q.setFromEuler(e3));
    renderer.setRenderTarget(rt); renderer.render(scene, cam);
    renderer.setRenderTarget(null); renderer.render(post, postCam);
    onFrame?.(t);
    if (!still) loop();
  }
  function loop() { if (!raf) raf = requestAnimationFrame(frame); }

  return {
    async load(url) {
      const gltf = await new GLTFLoader().loadAsync(url);
      scene.clear(); scene.add(gltf.scene);
      // colour × baked light, then Blender's exposure and AgX (bake.py stores light over light_scale)
      const ex = gltf.scene.userData || {}, scale = ex.light_scale || 4;
      renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = 2 ** (ex.exposure || 0);
      lens.needsUpdate = true;
      const tl = new THREE.TextureLoader(), dir = new URL('.', new URL(url, location.href)).href, waits = [];
      gltf.scene.traverse(o => {
        if (!o.isMesh) return;
        const m = o.material;
        if (m.map) { m.map.anisotropy = renderer.capabilities.getMaxAnisotropy(); m.map.colorSpace = THREE.SRGBColorSpace; }
        if (/glass/i.test(m.name)) { m.transparent = true; m.opacity = 0.12; m.depthWrite = false; return; }
        const lm = o.userData.lightmap || o.parent?.userData.lightmap;
        if (lm) waits.push(tl.loadAsync(dir + lm).then(t => {
          t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.channel = 0;
          m.lightMap = t; m.lightMapIntensity = scale * Math.PI; m.needsUpdate = true;
        }));
      });
      await Promise.all(waits);
      const bc = gltf.cameras[0];
      if (bc) {
        bc.updateWorldMatrix(true, false);
        base = { pos: bc.getWorldPosition(new THREE.Vector3()), quat: bc.getWorldQuaternion(new THREE.Quaternion()) };
        fov0 = bc.fov; aspect0 = bc.aspect || 16 / 9;
      } else base = { pos: new THREE.Vector3(0, 1.5, 3), quat: new THREE.Quaternion() };
      resize(); loop();
      return gltf;
    },
    focus(x, y) { focus.tx = x; focus.ty = 1 - y; focus.idle = performance.now(); },
    lens, scene, renderer, get camera() { return cam; },
  };
}
