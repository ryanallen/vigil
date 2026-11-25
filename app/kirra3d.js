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
  renderer.toneMappingExposure = 1.35;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  el.append(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070d);
  scene.fog = new THREE.FogExp2(0x070a12, 0.012);
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
  camera.position.set(19, 11, 25);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 4.5, 1);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 12; controls.maxDistance = 48;
  controls.maxPolarAngle = Math.PI * 0.47; controls.minPolarAngle = Math.PI * 0.18;
  controls.minAzimuthAngle = -0.35; controls.maxAzimuthAngle = 1.35;
  controls.autoRotate = !still; controls.autoRotateSpeed = 0.35;
  controls.addEventListener('start', () => { controls.autoRotate = false; });

  scene.add(new THREE.HemisphereLight(0x9fc0ff, 0x241406, 1.1));
  const key = new THREE.DirectionalLight(0xd6e4ff, 2.6);
  key.position.set(-18, 40, 24); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.06;
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
    const p = new THREE.PointLight(0xffb070, 140, 34, 1.5); p.position.copy(l.position); scene.add(p); lamps.push(p);
  }
  // A cold blue fill from the haul ramp, and the bearing's own light.
  const fill = new THREE.PointLight(0x4f8fff, 40, 50, 1.4); fill.position.set(14, 10, -12); scene.add(fill);
  bearing.userData.light = new THREE.PointLight(0xff3b4f, 90, 18, 1.6); bearing.userData.light.position.set(0, 10.2, 0); scene.add(bearing.userData.light);

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

async function dress() {
  const wall = model.getObjectByName('Wall'), floor = model.getObjectByName('Floor');
  wall.material = new THREE.MeshStandardMaterial({ map: texture('tex-asteroid-rock.webp', [10, 3]), color: 0x8a90a0, roughness: 0.9, metalness: 0.3 });
  floor.material = new THREE.MeshStandardMaterial({ map: texture('tex-ground-regolith.webp', [9, 9]), color: 0x6f7380, roughness: 0.95, metalness: 0.1 });
  const plate = new THREE.MeshStandardMaterial({ map: texture('tex-hull-panels.webp', [1, 2]), color: 0x8c9cb4, roughness: 0.45, metalness: 0.7 });
  model.traverse(o => { if (o.isMesh && /^(Leg|Brace|Tower|Bay2$)/.test(o.name)) o.material = plate; });

  const loader = new GLTFLoader();
  const [robot, truck, ring, head] = await Promise.all(['maint-robot', 'haul-truck', 'bearing', 'drill-head']
    .map(n => loader.loadAsync(media(n + '.glb')).then(g => shadows(g.scene))));

  // Each box robot keeps its place and its walk; its look is the model's.
  // The box stand-ins carry their offset in their mesh, so each robot becomes its own group where its box stood.
  robots.forEach((r, i) => {
    const c = new THREE.Box3().setFromObject(r).getCenter(new THREE.Vector3());
    hide(r);
    const g = new THREE.Group(); g.position.set(c.x, 0, c.z); scene.add(g);
    const m = robot.clone(); m.scale.setScalar(1.6); g.add(m); facing.push(m);
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
  bearing.material.emissiveIntensity = s === 'running' ? 2.2 : s === 'seized' || s === 'hot' ? 3 : 1.6;
  bearing.userData.light.color.setHex(c);
  bearing.userData.light.intensity = s === 'out' ? 0 : 90;
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
  if (bearing) bearing.material.emissiveIntensity = (state === 'running' ? 2.2 : 3) * flick;
  lamps.forEach((p, i) => { p.intensity = 140 + (still ? 0 : Math.sin(now / 900 + i * 2) * 4); });
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
function draw() { if (renderer) renderer.render(scene, camera); }
