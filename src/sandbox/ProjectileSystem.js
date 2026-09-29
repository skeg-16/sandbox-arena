import * as THREE from 'three';
import { soundSystem } from './SoundSystem';

export class ProjectileSystem {
  constructor(scene, physicsWorld, vfxManager = null, bloodGoreSystem = null) {
    this.scene = scene;
    this.world = physicsWorld;
    this.vfxManager = vfxManager;
    this.bloodGoreSystem = bloodGoreSystem;
    this.projectiles = [];
  }

  spawnArrow(startPos, targetPos, damage, attackerTeamId, sourceUnit = null) {
    const geo = new THREE.CylinderGeometry(0.04, 0.04, 1.2, 5);
    const mat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    this.scene.add(mesh);

    // Calculate arc launch velocity vector
    const dx = targetPos.x - startPos.x;
    const dy = targetPos.y - startPos.y;
    const dz = targetPos.z - startPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz) || 1;

    const speed = 28.0;
    const time = dist / speed;
    const vx = dx / time;
    const vz = dz / time;
    const vy = (dy + 0.5 * 9.81 * time * time) / time; // Gravity arc trajectory

    this.projectiles.push({
      type: 'ARROW',
      mesh,
      pos: new THREE.Vector3(startPos.x, startPos.y, startPos.z),
      vel: new THREE.Vector3(vx, vy, vz),
      damage,
      teamId: attackerTeamId,
      sourceUnit,
      life: 5.0
    });
  }

  spawnFireball(startPos, targetPos, damage, aoeRadius, attackerTeamId, sourceUnit = null) {
    const geo = new THREE.SphereGeometry(0.45, 12, 12);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xf97316,
      emissiveIntensity: 0.8,
      roughness: 0.2
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    this.scene.add(mesh);

    const dx = targetPos.x - startPos.x;
    const dy = targetPos.y - startPos.y;
    const dz = targetPos.z - startPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz) || 1;

    const speed = 22.0;
    const time = dist / speed;
    const vx = dx / time;
    const vz = dz / time;
    const vy = (dy + 0.5 * 9.81 * time * time) / time;

    this.projectiles.push({
      type: 'FIREBALL',
      mesh,
      pos: new THREE.Vector3(startPos.x, startPos.y, startPos.z),
      vel: new THREE.Vector3(vx, vy, vz),
      damage,
      aoeRadius,
      teamId: attackerTeamId,
      sourceUnit,
      life: 6.0
    });
  }

  spawnCatapultBoulder(startPos, targetPos, damage, aoeRadius, attackerTeamId, sourceUnit = null) {
    const geo = new THREE.DodecahedronGeometry(0.9, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9, flatShading: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    this.scene.add(mesh);

    const dx = targetPos.x - startPos.x;
    const dy = targetPos.y - startPos.y;
    const dz = targetPos.z - startPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz) || 1;

    const speed = 26.0;
    const time = dist / speed;
    const vx = dx / time;
    const vz = dz / time;
    const vy = (dy + 0.5 * 9.81 * time * time) / time;

    this.projectiles.push({
      type: 'BOULDER',
      mesh,
      pos: new THREE.Vector3(startPos.x, startPos.y, startPos.z),
      vel: new THREE.Vector3(vx, vy, vz),
      damage,
      aoeRadius,
      teamId: attackerTeamId,
      sourceUnit,
      life: 7.0
    });
  }

  spawnShuriken(startPos, targetPos, damage, attackerTeamId, sourceUnit = null) {
    const geo = new THREE.CylinderGeometry(0.18, 0.18, 0.03, 4);
    const mat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.castShadow = true;
    this.scene.add(mesh);

    const dx = targetPos.x - startPos.x;
    const dy = targetPos.y - startPos.y;
    const dz = targetPos.z - startPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz) || 1;

    const speed = 32.0;
    const time = dist / speed;
    const vx = dx / time;
    const vz = dz / time;
    const vy = (dy + 0.3 * 9.81 * time * time) / time;

    this.projectiles.push({
      type: 'SHURIKEN',
      mesh,
      pos: new THREE.Vector3(startPos.x, startPos.y, startPos.z),
      vel: new THREE.Vector3(vx, vy, vz),
      damage,
      teamId: attackerTeamId,
      sourceUnit,
      life: 4.0
    });
  }

  spawnIceShard(startPos, targetPos, damage, attackerTeamId, sourceUnit = null) {
    const geo = new THREE.ConeGeometry(0.12, 0.7, 5);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.6,
      roughness: 0.1,
      metalness: 0.3
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    this.scene.add(mesh);

    const dx = targetPos.x - startPos.x;
    const dy = targetPos.y - startPos.y;
    const dz = targetPos.z - startPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz) || 1;

    const speed = 25.0;
    const time = dist / speed;
    const vx = dx / time;
    const vz = dz / time;
    const vy = (dy + 0.4 * 9.81 * time * time) / time;

    this.projectiles.push({
      type: 'ICE_SHARD',
      mesh,
      pos: new THREE.Vector3(startPos.x, startPos.y, startPos.z),
      vel: new THREE.Vector3(vx, vy, vz),
      damage,
      teamId: attackerTeamId,
      sourceUnit,
      life: 5.0
    });
  }

  update(dt, allUnits) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;

      // Spin shuriken or icicle
      if (p.type === 'SHURIKEN' && p.mesh) {
        p.mesh.rotation.y += dt * 30.0;
      }

      // Apply Gravity
      p.vel.y -= 9.81 * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);

      // Point arrow / icicle toward flight vector
      if (p.type !== 'SHURIKEN' && p.vel.lengthSq() > 0.01) {
        p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.vel.clone().normalize());
      }

      let hitDetected = false;

      // Ground Collision Check
      if (p.pos.y <= 0.2) {
        hitDetected = true;
      } else {
        // Direct Unit Collision Check
        for (const unit of allUnits) {
          if (unit.isDead || unit.teamId === p.teamId) continue;
          const unitPos = unit.body.translation();
          const dist = p.pos.distanceTo(new THREE.Vector3(unitPos.x, unitPos.y, unitPos.z));

          if (dist < 1.2) {
            hitDetected = true;
            break;
          }
        }
      }

      if (hitDetected || p.life <= 0) {
        this._triggerImpactEffect(p, allUnits);
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }

  _triggerImpactEffect(p, allUnits) {
    if (p.type === 'ARROW' || p.type === 'SHURIKEN') {
      soundSystem.playSwordSlash();
      // Single Target Impact
      for (const unit of allUnits) {
        if (unit.isDead || unit.teamId === p.teamId) continue;
        const unitPos = unit.body.translation();
        const dist = p.pos.distanceTo(new THREE.Vector3(unitPos.x, unitPos.y, unitPos.z));

        if (dist < 1.6) {
          unit.takeDamage(p.damage, p.pos, p.type === 'SHURIKEN' ? 120 : 150, p.sourceUnit);
          if (this.vfxManager) {
            this.vfxManager.spawnHitSparks(p.pos, p.type === 'SHURIKEN' ? 0xe2e8f0 : 0xfacc15, 8);
          }
          break;
        }
      }
    } else if (p.type === 'ICE_SHARD') {
      soundSystem.playBluntHit();
      for (const unit of allUnits) {
        if (unit.isDead || unit.teamId === p.teamId) continue;
        const unitPos = unit.body.translation();
        const dist = p.pos.distanceTo(new THREE.Vector3(unitPos.x, unitPos.y, unitPos.z));

        if (dist < 1.8) {
          unit.takeDamage(p.damage, p.pos, 180, p.sourceUnit);
          unit.triggerKnockdown(0.8); // Short freeze stagger
          if (this.vfxManager) {
            this.vfxManager.spawnHitSparks(p.pos, 0x38bdf8, 10);
          }
          break;
        }
      }
    } else if (p.type === 'FIREBALL' || p.type === 'BOULDER') {
      soundSystem.playFireballExplosion();
      const radius = p.aoeRadius || 5.0;
      const baseForce = p.type === 'BOULDER' ? 1400 : 800;

      if (this.vfxManager) {
        this.vfxManager.spawnExplosionCloud(p.pos, radius);
      }
      if (this.decalSystem) {
        if (p.type === 'FIREBALL') {
          this.decalSystem.spawnScorch(p.pos, radius * 0.55);
        } else if (p.type === 'BOULDER') {
          this.decalSystem.spawnCrater(p.pos, radius * 0.65);
        }
      } else if (this.bloodGoreSystem) {
        this.bloodGoreSystem.spawnGroundSplat(p.pos, radius * 0.6);
      }

      allUnits.forEach(unit => {
        if (unit.isDead) return;
        const unitPos = unit.body.translation();
        const dist = p.pos.distanceTo(new THREE.Vector3(unitPos.x, unitPos.y, unitPos.z));

        if (dist <= radius) {
          const factor = 1.0 - dist / radius;
          const damage = p.damage * factor;
          unit.takeDamage(damage, p.pos, baseForce * factor, p.sourceUnit);
          unit.triggerKnockdown(2.0); // Send surrounding units ragdoll flying!
        }
      });
    }
  }

  clear() {
    this.projectiles.forEach(p => {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    });
    this.projectiles = [];
  }
}
