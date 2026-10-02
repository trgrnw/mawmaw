import * as T from 'three';
import { catSurprise, type CatActivity } from './catReactions';

/** An original, articulated 3D character built from reusable meshes. */
export function createCatScene(canvas: HTMLCanvasElement, activity: CatActivity, reducedMotion: boolean) {
  const renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(34, 1, .1, 50);
  camera.position.set(3.8, 3.1, 7.5); camera.lookAt(0, 1.45, 0);
  scene.add(new T.HemisphereLight(0xe7f4ff, 0x686882, 2.3));
  const key = new T.DirectionalLight(0xffe8ca, 4); key.position.set(-3, 6, 5); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -4; key.shadow.camera.right = 4;
  key.shadow.camera.top = 5; key.shadow.camera.bottom = -3; key.shadow.normalBias = .025; scene.add(key);
  const rim = new T.DirectionalLight(0x8bcaff, 2.6); rim.position.set(4, 3, -3); scene.add(rim);
  const mat = (color: number, roughness = .7, metalness = 0) => new T.MeshStandardMaterial({ color, roughness, metalness });
  const fur = mat(0xf0b671), cream = mat(0xffedd3), pink = mat(0xe89999), navy = mat(0x34445a);
  const ink = mat(0x252638), gold = mat(0xcba367, .35, .45), wood = mat(0x7b5260), teal = mat(0x71c8ba);
  const white = mat(0xfffff5, .3), dark = mat(0x292e40), stripes = mat(0xcd874b);
  const sphere = new T.SphereGeometry(1, 28, 20);
  const box = new T.BoxGeometry(1, 1, 1);
  function mesh(parent: T.Object3D, geometry: T.BufferGeometry, material: T.Material, pos: number[], scale = [1, 1, 1]) {
    const m = new T.Mesh(geometry, material); m.position.set(pos[0], pos[1], pos[2]); m.scale.set(scale[0], scale[1], scale[2]);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  const ball = (p: T.Object3D, m: T.Material, pos: number[], scale: number[]) => mesh(p, sphere, m, pos, scale);
  const block = (p: T.Object3D, m: T.Material, pos: number[], scale: number[]) => mesh(p, box, m, pos, scale);
  function curve(parent: T.Object3D, material: T.Material, points: number[][], radius: number) {
    const path = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p as [number, number, number])));
    return mesh(parent, new T.TubeGeometry(path, 20, radius, 6, false), material, [0, 0, 0]);
  }
  // A small office vignette, not a second game control.
  mesh(scene, new T.CylinderGeometry(1.95, 2.02, .15, 64), mat(0x313c56), [0, .075, 0]);
  mesh(scene, new T.CylinderGeometry(1.85, 1.85, .035, 64), mat(0x46546d), [0, .17, 0]);
  block(scene, wood, [0, 1.12, .55], [2.8, .15, 1.4]);
  block(scene, gold, [0, 1.02, .55], [2.65, .045, 1.32]);
  for (const x of [-1.12, 1.12]) for (const z of [0, 1.08]) block(scene, navy, [x, .61, z], [.09, .84, .09]);
  ball(scene, navy, [0, .87, -.35], [.78, .92, .45]);
  const cat = new T.Group(); cat.position.set(0, 0, -.25); scene.add(cat);
  const body = ball(cat, navy, [0, 1.25, 0], [.70, .87, .52]);
  ball(cat, cream, [0, 1.47, .40], [.43, .59, .16]);
  for (const side of [-1, 1]) {
    ball(cat, fur, [side * .50, .49, .24], [.30, .19, .32]);
    const lapel = block(cat, navy, [side * .24, 1.60, .53], [.22, .39, .07]); lapel.rotation.z = side * -.32;
  }
  const tie = mesh(cat, new T.ConeGeometry(.12, .37, 4), teal, [0, 1.47, .61]); tie.rotation.z = Math.PI;
  ball(cat, teal, [0, 1.70, .58], [.095, .07, .065]);
  ball(cat, gold, [0, 1.15, .55], [.035, .035, .03]);
  curve(cat, fur, [[.53, .55, -.2], [1.05, .45, -.4], [1.28, .7, -.35], [1.12, .95, -.28]], .105);
  const head = new T.Group(); head.position.set(0, 2.32, .01); cat.add(head);
  ball(head, fur, [0, 0, 0], [.94, .81, .67]);
  ball(head, cream, [0, -.36, .52], [.68, .38, .24]);
  for (const side of [-1, 1]) {
    const ear = mesh(head, new T.ConeGeometry(.34, .62, 3), fur, [side * .66, .64, -.04], [1, 1, .68]);
    ear.rotation.y = .52; ear.rotation.z = side * -.22;
    const inside = mesh(head, new T.ConeGeometry(.21, .40, 3), pink, [side * .66, .69, .12], [1, 1, .32]);
    inside.rotation.y = .52; inside.rotation.z = side * -.22;
    ball(head, pink, [side * .61, -.30, .63], [.16, .08, .025]);
    ball(head, cream, [side * .23, -.26, .70], [.25, .17, .13]);
    for (const offset of [-.07, .04]) ball(head, stripes, [side * .34, -.24 + offset, .824], [.018, .018, .009]);
    for (let i = 0; i < 3; i++) curve(head, cream, [[side * .41, -.23 - i * .065, .73], [side * .88, -.15 - i * .09, .69], [side * 1.13, -.08 - i * .13, .59]], .009);
  }
  for (let i = -1; i <= 1; i++) {
    const stripe = ball(head, stripes, [i * .23, .48, .53], [.065, .20 - Math.abs(i) * .04, .025]); stripe.rotation.z = i * -.20;
  }
  const eyes: T.Group[] = [], brows: T.Mesh[] = [];
  for (const side of [-1, 1]) {
    const eye = new T.Group(); eye.position.set(side * .37, .045, .624); head.add(eye); eyes.push(eye);
    ball(eye, white, [0, 0, 0], [.235, .28, .105]);
    ball(eye, teal, [.025, -.015, .096], [.125, .18, .027]);
    ball(eye, ink, [.027, -.01, .123], [.063, .135, .018]);
    ball(eye, white, [-.025, .075, .142], [.036, .044, .012]);
    const brow = ball(head, stripes, [side * .37, .28, .64], [.24, .045, .04]); brows.push(brow);
  }
  ball(head, pink, [0, -.22, .855], [.105, .073, .06]);
  curve(head, ink, [[0, -.26, .85], [0, -.34, .85], [-.13, -.39, .81]], .013);
  curve(head, ink, [[0, -.34, .85], [.13, -.39, .81]], .013);
  const mouth = ball(head, ink, [0, -.43, .762], [.085, .07, .023]);
  const paws: T.Group[] = [];
  for (const side of [-1, 1]) {
    const paw = new T.Group(); paw.position.set(side * .55, 1.30, .52); cat.add(paw); paws.push(paw);
    ball(paw, navy, [0, .025, -.14], [.23, .28, .22]);
    ball(paw, fur, [0, -.04, .16], [.235, .15, .28]);
    for (let i = -1; i <= 1; i++) ball(paw, cream, [i * .075, -.03, .39], [.055, .075, .045]);
  }
  const calculator = new T.Group(); calculator.position.set(0, 1.22, 1.03); calculator.rotation.x = -.12; scene.add(calculator);
  block(calculator, dark, [0, 0, 0], [.61, .10, .63]);
  block(calculator, teal, [0, .06, -.18], [.47, .012, .12]);
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) block(calculator, row === 2 && col === 2 ? gold : white, [(col - 1) * .16, .071, row * .13 - .035], [.105, .035, .075]);
  // A tidy mug and stacked coins give the desk some personality.
  mesh(scene, new T.CylinderGeometry(.13, .11, .24, 24), cream, [-.95, 1.33, .68]);
  const handle = mesh(scene, new T.TorusGeometry(.09, .025, 8, 20), cream, [-1.10, 1.34, .68]); handle.rotation.y = .2;
  mesh(scene, new T.CylinderGeometry(.105, .105, .01, 24), wood, [-.95, 1.455, .68]);
  for (let i = 0; i < 5; i++) mesh(scene, new T.CylinderGeometry(.10, .10, .025, 24), gold, [.99, 1.23 + i * .028, .73]);
  let visible = true, stopped = false, lastFrame = 0;
  const start = performance.now();
  function resize(width: number, height: number) {
    if (!width || !height) return;
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
  }
  function draw(now: number) {
    if (stopped || !visible || document.hidden || now - lastFrame < 1000 / 30) return;
    lastFrame = now;
    const time = (now - start) / 1000;
    const surprised = reducedMotion ? 0 : catSurprise(activity, now);
    const blink = !reducedMotion && time % 6.2 > 6.03 ? .10 : 1;
    head.rotation.y = -.30 + surprised * .80;
    head.rotation.z = surprised * -.08;
    head.rotation.x = -.08 + surprised * -.05;
    body.scale.y = .87 + (reducedMotion ? 0 : Math.sin(time * 2) * .012);
    head.position.y = 2.32 + (reducedMotion ? 0 : Math.sin(time * 2) * .012);
    eyes.forEach(e => { e.scale.y = (.34 + surprised * .66) * blink; });
    brows.forEach((b, i) => { b.position.y = .21 + surprised * .23; b.rotation.z = (i ? -1 : 1) * surprised * .15; });
    mouth.scale.y = .07 * (.20 + surprised * 1.6);
    paws.forEach((p, i) => { p.position.y = 1.30 + surprised * .11 + (reducedMotion ? 0 : Math.sin(time * 4 + i * 2) * .025 * (1 - surprised)); });
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(draw);
  return {
    resize,
    setVisible(value: boolean) { visible = value; },
    dispose() {
      stopped = true; renderer.setAnimationLoop(null);
      const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>();
      scene.traverse(object => { if (object instanceof T.Mesh) { geometries.add(object.geometry); (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m)); } });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); key.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
