// 渲染器、天空、光源、後製（Bloom）與粒子特效
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const HORIZON = new THREE.Color('#f3d9b8');
const ZENITH = new THREE.Color('#3f86d8');

export class Stage {
  constructor(container) {
    const mobile = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
    this.mobile = mobile;
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(HORIZON.clone().multiplyScalar(0.92), 60, 250);
    scene.background = HORIZON.clone();
    this.scene = scene;

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.45;

    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 600);

    this.buildSky();
    this.buildLights(mobile);
    this.buildComposer(mobile);
    this.buildSparkles();
    this.buildSpeedLines();

    addEventListener('resize', () => this.resize());
  }

  buildSky() {
    const geo = new THREE.SphereGeometry(500, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uHorizon: { value: HORIZON },
        uZenith: { value: ZENITH },
        uSunDir: { value: new THREE.Vector3(0.35, 0.16, -1).normalize() },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uHorizon;
        uniform vec3 uZenith;
        uniform vec3 uSunDir;
        uniform float uTime;
        varying vec3 vDir;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
        }
        float fbm(vec2 p) {
          float v = 0.0; float a = 0.5;
          for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
          return v;
        }
        void main() {
          vec3 d = normalize(vDir);
          float h = max(d.y, 0.0);
          vec3 col = mix(uHorizon, uZenith, pow(h, 0.55));
          // 太陽光暈
          float s = max(dot(d, uSunDir), 0.0);
          col += vec3(1.0, 0.75, 0.45) * (pow(s, 6.0) * 0.35 + pow(s, 60.0) * 0.6);
          col += vec3(1.0, 0.95, 0.85) * smoothstep(0.9975, 0.999, s) * 3.0;
          // 雲
          if (d.y > 0.0) {
            vec2 uv = d.xz / (d.y + 0.08) * 1.6 + vec2(uTime * 0.01, 0.0);
            float c = fbm(uv);
            c = smoothstep(0.52, 0.8, c) * smoothstep(0.0, 0.18, d.y);
            vec3 cloudCol = mix(vec3(1.0, 0.93, 0.86), vec3(1.0), h);
            col = mix(col, cloudCol + pow(s, 8.0) * vec3(0.3, 0.2, 0.1), c * 0.85);
          }
          if (d.y < 0.0) col = mix(uHorizon, uHorizon * 0.85, min(1.0, -d.y * 4.0));
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1;
    this.scene.add(this.sky);
  }

  buildLights(mobile) {
    const hemi = new THREE.HemisphereLight('#cfe3ff', '#8a7057', 1.1);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff0d6', 3.1);
    sun.castShadow = true;
    const size = mobile ? 1024 : 2048;
    sun.shadow.mapSize.set(size, size);
    const cam = sun.shadow.camera;
    cam.left = -30;
    cam.right = 30;
    cam.top = 34;
    cam.bottom = -34;
    cam.near = 1;
    cam.far = 90;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = 3;
    this.sunOffset = new THREE.Vector3(-14, 26, 12);
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
  }

  buildComposer(mobile) {
    const size = new THREE.Vector2(innerWidth, innerHeight);
    const target = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: mobile ? 2 : 4,
    });
    const composer = new EffectComposer(this.renderer, target);
    composer.setPixelRatio(this.renderer.getPixelRatio());
    composer.setSize(size.x, size.y);
    composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(size.clone().multiplyScalar(0.5), 0.45, 0.55, 0.92);
    composer.addPass(this.bloom);
    composer.addPass(new OutputPass());
    this.composer = composer;
  }

  buildSparkles() {
    const N = 240;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(N), 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uScale: { value: innerHeight * 0.5 } },
      vertexShader: /* glsl */ `
        attribute float alpha;
        varying float vA;
        uniform float uScale;
        void main() {
          vA = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = (0.12 + alpha * 0.18) * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          float star = max(0.0, 1.0 - d * 2.0);
          star += max(0.0, 1.0 - abs(c.x) * 12.0) * max(0.0, 1.0 - abs(c.y) * 2.2) * 0.7;
          star += max(0.0, 1.0 - abs(c.y) * 12.0) * max(0.0, 1.0 - abs(c.x) * 2.2) * 0.7;
          gl_FragColor = vec4(vec3(2.4, 1.9, 0.8) * star, star * vA);
        }
      `,
    });
    this.sparkles = new THREE.Points(geo, mat);
    this.sparkles.frustumCulled = false;
    this.sparkleData = Array.from({ length: N }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3() }));
    this.sparkleCursor = 0;
    this.scene.add(this.sparkles);
  }

  burst(pos, count = 10) {
    for (let i = 0; i < count; i++) {
      const s = this.sparkleData[this.sparkleCursor];
      this.sparkleCursor = (this.sparkleCursor + 1) % this.sparkleData.length;
      s.life = 0.5 + Math.random() * 0.3;
      s.p.copy(pos);
      s.v.set((Math.random() - 0.5) * 5, Math.random() * 4 + 1, (Math.random() - 0.5) * 5);
    }
  }

  // 高速時畫面兩側的速度線
  buildSpeedLines() {
    const N = 60;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
    const mat = new THREE.LineBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.speedLines = new THREE.LineSegments(geo, mat);
    this.speedLines.frustumCulled = false;
    this.speedData = Array.from({ length: N }, () => this.spawnSpeedLine({}));
    this.scene.add(this.speedLines);
  }

  spawnSpeedLine(s) {
    const a = Math.random() * Math.PI * 2;
    const r = 2.2 + Math.random() * 3;
    s.x = Math.cos(a) * r;
    s.y = Math.sin(a) * r * 0.7 + 1.5;
    s.z = -Math.random() * 40;
    s.len = 1.5 + Math.random() * 3;
    return s;
  }

  update(dt, focus, speedFactor, time) {
    this.sky.position.copy(this.camera.position);
    this.sky.material.uniforms.uTime.value = time;

    // 陰影相機跟著玩家，並對齊貼圖像素，避免陰影閃爍
    const snap = 60 / this.sun.shadow.mapSize.x;
    const tz = Math.round(focus.z / snap) * snap;
    this.sun.target.position.set(0, 0, tz - 10);
    this.sun.position.set(this.sunOffset.x, this.sunOffset.y, tz - 10 + this.sunOffset.z);

    // 粒子
    const pos = this.sparkles.geometry.attributes.position;
    const alpha = this.sparkles.geometry.attributes.alpha;
    this.sparkleData.forEach((s, i) => {
      if (s.life > 0) {
        s.life -= dt;
        s.v.y -= 9 * dt;
        s.p.addScaledVector(s.v, dt);
      }
      pos.setXYZ(i, s.p.x, s.p.y, s.p.z);
      alpha.setX(i, Math.max(0, s.life) * 1.6);
    });
    pos.needsUpdate = true;
    alpha.needsUpdate = true;

    // 速度線（相對於相機）
    const lp = this.speedLines.geometry.attributes.position;
    const cam = this.camera.position;
    const move = dt * (40 + speedFactor * 80);
    this.speedData.forEach((s, i) => {
      s.z += move;
      if (s.z > 2) this.spawnSpeedLine(s).z = -40;
      lp.setXYZ(i * 2, cam.x + s.x, cam.y + s.y - 1.5, cam.z + s.z - 4);
      lp.setXYZ(i * 2 + 1, cam.x + s.x, cam.y + s.y - 1.5, cam.z + s.z - 4 - s.len);
    });
    lp.needsUpdate = true;
    this.speedLines.material.opacity = Math.max(0, speedFactor - 0.35) * 0.35;
  }

  render() {
    this.composer.render();
  }

  resize() {
    const w = innerWidth;
    const h = innerHeight;
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.8 ? 75 : 62;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.sparkles.material.uniforms.uScale.value = h * 0.5;
  }
}
