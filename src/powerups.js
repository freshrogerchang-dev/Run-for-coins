// 道具的 3D 模型：發光泡泡裡面放一個旋轉的圖示
import * as THREE from 'three';
import { POWERUPS } from './progress.js';

function labelTexture(text, bg, fg = '#ffffff') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(64, 64, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#ffe28a';
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.font = '900 64px "Fredoka", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function boxTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 128, 128);
  g.addColorStop(0, '#ff7ac8');
  g.addColorStop(0.5, '#9b5cff');
  g.addColorStop(1, '#3dfcff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#fff3b0';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 118, 118);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 84px "Fredoka", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class PowerupModels {
  constructor() {
    const emissive = (color, k = 0.6) =>
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.3, metalness: 0.4 });
    const steel = new THREE.MeshStandardMaterial({ color: '#c9d1d9', roughness: 0.25, metalness: 0.9 });
    this.icons = {};

    // 閃電（衝刺）
    const bolt = new THREE.Shape();
    [[0.05, 0.42], [-0.2, 0.0], [-0.02, 0.0], [-0.1, -0.42], [0.2, 0.06], [0.02, 0.06], [0.12, 0.42]].forEach(([x, y], i) =>
      i ? bolt.lineTo(x, y) : bolt.moveTo(x, y),
    );
    const boltGeo = new THREE.ExtrudeGeometry(bolt, { depth: 0.1, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
    boltGeo.center();
    this.icons.dash = () => new THREE.Mesh(boltGeo, emissive('#ffb000', 0.9));

    // 噴射背包
    this.icons.jetpack = () => {
      const g = new THREE.Group();
      const red = emissive('#ff4d3d', 0.35);
      for (const x of [-0.12, 0.12]) {
        const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.3, 4, 12), red);
        tank.position.x = x;
        const fl = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2, 0.4) }));
        fl.position.set(x, -0.33, 0);
        fl.rotation.x = Math.PI;
        g.add(tank, fl);
      }
      return g;
    };

    // 磁鐵
    this.icons.magnet = () => {
      const g = new THREE.Group();
      const horse = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.08, 10, 24, Math.PI), emissive('#e0245e', 0.45));
      horse.rotation.z = Math.PI;
      g.add(horse);
      for (const x of [-0.2, 0.2]) {
        const tip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.16), steel);
        tip.position.set(x, 0.05, 0);
        g.add(tip);
      }
      g.position.y = 0.08;
      return g;
    };

    // 雙倍、圓牌
    const disc = new THREE.CylinderGeometry(0.32, 0.32, 0.06, 32).rotateX(Math.PI / 2);
    const doubleMat = new THREE.MeshStandardMaterial({ map: labelTexture('×2', '#7b3fe4'), emissive: '#ffffff', emissiveMap: labelTexture('×2', '#7b3fe4'), emissiveIntensity: 0.5 });
    this.icons.double = () => new THREE.Mesh(disc, doubleMat);

    // 彈簧
    const helix = new THREE.CatmullRomCurve3(
      Array.from({ length: 61 }, (_, i) => new THREE.Vector3(Math.cos(i * 0.52) * 0.16, i * 0.009 - 0.27, Math.sin(i * 0.52) * 0.16)),
    );
    const springGeo = new THREE.TubeGeometry(helix, 120, 0.035, 8);
    this.icons.spring = () => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(springGeo, emissive('#2ecc71', 0.5)));
      for (const y of [-0.3, 0.3]) {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 20), steel);
        cap.position.y = y;
        g.add(cap);
      }
      return g;
    };

    // 盾牌
    const sh = new THREE.Shape();
    sh.moveTo(0, 0.36);
    sh.bezierCurveTo(0.14, 0.3, 0.26, 0.3, 0.3, 0.28);
    sh.bezierCurveTo(0.3, 0.0, 0.2, -0.24, 0, -0.38);
    sh.bezierCurveTo(-0.2, -0.24, -0.3, 0.0, -0.3, 0.28);
    sh.bezierCurveTo(-0.26, 0.3, -0.14, 0.3, 0, 0.36);
    const shieldGeo = new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 3 });
    shieldGeo.center();
    this.icons.shield = () => new THREE.Mesh(shieldGeo, emissive('#2fa8ff', 0.6));

    // 神秘寶箱
    const boxMat = new THREE.MeshStandardMaterial({ map: boxTexture(), emissive: '#ffffff', emissiveMap: boxTexture(), emissiveIntensity: 0.45, roughness: 0.4 });
    const boxGeo = new THREE.BoxGeometry(0.46, 0.46, 0.46);
    this.icons.mystery = () => new THREE.Mesh(boxGeo, boxMat);

    // 時光沙漏
    this.icons.slowmo = () => {
      const g = new THREE.Group();
      const sand = emissive('#5ec8ff', 0.6);
      const wood = new THREE.MeshStandardMaterial({ color: '#8a5a36', roughness: 0.6 });
      const top = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 16), sand);
      top.position.y = 0.15;
      top.rotation.x = Math.PI;
      const bottom = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 16), sand);
      bottom.position.y = -0.15;
      g.add(top, bottom);
      for (const y of [-0.33, 0.33]) {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 16), wood);
        cap.position.y = y;
        g.add(cap);
      }
      return g;
    };

    // 金幣雨：雲朵 + 金幣
    this.icons.coinrain = () => {
      const g = new THREE.Group();
      const cloud = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 });
      for (const [x, r] of [[-0.15, 0.17], [0.1, 0.2], [0.28, 0.14]]) {
        const c = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), cloud);
        c.position.set(x, 0.18, 0);
        g.add(c);
      }
      const gold = emissive('#ffc21a', 0.5);
      for (const [x, y] of [[-0.18, -0.12], [0.08, -0.25], [0.3, -0.08]]) {
        const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 16).rotateX(Math.PI / 2), gold);
        coin.position.set(x, y, 0);
        g.add(coin);
      }
      return g;
    };

    // 巨人蘑菇
    this.icons.giant = () => {
      const g = new THREE.Group();
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), emissive('#ff4d3d', 0.4));
      cap.position.y = 0.02;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.3, 14), new THREE.MeshStandardMaterial({ color: '#fff4e0', roughness: 0.6 }));
      stem.position.y = -0.14;
      g.add(cap, stem);
      const dot = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 });
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        const d = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), dot);
        d.position.set(Math.cos(a) * 0.2, 0.2, Math.sin(a) * 0.2);
        g.add(d);
      }
      return g;
    };

    // 泡泡外殼（邊緣發光）
    this.bubbleGeo = new THREE.SphereGeometry(0.62, 32, 18);
    this.bubbleMats = {};
    for (const [k, p] of Object.entries(POWERUPS)) {
      this.bubbleMats[k] = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: new THREE.Color(p.color).multiplyScalar(1.6) } },
        vertexShader: /* glsl */ `
          varying vec3 vN; varying vec3 vV;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
          void main() {
            float f = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.2);
            gl_FragColor = vec4(uColor * (f + 0.08), f * 0.95 + 0.06);
          }`,
      });
    }
  }

  make(kind) {
    const g = new THREE.Group();
    const icon = this.icons[kind]();
    icon.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    const bubble = new THREE.Mesh(this.bubbleGeo, this.bubbleMats[kind]);
    g.add(icon, bubble);
    g.userData.icon = icon;
    return g;
  }
}
