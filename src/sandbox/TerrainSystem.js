/**
 * TerrainSystem.js
 * Heightmap-based 3D terrain system with dynamic Rapier3D trimesh collision,
 * blended multi-biome vertex texturing, slope mechanics, water simulation,
 * and physical forest obstacles.
 */

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { BATTLEGROUND_MAPS } from './MapConfigs';
import { pbrMaterialSystem } from './PBRMaterialSystem';

export class TerrainSystem {
  constructor(scene, rapierWorld) {
    this.scene = scene;
    this.world = rapierWorld;

    this.currentMap = BATTLEGROUND_MAPS.castle_siege_plains;
    this.terrainMesh = null;
    this.terrainGeo = null;
    this.groundBody = null;
    this.groundCollider = null;

    // Water Surface & Mechanics
    this.waterMesh = null;
    this.waterLevel = 0;
    this.hasWater = false;
    this.waterTime = 0;

    // Instanced Grass & Ground Details
    this.grassInstancedMesh = null;
    this.grassDummy = new THREE.Object3D();
    this.pebblesInstancedMesh = null;

    // Physical Trees & Forest Obstacles
    this.treeGroup = new THREE.Group();
    this.scene.add(this.treeGroup);
    this.treeBodies = [];

    // Fall damage tracking for units
    this.unitPeakSpeeds = new Map(); // unitId -> peak negative linvel.y
  }

  /**
   * Builds the entire 3D physical terrain for a given battleground config.
   */
  buildTerrain(mapConfig) {
    this.currentMap = mapConfig;
    this.clear();

    const size = 120;
    const segments = 112; // High-detail tessellation for smooth hills & cliffs
    this.terrainGeo = new THREE.PlaneGeometry(size, size, segments, segments);
    this.terrainGeo.rotateX(-Math.PI / 2); // Orient XZ plane horizontal

    const pos = this.terrainGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    // Color swatches (RGB normalized 0-1)
    const colGrassLow = new THREE.Color(0x22c55e);  // Lush bright green
    const colGrassMid = new THREE.Color(0x15803d);  // Deep forest green
    const colMud = new THREE.Color(0x3f2e21);       // Churned battlefield mud
    const colSand = new THREE.Color(0xd97706);      // Wet river gravel
    const colCliffRock = new THREE.Color(0x475569); // Sheer granite cliff
    const colPeakRock = new THREE.Color(0x334155);  // High dark bedrock
    const colTrenchDirt = new THREE.Color(0x573926); // War-trampled ground
    const colCobblestone = new THREE.Color(0x64748b); // Fortress stone road / pavers
    const colFlagstone = new THREE.Color(0x78716c);   // Warm castle courtyard stone

    // 1. Elevate each vertex using map heightmap function
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = this.currentMap.getHeight(x, z);
      pos.setY(i, y);
    }

    this.terrainGeo.computeVertexNormals();
    const normals = this.terrainGeo.attributes.normal;

    // 2. Vertex Color Blending based on elevation and slope
    const tempColor = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);

      const ny = normals.getY(i); // 1 = perfectly flat, 0 = 90 degree cliff
      const slopeAngle = Math.acos(Math.max(-1, Math.min(1, ny))); // radians

      // Base: Flat ground vs steep cliff
      if (slopeAngle > 0.55) { // > 31 degrees -> Granite rock cliff
        tempColor.copy(colCliffRock);
        if (y > 4.5) tempColor.lerp(colPeakRock, 0.45);
      } else if (this.currentMap.waterPlane && this.currentMap.waterPlane.enabled && y < this.currentMap.waterPlane.level + 0.4) {
        // Near water shore / riverbed
        tempColor.copy(colMud).lerp(colSand, 0.35);
      } else {
        // Rolling plains / hillside
        const t = Math.max(0, Math.min(1, y / 8.0));
        tempColor.copy(colGrassLow).lerp(colGrassMid, t);

        // Castle Siege Plains: Paved road and fortress courtyard flagstones
        if (this.currentMap.id === 'castle_siege_plains') {
          // Approach road to the castle
          if (x >= -4 && x <= 16 && Math.abs(z) < 3.8 && slopeAngle < 0.45) {
            const roadDist = Math.abs(z) / 3.8;
            tempColor.lerp(colCobblestone, (1 - roadDist) * 0.75);
          }
          // Castle courtyard & citadel flagstones
          if (x > 14 && x <= 46 && Math.abs(z) < 24 && slopeAngle < 0.45) {
            tempColor.lerp(colFlagstone, 0.72);
          }
        }

        // Central clash front dirt discoloration (where armies meet around x=0)
        if (Math.abs(x) < 7.0 && slopeAngle < 0.35) {
          tempColor.lerp(colTrenchDirt, 0.45);
        }
      }

      // Add subtle noise tint variation per vertex
      const noise = (Math.sin(x * 1.5) * Math.cos(z * 1.5)) * 0.05;
      tempColor.r = Math.max(0, Math.min(1, tempColor.r + noise));
      tempColor.g = Math.max(0, Math.min(1, tempColor.g + noise));
      tempColor.b = Math.max(0, Math.min(1, tempColor.b + noise));

      colors[i * 3] = tempColor.r;
      colors[i * 3 + 1] = tempColor.g;
      colors[i * 3 + 2] = tempColor.b;
    }

    this.terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // 3. Create Three.js Visual Mesh with full PBR Material Pipeline
    const terrainMat = pbrMaterialSystem.getMaterial('terrain_pbr', {
      envId: this.currentMap.id,
      vertexColors: true,
      roughness: 0.86,
      metalness: 0.05,
      flatShading: false,
    });

    this.terrainMesh = new THREE.Mesh(this.terrainGeo, terrainMat);
    this.terrainMesh.receiveShadow = true;
    this.terrainMesh.castShadow = false;
    this.scene.add(this.terrainMesh);

    // 4. Create Rapier3D Trimesh Physics Collider
    this._createPhysicsCollider();

    // 5. Water Plane Setup
    this._setupWaterPlane();

    // 6. Forest & Obstacle Setup
    this._setupForestObstacles();

    // 7. Instanced Swaying Grass Blades & Ground Details
    this._setupInstancedGrass();
    this._setupInstancedPebbles();

    console.log(`[TerrainSystem] Built 3D terrain for: ${mapConfig.name}`);
  }

  _createPhysicsCollider() {
    if (!this.world) return;

    try {
      const vertices = this.terrainGeo.attributes.position.array;
      const rawIndices = this.terrainGeo.index ? this.terrainGeo.index.array : null;

      // Rapier3D WASM strictly requires Float32Array for vertices and Uint32Array for indices
      const float32Vertices = vertices instanceof Float32Array ? vertices : new Float32Array(vertices);
      let uint32Indices;
      if (rawIndices) {
        uint32Indices = rawIndices instanceof Uint32Array ? rawIndices : new Uint32Array(rawIndices);
      } else {
        uint32Indices = new Uint32Array(float32Vertices.length / 3);
        for (let i = 0; i < uint32Indices.length; i++) uint32Indices[i] = i;
      }

      // Fixed ground body at origin
      const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0);
      this.groundBody = this.world.createRigidBody(bodyDesc);

      const colliderDesc = RAPIER.ColliderDesc.trimesh(float32Vertices, uint32Indices)
        .setFriction(0.7)
        .setRestitution(0.15);
      this.groundCollider = this.world.createCollider(colliderDesc, this.groundBody);
      console.log(`[TerrainSystem] Created Rapier3D trimesh collider (${uint32Indices.length / 3} triangles)`);
    } catch (err) {
      console.error('[TerrainSystem] Error creating terrain trimesh collider:', err);
    }
  }

  _setupWaterPlane() {
    if (!this.currentMap.waterPlane || !this.currentMap.waterPlane.enabled) {
      this.hasWater = false;
      return;
    }

    this.hasWater = true;
    this.waterLevel = this.currentMap.waterPlane.level || 0.2;

    const waterGeo = new THREE.PlaneGeometry(120, 120, 32, 32);
    waterGeo.rotateX(-Math.PI / 2);

    // Realistic PBR Water Material with animated normal ripple waves
    const waterMat = pbrMaterialSystem.getMaterial('water', {
      color: this.currentMap.waterPlane.color || 0x0369a1,
      roughness: 0.1,
      metalness: 0.2,
      transparent: true,
      opacity: 0.76,
      envMapIntensity: 2.0
    });

    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.position.y = this.waterLevel;
    this.waterMesh.receiveShadow = true;
    this.scene.add(this.waterMesh);
  }

  _setupInstancedGrass() {
    const maxGrass = 1800;
    // Slender, tapered grass tuft geometry (2 intersecting planes with tapered tips)
    const tuftGeo = new THREE.PlaneGeometry(0.32, 0.46, 1, 2);
    tuftGeo.translate(0, 0.23, 0);

    // Taper the top vertices inward to create realistic blade tips
    const p1 = tuftGeo.attributes.position.array;
    for (let i = 0; i < p1.length; i += 3) {
      if (p1[i + 1] > 0.38) {
        p1[i] *= 0.22; // taper top tip
      }
    }
    tuftGeo.attributes.position.needsUpdate = true;

    const crossGeo = tuftGeo.clone();
    crossGeo.rotateY(Math.PI / 2);

    // Merge into single tuft geometry
    const grassGeo = new THREE.BufferGeometry();
    const pos1 = tuftGeo.attributes.position.array;
    const pos2 = crossGeo.attributes.position.array;
    const mergedPos = new Float32Array(pos1.length + pos2.length);
    mergedPos.set(pos1);
    mergedPos.set(pos2, pos1.length);
    grassGeo.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));

    const norm1 = tuftGeo.attributes.normal.array;
    const norm2 = crossGeo.attributes.normal.array;
    const mergedNorm = new Float32Array(norm1.length + norm2.length);
    mergedNorm.set(norm1);
    mergedNorm.set(norm2, norm1.length);
    grassGeo.setAttribute('normal', new THREE.BufferAttribute(mergedNorm, 3));

    if (tuftGeo.index && crossGeo.index) {
      const idx1 = tuftGeo.index.array;
      const idx2 = crossGeo.index.array;
      const mergedIdx = new Uint16Array(idx1.length + idx2.length);
      mergedIdx.set(idx1);
      const vOffset = pos1.length / 3;
      for (let j = 0; j < idx2.length; j++) mergedIdx[idx1.length + j] = idx2[j] + vOffset;
      grassGeo.setIndex(new THREE.BufferAttribute(mergedIdx, 1));
    }

    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x2e4a1a, // Natural deep olive meadow grass
      roughness: 0.92,
      metalness: 0.02,
      side: THREE.DoubleSide,
      flatShading: true
    });

    this.grassInstancedMesh = new THREE.InstancedMesh(grassGeo, grassMat, maxGrass);
    this.grassInstancedMesh.receiveShadow = true;
    this.grassInstancedMesh.castShadow = false;

    let validCount = 0;
    const dummy = this.grassDummy;

    for (let i = 0; i < maxGrass * 2 && validCount < maxGrass; i++) {
      const gx = (Math.random() - 0.5) * 105;
      const gz = (Math.random() - 0.5) * 105;

      // On Mountain Pass, strictly constrain grass to canyon floor (|z| <= 7.5), never on mountain cliffs
      if (this.currentMap.id === 'mountain_pass' && Math.abs(gz) > 7.5) continue;

      // Keep paved castle grounds and approach road clean of wild grass
      if (this.currentMap.id === 'castle_siege_plains') {
        if (gx > 13 && Math.abs(gz) < 25) continue;
        if (gx >= -4 && gx <= 13 && Math.abs(gz) < 3.8) continue;
      }

      // Skip trampled clash front
      if (Math.abs(gx) < 5.0 && Math.random() < 0.75) continue;

      const gy = this.getHeight(gx, gz);
      // Skip submerged in water or rocky peaks
      if (this.hasWater && gy < this.waterLevel + 0.35) continue;
      if (gy > 3.4) continue; // No grass on high cliffs/ridges

      const norm = this.getNormal(gx, gz);
      if (norm.y < 0.88) continue; // Skip steep hills and slopes (> 28 deg)

      dummy.position.set(gx, gy, gz);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      const s = 0.6 + Math.random() * 0.5;
      dummy.scale.set(s, s * (0.8 + Math.random() * 0.4), s);
      dummy.updateMatrix();

      this.grassInstancedMesh.setMatrixAt(validCount, dummy.matrix);
      validCount++;
    }

    this.grassInstancedMesh.count = validCount;
    this.grassInstancedMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.grassInstancedMesh);
  }

  _setupInstancedPebbles() {
    const pebbleCount = 180;
    const pebbleGeo = new THREE.DodecahedronGeometry(0.35, 0);
    const pebbleMat = pbrMaterialSystem.getMaterial('stone_masonry', {
      roughness: 0.88,
      metalness: 0.08
    });

    this.pebblesInstancedMesh = new THREE.InstancedMesh(pebbleGeo, pebbleMat, pebbleCount);
    this.pebblesInstancedMesh.receiveShadow = true;
    this.pebblesInstancedMesh.castShadow = true;

    const dummy = this.grassDummy;
    let count = 0;

    for (let i = 0; i < pebbleCount * 3 && count < pebbleCount; i++) {
      const px = (Math.random() - 0.5) * 110;
      const pz = (Math.random() - 0.5) * 110;
      const py = this.getHeight(px, pz);

      // Distribute along riverbanks or rocky areas
      const isNearWater = this.hasWater && Math.abs(py - this.waterLevel) < 1.4;
      const norm = this.getNormal(px, pz);
      const isRocky = norm.y < 0.85;

      if (!isNearWater && !isRocky && Math.random() > 0.15) continue;

      dummy.position.set(px, py + 0.1, pz);
      dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      const sx = 0.4 + Math.random() * 0.7;
      const sy = 0.3 + Math.random() * 0.5;
      const sz = 0.4 + Math.random() * 0.7;
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();

      this.pebblesInstancedMesh.setMatrixAt(count, dummy.matrix);
      count++;
    }

    this.pebblesInstancedMesh.count = count;
    this.pebblesInstancedMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.pebblesInstancedMesh);
  }

  _setupForestObstacles() {
    const spawns = this.currentMap.treeSpawns || [];

    spawns.forEach((spawn, idx) => {
      const treeY = this.getHeight(spawn.x, spawn.z);
      this._createPhysicalTree(spawn.x, treeY, spawn.z, idx);
    });
  }

  _createPhysicalTree(x, y, z, id) {
    const trunkHeight = 4.2;
    const trunkRadius = 0.45;

    // Visual Tree Group
    const treeMesh = new THREE.Group();
    treeMesh.position.set(x, y, z);

    // Weathered Dark Oak Trunk with PBR Material
    const trunkGeo = new THREE.CylinderGeometry(trunkRadius * 0.65, trunkRadius, trunkHeight, 8);
    const trunkMat = pbrMaterialSystem.getMaterial('dark_timber', { roughness: 0.88 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = trunkHeight / 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    treeMesh.add(trunk);

    // Pine / Broadleaf Foliage Cones with needle texture and rich forest green
    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0x14532d,
      roughness: 0.82,
      metalness: 0.05,
      flatShading: true
    });

    for (let c = 0; c < 3; c++) {
      const coneGeo = new THREE.ConeGeometry(2.5 - c * 0.55, 2.4, 7);
      const cone = new THREE.Mesh(coneGeo, foliageMat);
      cone.position.y = trunkHeight * 0.75 + c * 1.35;
      cone.castShadow = true;
      cone.receiveShadow = true;
      treeMesh.add(cone);
    }

    this.treeGroup.add(treeMesh);

    // Physical Fixed Cylinder Collider in Rapier
    if (this.world) {
      const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y + trunkHeight / 2, z);
      const treeBody = this.world.createRigidBody(bodyDesc);
      const colliderDesc = RAPIER.ColliderDesc.cylinder(trunkHeight / 2, trunkRadius)
        .setFriction(0.6)
        .setRestitution(0.1);
      this.world.createCollider(colliderDesc, treeBody);
      this.treeBodies.push(treeBody);
    }
  }

  /**
   * Fast analytical height query at any world coordinate.
   */
  getHeight(x, z) {
    if (!this.currentMap || !this.currentMap.getHeight) return 0;
    return this.currentMap.getHeight(x, z);
  }

  /**
   * Fast finite-difference normal calculation.
   */
  getNormal(x, z) {
    const eps = 0.2;
    const hL = this.getHeight(x - eps, z);
    const hR = this.getHeight(x + eps, z);
    const hD = this.getHeight(x, z - eps);
    const hU = this.getHeight(x, z + eps);

    const normal = new THREE.Vector3(
      -(hR - hL) / (2 * eps),
      1.0,
      -(hU - hD) / (2 * eps)
    ).normalize();

    return normal;
  }

  /**
   * Directional slope speed modifier for units:
   * Slower uphill (down to 0.6x), faster downhill (up to 1.35x).
   */
  getSlopeSpeedModifier(pos, moveDir) {
    if (!moveDir || (moveDir.x === 0 && moveDir.z === 0)) return 1.0;

    const normal = this.getNormal(pos.x, pos.z);
    // Gradient vector along the ground in direction of ascent
    const ascentGrad = new THREE.Vector2(-normal.x, -normal.z);
    const dir2D = new THREE.Vector2(moveDir.x, moveDir.z).normalize();
    const slopeAlignment = ascentGrad.dot(dir2D);

    if (slopeAlignment > 0.05) {
      // Moving uphill: reduce speed
      return Math.max(0.6, 1.0 - slopeAlignment * 0.7);
    } else if (slopeAlignment < -0.05) {
      // Moving downhill: boost speed
      return Math.min(1.35, 1.0 - slopeAlignment * 0.5);
    }
    return 1.0;
  }

  /**
   * Water drag and deep-water drowning check.
   */
  evaluateWaterInteraction(unit, dt, vfxManager) {
    if (!this.hasWater || !unit.body) return;

    const pos = unit.body.translation();
    const waterDepth = this.waterLevel - pos.y;

    if (waterDepth > 0.15) {
      // In water: apply water drag
      const linvel = unit.body.linvel();
      unit.body.setLinvel({ x: linvel.x * 0.88, y: linvel.y * 0.92, z: linvel.z * 0.88 }, true);

      // Deep water (> 1.2m) kills heavy units (Giants, Shield Bearers, Golems, Battering Rams)
      const isHeavy = unit.typeConfig.mass >= 110 || unit.typeConfig.category === 'SIEGE';
      if (waterDepth > 1.2 && isHeavy && !unit.isDead) {
        unit.takeDamage(45 * dt, null, 0);
        if (vfxManager && Math.random() < 0.2) {
          vfxManager.spawnWaterSplash?.(new THREE.Vector3(pos.x, this.waterLevel, pos.z));
        }
      }
    }
  }

  /**
   * Physics fall damage check when units land with extreme downward velocity.
   */
  evaluateFallDamage(unit, dt) {
    if (!unit.body || unit.isDead) return;

    const linvel = unit.body.linvel();
    const unitId = unit.id;

    // Track peak downward velocity while airborne
    const currentPeak = this.unitPeakSpeeds.get(unitId) || 0;
    if (linvel.y < -3.0) {
      if (linvel.y < currentPeak) {
        this.unitPeakSpeeds.set(unitId, linvel.y);
      }
    } else {
      // Unit has landed or is moving upward
      if (currentPeak < -10.5) {
        // High impact landing!
        const impactSpeed = Math.abs(currentPeak);
        const fallDamage = Math.round((impactSpeed - 9.0) * 12);

        if (fallDamage > 10) {
          unit.takeDamage(fallDamage, null, 150);
          unit.triggerKnockdown(1.8);
        }
      }
      this.unitPeakSpeeds.set(unitId, 0);
    }
  }

  update(dt) {
    // 1. Water Ripple Animation
    if (this.waterMesh && this.waterMesh.material && this.waterMesh.material.normalMap) {
      this.waterTime += dt;
      this.waterMesh.material.normalMap.offset.x = (this.waterTime * 0.02) % 1;
      this.waterMesh.material.normalMap.offset.y = (this.waterTime * 0.015) % 1;
    }
  }

  clear() {
    if (this.terrainMesh && this.scene) {
      this.scene.remove(this.terrainMesh);
      if (this.terrainGeo) this.terrainGeo.dispose();
      this.terrainMesh = null;
    }

    if (this.waterMesh && this.scene) {
      this.scene.remove(this.waterMesh);
      this.waterMesh = null;
    }

    if (this.grassInstancedMesh && this.scene) {
      this.scene.remove(this.grassInstancedMesh);
      this.grassInstancedMesh.geometry.dispose();
      this.grassInstancedMesh = null;
    }

    if (this.pebblesInstancedMesh && this.scene) {
      this.scene.remove(this.pebblesInstancedMesh);
      this.pebblesInstancedMesh.geometry.dispose();
      this.pebblesInstancedMesh = null;
    }

    if (this.groundBody && this.world) {
      this.world.removeRigidBody(this.groundBody);
      this.groundBody = null;
      this.groundCollider = null;
    }

    // Clean up trees
    while (this.treeGroup.children.length > 0) {
      const child = this.treeGroup.children[0];
      this.treeGroup.remove(child);
    }

    this.treeBodies.forEach(tb => {
      if (this.world) this.world.removeRigidBody(tb);
    });
    this.treeBodies = [];
    this.unitPeakSpeeds.clear();
  }
}
