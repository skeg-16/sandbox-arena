/**
 * DecalSystem.js
 * High-performance dynamic ground damage decal system for the PBR pipeline.
 * Projects scorch marks (fireball/explosions), catapult impact craters,
 * blood pools, and trampled ground ruts onto 3D terrain with slope-conforming orientation,
 * lifespan fading, and strict FIFO performance capping.
 */

import * as THREE from 'three';

export class DecalSystem {
  constructor(scene, terrainSystem) {
    this.scene = scene;
    this.terrainSystem = terrainSystem;

    this.decals = [];
    this.maxDecals = 140; // Cap to keep draw calls and memory predictable

    // Cached shared procedural textures
    this.textures = {
      scorch: this._createScorchTexture(),
      crater: this._createCraterTexture(),
      blood: this._createBloodTexture(),
      track: this._createTrackTexture()
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // PROCEDURAL DECAL TEXTURE GENERATORS
  // ═══════════════════════════════════════════════════════════════

  _createScorchTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const cx = size / 2;
    const cy = size / 2;

    // Charred black center with fiery glowing ember fringe fading to transparent
    const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, size * 0.46);
    grad.addColorStop(0, 'rgba(12, 10, 9, 0.95)');      // Deep black soot core
    grad.addColorStop(0.45, 'rgba(38, 28, 20, 0.85)');  // Charred carbon
    grad.addColorStop(0.7, 'rgba(180, 83, 9, 0.4)');    // Smoldering ember ring
    grad.addColorStop(0.88, 'rgba(40, 20, 10, 0.2)');   // Outer ash feathering
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');           // Transparent edge

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.46, 0, Math.PI * 2);
    ctx.fill();

    // Jagged radial blast fracture fissures
    ctx.strokeStyle = 'rgba(15, 10, 8, 0.85)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 28; i++) {
      const angle = (i / 28) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      const rInner = 20 + Math.random() * 20;
      const rOuter = size * 0.38 + Math.random() * (size * 0.1);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * rInner, cy + Math.sin(angle) * rInner);
      ctx.lineTo(cx + Math.cos(angle) * rOuter, cy + Math.sin(angle) * rOuter);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _createCraterTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const cx = size / 2;
    const cy = size / 2;

    // Depressed shadow core surrounded by raised shattered earth lip
    const grad = ctx.createRadialGradient(cx, cy, 15, cx, cy, size * 0.48);
    grad.addColorStop(0, 'rgba(20, 14, 10, 0.95)');     // Impact crater pit
    grad.addColorStop(0.5, 'rgba(60, 42, 28, 0.9)');    // Pulverized soil
    grad.addColorStop(0.75, 'rgba(120, 85, 55, 0.6)');  // Ejecta rim
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.48, 0, Math.PI * 2);
    ctx.fill();

    // Shattered rock and ground fissures
    ctx.strokeStyle = 'rgba(18, 12, 8, 0.9)';
    ctx.lineWidth = 3.0;
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const len = size * 0.42 + Math.random() * (size * 0.06);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      let px = cx;
      let py = cy;
      for (let s = 0; s < 3; s++) {
        px += Math.cos(angle) * (len / 3) + (Math.random() - 0.5) * 12;
        py += Math.sin(angle) * (len / 3) + (Math.random() - 0.5) * 12;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _createBloodTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const cx = size / 2;
    const cy = size / 2;

    // Visceral arterial dark red pool with wet coagulated shine
    const grad = ctx.createRadialGradient(cx, cy, 5, cx, cy, size * 0.42);
    grad.addColorStop(0, 'rgba(80, 5, 5, 0.95)');
    grad.addColorStop(0.65, 'rgba(120, 10, 10, 0.85)');
    grad.addColorStop(0.85, 'rgba(90, 8, 8, 0.5)');
    grad.addColorStop(1, 'rgba(60, 4, 4, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.42, 0, Math.PI * 2);
    ctx.fill();

    // Splatter droplets
    ctx.fillStyle = 'rgba(100, 8, 8, 0.88)';
    for (let i = 0; i < 35; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = size * 0.2 + Math.random() * (size * 0.26);
      const rad = Math.random() * 4 + 1.5;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _createTrackTexture() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const cx = size / 2;
    const cy = size / 2;

    // Churned mud boot print indentation
    const grad = ctx.createRadialGradient(cx, cy, 6, cx, cy, size * 0.42);
    grad.addColorStop(0, 'rgba(45, 28, 16, 0.85)');
    grad.addColorStop(0.7, 'rgba(65, 42, 25, 0.5)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, size * 0.25, size * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // ═══════════════════════════════════════════════════════════════
  // DECAL SPAWNING & TERRAIN CONFORMING
  // ═══════════════════════════════════════════════════════════════

  /**
   * Spawns a projected ground decal oriented flush with terrain slope.
   */
  _spawnDecal(pos, radius, map, maxLife = 22.0) {
    if (this.decals.length >= this.maxDecals) {
      const oldest = this.decals.shift();
      this.scene.remove(oldest.mesh);
      oldest.mesh.geometry.dispose();
      oldest.mesh.material.dispose();
    }

    const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);

    const mat = new THREE.MeshStandardMaterial({
      map,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      roughness: 0.7,
      metalness: 0.05
    });

    const mesh = new THREE.Mesh(geo, mat);

    // Compute ground elevation and surface normal
    const groundY = this.terrainSystem ? this.terrainSystem.getHeight(pos.x, pos.z) : (pos.y || 0);
    const normal = this.terrainSystem ? this.terrainSystem.getNormal(pos.x, pos.z) : new THREE.Vector3(0, 1, 0);

    // Position just above ground to eliminate z-fighting
    mesh.position.set(pos.x, groundY + 0.025 + Math.random() * 0.005, pos.z);

    // Orient plane normal to align with ground slope
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);

    // Apply random rotation around terrain normal
    const randomRot = new THREE.Quaternion().setFromAxisAngle(normal, Math.random() * Math.PI * 2);
    mesh.quaternion.multiply(randomRot);

    this.scene.add(mesh);

    this.decals.push({
      mesh,
      mat,
      life: maxLife,
      maxLife,
      initialOpacity: 0.92
    });
  }

  spawnScorch(pos, radius = 2.4) {
    this._spawnDecal(pos, radius, this.textures.scorch, 28.0);
  }

  spawnCrater(pos, radius = 2.8) {
    this._spawnDecal(pos, radius, this.textures.crater, 35.0);
  }

  spawnBloodPool(pos, radius = 1.2) {
    this._spawnDecal(pos, radius, this.textures.blood, 24.0);
  }

  spawnTrack(pos, radius = 0.6) {
    this._spawnDecal(pos, radius, this.textures.track, 14.0);
  }

  update(dt) {
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i];
      d.life -= dt;

      // Smooth fade out in the last 4 seconds of lifetime
      if (d.life < 4.0) {
        d.mat.opacity = Math.max(0, (d.life / 4.0) * d.initialOpacity);
      }

      if (d.life <= 0) {
        this.scene.remove(d.mesh);
        d.mesh.geometry.dispose();
        d.mat.dispose();
        this.decals.splice(i, 1);
      }
    }
  }

  clear() {
    this.decals.forEach(d => {
      this.scene.remove(d.mesh);
      d.mesh.geometry.dispose();
      d.mat.dispose();
    });
    this.decals = [];
  }
}
