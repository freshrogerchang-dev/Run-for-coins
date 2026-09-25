// 共用的幾何小工具
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];

export function xform(g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const c = g.index ? g.toNonIndexed() : g.clone();
  for (const name of Object.keys(c.attributes)) {
    if (!['position', 'normal', 'uv'].includes(name)) c.deleteAttribute(name);
  }
  c.applyMatrix4(
    new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(sx, sy, sz),
    ),
  );
  return c;
}

// list 裡每一項：[geometry, x, y, z, rx, ry, rz, sx, sy, sz]
export function merged(list) {
  return mergeGeometries(list.map((args) => xform(...args)));
}

export function mesh(geo, mat, { cast = false, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

// 三角柱屋頂（屋脊沿 z 軸）
export function roofGeometry(w, d, h) {
  const g = new THREE.CylinderGeometry(1, 1, 1, 3);
  g.rotateX(-Math.PI / 2);
  g.scale(w / 1.73, h / 1.5, d);
  g.translate(0, h / 3, 0);
  return g;
}
