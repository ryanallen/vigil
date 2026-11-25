// Shaft 3 at Kirra Station in 3D: Drill 7 and its crew, following the job's state.
// mount(el) draws into el; set(state) moves the scene to match: 'seized', 'crew', 'out', 'fitted', 'hot', 'running'.
import * as THREE from '../vendor/three/three.module.min.js';
import { GLTFLoader } from '../vendor/three/loaders/GLTFLoader.js';
import { OrbitControls } from '../vendor/three/controls/OrbitControls.js';

const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const GLOW = { seized: 0xff3b4f, hot: 0xff3b4f, crew: 0xffb347, out: 0x000000, fitted: 0xffb347, running: 0x5cf0b0 };

let renderer, scene, camera, controls, model, rotor, bearing, robots = [], lamps = [], state = 'seized', spin = 0;
const facing = [];
let host, running = false, visible = false, last = 0;
const homes = [], dest = [], t0 = performance.now();

export async function mount(el) {
  host = el;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.55;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  el.prepend(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070d);
  scene.fog = new THREE.FogExp2(0x2a2c31, 0.0022);
  camera = new THREE.PerspectiveCamera(14, 1, 1, 900);
  camera.position.set(74, 96, 112);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(-2, 5, 1);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 110; controls.maxDistance = 220; controls.enableZoom = true;
  controls.maxPolarAngle = Math.PI * 0.33; controls.minPolarAngle = Math.PI * 0.16;
  controls.minAzimuthAngle = -0.35; controls.maxAzimuthAngle = 1.35;
  controls.autoRotate = !still; controls.autoRotateSpeed = 0.35;
  controls.addEventListener('start', () => { controls.autoRotate = false; });

  scene.add(new THREE.HemisphereLight(0xe4e7ec, 0x4a463e, 1.7));
  const key = new THREE.DirectionalLight(0xfff6ea, 4.6);
  key.position.set(-30, 46, 14); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.06;
  Object.assign(key.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 90 });
  scene.add(key);

  const gltf = await new GLTFLoader().loadAsync(new URL('../media/3d/kirra.glb', import.meta.url).href);
  model = gltf.scene;
  model.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = !/^Wall|^Floor/.test(o.name) || o.name === 'Floor';
    if (o.name === 'Wall') o.castShadow = false;
  });
  scene.add(model);
  rotor = model.getObjectByName('Rotor');
  bearing = model.getObjectByName('Bearing');
  bearing.material = bearing.material.clone();
  for (let i = 1; i <= 4; i++) {
    const r = model.getObjectByName('Robot' + i); robots.push(r); homes.push(r.position.clone());
    const a = Math.PI * 0.12 + (i - 1) * 0.42;
    dest.push(new THREE.Vector3(Math.cos(a) * 7.2, 0, Math.sin(a) * 7.2));
    const l = model.getObjectByName('Light' + i);
    const p = new THREE.PointLight(0xffe2b8, 25, 16, 2); p.position.copy(l.position); scene.add(p); lamps.push(p);
  }
  // A cold blue fill from the haul ramp, and the bearing's own light.
  const fill = new THREE.PointLight(0xffffff, 0, 1, 2); fill.position.set(14, 10, -12); scene.add(fill);
  bearing.userData.light = new THREE.PointLight(0xff3b4f, 20, 10, 2); bearing.userData.light.position.set(0, 10.2, 0); scene.add(bearing.userData.light);

  // Codex's rock and ground on the shaft, and the machines built from Codex's sheets (source/blender/sheets.py).
  dress().then(() => { faceCamera(); draw(); });

  new ResizeObserver(resize).observe(el); resize();
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); }).observe(el);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loop(); });
  set(state);
}

const media = n => new URL('../media/3d/' + n, import.meta.url).href;
function texture(name, repeat) {
  const t = new THREE.TextureLoader().load(media(name), draw);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const hidden = new THREE.MeshBasicMaterial({ visible: false });
function hide(obj) { obj.traverse(o => { if (o.isMesh) o.material = hidden; }); }
function shadows(obj) { obj.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }); return obj; }

// A radial fade, so the pad's edge sinks into the regolith instead of a hard disc.
function padFade() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 30, 64, 64, 64);
  r.addColorStop(0, '#fff'); r.addColorStop(1, '#000'); g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
async function dress() {
  const wall = model.getObjectByName('Wall'), floor = model.getObjectByName('Floor');
  wall.material = new THREE.MeshStandardMaterial({ map: texture('tex-asteroid-rock.webp', [10, 3]), color: 0xb4b8c2, roughness: 0.9, metalness: 0.3 });
  // An open pit seen from the rim: the old shaft wall and ramp go; terraced benches step up and out from the floor.
  hide(wall); model.traverse(o => { if (/^Ramp/.test(o.name)) o.visible = false; });
  const rock = new THREE.MeshStandardMaterial({ map: texture('tex-asteroid-rock.webp', [14, 2]), color: 0xd8dbe2, roughness: 0.95, metalness: 0.05 });
  const bench = new THREE.MeshStandardMaterial({ map: texture('tex-ground-regolith.webp', [24, 2]), color: 0xa8abb4, roughness: 0.95, metalness: 0.1 });
  const BENCH = 7, RISE = 3.2;
  for (let k = 0; k < 7; k++) {
    const r0 = 24 + k * BENCH, y0 = k * RISE;
    const face = new THREE.Mesh(new THREE.CylinderGeometry(r0 + 1.6, r0, RISE, 96, 1, true), rock);
    face.position.y = y0 + RISE / 2; face.material.side = THREE.DoubleSide; face.receiveShadow = face.castShadow = true;
    const top = new THREE.Mesh(new THREE.RingGeometry(r0 + 1.6, r0 + BENCH, 96, 1), bench);
    top.rotation.x = -Math.PI / 2; top.position.y = y0 + RISE; top.receiveShadow = true;
    scene.add(face, top);
  }
  floor.scale.set(0.82, 1, 0.82);
  floor.material = new THREE.MeshStandardMaterial({ map: texture('tex-ground-regolith.webp', [7, 7]), color: 0xa8abb4, roughness: 0.95, metalness: 0.1 });
  const steel = new THREE.MeshStandardMaterial({ map: texture('tex-drill-steel.webp', [1, 3]), roughness: 0.42, metalness: 0.8 });
  const hazard = new THREE.MeshStandardMaterial({ map: texture('tex-hazard-yellow.webp', [1, 1]), roughness: 0.55, metalness: 0.3 });
  const hull = new THREE.MeshStandardMaterial({ map: texture('tex-hull-panels.webp', [2, 1]), color: 0x9aa6b8, roughness: 0.5, metalness: 0.6 });
  model.traverse(o => {
    if (!o.isMesh) return;
    if (/^(Leg|Brace|Tower|Gantry)/.test(o.name)) o.material = steel;
    else if (/^(Foot|Stripe|Bay2Stripe)/.test(o.name)) o.material = hazard;
    else if (/^(Motor|Bay2$)/.test(o.name)) o.material = hull;
  });
  // A poured pad under the rig, and Psyche's sky over the open shaft.
  const pad = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.MeshStandardMaterial({ map: texture('tex-concrete-pad.webp', [3, 3]), color: 0x5c606a, roughness: 0.95, transparent: true, alphaMap: padFade() }));
  pad.rotation.x = -Math.PI / 2; pad.position.y = 0.02; pad.receiveShadow = true; scene.add(pad);
  new THREE.TextureLoader().load(media('sky-psyche.webp'), t => { t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; scene.background = t; scene.backgroundIntensity = 0.55; draw(); });

  const loader = new GLTFLoader();
  const [robot, truck, ring, head] = await Promise.all(['maint-robot', 'haul-truck', 'bearing', 'drill-head']
    .map(n => loader.loadAsync(media(n + '.glb')).then(g => shadows(g.scene))));

  // Each box robot keeps its place and its walk; its look is the model's.
  // The box stand-ins carry their offset in their mesh, so each robot becomes its own group where its box stood.
  robots.forEach((r, i) => {
    const c = new THREE.Box3().setFromObject(r).getCenter(new THREE.Vector3());
    hide(r);
    const g = new THREE.Group(); g.position.set(c.x, 0, c.z); scene.add(g);
    const m = robot.clone(); m.scale.setScalar(1.25); g.add(m); facing.push(m);
    robots[i] = g; homes[i] = g.position.clone();
  });

  // The bearing ring lies flat round the rotor; the glow inside it still shows the job's state.
  const rg = ring.clone(); rg.rotation.x = -Math.PI / 2; rg.position.set(0, 10.2 - model.getObjectByName('Rotor').position.y, 2.2);
  rotor.add(rg);
  bearing.scale.set(0.85, 0.5, 0.85);
  hide(model.getObjectByName('Race'));

  // The drill head faces down at the bottom of the rotor.
  const hd = model.getObjectByName('Head'); hide(hd);
  const h2 = head.clone(); h2.rotation.x = Math.PI / 2; h2.position.set(0, 1.6 - rotor.position.y + 0.6, -3.0);
  rotor.add(h2);

  // Two haulers waiting on the floor by the ramp.
  [[13, 6, -2.2], [-3, 15, -1.1]].forEach(([x, z, a]) => { const t = truck.clone(); t.position.set(x, 0, z); scene.add(t); facing.push(t); });
}

function resize() {
  const w = host.clientWidth, h = host.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  draw();
}

export function set(s) {
  state = s;
  if (!bearing) return;
  const c = GLOW[s] ?? 0xffb347;
  bearing.visible = s !== 'out';
  bearing.material.emissive.setHex(c);
  bearing.material.emissiveIntensity = s === 'running' ? 0.8 : s === 'seized' || s === 'hot' ? 1.2 : 0.6;
  bearing.userData.light.color.setHex(c);
  bearing.userData.light.intensity = s === "out" ? 0 : 20;
  loop();
}

function loop() {
  if (running || !visible || document.hidden || !renderer) return;
  running = true;
  requestAnimationFrame(tick);
}

function tick(now) {
  if (!visible || document.hidden) { running = false; return; }
  const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
  const atDrill = state !== 'seized';
  robots.forEach((r, i) => {
    const to = atDrill ? dest[i] : homes[i];
    const d = to.clone().sub(r.position); d.y = 0;
    const dist = d.length();
    if (dist > 0.05) {
      const step = Math.min(dist, dt * 4);
      r.position.addScaledVector(d.normalize(), still ? dist : step);
      r.rotation.y = Math.atan2(d.x, d.z) + Math.PI;
      r.position.y = still ? 0 : Math.abs(Math.sin(now / 120 + i)) * 0.08;
    } else if (atDrill) {
      r.lookAt(0, r.position.y, 0); r.rotateY(Math.PI);
    }
  });
  const target = state === 'running' ? 2.4 : state === 'hot' ? 0.6 : 0;
  spin += (target - spin) * Math.min(1, dt * 1.5);
  if (rotor && !still) rotor.rotation.y += spin * dt;
  const flick = state === 'seized' || state === 'hot' ? 0.6 + 0.4 * Math.sin(now / 160) ** 2 : 1;
  if (bearing) bearing.material.emissiveIntensity = (state === 'running' ? 0.8 : 1.2) * flick;
  lamps.forEach((p, i) => { p.intensity = 25; });
  const az = controls.getAzimuthalAngle();
  if (az > 1.2) controls.autoRotateSpeed = Math.abs(controls.autoRotateSpeed);
  if (az < -0.2) controls.autoRotateSpeed = -Math.abs(controls.autoRotateSpeed);
  controls.update();
  faceCamera();
  draw();
  requestAnimationFrame(tick);
}

// Models made from one front painting turn on their vertical axis to face the camera (the Mani temple's offerings
// do the same), so the painted front is what's seen, with its depth and the scene's light on it.
const wp = new THREE.Vector3(), pq = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
function faceCamera() {
  for (const o of facing) {
    o.getWorldPosition(wp);
    const yaw = Math.atan2(camera.position.x - wp.x, camera.position.z - wp.z);
    o.parent.getWorldQuaternion(pq);
    const parentYaw = new THREE.Euler().setFromQuaternion(pq, 'YXZ').y;
    o.rotation.y = yaw - parentYaw;
  }
}
// The tilt-shift lens, on the GPU: the scene renders to a mipmapped target, then one pass shows it sharp in a band
// across the middle and reads blurrier mip levels above and below, with a muted grade and the scene's tone mapping.
let rt, post, quad, pcam;
function lensSetup() {
  rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, samples: 4 });
  pcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: rt.texture }, px: { value: new THREE.Vector2(1, 1) } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 px; varying vec2 vUv;
      void main() {
        float d = smoothstep(0.08, 0.42, abs(vUv.y - 0.52));
        float lod = d * 3.6;
        vec2 o = px * exp2(lod) * 0.75;
        vec4 c = textureLod(tDiffuse, vUv, lod) * 0.4
          + (textureLod(tDiffuse, vUv + vec2(o.x, o.y), lod) + textureLod(tDiffuse, vUv + vec2(-o.x, o.y), lod)
          + textureLod(tDiffuse, vUv + vec2(o.x, -o.y), lod) + textureLod(tDiffuse, vUv + vec2(-o.x, -o.y), lod)) * 0.15;
        float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
        c.rgb = mix(vec3(l), c.rgb, 0.8);
        gl_FragColor = vec4(c.rgb, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    toneMapped: true, depthTest: false, depthWrite: false,
  }));
  post = new THREE.Scene(); post.add(quad);
}
const NOLENS = new URLSearchParams(location.search).has('nolens');
function draw() {
  if (!renderer) return;
  if (NOLENS) { renderer.render(scene, camera); return; }
  if (!rt) lensSetup();
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  if (rt.width !== size.x || rt.height !== size.y) { rt.setSize(size.x, size.y); quad.material.uniforms.px.value.set(1 / size.x, 1 / size.y); }
  renderer.setRenderTarget(rt); renderer.render(scene, camera);
  renderer.setRenderTarget(null); renderer.render(post, pcam);
}
