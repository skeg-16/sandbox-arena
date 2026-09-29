import * as THREE from 'three';

export class VFXManager {
  constructor(scene, camera, threeScene = null) {
    this.scene = scene;
    this.camera = camera;
    this.threeScene = threeScene;
    this.particles = [];
    this.combatMeshes = [];

    // Pre-allocated object pool for floating damage numbers (Zero GC allocation during battle)
    this.maxPooledTexts = 24;
    this.textPool = [];
    this.floatingTexts = [];
    this._initTextPool();
  }

  _initTextPool() {
    for (let i = 0; i < this.maxPooledTexts; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      const spriteMat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.visible = false;
      this.scene.add(sprite);

      this.textPool.push({
        canvas,
        ctx,
        texture,
        material: spriteMat,
        sprite,
        vx: 0,
        vy: 0,
        vz: 0,
        baseScale: 1.8,
        life: 0,
        maxLife: 0.85
      });
    }
  }

  spawnHitSparks(pos, colorHex = 0xfacc15, count = 8) {
    const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const mat = new THREE.MeshBasicMaterial({ color: colorHex });

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);

      const vx = (Math.random() - 0.5) * 6;
      const vy = Math.random() * 5 + 2;
      const vz = (Math.random() - 0.5) * 6;

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(vx, vy, vz),
        life: 0.45,
        maxLife: 0.45
      });
    }
  }

  spawnExplosionCloud(pos, radius = 4.0) {
    const geo = new THREE.DodecahedronGeometry(0.5, 1);
    const colors = [0xef4444, 0xf97316, 0xfacc15, 0x475569];

    // Spawn charred scorched impact crater on ground with glowing cooling embers
    this.spawnScorchDecal(pos, radius * 0.85, true);

    for (let i = 0; i < 18; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.5,
        flatShading: true
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        pos.x + (Math.random() - 0.5) * 1.2,
        pos.y + (Math.random() - 0.5) * 1.2,
        pos.z + (Math.random() - 0.5) * 1.2
      );

      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * radius * 2.5 + 2;
      const vx = Math.cos(angle) * speed;
      const vy = Math.random() * 4 + 3;
      const vz = Math.sin(angle) * speed;

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(vx, vy, vz),
        life: 0.75,
        maxLife: 0.75
      });
    }
  }

  /**
   * Battlefield Scorch Decal: Persistent charred ground crater that slowly cools
   */
  spawnScorchDecal(pos, radius = 2.8, isMolten = false) {
    const group = new THREE.Group();

    // 1. Dark scorched charred earth disk
    const scorchGeo = new THREE.CircleGeometry(radius, 16);
    const scorchMat = new THREE.MeshBasicMaterial({
      color: 0x17120e,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
    const scorchMesh = new THREE.Mesh(scorchGeo, scorchMat);
    scorchMesh.rotation.x = -Math.PI / 2;
    scorchMesh.position.y = 0.025;
    group.add(scorchMesh);

    // 2. Molten / Glowing ember inner ring (slowly cools from orange to black)
    let emberMat = null;
    if (isMolten) {
      const emberGeo = new THREE.RingGeometry(0.1, radius * 0.55, 16);
      emberMat = new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const emberMesh = new THREE.Mesh(emberGeo, emberMat);
      emberMesh.rotation.x = -Math.PI / 2;
      emberMesh.position.y = 0.03;
      group.add(emberMesh);
    }

    group.position.set(pos.x, 0, pos.z);
    this.scene.add(group);

    const maxLife = 7.5; // Lingers for 7.5 seconds
    this.combatMeshes.push({
      mesh: group,
      life: maxLife,
      maxLife,
      update: (dt, progress) => {
        // Ember cools and dims first
        if (emberMat) {
          emberMat.opacity = Math.max(0, (progress - 0.4) / 0.6) * 0.9;
        }
        // Scorch mark fades out in second half
        scorchMat.opacity = Math.min(1.0, progress * 1.5) * 0.85;
      }
    });
  }

  spawnFloatingDamageText(pos, damage, isCrit = false) {
    // Acquire pooled sprite item instead of allocating new canvas and texture
    let item = this.textPool.pop();
    if (!item) {
      // Pool exhausted: recycle oldest active floating text
      if (this.floatingTexts.length > 0) {
        item = this.floatingTexts.shift();
      } else {
        return;
      }
    }

    const ctx = item.ctx;
    ctx.clearRect(0, 0, 256, 128);

    let displayText = '';
    let textColor = '#facc15';
    let strokeColor = '#0f172a';
    let fontSize = 38;
    let isSpecial = false;

    if (typeof damage === 'string') {
      displayText = damage;
      isSpecial = true;
      if (damage.includes('CRIT')) {
        textColor = '#f43f5e';
        fontSize = 44;
      } else if (damage.includes('BLOCK')) {
        textColor = '#38bdf8';
        fontSize = 40;
      } else if (damage.includes('KNOCK') || damage.includes('STUN')) {
        textColor = '#fb923c';
        fontSize = 40;
      } else if (damage.includes('ENRAGED')) {
        textColor = '#ef4444';
        fontSize = 44;
      } else if (damage.startsWith('+')) {
        textColor = '#22c55e';
        fontSize = 38;
      }
    } else {
      const rounded = Math.round(damage);
      if (isCrit) {
        displayText = `⚡ ${rounded} CRIT!`;
        textColor = '#fbbf24';
        strokeColor = '#881337';
        fontSize = 46;
      } else {
        displayText = `-${rounded}`;
        textColor = rounded > 60 ? '#f87171' : '#facc15';
        fontSize = rounded > 60 ? 40 : 34;
      }
    }

    // Render Crisp 2D Canvas Text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${fontSize}px system-ui, -apple-system, sans-serif`;

    // Drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 3;

    // Thick dark stroke for AAA contrast
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 7;
    ctx.strokeText(displayText, 128, 64);

    // Inner bright gradient fill
    const grad = ctx.createLinearGradient(0, 64 - fontSize / 2, 0, 64 + fontSize / 2);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, textColor);
    grad.addColorStop(1, textColor);
    ctx.fillStyle = grad;
    ctx.fillText(displayText, 128, 64);

    item.texture.needsUpdate = true;

    const baseScale = isCrit || isSpecial ? 2.5 : 1.8;
    item.sprite.scale.set(baseScale, baseScale * 0.5, 1);
    item.sprite.position.set(
      pos.x + (Math.random() - 0.5) * 0.4,
      pos.y + 1.4,
      pos.z + (Math.random() - 0.5) * 0.4
    );
    item.sprite.material.opacity = 1.0;
    item.sprite.visible = true;

    // Subtle drift velocity
    item.vx = (Math.random() - 0.5) * 0.6;
    item.vy = isCrit ? 2.6 : 2.0;
    item.vz = (Math.random() - 0.5) * 0.6;
    item.baseScale = baseScale;
    item.life = 0.85;
    item.maxLife = 0.85;

    this.floatingTexts.push(item);

    // Screen Shake & Mobile Haptics for heavy hits / crits
    if (isCrit || (typeof damage === 'number' && damage > 50)) {
      if (this.threeScene && typeof this.threeScene.shakeCamera === 'function') {
        this.threeScene.shakeCamera(isCrit ? 0.32 : 0.22);
      }
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(isCrit ? [40, 25, 40] : 25);
        } catch (e) {}
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CHARACTER COMBAT THEMES & SIGNATURE WEAPON TRAILS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Swordsman: Sweeping crescent blade slash arc
   */
  spawnSlashArc(origin, forwardDir, teamColor = 0xffd700, radius = 1.6) {
    const innerR = radius * 0.5;
    const outerR = radius;
    const arcLength = Math.PI * 0.75;
    const geo = new THREE.RingGeometry(innerR, outerR, 24, 1, -arcLength / 2, arcLength);
    const mat = new THREE.MeshBasicMaterial({
      color: teamColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(origin.x, origin.y + 0.9, origin.z);

    const angle = Math.atan2(forwardDir.x, forwardDir.z);
    mesh.rotation.x = Math.PI / 2 + 0.15;
    mesh.rotation.z = -angle;

    this.scene.add(mesh);
    this.combatMeshes.push({
      mesh,
      life: 0.22,
      maxLife: 0.22,
      update: (dt, progress) => {
        mesh.scale.setScalar(1.0 + (1 - progress) * 0.35);
        mat.opacity = progress * 0.9;
      }
    });

    // Sparks flying in slash trajectory
    for (let i = 0; i < 4; i++) {
      const sGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
      const sMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const sMesh = new THREE.Mesh(sGeo, sMat);
      sMesh.position.set(
        origin.x + forwardDir.x * 0.8 + (Math.random() - 0.5) * 0.3,
        origin.y + 0.9 + (Math.random() - 0.5) * 0.3,
        origin.z + forwardDir.z * 0.8 + (Math.random() - 0.5) * 0.3
      );
      this.scene.add(sMesh);
      this.particles.push({
        mesh: sMesh,
        vel: new THREE.Vector3(
          forwardDir.x * 5 + (Math.random() - 0.5) * 2,
          Math.random() * 2 + 1,
          forwardDir.z * 5 + (Math.random() - 0.5) * 2
        ),
        life: 0.25,
        maxLife: 0.25
      });
    }
  }

  /**
   * Spearman: Linear thrust piercing beam with kinetic particles
   */
  spawnPiercingStreak(origin, targetPos, color = 0x67e8f9) {
    const start = new THREE.Vector3(origin.x, origin.y + 1.0, origin.z);
    const end = targetPos ? new THREE.Vector3(targetPos.x, targetPos.y + 1.0, targetPos.z) : start.clone().add(new THREE.Vector3(0, 0, 2));
    const dist = start.distanceTo(end);
    const dir = new THREE.Vector3().subVectors(end, start).normalize();

    const geo = new THREE.CylinderGeometry(0.05, 0.12, Math.max(1.0, dist), 8);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    mesh.position.copy(mid);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

    this.scene.add(mesh);
    this.combatMeshes.push({
      mesh,
      life: 0.18,
      maxLife: 0.18,
      update: (dt, progress) => {
        mat.opacity = progress * 0.9;
        mesh.scale.set(progress, 1, progress);
      }
    });

    for (let i = 0; i < 5; i++) {
      const pGeo = new THREE.BoxGeometry(0.08, 0.08, 0.16);
      const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      pMesh.position.copy(start);
      this.scene.add(pMesh);
      this.particles.push({
        mesh: pMesh,
        vel: new THREE.Vector3(
          dir.x * (8 + Math.random() * 4),
          dir.y * 3 + Math.random() * 2,
          dir.z * (8 + Math.random() * 4)
        ),
        life: 0.25,
        maxLife: 0.25
      });
    }
  }

  /**
   * Shield Bearer: Expanding aegis pulse & defensive shock ring
   */
  spawnShieldPulse(pos, teamColor = 0x60a5fa) {
    const geo = new THREE.RingGeometry(0.4, 0.7, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: teamColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, pos.y + 0.15, pos.z);
    mesh.rotation.x = Math.PI / 2;

    this.scene.add(mesh);
    this.combatMeshes.push({
      mesh,
      life: 0.35,
      maxLife: 0.35,
      update: (dt, progress) => {
        const scale = 1.0 + (1 - progress) * 3.5;
        mesh.scale.set(scale, scale, 1);
        mat.opacity = progress * 0.9;
      }
    });

    this.spawnHitSparks(new THREE.Vector3(pos.x, pos.y + 1.0, pos.z), 0x93c5fd, 8);
  }

  /**
   * Mage: Arcane ground seal / glowing rune ring
   */
  spawnMagicGlyph(pos, color = 0xa855f7) {
    const group = new THREE.Group();
    group.position.set(pos.x, 0.05, pos.z);

    const outerGeo = new THREE.RingGeometry(1.2, 1.45, 32);
    const outerMat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const outerRing = new THREE.Mesh(outerGeo, outerMat);
    outerRing.rotation.x = Math.PI / 2;
    group.add(outerRing);

    const innerGeo = new THREE.RingGeometry(0.5, 0.65, 16);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const innerRing = new THREE.Mesh(innerGeo, innerMat);
    innerRing.rotation.x = Math.PI / 2;
    group.add(innerRing);

    this.scene.add(group);
    this.combatMeshes.push({
      mesh: group,
      life: 0.6,
      maxLife: 0.6,
      update: (dt, progress) => {
        group.rotation.y += dt * 3.5;
        outerMat.opacity = progress * 0.85;
        innerMat.opacity = progress * 0.7;
      }
    });

    for (let i = 0; i < 6; i++) {
      const mGeo = new THREE.DodecahedronGeometry(0.08);
      const mMat = new THREE.MeshBasicMaterial({ color });
      const mMesh = new THREE.Mesh(mGeo, mMat);
      const angle = (i / 6) * Math.PI * 2;
      mMesh.position.set(pos.x + Math.cos(angle) * 1.0, 0.2, pos.z + Math.sin(angle) * 1.0);
      this.scene.add(mMesh);
      this.particles.push({
        mesh: mMesh,
        vel: new THREE.Vector3(0, Math.random() * 2.5 + 2, 0),
        life: 0.5,
        maxLife: 0.5
      });
    }
  }

  /**
   * Giant: Ground-shattering seismic shockwave with flying rocks & camera shake
   */
  spawnSeismicStomp(pos, radius = 4.5) {
    const geo = new THREE.RingGeometry(0.6, 1.2, 36);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.position.set(pos.x, 0.08, pos.z);
    ring.rotation.x = Math.PI / 2;

    this.spawnScorchDecal(pos, radius * 0.75, false);

    this.scene.add(ring);
    this.combatMeshes.push({
      mesh: ring,
      life: 0.45,
      maxLife: 0.45,
      update: (dt, progress) => {
        const scale = 1.0 + (1 - progress) * (radius / 1.2);
        ring.scale.set(scale, scale, 1);
        mat.opacity = progress * 0.95;
      }
    });

    for (let i = 0; i < 14; i++) {
      const dGeo = new THREE.DodecahedronGeometry(0.2, 0);
      const dMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.9,
        flatShading: true
      });
      const dMesh = new THREE.Mesh(dGeo, dMat);
      dMesh.position.set(pos.x + (Math.random() - 0.5) * 1.5, 0.2, pos.z + (Math.random() - 0.5) * 1.5);
      this.scene.add(dMesh);

      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6 + 3;
      this.particles.push({
        mesh: dMesh,
        vel: new THREE.Vector3(Math.cos(angle) * speed, Math.random() * 6 + 4, Math.sin(angle) * speed),
        life: 0.7,
        maxLife: 0.7
      });
    }

    if (this.threeScene?.shakeCamera) {
      this.threeScene.shakeCamera(0.4);
    }
  }

  /**
   * Cavalry: Charging hoof dust puffs
   */
  spawnCavalryHoofDust(pos) {
    for (let i = 0; i < 4; i++) {
      const geo = new THREE.DodecahedronGeometry(0.18, 0);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xa8a29e,
        transparent: true,
        opacity: 0.6,
        flatShading: true
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        pos.x + (Math.random() - 0.5) * 0.8,
        0.15,
        pos.z + (Math.random() - 0.5) * 0.8
      );
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 1.8 + 0.8, (Math.random() - 0.5) * 1.5),
        life: 0.4,
        maxLife: 0.4
      });
    }
  }

  /**
   * Archer: Wind wake trail
   */
  spawnArrowWindWake(origin, targetPos) {
    const start = new THREE.Vector3(origin.x, origin.y + 1.2, origin.z);
    const end = targetPos ? new THREE.Vector3(targetPos.x, targetPos.y + 1.0, targetPos.z) : start.clone().add(new THREE.Vector3(0, 0, 4));
    const dir = new THREE.Vector3().subVectors(end, start).normalize();

    for (let i = 0; i < 4; i++) {
      const geo = new THREE.BoxGeometry(0.06, 0.06, 0.25);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xe2e8f0,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        start.x + dir.x * (i * 0.6) + (Math.random() - 0.5) * 0.15,
        start.y + (Math.random() - 0.5) * 0.15,
        start.z + dir.z * (i * 0.6) + (Math.random() - 0.5) * 0.15
      );
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(dir.x * 8, dir.y * 2, dir.z * 8),
        life: 0.2,
        maxLife: 0.2
      });
    }
  }

  /**
   * Berserker: 360-degree blood whirlwind twin-axe cyclone
   */
  spawnWhirlwindArc(origin, teamColor = 0xef4444) {
    const geo = new THREE.RingGeometry(0.8, 2.4, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: teamColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(origin.x, origin.y + 0.8, origin.z);
    mesh.rotation.x = Math.PI / 2;

    this.scene.add(mesh);
    this.combatMeshes.push({
      mesh,
      life: 0.35,
      maxLife: 0.35,
      update: (dt, progress) => {
        mesh.rotation.z += dt * 18.0;
        mesh.scale.setScalar(1.0 + (1 - progress) * 0.6);
        mat.opacity = progress * 0.9;
      }
    });

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      this.spawnHitSparks(
        new THREE.Vector3(origin.x + Math.cos(angle) * 1.8, origin.y + 0.8, origin.z + Math.sin(angle) * 1.8),
        teamColor,
        2
      );
    }
  }

  /**
   * Samurai: Iaido quick-draw razor flash streak
   */
  spawnIaidoSlash(origin, forwardDir, teamColor = 0x38bdf8) {
    const start = new THREE.Vector3(origin.x, origin.y + 0.9, origin.z);
    const end = start.clone().add(forwardDir.clone().multiplyScalar(4.5));
    const dist = start.distanceTo(end);
    const dir = new THREE.Vector3().subVectors(end, start).normalize();

    // High-contrast razor-thin white-blue slash streak
    const geo = new THREE.CylinderGeometry(0.02, 0.08, dist, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

    this.scene.add(mesh);
    this.combatMeshes.push({
      mesh,
      life: 0.25,
      maxLife: 0.25,
      update: (dt, progress) => {
        mat.opacity = progress;
        mesh.scale.set(progress * 2.0, 1.0, progress * 2.0);
      }
    });

    // Cherry blossom / spark petals
    for (let i = 0; i < 6; i++) {
      const pGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
      const pMat = new THREE.MeshBasicMaterial({ color: teamColor });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      pMesh.position.set(
        start.x + dir.x * (i * 0.7),
        start.y + (Math.random() - 0.5) * 0.3,
        start.z + dir.z * (i * 0.7)
      );
      this.scene.add(pMesh);
      this.particles.push({
        mesh: pMesh,
        vel: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3 + 1, (Math.random() - 0.5) * 4),
        life: 0.35,
        maxLife: 0.35
      });
    }
  }

  /**
   * Monk: Dragon Palm Chi Burst (Colossal Golden Kinetic Blast)
   */
  spawnChiBurst(pos, forwardDir, color = 0xfacc15) {
    const geo = new THREE.RingGeometry(0.3, 0.8, 24);
    const mat = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, pos.y + 0.9, pos.z);

    const angle = Math.atan2(forwardDir.x, forwardDir.z);
    mesh.rotation.y = angle;

    this.scene.add(mesh);
    this.combatMeshes.push({
      mesh,
      life: 0.35,
      maxLife: 0.35,
      update: (dt, progress) => {
        mesh.position.addScaledVector(forwardDir, dt * 14.0);
        const s = 1.0 + (1 - progress) * 4.0;
        mesh.scale.set(s, s, 1);
        mat.opacity = progress * 0.95;
      }
    });

    // Golden kinetic particles
    for (let i = 0; i < 12; i++) {
      const pGeo = new THREE.DodecahedronGeometry(0.1);
      const pMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      pMesh.position.set(pos.x, pos.y + 0.9, pos.z);
      this.scene.add(pMesh);
      this.particles.push({
        mesh: pMesh,
        vel: new THREE.Vector3(
          forwardDir.x * 12 + (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 4,
          forwardDir.z * 12 + (Math.random() - 0.5) * 6
        ),
        life: 0.4,
        maxLife: 0.4
      });
    }

    if (this.threeScene?.shakeCamera) {
      this.threeScene.shakeCamera(0.35);
    }
  }

  /**
   * Paladin: Heavenly Smite (Colossal Golden Divine Pillar of Light)
   */
  spawnHolySmite(targetPos) {
    const group = new THREE.Group();
    group.position.set(targetPos.x, 0, targetPos.z);

    // 1. Pillar of Light
    const beamGeo = new THREE.CylinderGeometry(1.2, 1.8, 28, 16);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 14;
    group.add(beam);

    // 2. Ground Holy Seal Ring
    const ringGeo = new THREE.RingGeometry(0.5, 4.0, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.05;
    group.add(ring);

    this.scene.add(group);
    this.combatMeshes.push({
      mesh: group,
      life: 0.6,
      maxLife: 0.6,
      update: (dt, progress) => {
        beamMat.opacity = progress * 0.85;
        ringMat.opacity = progress * 0.9;
        const s = 1.0 + (1 - progress) * 0.5;
        group.scale.set(s, 1, s);
      }
    });

    // Holy spark burst
    for (let i = 0; i < 16; i++) {
      const pGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
      const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      pMesh.position.set(targetPos.x, 0.5, targetPos.z);
      this.scene.add(pMesh);
      const angle = (i / 16) * Math.PI * 2;
      this.particles.push({
        mesh: pMesh,
        vel: new THREE.Vector3(Math.cos(angle) * 7, Math.random() * 8 + 3, Math.sin(angle) * 7),
        life: 0.55,
        maxLife: 0.55
      });
    }

    if (this.threeScene?.shakeCamera) {
      this.threeScene.shakeCamera(0.45);
    }
  }

  /**
   * Necromancer: Soul Harvest (Dark Void Vortex)
   */
  spawnSoulHarvest(pos, radius = 4.2) {
    const geo = new THREE.RingGeometry(0.5, radius, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x8b5cf6,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.position.set(pos.x, 0.06, pos.z);
    ring.rotation.x = Math.PI / 2;

    this.scene.add(ring);
    this.combatMeshes.push({
      mesh: ring,
      life: 0.7,
      maxLife: 0.7,
      update: (dt, progress) => {
        ring.rotation.z += dt * 4.0;
        mat.opacity = progress * 0.85;
      }
    });

    // Rising soul wisp particles
    for (let i = 0; i < 14; i++) {
      const pGeo = new THREE.SphereGeometry(0.12, 6, 6);
      const pMat = new THREE.MeshBasicMaterial({ color: 0xa855f7 });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * radius * 0.8;
      pMesh.position.set(pos.x + Math.cos(angle) * r, 0.2, pos.z + Math.sin(angle) * r);
      this.scene.add(pMesh);
      this.particles.push({
        mesh: pMesh,
        vel: new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 4 + 2, (Math.random() - 0.5) * 1.5),
        life: 0.65,
        maxLife: 0.65
      });
    }
  }

  /**
   * Dragon Knight & Pyromancer: Dragon Fire Breath Stream
   */
  spawnFireBreath(origin, forwardDir) {
    for (let i = 0; i < 7; i++) {
      const geo = new THREE.DodecahedronGeometry(0.25, 0);
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xf97316 : 0xef4444,
        transparent: true,
        opacity: 0.85
      });
      const mesh = new THREE.Mesh(geo, mat);
      const spreadX = (Math.random() - 0.5) * 0.6;
      const spreadZ = (Math.random() - 0.5) * 0.6;
      mesh.position.set(origin.x + spreadX, origin.y + 1.1, origin.z + spreadZ);
      this.scene.add(mesh);

      const speed = 10.0 + Math.random() * 5.0;
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(
          forwardDir.x * speed + (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 2,
          forwardDir.z * speed + (Math.random() - 0.5) * 3
        ),
        life: 0.45,
        maxLife: 0.45
      });
    }
  }

  /**
   * Frost Witch: Glacial Spikes (Spiky icicles bursting from ground)
   */
  spawnGlacialSpikes(pos, radius = 3.5) {
    const group = new THREE.Group();
    group.position.set(pos.x, 0, pos.z);

    const spikeMat = new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      roughness: 0.1,
      metalness: 0.4,
      transparent: true,
      opacity: 0.95
    });

    for (let i = 0; i < 9; i++) {
      const h = 1.2 + Math.random() * 1.8;
      const spikeGeo = new THREE.ConeGeometry(0.22, h, 5);
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      const angle = (i / 9) * Math.PI * 2;
      const r = Math.random() * radius * 0.75 + 0.3;
      spike.position.set(Math.cos(angle) * r, h * 0.5, Math.sin(angle) * r);
      spike.rotation.x = (Math.random() - 0.5) * 0.3;
      spike.rotation.z = (Math.random() - 0.5) * 0.3;
      group.add(spike);
    }

    this.scene.add(group);
    this.combatMeshes.push({
      mesh: group,
      life: 1.2,
      maxLife: 1.2,
      update: (dt, progress) => {
        if (progress > 0.8) {
          // Erupt out of ground quickly
          group.scale.y = 1.0 - (progress - 0.8) / 0.2;
        } else if (progress < 0.3) {
          // Melt / shatter fade
          group.scale.setScalar(progress / 0.3);
        }
      }
    });

    // Frost mist particles
    for (let i = 0; i < 8; i++) {
      const pGeo = new THREE.DodecahedronGeometry(0.18, 0);
      const pMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.7 });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      pMesh.position.set(pos.x + (Math.random() - 0.5) * 2, 0.4, pos.z + (Math.random() - 0.5) * 2);
      this.scene.add(pMesh);
      this.particles.push({
        mesh: pMesh,
        vel: new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2 + 1, (Math.random() - 0.5) * 2),
        life: 0.5,
        maxLife: 0.5
      });
    }
  }

  /**
   * Fighting Game: 3-Hit Combo Finisher Burst & Impact Screen Punch
   */
  spawnComboFinisherVFX(pos, teamColor = 0xfacc15, comboCount = 3) {
    const geo = new THREE.RingGeometry(0.4, 2.2, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: teamColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.position.set(pos.x, pos.y + 0.9, pos.z);
    ring.rotation.x = Math.PI / 2;

    this.scene.add(ring);
    this.combatMeshes.push({
      mesh: ring,
      life: 0.3,
      maxLife: 0.3,
      update: (dt, progress) => {
        const s = 1.0 + (1 - progress) * 2.5;
        ring.scale.set(s, s, 1);
        mat.opacity = progress;
      }
    });

    this.spawnHitSparks(pos, 0xffffff, 16);
    this.spawnHitSparks(pos, teamColor, 12);

    if (this.threeScene?.shakeCamera) {
      this.threeScene.shakeCamera(0.4);
    }
  }

  // ═══════════════════════════════════════════════════════
  // ═══ MYTHIC DEITY & BOSS VISUAL EFFECTS ═══
  // ═══════════════════════════════════════════════════════

  /**
   * Zeus / Sky God: Cataclysmic Celestial Lightning Strike from the clouds
   */
  spawnDivineLightningStrike(pos, colorHex = 0x38bdf8, isUltimate = false) {
    const boltGroup = new THREE.Group();
    const segments = 9;
    const startY = pos.y + 40;
    const points = [];

    let currentPos = new THREE.Vector3(
      pos.x + (Math.random() - 0.5) * 4,
      startY,
      pos.z + (Math.random() - 0.5) * 4
    );
    points.push(currentPos.clone());

    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const targetY = THREE.MathUtils.lerp(startY, pos.y, t);
      const targetX = THREE.MathUtils.lerp(currentPos.x, pos.x, t) + (Math.random() - 0.5) * (1 - t) * 3.5;
      const targetZ = THREE.MathUtils.lerp(currentPos.z, pos.z, t) + (Math.random() - 0.5) * (1 - t) * 3.5;
      points.push(new THREE.Vector3(targetX, targetY, targetZ));
    }
    points[points.length - 1].set(pos.x, pos.y, pos.z);

    // Build luminous cylinder segments for thick blinding thunderbolt
    const boltMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95
    });

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const dist = p1.distanceTo(p2);
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

      const radius = (isUltimate ? 0.35 : 0.22) * (1.2 - (i / points.length) * 0.4);
      const segGeo = new THREE.CylinderGeometry(radius, radius, dist, 6);
      const seg = new THREE.Mesh(segGeo, boltMat);
      seg.position.copy(mid);
      seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(p2, p1).normalize());
      boltGroup.add(seg);
    }

    // Outer electricity glow shell
    const glowMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.65
    });
    for (let i = 0; i < points.length - 1; i += 2) {
      const p1 = points[i];
      const p2 = points[i + 1] || points[i];
      const dist = p1.distanceTo(p2);
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, dist, 6), glowMat);
      seg.position.copy(mid);
      seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(p2, p1).normalize());
      boltGroup.add(seg);
    }

    // Blinding point light flash
    const flashLight = new THREE.PointLight(colorHex, 5.0, 30);
    flashLight.position.set(pos.x, pos.y + 2.5, pos.z);
    boltGroup.add(flashLight);

    // Ground scorch ring
    this.spawnScorchDecal(pos, isUltimate ? 5.0 : 3.0, true);
    this.spawnHitSparks(pos, 0xffffff, isUltimate ? 28 : 16);
    this.spawnHitSparks(pos, colorHex, isUltimate ? 24 : 14);

    this.scene.add(boltGroup);
    this.combatMeshes.push({
      mesh: boltGroup,
      life: isUltimate ? 0.4 : 0.25,
      maxLife: isUltimate ? 0.4 : 0.25,
      update: (dt, progress) => {
        boltMat.opacity = progress;
        glowMat.opacity = progress * 0.7;
        flashLight.intensity = progress * 5.0;
      }
    });

    if (this.threeScene?.shakeCamera) {
      this.threeScene.shakeCamera(isUltimate ? 0.8 : 0.45);
    }
  }

  /**
   * Ares / Blood God: Molten Volcanic Ground Fissure & Hellfire Eruption
   */
  spawnBloodGodFissure(centerPos, forwardDir, length = 12.0) {
    const count = 7;
    const normDir = forwardDir.clone().normalize();

    for (let i = 0; i < count; i++) {
      const dist = (i + 1) * (length / count);
      const pX = centerPos.x + normDir.x * dist + (Math.random() - 0.5) * 0.8;
      const pZ = centerPos.z + normDir.z * dist + (Math.random() - 0.5) * 0.8;
      const pt = new THREE.Vector3(pX, centerPos.y, pZ);

      setTimeout(() => {
        // Jagged magma spike rising from earth
        const spikeGeo = new THREE.ConeGeometry(0.6 + Math.random() * 0.4, 2.2 + Math.random() * 1.5, 5);
        const spikeMat = new THREE.MeshStandardMaterial({
          color: 0x1f0a0a,
          emissive: 0xef4444,
          emissiveIntensity: 1.4,
          roughness: 0.6
        });
        const spike = new THREE.Mesh(spikeGeo, spikeMat);
        spike.position.set(pt.x, pt.y - 0.5, pt.z);
        spike.rotation.y = Math.random() * Math.PI * 2;
        spike.rotation.z = (Math.random() - 0.5) * 0.35;
        this.scene.add(spike);

        this.spawnScorchDecal(pt, 2.2, true);
        this.spawnHitSparks(pt, 0xef4444, 14);
        this.spawnHitSparks(pt, 0xf97316, 10);

        this.combatMeshes.push({
          mesh: spike,
          life: 2.5,
          maxLife: 2.5,
          update: (dt, progress) => {
            if (progress > 0.8) {
              spike.position.y += dt * 3.5;
            } else if (progress < 0.3) {
              spike.position.y -= dt * 2.5;
              spikeMat.emissiveIntensity = progress * 2.0;
            }
          }
        });
      }, i * 65);
    }

    if (this.threeScene?.shakeCamera) {
      this.threeScene.shakeCamera(0.7);
    }
  }

  /**
   * Hades / Shadow Sovereign: Ethereal Soul Torment Vortex
   */
  spawnSoulTormentVortex(centerPos, radius = 6.5) {
    // 1. Necrotic Ground Sigil
    const sigilGeo = new THREE.RingGeometry(radius * 0.2, radius, 24);
    sigilGeo.rotateX(-Math.PI / 2);
    const sigilMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    const sigil = new THREE.Mesh(sigilGeo, sigilMat);
    sigil.position.set(centerPos.x, centerPos.y + 0.05, centerPos.z);
    this.scene.add(sigil);

    this.combatMeshes.push({
      mesh: sigil,
      life: 2.2,
      maxLife: 2.2,
      update: (dt, progress) => {
        sigil.rotation.y += dt * 1.5;
        sigilMat.opacity = progress * 0.8;
      }
    });

    // 2. Swirling Soul Wisps ascending
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2;
      const dist = Math.random() * radius * 0.8 + 0.5;
      const px = centerPos.x + Math.cos(angle) * dist;
      const pz = centerPos.z + Math.sin(angle) * dist;

      const soulGeo = new THREE.SphereGeometry(0.18 + Math.random() * 0.12, 6, 6);
      const soulMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0x34d399 : 0x059669,
        transparent: true,
        opacity: 0.9
      });
      const soul = new THREE.Mesh(soulGeo, soulMat);
      soul.position.set(px, centerPos.y + 0.2, pz);
      this.scene.add(soul);

      const orbitSpeed = 2.5 + Math.random() * 2.0;
      let curDist = dist;

      this.combatMeshes.push({
        mesh: soul,
        life: 1.8 + Math.random() * 0.6,
        maxLife: 2.4,
        update: (dt, progress) => {
          soul.position.y += dt * 3.5;
          curDist *= 0.98; // spiral inward
          const theta = progress * orbitSpeed * 6.0 + angle;
          soul.position.x = centerPos.x + Math.cos(theta) * curDist;
          soul.position.z = centerPos.z + Math.sin(theta) * curDist;
          soulMat.opacity = progress;
        }
      });
    }

    if (this.threeScene?.shakeCamera) {
      this.threeScene.shakeCamera(0.5);
    }
  }

  /**
   * Poseidon / Ocean Lord: Cascading Abyssal Tsunami Geysers
   */
  spawnAbyssalTsunamiGeysers(centerPos, forwardDir, range = 14.0) {
    const count = 5;
    const normDir = forwardDir.clone().normalize();

    for (let i = 0; i < count; i++) {
      const dist = (i + 1) * (range / count);
      const pX = centerPos.x + normDir.x * dist + (Math.random() - 0.5) * 1.5;
      const pZ = centerPos.z + normDir.z * dist + (Math.random() - 0.5) * 1.5;
      const pt = new THREE.Vector3(pX, centerPos.y, pZ);

      setTimeout(() => {
        // Erupting Water Geyser Column
        const geyserGeo = new THREE.CylinderGeometry(0.8 + i * 0.25, 1.4 + i * 0.35, 6.0 + i * 1.2, 12, 1, true);
        const geyserMat = new THREE.MeshStandardMaterial({
          color: 0x0284c7,
          roughness: 0.1,
          metalness: 0.1,
          transparent: true,
          opacity: 0.75,
          side: THREE.DoubleSide
        });
        const geyser = new THREE.Mesh(geyserGeo, geyserMat);
        geyser.position.set(pt.x, pt.y + 2.5, pt.z);
        this.scene.add(geyser);

        // Water crest ring
        const ringGeo = new THREE.RingGeometry(0.8, 2.5 + i * 0.4, 16);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(pt.x, pt.y + 0.1, pt.z);
        this.scene.add(ring);

        this.spawnHitSparks(pt, 0x38bdf8, 20);
        this.spawnHitSparks(pt, 0xffffff, 16);

        this.combatMeshes.push({
          mesh: geyser,
          life: 0.7,
          maxLife: 0.7,
          update: (dt, progress) => {
            geyser.scale.y = 1.0 + (1 - progress) * 1.2;
            geyser.rotation.y += dt * 4.0;
            geyserMat.opacity = progress * 0.75;
          }
        });

        this.combatMeshes.push({
          mesh: ring,
          life: 0.5,
          maxLife: 0.5,
          update: (dt, progress) => {
            const s = 1.0 + (1 - progress) * 2.0;
            ring.scale.set(s, s, 1);
            ringMat.opacity = progress;
          }
        });
      }, i * 75);
    }

    if (this.threeScene?.shakeCamera) {
      this.threeScene.shakeCamera(0.65);
    }
  }

  update(dt) {
    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vel.y -= 9.81 * dt; // gravity
      p.mesh.position.addScaledVector(p.vel, dt);

      const progress = p.life / p.maxLife;
      p.mesh.scale.setScalar(progress);

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }

    // Update Combat Meshes (Slash arcs, shockwaves, runes, beams)
    for (let i = this.combatMeshes.length - 1; i >= 0; i--) {
      const item = this.combatMeshes[i];
      item.life -= dt;
      if (item.update) item.update(dt, Math.max(0, item.life / item.maxLife));

      if (item.life <= 0) {
        this.scene.remove(item.mesh);
        if (item.mesh.geometry) item.mesh.geometry.dispose();
        if (item.mesh.material) {
          if (Array.isArray(item.mesh.material)) item.mesh.material.forEach(m => m.dispose());
          else item.mesh.material.dispose();
        }
        this.combatMeshes.splice(i, 1);
      }
    }

    // Update Floating Text Sprites
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;

      // 3D velocity drift with upward drag
      ft.sprite.position.x += (ft.vx || 0) * dt;
      ft.sprite.position.y += (ft.vy || 2.0) * dt;
      ft.sprite.position.z += (ft.vz || 0) * dt;
      ft.vy = Math.max(0.6, (ft.vy || 2.0) - dt * 2.2);

      const progress = ft.life / ft.maxLife; // 1.0 -> 0.0

      // Scale pop: expands on spawn, then gently settles
      const pop = progress > 0.85
        ? 0.7 + ((1.0 - progress) / 0.15) * 0.45
        : Math.min(1.0, progress * 1.3);
      const bScale = ft.baseScale || 1.8;
      ft.sprite.scale.set(bScale * pop, bScale * 0.5 * pop, 1);

      // Smooth alpha fadeout
      ft.sprite.material.opacity = Math.max(0, Math.min(1.0, progress * 1.8));

      if (ft.life <= 0) {
        ft.sprite.visible = false;
        this.floatingTexts.splice(i, 1);
        this.textPool.push(ft);
      }
    }

    // Safety cap active particles & combat meshes to maintain high FPS during massive battles
    if (this.particles.length > 120) {
      const excess = this.particles.splice(0, this.particles.length - 120);
      excess.forEach(p => {
        this.scene.remove(p.mesh);
        p.mesh.geometry?.dispose();
        p.mesh.material?.dispose();
      });
    }

    if (this.combatMeshes.length > 25) {
      const excess = this.combatMeshes.splice(0, this.combatMeshes.length - 25);
      excess.forEach(item => {
        this.scene.remove(item.mesh);
        if (item.mesh.geometry) item.mesh.geometry.dispose();
        if (item.mesh.material) {
          if (Array.isArray(item.mesh.material)) item.mesh.material.forEach(m => m.dispose());
          else item.mesh.material.dispose();
        }
      });
    }
  }

  clear() {
    this.particles.forEach(p => {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    });
    this.combatMeshes.forEach(item => {
      this.scene.remove(item.mesh);
      if (item.mesh.geometry) item.mesh.geometry.dispose();
      if (item.mesh.material) {
        if (Array.isArray(item.mesh.material)) item.mesh.material.forEach(m => m.dispose());
        else item.mesh.material.dispose();
      }
    });
    // Return all active floating texts back to pool
    this.floatingTexts.forEach(ft => {
      ft.sprite.visible = false;
      this.textPool.push(ft);
    });
    this.particles = [];
    this.combatMeshes = [];
    this.floatingTexts = [];
  }

  dispose() {
    this.clear();
    this.textPool.forEach(item => {
      this.scene.remove(item.sprite);
      item.material.dispose();
      item.texture.dispose();
    });
    this.textPool = [];
  }
}
