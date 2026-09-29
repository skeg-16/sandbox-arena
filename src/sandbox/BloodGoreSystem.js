import * as THREE from 'three';

export class BloodGoreSystem {
  constructor(scene) {
    this.scene = scene;
    this.bloodParticles = [];
    this.groundSplatDecals = [];
    this.severedLimbs = [];
    this.goreLevel = 'ULTRA'; // ULTRA | NORMAL | OFF
  }

  spawnBloodSpurt(pos, impactDir, damage = 35) {
    if (this.goreLevel === 'OFF') return;

    const count = Math.min(25, Math.floor(damage * 0.4) + 6);
    const geo = new THREE.DodecahedronGeometry(0.08 + Math.random() * 0.06, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x880808, // Dark visceral crimson blood
      roughness: 0.2,
      metalness: 0.1
    });

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        pos.x + (Math.random() - 0.5) * 0.3,
        pos.y + (Math.random() - 0.5) * 0.3,
        pos.z + (Math.random() - 0.5) * 0.3
      );

      // Spray outward away from hit direction
      const vx = (impactDir ? impactDir.x : (Math.random() - 0.5)) * 4 + (Math.random() - 0.5) * 3;
      const vy = Math.random() * 4 + 2;
      const vz = (impactDir ? impactDir.z : (Math.random() - 0.5)) * 4 + (Math.random() - 0.5) * 3;

      this.scene.add(mesh);
      this.bloodParticles.push({
        mesh,
        vel: new THREE.Vector3(vx, vy, vz),
        life: 0.8,
        maxLife: 0.8
      });
    }

    // Also spawn a ground blood pool decal beneath hit
    this.spawnGroundSplat(pos, Math.min(1.8, 0.6 + damage * 0.015));
  }

  spawnGroundSplat(pos, radius = 1.0) {
    if (this.goreLevel === 'OFF') return;

    if (this.decalSystem) {
      this.decalSystem.spawnBloodPool(pos, radius);
      return;
    }

    // Limit max ground decals for high performance (cap at 120)
    if (this.groundSplatDecals.length > 120) {
      const oldest = this.groundSplatDecals.shift();
      this.scene.remove(oldest.mesh);
      oldest.mesh.geometry.dispose();
      oldest.mesh.material.dispose();
    }

    const geo = new THREE.CircleGeometry(radius, 12);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x4a0404,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(
      pos.x + (Math.random() - 0.5) * 0.4,
      0.025 + Math.random() * 0.005, // Slight Y offset to avoid z-fighting
      pos.z + (Math.random() - 0.5) * 0.4
    );

    // Randomize rotation for varied splat shapes
    mesh.rotation.z = Math.random() * Math.PI * 2;
    mesh.scale.set(1.0 + Math.random() * 0.3, 0.8 + Math.random() * 0.4, 1.0);

    this.scene.add(mesh);
    this.groundSplatDecals.push({ mesh });
  }

  dismemberUnit(unit, attackerPos) {
    if (this.goreLevel !== 'ULTRA' || !unit || !unit.bodyGroup) return;

    const pos = unit.body ? unit.body.translation() : null;
    if (!pos) return;

    // Decapitate head mesh on high-impact lethal hit!
    if (unit.headMesh && unit.headMesh.parent) {
      const headWorldPos = new THREE.Vector3();
      unit.headMesh.getWorldPosition(headWorldPos);

      // Clone head mesh for flying severed limb
      const severedHead = unit.headMesh.clone();
      severedHead.position.copy(headWorldPos);
      severedHead.scale.copy(unit.headMesh.scale);
      this.scene.add(severedHead);

      // Hide original head on unit
      unit.headMesh.visible = false;

      // Calculate fly impulse away from attacker
      const dx = headWorldPos.x - (attackerPos ? attackerPos.x : headWorldPos.x);
      const dz = headWorldPos.z - (attackerPos ? attackerPos.z : headWorldPos.z);
      const len = Math.sqrt(dx * dx + dz * dz) || 1;

      const vx = (dx / len) * 8 + (Math.random() - 0.5) * 4;
      const vy = Math.random() * 6 + 4;
      const vz = (dz / len) * 8 + (Math.random() - 0.5) * 4;

      this.severedLimbs.push({
        mesh: severedHead,
        vel: new THREE.Vector3(vx, vy, vz),
        rotVel: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10),
        life: 2.5
      });
    }

    // Heavy blood fountain spurt at neck
    this.spawnBloodSpurt(pos, { x: (Math.random() - 0.5) * 2, z: (Math.random() - 0.5) * 2 }, 80);
  }

  update(dt) {
    // Update Blood Particles Trajectories
    for (let i = this.bloodParticles.length - 1; i >= 0; i--) {
      const p = this.bloodParticles[i];
      p.life -= dt;
      p.vel.y -= 14.0 * dt; // Strong gravity drop
      p.mesh.position.addScaledVector(p.vel, dt);

      // Hit ground check
      if (p.mesh.position.y <= 0.03) {
        p.mesh.position.y = 0.03;
        p.vel.set(0, 0, 0); // Stop on ground
      }

      const progress = p.life / p.maxLife;
      p.mesh.scale.setScalar(progress);

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.bloodParticles.splice(i, 1);
      }
    }

    // Update Severed Flying Limbs
    for (let i = this.severedLimbs.length - 1; i >= 0; i--) {
      const limb = this.severedLimbs[i];
      limb.life -= dt;

      if (limb.mesh.position.y > 0.3) {
        limb.vel.y -= 12.0 * dt;
        limb.mesh.position.addScaledVector(limb.vel, dt);
        limb.mesh.rotation.x += limb.rotVel.x * dt;
        limb.mesh.rotation.y += limb.rotVel.y * dt;
      } else {
        limb.mesh.position.y = 0.3; // Rest on floor
      }

      if (limb.life <= 0) {
        this.scene.remove(limb.mesh);
        limb.mesh.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
        this.severedLimbs.splice(i, 1);
      }
    }
  }

  clear() {
    this.bloodParticles.forEach(p => {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    });
    this.groundSplatDecals.forEach(d => {
      this.scene.remove(d.mesh);
      d.mesh.geometry.dispose();
      d.mesh.material.dispose();
    });
    this.severedLimbs.forEach(l => {
      this.scene.remove(l.mesh);
      l.mesh.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    });

    this.bloodParticles = [];
    this.groundSplatDecals = [];
    this.severedLimbs = [];
  }
}
