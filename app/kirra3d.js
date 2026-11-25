// Shaft 3 at Kirra Station in 3D: Drill 7 and its crew, following the job's state.
// mount(el) draws into el; set(state) moves the scene to match: 'seized', 'crew', 'out', 'fitted', 'hot', 'running'.
import * as THREE from '../vendor/three/three.module.min.js';
import { GLTFLoader } from '../vendor/three/loaders/GLTFLoader.js';
import { OrbitControls } from '../vendor/three/controls/OrbitControls.js';

const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const GLOW = { seized: 0xff3b4f, hot: 0xff3b4f, crew: 0xffb347, out: 0x000000, fitted: 0xffb347, running: 0x5cf0b0 };

let renderer, scene, camera, controls, model, rotor, bearing, robots = [], lamps = [], state = 'seized', spin = 0;
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
  camera.position.set(30, 20, 40);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(-3, 5, -1);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 16; controls.maxDistance = 60;
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
    const a = (i - 1) / 4 * Math.PI * 2 + Math.PI / 4;
    dest.push(new THREE.Vector3(Math.cos(a) * 5.6, r.position.y, Math.sin(a) * 5.6));
    const l = model.getObjectByName('Light' + i);
    const p = new THREE.PointLight(0xffb070, 140, 34, 1.5); p.position.copy(l.position); scene.add(p); lamps.push(p);
  }
  // A cold blue fill from the haul ramp, and the bearing's own light.
  const fill = new THREE.PointLight(0x4f8fff, 40, 50, 1.4); fill.position.set(14, 10, -12); scene.add(fill);
  bearing.userData.light = new THREE.PointLight(0xff3b4f, 90, 18, 1.6); bearing.userData.light.position.set(0, 10.2, 0); scene.add(bearing.userData.light);

  new ResizeObserver(resize).observe(el); resize();
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); }).observe(el);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loop(); });
  set(state);
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
      r.position.y = homes[i].y + (still ? 0 : Math.abs(Math.sin(now / 120 + i)) * 0.12);
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
  draw();
  requestAnimationFrame(tick);
}

function draw() { if (renderer) renderer.render(scene, camera); }
