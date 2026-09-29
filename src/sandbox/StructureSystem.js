/**
 * StructureSystem.js
 * Destructible fortifications and siege structures with Rapier3D physics,
 * visual health degradation, garrison platforms, and dynamic physical debris collapse.
 */

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { soundSystem } from './SoundSystem';
import { pbrMaterialSystem } from './PBRMaterialSystem';

export const STRUCTURE_TYPES = {
  watchtower: {
    id: 'watchtower',
    name: 'Stone Watchtower',
    cost: 250,
    maxHealth: 850,
    width: 3.5,
    height: 9.0,
    depth: 3.5,
    platformY: 8.2,
    hasGarrisonPlatform: true,
  },
  wall_segment: {
    id: 'wall_segment',
    name: 'Castle Wall Segment',
    cost: 180,
    maxHealth: 950,
    width: 8.0,
    height: 4.2,
    depth: 2.4,
    platformY: 4.0,
    hasGarrisonPlatform: true,
  },
  gatehouse: {
    id: 'gatehouse',
    name: 'Fortified Gatehouse',
    cost: 400,
    maxHealth: 1600,
    gateMaxHealth: 700,
    width: 10.0,
    height: 8.0,
    depth: 3.2,
    platformY: 6.8,
    hasGarrisonPlatform: true,
    hasDestructibleGate: true,
  },
  keep: {
    id: 'keep',
    name: 'Stronghold Keep',
    cost: 800,
    maxHealth: 2800,
    width: 12.0,
    height: 11.0,
    depth: 12.0,
    platformY: 9.5,
    hasGarrisonPlatform: true,
    isObjectiveTarget: true,
  },
  palisade: {
    id: 'palisade',
    name: 'Wooden Barricade',
    cost: 75,
    maxHealth: 260,
    width: 5.0,
    height: 2.2,
    depth: 1.0,
    hasGarrisonPlatform: false,
  },
  bridge: {
    id: 'bridge',
    name: 'Heavy Timber Bridge',
    cost: 200,
    maxHealth: 650,
    width: 5.5,
    height: 1.2,
    depth: 16.0,
    platformY: 1.2,
    hasGarrisonPlatform: false,
  }
};

export class FortificationStructure {
  constructor(system, config, world, scene, vfxManager) {
    this.system = system;
    this.config = config;
    this.typeConfig = STRUCTURE_TYPES[config.type] || STRUCTURE_TYPES.wall_segment;
    this.world = world;
    this.scene = scene;
    this.vfxManager = vfxManager;

    this.id = config.id || `struct_${Math.random().toString(36).substr(2, 9)}`;
    this.teamId = config.teamId || 'neutral';
    this.position = { ...config.position };
    this.rotationY = config.rotationY || 0;

    this.health = this.typeConfig.maxHealth;
    this.maxHealth = this.typeConfig.maxHealth;
    this.isDestroyed = false;

    // Gatehouse specific gate HP
    this.gateHealth = this.typeConfig.gateMaxHealth || 0;
    this.isGateBreached = false;

    this.meshGroup = new THREE.Group();
    this.body = null;
    this.collider = null;
    this.gateBody = null;
    this.gateMesh = null;

    // Materials
    this.stoneMat = null;
    this.woodMat = null;
    this.ironMat = null;

    // Smoke / Fire visual stages
    this.smokeActive = false;

    this._buildVisualsAndPhysics();
  }

  _buildVisualsAndPhysics() {
    const p = this.position;
    const cfg = this.typeConfig;

    this.meshGroup.position.set(p.x, p.y, p.z);
    this.meshGroup.rotation.y = this.rotationY;

    // Grounded, realistic, gritty medieval PBR materials
    this.stoneMat = pbrMaterialSystem.getMaterial('stone_masonry');
    this.woodMat = pbrMaterialSystem.getMaterial('dark_timber');
    this.ironMat = pbrMaterialSystem.getMaterial('rusted_iron');

    const teamHex = this.teamId === 'blue' ? 0x2563eb : (this.teamId === 'red' ? 0xdc2626 : 0xd97706);
    const bannerMat = pbrMaterialSystem.getMaterial('cloth_weave', { teamColor: teamHex });

    // ════════════════════════════════════════════════════
    // 1. WATCHTOWER
    // ════════════════════════════════════════════════════
    if (cfg.id === 'watchtower') {
      // Main Stone Shaft
      const shaftGeo = new THREE.BoxGeometry(cfg.width, cfg.height, cfg.depth);
      const shaft = new THREE.Mesh(shaftGeo, this.stoneMat);
      shaft.position.y = cfg.height / 2;
      shaft.castShadow = true;
      shaft.receiveShadow = true;
      this.meshGroup.add(shaft);

      // Elevated Wooden / Stone Platform Top
      const platGeo = new THREE.BoxGeometry(cfg.width * 1.35, 0.4, cfg.depth * 1.35);
      const plat = new THREE.Mesh(platGeo, this.woodMat);
      plat.position.y = cfg.platformY;
      plat.castShadow = true;
      plat.receiveShadow = true;
      this.meshGroup.add(plat);

      // Crenellation Battlements
      const parapetGeo = new THREE.BoxGeometry(cfg.width * 1.35, 0.8, 0.2);
      const pNorth = new THREE.Mesh(parapetGeo, this.stoneMat);
      pNorth.position.set(0, cfg.platformY + 0.5, (cfg.depth * 1.35) / 2);
      this.meshGroup.add(pNorth);

      const pSouth = new THREE.Mesh(parapetGeo, this.stoneMat);
      pSouth.position.set(0, cfg.platformY + 0.5, -(cfg.depth * 1.35) / 2);
      this.meshGroup.add(pSouth);

      // Team Pennant Banner
      const bannerGeo = new THREE.BoxGeometry(0.1, 1.8, 1.0);
      const banner = new THREE.Mesh(bannerGeo, bannerMat);
      banner.position.set(0, cfg.platformY + 2.0, 0);
      this.meshGroup.add(banner);

      this._createPhysicsBox(cfg.width, cfg.height, cfg.depth, cfg.height / 2);

    // ════════════════════════════════════════════════════
    // 2. CASTLE WALL SEGMENT
    // ════════════════════════════════════════════════════
    } else if (cfg.id === 'wall_segment') {
      // Wall Body
      const wallGeo = new THREE.BoxGeometry(cfg.width, cfg.height, cfg.depth);
      const wall = new THREE.Mesh(wallGeo, this.stoneMat);
      wall.position.y = cfg.height / 2;
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.meshGroup.add(wall);

      // Outer Parapet Shield
      const parapetGeo = new THREE.BoxGeometry(cfg.width, 0.9, 0.35);
      const parapet = new THREE.Mesh(parapetGeo, this.stoneMat);
      parapet.position.set(0, cfg.height + 0.45, -cfg.depth / 2 + 0.2);
      parapet.castShadow = true;
      this.meshGroup.add(parapet);

      // Merlon battlements along top
      for (let m = -3; m <= 3; m += 2) {
        const merlonGeo = new THREE.BoxGeometry(0.9, 0.5, 0.38);
        const merlon = new THREE.Mesh(merlonGeo, this.stoneMat);
        merlon.position.set(m * 1.0, cfg.height + 1.0, -cfg.depth / 2 + 0.2);
        this.meshGroup.add(merlon);
      }

      this._createPhysicsBox(cfg.width, cfg.height, cfg.depth, cfg.height / 2);

    // ════════════════════════════════════════════════════
    // 3. FORTIFIED GATEHOUSE
    // ════════════════════════════════════════════════════
    } else if (cfg.id === 'gatehouse') {
      const towerWidth = 2.6;
      const archSpan = 4.8;

      // Left Flanking Tower
      const leftTowerGeo = new THREE.BoxGeometry(towerWidth, cfg.height, cfg.depth);
      const leftTower = new THREE.Mesh(leftTowerGeo, this.stoneMat);
      leftTower.position.set(-archSpan / 2 - towerWidth / 2, cfg.height / 2, 0);
      leftTower.castShadow = true;
      leftTower.receiveShadow = true;
      this.meshGroup.add(leftTower);

      // Right Flanking Tower
      const rightTower = leftTower.clone();
      rightTower.position.set(archSpan / 2 + towerWidth / 2, cfg.height / 2, 0);
      this.meshGroup.add(rightTower);

      // Overhead Lintel Arch & Walkway
      const lintelGeo = new THREE.BoxGeometry(archSpan, 2.4, cfg.depth);
      const lintel = new THREE.Mesh(lintelGeo, this.stoneMat);
      lintel.position.set(0, cfg.height - 1.2, 0);
      lintel.castShadow = true;
      lintel.receiveShadow = true;
      this.meshGroup.add(lintel);

      // Destructible Center Iron/Oak Portcullis Gate
      const gateGeo = new THREE.BoxGeometry(archSpan, cfg.height - 2.4, 0.4);
      this.gateMesh = new THREE.Mesh(gateGeo, this.woodMat);
      this.gateMesh.position.set(0, (cfg.height - 2.4) / 2, 0);
      this.gateMesh.castShadow = true;

      // Iron Studs & Banding on Gate
      const ironBandGeo = new THREE.BoxGeometry(archSpan * 0.98, 0.15, 0.44);
      const b1 = new THREE.Mesh(ironBandGeo, this.ironMat);
      b1.position.y = 1.0;
      this.gateMesh.add(b1);
      const b2 = new THREE.Mesh(ironBandGeo, this.ironMat);
      b2.position.y = -1.0;
      this.gateMesh.add(b2);

      this.meshGroup.add(this.gateMesh);

      // Create compound physical colliders for towers + lintel
      this._createGatehousePhysics(towerWidth, archSpan, cfg.height, cfg.depth);

    // ════════════════════════════════════════════════════
    // 4. STRONGHOLD KEEP
    // ════════════════════════════════════════════════════
    } else if (cfg.id === 'keep') {
      // Main Fortress Citadel
      const keepGeo = new THREE.BoxGeometry(cfg.width, cfg.height, cfg.depth);
      const keepBodyMesh = new THREE.Mesh(keepGeo, this.stoneMat);
      keepBodyMesh.position.y = cfg.height / 2;
      keepBodyMesh.castShadow = true;
      keepBodyMesh.receiveShadow = true;
      this.meshGroup.add(keepBodyMesh);

      // 4 Corner Turrets
      const turretRadius = 1.8;
      const turretHeight = cfg.height + 2.5;
      const turretGeo = new THREE.CylinderGeometry(turretRadius, turretRadius, turretHeight, 8);
      const corners = [
        { x: -cfg.width / 2, z: -cfg.depth / 2 },
        { x: cfg.width / 2, z: -cfg.depth / 2 },
        { x: -cfg.width / 2, z: cfg.depth / 2 },
        { x: cfg.width / 2, z: cfg.depth / 2 }
      ];

      corners.forEach(c => {
        const turret = new THREE.Mesh(turretGeo, this.stoneMat);
        turret.position.set(c.x, turretHeight / 2, c.z);
        turret.castShadow = true;
        this.meshGroup.add(turret);

        // Turret Conical Slate Roof
        const roofGeo = new THREE.ConeGeometry(turretRadius * 1.25, 2.4, 8);
        const roofMat = pbrMaterialSystem.getMaterial('roof_tiles');
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(c.x, turretHeight + 1.2, c.z);
        this.meshGroup.add(roof);
      });

      // Majestic Central Tower & Banner Flag
      const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4.5, 6), this.woodMat);
      flagPole.position.set(0, cfg.height + 2.25, 0);
      this.meshGroup.add(flagPole);

      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 2.8), bannerMat);
      flag.position.set(0.1, cfg.height + 3.2, 1.4);
      this.meshGroup.add(flag);

      this._createPhysicsBox(cfg.width + 1.5, cfg.height, cfg.depth + 1.5, cfg.height / 2);

    // ════════════════════════════════════════════════════
    // 5. WOODEN PALISADE
    // ════════════════════════════════════════════════════
    } else if (cfg.id === 'palisade') {
      const stakeCount = 8;
      const stakeWidth = cfg.width / stakeCount;

      for (let s = 0; s < stakeCount; s++) {
        const stakeGeo = new THREE.CylinderGeometry(0.2, 0.28, cfg.height + (s % 2) * 0.4, 6);
        const stake = new THREE.Mesh(stakeGeo, this.woodMat);
        stake.position.set(-cfg.width / 2 + s * stakeWidth + 0.3, cfg.height / 2, (Math.random() - 0.5) * 0.15);
        stake.rotation.z = (Math.random() - 0.5) * 0.08;
        stake.castShadow = true;
        this.meshGroup.add(stake);
      }

      // Horizontal Crossbeams
      const beamGeo = new THREE.BoxGeometry(cfg.width, 0.25, 0.25);
      const b1 = new THREE.Mesh(beamGeo, this.woodMat);
      b1.position.set(0, cfg.height * 0.4, 0.15);
      this.meshGroup.add(b1);
      const b2 = new THREE.Mesh(beamGeo, this.woodMat);
      b2.position.set(0, cfg.height * 0.75, 0.15);
      this.meshGroup.add(b2);

      this._createPhysicsBox(cfg.width, cfg.height, cfg.depth, cfg.height / 2);

    // ════════════════════════════════════════════════════
    // 6. HEAVY TIMBER BRIDGE
    // ════════════════════════════════════════════════════
    } else if (cfg.id === 'bridge') {
      // Arched Deck Planks
      const deckGeo = new THREE.BoxGeometry(cfg.width, cfg.height, cfg.depth);
      const deck = new THREE.Mesh(deckGeo, this.woodMat);
      deck.position.y = cfg.height / 2;
      deck.castShadow = true;
      deck.receiveShadow = true;
      this.meshGroup.add(deck);

      // Handrails along edges
      const railGeo = new THREE.BoxGeometry(0.25, 0.9, cfg.depth);
      const rLeft = new THREE.Mesh(railGeo, this.woodMat);
      rLeft.position.set(-cfg.width / 2 + 0.15, cfg.height + 0.45, 0);
      this.meshGroup.add(rLeft);

      const rRight = new THREE.Mesh(railGeo, this.woodMat);
      rRight.position.set(cfg.width / 2 - 0.15, cfg.height + 0.45, 0);
      this.meshGroup.add(rRight);

      // Stone Bridge Pylons underneath
      const pylonGeo = new THREE.BoxGeometry(cfg.width * 1.1, 4.0, 1.2);
      const pylon1 = new THREE.Mesh(pylonGeo, this.stoneMat);
      pylon1.position.set(0, -1.8, -cfg.depth * 0.3);
      this.meshGroup.add(pylon1);

      const pylon2 = new THREE.Mesh(pylonGeo, this.stoneMat);
      pylon2.position.set(0, -1.8, cfg.depth * 0.3);
      this.meshGroup.add(pylon2);

      this._createPhysicsBox(cfg.width, cfg.height, cfg.depth, cfg.height / 2);
    }

    this.scene.add(this.meshGroup);
  }

  _createPhysicsBox(w, h, d, centerY) {
    if (!this.world) return;

    const p = this.position;
    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(p.x, p.y + centerY, p.z)
      .setRotation({
        x: 0,
        y: Math.sin(this.rotationY * 0.5),
        z: 0,
        w: Math.cos(this.rotationY * 0.5)
      });

    this.body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
      .setFriction(0.7)
      .setRestitution(0.1);
    this.collider = this.world.createCollider(colliderDesc, this.body);
  }

  _createGatehousePhysics(towerW, archSpan, h, d) {
    if (!this.world) return;
    const p = this.position;

    // Fixed Body for Main Gatehouse Frame
    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(p.x, p.y, p.z)
      .setRotation({
        x: 0,
        y: Math.sin(this.rotationY * 0.5),
        z: 0,
        w: Math.cos(this.rotationY * 0.5)
      });
    this.body = this.world.createRigidBody(bodyDesc);

    // Left Tower Collider
    const leftCol = RAPIER.ColliderDesc.cuboid(towerW / 2, h / 2, d / 2)
      .setTranslation(-archSpan / 2 - towerW / 2, h / 2, 0);
    this.world.createCollider(leftCol, this.body);

    // Right Tower Collider
    const rightCol = RAPIER.ColliderDesc.cuboid(towerW / 2, h / 2, d / 2)
      .setTranslation(archSpan / 2 + towerW / 2, h / 2, 0);
    this.world.createCollider(rightCol, this.body);

    // Overhead Lintel Collider
    const lintelCol = RAPIER.ColliderDesc.cuboid(archSpan / 2, 1.2, d / 2)
      .setTranslation(0, h - 1.2, 0);
    this.world.createCollider(lintelCol, this.body);

    // Central Gate Collider (Separate so it can be unblocked when gate is breached!)
    const gateBodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(p.x, p.y + (h - 2.4) / 2, p.z)
      .setRotation({
        x: 0,
        y: Math.sin(this.rotationY * 0.5),
        z: 0,
        w: Math.cos(this.rotationY * 0.5)
      });
    this.gateBody = this.world.createRigidBody(gateBodyDesc);
    const gateCol = RAPIER.ColliderDesc.cuboid(archSpan / 2, (h - 2.4) / 2, 0.25);
    this.world.createCollider(gateCol, this.gateBody);
  }

  /**
   * Applies damage to this structure, updates visuals, triggers collapse when HP <= 0.
   */
  takeDamage(amount, hitPos, attackerUnit = null) {
    if (this.isDestroyed) return;

    // Check if damage hits the gate in a gatehouse
    if (this.typeConfig.id === 'gatehouse' && !this.isGateBreached) {
      this.gateHealth -= amount;
      if (this.vfxManager && hitPos) {
        this.vfxManager.spawnHitSparks(new THREE.Vector3(hitPos.x, hitPos.y, hitPos.z), 0xd97706, 8);
      }

      if (this.gateHealth <= 0) {
        this.breachGate();
      }
    }

    this.health -= amount;

    // Visual crack / smoke degradation
    const hpRatio = this.health / this.maxHealth;
    if (hpRatio < 0.6 && !this.smokeActive) {
      this.smokeActive = true;
      if (this.stoneMat) this.stoneMat.color.setHex(0x475569); // Darkened scorched stone
    }

    if (this.vfxManager && hitPos) {
      this.vfxManager.spawnHitSparks(new THREE.Vector3(hitPos.x, hitPos.y, hitPos.z), 0x94a3b8, 6);
    }

    if (this.health <= 0) {
      this.collapse();
    }
  }

  breachGate() {
    this.isGateBreached = true;
    soundSystem.playHeavyWoodBreak?.();

    if (this.gateMesh) {
      this.meshGroup.remove(this.gateMesh);
      this.gateMesh = null;
    }

    if (this.gateBody && this.world) {
      this.world.removeRigidBody(this.gateBody);
      this.gateBody = null;
    }

    if (this.vfxManager) {
      this.vfxManager.spawnExplosionWave?.(
        new THREE.Vector3(this.position.x, this.position.y + 1.5, this.position.z),
        0x78350f,
        4.0
      );
    }

    // Signal navigation system that gate passage is now open!
    this.system.onGateBreached(this);
    console.log(`[StructureSystem] Gate breached on: ${this.id}`);
  }

  /**
   * Complete physical collapse into tumbling rigid body debris rubble.
   */
  collapse() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.health = 0;

    soundSystem.playTowerCollapse?.();

    // Spawns debris physical bodies in StructureSystem
    this.system.spawnStructureDebris(this);

    // Apply crush damage and knockdown to any units underneath or on top
    this.system.applyCrushDamage(this.position, this.typeConfig.width * 1.2, 240);

    // Remove intact physical colliders
    if (this.body && this.world) {
      this.world.removeRigidBody(this.body);
      this.body = null;
      this.collider = null;
    }

    if (this.gateBody && this.world) {
      this.world.removeRigidBody(this.gateBody);
      this.gateBody = null;
    }

    // Fade out and remove visual mesh
    if (this.meshGroup && this.scene) {
      this.scene.remove(this.meshGroup);
    }

    // Signal navigation graph that obstacle is now passable rubble
    this.system.onStructureCollapsed(this);
    console.log(`[StructureSystem] Collapsed structure: ${this.id}`);
  }

  destroy() {
    if (this.body && this.world) {
      this.world.removeRigidBody(this.body);
      this.body = null;
    }
    if (this.gateBody && this.world) {
      this.world.removeRigidBody(this.gateBody);
      this.gateBody = null;
    }
    if (this.meshGroup && this.scene) {
      this.scene.remove(this.meshGroup);
    }
  }
}

export class StructureSystem {
  constructor(scene, rapierWorld, vfxManager, terrainSystem) {
    this.scene = scene;
    this.world = rapierWorld;
    this.vfxManager = vfxManager;
    this.terrainSystem = terrainSystem;

    this.structures = [];
    this.activeDebrisBodies = []; // Capped for performance
    this.maxActiveDebris = 40;
    this.debrisGroup = new THREE.Group();
    this.scene.add(this.debrisGroup);

    this.onGateBreachedCallback = null;
    this.onStructureCollapsedCallback = null;
  }

  loadMapStructures(structureConfigs) {
    this.clear();
    if (!structureConfigs || structureConfigs.length === 0) return;

    structureConfigs.forEach(cfg => {
      const struct = new FortificationStructure(this, cfg, this.world, this.scene, this.vfxManager);
      this.structures.push(struct);
    });

    console.log(`[StructureSystem] Loaded ${this.structures.length} fortifications.`);
  }

  addStructure(type, teamId, position, rotationY = 0) {
    const cfg = {
      id: `placed_${type}_${Date.now()}`,
      type,
      teamId,
      position,
      rotationY
    };
    const struct = new FortificationStructure(this, cfg, this.world, this.scene, this.vfxManager);
    this.structures.push(struct);
    return struct;
  }

  removeStructureAt(worldPos, maxDist = 3.5) {
    const idx = this.structures.findIndex(s => {
      const dx = s.position.x - worldPos.x;
      const dz = s.position.z - worldPos.z;
      return Math.sqrt(dx * dx + dz * dz) < maxDist;
    });

    if (idx !== -1) {
      const struct = this.structures[idx];
      struct.destroy();
      this.structures.splice(idx, 1);
      return true;
    }
    return false;
  }

  /**
   * Spawns physical dynamic debris blocks when a structure collapses.
   */
  spawnStructureDebris(struct) {
    const p = struct.position;
    const cfg = struct.typeConfig;
    const blockCount = Math.min(10, Math.max(5, Math.round(cfg.width * 1.2)));

    // Rubble debris keeps the exact same PBR material as intact structure
    const debrisMat = cfg.id === 'palisade'
      ? pbrMaterialSystem.getMaterial('dark_timber')
      : pbrMaterialSystem.getMaterial('stone_masonry');

    for (let i = 0; i < blockCount; i++) {
      // Manage debris cap: recycle oldest settled debris if over limit
      if (this.activeDebrisBodies.length >= this.maxActiveDebris) {
        const oldest = this.activeDebrisBodies.shift();
        if (oldest.body && this.world) this.world.removeRigidBody(oldest.body);
        if (oldest.mesh) this.debrisGroup.remove(oldest.mesh);
      }

      const bw = Math.random() * 0.9 + 0.6;
      const bh = Math.random() * 0.7 + 0.5;
      const bd = Math.random() * 0.9 + 0.6;

      const spawnX = p.x + (Math.random() - 0.5) * cfg.width * 0.7;
      const spawnY = p.y + Math.random() * cfg.height * 0.6 + 0.8;
      const spawnZ = p.z + (Math.random() - 0.5) * (cfg.depth || 3) * 0.7;

      const mesh = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), debrisMat);
      mesh.position.set(spawnX, spawnY, spawnZ);
      mesh.castShadow = true;
      this.debrisGroup.add(mesh);

      // Create Dynamic Rapier Rigid Body for each debris stone block
      if (this.world) {
        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(spawnX, spawnY, spawnZ)
          .setAdditionalMass(120)
          .setLinearDamping(0.8)
          .setAngularDamping(1.5)
          .setCanSleep(true);

        const body = this.world.createRigidBody(bodyDesc);
        const colDesc = RAPIER.ColliderDesc.cuboid(bw / 2, bh / 2, bd / 2)
          .setFriction(0.85)
          .setRestitution(0.1);
        this.world.createCollider(colDesc, body);

        // Apply outward explosive tumble impulse
        const impX = (Math.random() - 0.5) * 450;
        const impY = Math.random() * 350 + 100;
        const impZ = (Math.random() - 0.5) * 450;
        body.applyImpulse({ x: impX, y: impY, z: impZ }, true);

        this.activeDebrisBodies.push({
          mesh,
          body,
          spawnTime: performance.now(),
          life: 8.0 // seconds before despawn
        });
      }
    }

    // Explosion dust VFX
    if (this.vfxManager) {
      this.vfxManager.spawnExplosionWave?.(
        new THREE.Vector3(p.x, p.y + 0.5, p.z),
        0x64748b,
        cfg.width * 1.4
      );
    }
  }

  /**
   * Applies crush damage and physics knockdown to units in blast radius.
   */
  applyCrushDamage(pos, radius, damage) {
    if (!this.engineUnits) return;

    this.engineUnits.forEach(unit => {
      if (unit.isDead || !unit.body) return;
      const uPos = unit.body.translation();
      const dx = uPos.x - pos.x;
      const dz = uPos.z - pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < radius) {
        unit.takeDamage(damage, pos, 600);
        unit.triggerKnockdown(2.8);
      }
    });
  }

  /**
   * Checks if position is atop a garrison platform (tower or wall top).
   */
  getGarrisonPlatform(pos) {
    for (const struct of this.structures) {
      if (struct.isDestroyed || !struct.typeConfig.hasGarrisonPlatform) continue;
      const sp = struct.position;
      const cfg = struct.typeConfig;

      const dx = Math.abs(pos.x - sp.x);
      const dz = Math.abs(pos.z - sp.z);

      if (dx < cfg.width * 0.65 && dz < (cfg.depth || 3.0) * 0.65) {
        return {
          structure: struct,
          platformY: sp.y + cfg.platformY,
        };
      }
    }
    return null;
  }

  /**
   * Finds nearest enemy structure within range for a unit.
   */
  findTargetStructure(unitPos, teamId, maxRange = 35) {
    let nearest = null;
    let minDist = maxRange;

    for (const struct of this.structures) {
      if (struct.isDestroyed) continue;
      // Allow attacking opposing or neutral blocking gates/walls
      if (struct.teamId !== teamId || struct.teamId === 'neutral') {
        const dx = struct.position.x - unitPos.x;
        const dz = struct.position.z - unitPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < minDist) {
          minDist = dist;
          nearest = struct;
        }
      }
    }
    return nearest;
  }

  onGateBreached(struct) {
    if (this.onGateBreachedCallback) {
      this.onGateBreachedCallback(struct);
    }
  }

  onStructureCollapsed(struct) {
    if (this.onStructureCollapsedCallback) {
      this.onStructureCollapsedCallback(struct);
    }
  }

  update(dt) {
    const now = performance.now();

    // Update active debris positions and put sleeping/old debris to rest
    for (let i = this.activeDebrisBodies.length - 1; i >= 0; i--) {
      const item = this.activeDebrisBodies[i];
      const age = (now - item.spawnTime) / 1000;

      if (item.body) {
        const pos = item.body.translation();
        const rot = item.body.rotation();
        item.mesh.position.set(pos.x, pos.y, pos.z);
        item.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);

        // Put settled debris to sleep after 3 seconds
        if (age > 3.0 && item.body.isSleeping && !item.body.isSleeping()) {
          item.body.sleep();
        }
      }

      // Despawn expired debris
      if (age > item.life) {
        if (item.body && this.world) this.world.removeRigidBody(item.body);
        if (item.mesh) this.debrisGroup.remove(item.mesh);
        this.activeDebrisBodies.splice(i, 1);
      }
    }
  }

  clear() {
    this.structures.forEach(s => s.destroy());
    this.structures = [];

    this.activeDebrisBodies.forEach(d => {
      if (d.body && this.world) this.world.removeRigidBody(d.body);
      if (d.mesh) this.debrisGroup.remove(d.mesh);
    });
    this.activeDebrisBodies = [];
  }
}
