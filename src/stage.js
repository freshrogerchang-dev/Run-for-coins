// 渲染器、天空、光源、後製（Bloom）與粒子特效
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// 保險：把 NaN / 無限大的像素清掉，避免 Bloom 把它們擴散成閃爍的黑色方塊（iPad / iPhone 特別容易出現）
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    // 用位元判斷 NaN / Inf：Safari 的 Metal 編譯器可能把 v != v 最佳化掉，位元運算不會
    bool bad(float v) { return (floatBitsToUint(v) & 0x7f800000u) == 0x7f800000u || abs(v) > 60000.0; }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      if (bad(c.r) || bad(c.g) || bad(c.b) || bad(c.a)) c = vec4(0.0, 0.0, 0.0, 1.0);
      gl_FragColor = vec4(clamp(c.rgb, 0.0, 64.0), clamp(c.a, 0.0, 1.0));
    }`,
};

import { THEMES } from './themes.js';

const HORIZON = new THREE.Color('#f3d9b8');
const ZENITH = new THREE.Color('#3f86d8');

// 把主題設定轉成可以內插的數值
function atmosphereOf(t) {
  return {
    horizon: new THREE.Color(t.sky.horizon),
    zenith: new THREE.Color(t.sky.zenith),
    glow: new THREE.Color(t.sky.glow),
    sunDir: new THREE.Vector3(...t.sky.sunDir).normalize(),
    cloud: t.sky.cloud,
    stars: t.sky.stars,
    fogColor: new THREE.Color(t.fog.color),
    fogNear: t.fog.near,
    fogFar: t.fog.far,
    hemiSky: new THREE.Color(t.hemi.sky),
    hemiGround: new THREE.Color(t.hemi.ground),
    hemiIntensity: t.hemi.intensity,
    sunColor: new THREE.Color(t.sun.color),
    sunIntensity: t.sun.intensity,
    sunOffset: new THREE.Vector3(...t.sun.offset),
    exposure: t.exposure,
    bloom: t.bloom,
    envIntensity: t.envIntensity,
    snow: t.particles ? 1 : 0,
  };
}

export class Stage {
  constructor(container) {
    const mobile = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
    this.mobile = mobile;
    // iPad（新版會偽裝成 Mac）與 iPhone
    this.ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
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
    this.buildSnow(mobile);
    this.buildRain(mobile);
    this.storm = 0;
    this.stormTarget = 0;
    this.flash = 0;
    this.flashQueue = [];

    this.atmo = atmosphereOf(THEMES.city);
    this.atmoTarget = atmosphereOf(THEMES.city);
    this.applyAtmosphere(1);

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
        uGlow: { value: new THREE.Color('#ffbf73') },
        uCloud: { value: 0.85 },
        uStars: { value: 0 },
        uFlash: { value: 0 },
        uStorm: { value: 0 },
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
        uniform vec3 uGlow;
        uniform float uCloud;
        uniform float uStars;
        uniform float uFlash;
        uniform float uStorm;
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
          col += uGlow * (pow(s, 6.0) * 0.35 + pow(s, 60.0) * 0.6);
          col += mix(vec3(1.0, 0.95, 0.85), vec3(0.9, 0.95, 1.0), uStars) * smoothstep(0.9975, 0.999, s) * mix(3.0, 1.4, uStars);
          // 星星（夜晚主題）
          if (uStars > 0.0 && d.y > 0.0) {
            vec2 sp = d.xz / (d.y + 0.35) * 90.0;
            vec2 cell = floor(sp);
            float r = hash(cell);
            vec2 f = fract(sp) - 0.5 - (vec2(hash(cell + 7.1), hash(cell + 3.3)) - 0.5) * 0.6;
            float star = step(0.985, r) * smoothstep(0.12, 0.0, length(f));
            float tw = 0.6 + 0.4 * sin(uTime * 3.0 + r * 100.0);
            col += vec3(1.0, 0.95, 1.0) * star * tw * uStars * smoothstep(0.02, 0.25, d.y) * 1.6;
          }
          // 雲
          if (d.y > 0.0 && uCloud > 0.0) {
            vec2 uv = d.xz / (d.y + 0.08) * 1.6 + vec2(uTime * 0.01, 0.0);
            float c = fbm(uv);
            c = smoothstep(0.52, 0.8, c) * smoothstep(0.0, 0.18, d.y);
            vec3 cloudCol = mix(vec3(1.0, 0.93, 0.86), vec3(1.0), h);
            cloudCol = mix(cloudCol, uHorizon * 0.7 + uGlow * 0.15, uStars);
            cloudCol = mix(cloudCol, vec3(0.32, 0.34, 0.4), uStorm * 0.85);
            col = mix(col, cloudCol + pow(s, 8.0) * uGlow * 0.3, c * uCloud);
          }
          if (d.y < 0.0) col = mix(uHorizon, uHorizon * 0.85, min(1.0, -d.y * 4.0));
          col = mix(col, vec3(1.3, 1.35, 1.6), uFlash * 0.7);
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
    this.hemi = hemi;
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
    this.sanitize = new ShaderPass(SanitizeShader);
    composer.addPass(this.sanitize);
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
          gl_PointSize = clamp((0.12 + alpha * 0.18) * uScale / max(-mv.z, 0.5), 0.0, 128.0);
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

  // 下雪粒子：在相機周圍循環
  buildSnow(mobile) {
    const N = mobile ? 700 : 1500;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 50;
      pos[i * 3 + 1] = Math.random() * 18;
      pos[i * 3 + 2] = -2 - Math.random() * 66;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    const mat = new THREE.PointsMaterial({
      size: 0.16,
      map: new THREE.CanvasTexture(c),
      transparent: true,
      depthWrite: false,
      opacity: 0,
      fog: false,
    });
    this.snow = new THREE.Points(geo, mat);
    this.snow.frustumCulled = false;
    this.snowOffsets = pos;
    this.scene.add(this.snow);
  }

  // 暴風雨：雨絲 + 天色變暗 + 閃電
  buildRain(mobile) {
    const N = mobile ? 500 : 1100;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
    this.rainData = Array.from({ length: N }, () => ({
      x: (Math.random() - 0.5) * 40,
      y: Math.random() * 20,
      z: -Math.random() * 60 + 6,
      v: 26 + Math.random() * 10,
    }));
    this.rain = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: '#b8cde0', transparent: true, opacity: 0, depthWrite: false, fog: false }),
    );
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.scene.add(this.rain);
  }

  setStorm(on) {
    this.stormTarget = on ? 1 : 0;
  }

  lightning() {
    this.flashQueue = [0, 0.12, 0.3 + Math.random() * 0.2];
  }

  setTheme(theme, instant = false) {
    this.atmoTarget = atmosphereOf(theme);
    this.pendingParticles = theme.particles;
    if (instant) {
      this.setParticleStyle(theme.particles);
      this.applyAtmosphere(1);
    }
  }

  // 天氣粒子樣式：雪、櫻花瓣、火山火星、雨林孢子
  setParticleStyle(style) {
    this.particleStyle = style;
    if (!style) return;
    const m = this.snow.material;
    m.color.set(style.color);
    m.size = style.size;
    const glow = style.type === 'embers' || style.type === 'spores';
    m.blending = glow ? THREE.AdditiveBlending : THREE.NormalBlending;
    if (glow) m.color.multiplyScalar(2.2);
    m.needsUpdate = true;
  }

  applyAtmosphere(k) {
    const a = this.atmo;
    const t = this.atmoTarget;
    // 換粒子樣式時先淡出，再換樣式淡入
    if (this.pendingParticles !== this.particleStyle) {
      if (a.snow < 0.05 || !this.particleStyle) this.setParticleStyle(this.pendingParticles);
      else t.snow = 0;
    }
    if (this.particleStyle && this.pendingParticles === this.particleStyle) t.snow = 1;
    for (const key of Object.keys(a)) {
      if (typeof a[key] === 'number') a[key] += (t[key] - a[key]) * k;
      else a[key].lerp(t[key], k);
    }
    const u = this.sky.material.uniforms;
    u.uHorizon.value.copy(a.horizon);
    u.uZenith.value.copy(a.zenith);
    u.uGlow.value.copy(a.glow);
    u.uSunDir.value.copy(a.sunDir).normalize();
    const st = this.storm || 0;
    const fl = this.flash || 0;
    const dim = 1 - 0.6 * st;
    u.uStorm.value = st;
    u.uHorizon.value.multiplyScalar(dim);
    u.uZenith.value.multiplyScalar(1 - 0.75 * st);
    u.uGlow.value.multiplyScalar(1 - st);
    u.uCloud.value = Math.max(a.cloud, st);
    u.uStars.value = a.stars * (1 - st);
    u.uFlash.value = fl;
    this.scene.fog.color.copy(a.fogColor).multiplyScalar(dim);
    this.scene.fog.near = a.fogNear * (1 - 0.35 * st);
    this.scene.fog.far = a.fogFar * (1 - 0.3 * st);
    this.scene.background.copy(this.scene.fog.color);
    this.hemi.color.copy(a.hemiSky);
    this.hemi.groundColor.copy(a.hemiGround);
    this.hemi.intensity = a.hemiIntensity * (1 - 0.4 * st) + fl * 2.5;
    this.sun.color.copy(a.sunColor);
    this.sun.intensity = a.sunIntensity * (1 - 0.8 * st);
    this.sunOffset.copy(a.sunOffset);
    this.renderer.toneMappingExposure = a.exposure * (1 - 0.08 * st) + fl * 0.4;
    this.bloom.strength = a.bloom;
    this.scene.environmentIntensity = a.envIntensity;
    this.snow.material.opacity = a.snow * 0.9;
    this.snow.visible = a.snow > 0.01;
  }

  update(dt, focus, speedFactor, time) {
    // 閃電：排程好的幾次閃光
    this.flash = Math.max(0, this.flash - dt * 6);
    if (this.flashQueue.length) {
      this.flashQueue = this.flashQueue.map((t) => t - dt);
      if (this.flashQueue[0] <= 0) {
        this.flash = 1;
        this.flashQueue.shift();
      }
    }
    this.storm += (this.stormTarget - this.storm) * (1 - Math.exp(-dt * 0.8));
    this.applyAtmosphere(1 - Math.exp(-dt * 1.4));

    // 雨絲
    this.rain.visible = this.storm > 0.02;
    if (this.rain.visible) {
      this.rain.material.opacity = this.storm * 0.55;
      const lp = this.rain.geometry.attributes.position;
      const cam = this.camera.position;
      const drift = dt * ((this.runSpeed || 0) + 1);
      this.rainData.forEach((r, i) => {
        r.y -= r.v * dt;
        r.z += drift;
        if (r.y < -6) r.y += 22;
        if (r.z > 6) r.z -= 60;
        const x = cam.x + r.x;
        const y = cam.y + r.y - 6;
        const z = cam.z + r.z;
        lp.setXYZ(i * 2, x, y, z);
        lp.setXYZ(i * 2 + 1, x + 0.05, y + 0.9, z - 0.25);
      });
      lp.needsUpdate = true;
    }
    this.sky.position.copy(this.camera.position);
    this.sky.material.uniforms.uTime.value = time;

    // 雪花：跟著相機，往下飄並循環
    if (this.snow.visible) {
      const p = this.snowOffsets;
      const cam = this.camera.position;
      const type = this.particleStyle?.type || 'snow';
      const fallRate = { snow: 2.2, petals: 1.1, embers: -2.6, spores: 0.15 }[type];
      const sway = { snow: 0.4, petals: 1.8, embers: 0.7, spores: 0.6 }[type];
      const fall = dt * fallRate;
      const drift = dt * ((this.runSpeed || 0) + 1);
      for (let i = 0; i < p.length; i += 3) {
        p[i + 1] -= fall * (0.7 + ((i * 7) % 10) / 20);
        if (type === 'spores') p[i + 1] += Math.sin(time * 0.9 + i * 0.37) * dt * 0.5;
        p[i] += Math.sin(time * 0.8 + i) * dt * sway;
        p[i + 2] += drift;
        if (p[i + 1] < 0) p[i + 1] += 18;
        if (p[i + 1] > 18) p[i + 1] -= 18;
        // 不讓粒子貼近鏡頭：太近時點的大小會除以接近 0 的數，在 iPad 上變成巨大方塊
        if (p[i + 2] > -2) p[i + 2] -= 66;
      }
      this.snow.position.set(cam.x, cam.y - 6, cam.z);
      this.snow.geometry.attributes.position.needsUpdate = true;
    }

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

  // 畫質：high = Bloom 光暈 + 高解析；balanced = 關閉 Bloom；saver = 關閉 Bloom 與陰影、降低解析度
  setQuality(level) {
    this.quality = level;
    this.bloom.enabled = level === 'high';
    this.sanitize.enabled = level === 'high';
    this.sun.castShadow = level !== 'saver';
    const cap = level === 'saver' ? 1 : this.mobile ? 1.5 : 2;
    const pr = Math.min(devicePixelRatio, cap);
    this.renderer.setPixelRatio(pr);
    this.composer.setPixelRatio(pr);
    this.resize();
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
