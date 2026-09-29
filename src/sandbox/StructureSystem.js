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
    width: 3.8,
    height: 9.5,
    depth: 3.8,
    platformY: 8.6,
    hasGarrisonPlatform: true,
  },
  wall_segment: {
    id: 'wall_segment',
    name: 'Castle Wall Segment',
    cost: 180,
    maxHealth: 950,
    width: 8.0,
    height: 4.4,
    depth: 2.8,
    platformY: 4.0,
    hasGarrisonPlatform: true,
  },
  gatehouse: {
    id: 'gatehouse',
    name: 'Fortified Gatehouse',
    cost: 400,
    maxHealth: 1600,
    gateMaxHealth: 700,
    width: 10.4,
    height: 8.2,
    depth: 3.6,
    platformY: 7.0,
    hasGarrisonPlatform: true,
    hasDestructibleGate: true,
  },
  keep: {
    id: 'keep',
    name: 'Stronghold Keep',
    cost: 800,
    maxHealth: 2800,
    width: 13.0,
    height: 12.0,
    depth: 13.0,
    platformY: 10.4,
    hasGarrisonPlatform: true,
    isObjectiveTarget: true,
  },
  staircase_stone: {
    id: 'staircase_stone',
    name: 'Grand Stone Staircase',
    cost: 140,
    maxHealth: 1400,
    width: 5.2,
    height: 3.6,
    depth: 7.6,
    platformY: 3.6,
    hasGarrisonPlatform: true,
    isWalkable: true,
  },
  rampart_stairs: {
    id: 'rampart_stairs',
    name: 'Rampart Access Stairs',
    cost: 95,
    maxHealth: 550,
    width: 2.4,
    height: 4.0,
    depth: 5.6,
    platformY: 4.0,
    hasGarrisonPlatform: true,
    isWalkable: true,
  },
  courtyard_terrace: {
    id: 'courtyard_terrace',
    name: 'Citadel Courtyard Terrace',
    cost: 320,
    maxHealth: 3500,
    width: 18.0,
    height: 2.2,
    depth: 14.0,
    platformY: 2.2,
    hasGarrisonPlatform: true,
    isWalkable: true,
  },
  weapon_rack: {
    id: 'weapon_rack',
    name: 'Armory Weapon Rack',
    cost: 40,
    maxHealth: 130,
    width: 2.0,
    height: 1.8,
    depth: 0.9,
    hasGarrisonPlatform: false,
    isProp: true,
  },
  siege_supply_cache: {
    id: 'siege_supply_cache',
    name: 'Siege Supply Cache',
    cost: 50,
    maxHealth: 180,
    width: 2.4,
    height: 1.5,
    depth: 2.2,
    hasGarrisonPlatform: false,
    isProp: true,
  },
  spike_barricade: {
    id: 'spike_barricade',
    name: 'Spike Barricade (Cheval-de-Frise)',
    cost: 65,
    maxHealth: 340,
    width: 4.0,
    height: 1.6,
    depth: 1.8,
    hasGarrisonPlatform: false,
    isSpikeObstacle: true,
  },
  brazier_fire: {
    id: 'brazier_fire',
    name: 'Iron Fire Brazier',
    cost: 30,
    maxHealth: 90,
    width: 1.1,
    height: 1.6,
    depth: 1.1,
    hasGarrisonPlatform: false,
    isLightSource: true,
    isProp: true,
  },
  siege_ballista: {
    id: 'siege_ballista',
    name: 'Mounted Defensive Ballista',
    cost: 220,
    maxHealth: 450,
    width: 2.8,
    height: 2.0,
    depth: 3.2,
    hasGarrisonPlatform: false,
    isSiegeWeapon: true,
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
    this.localLights = [];

    // Materials
    this.stoneMat = null;
    this.woodMat = null;
    this.ironMat = null;
    this.steelMat = null;

    // Smoke / Fire visual stages
    this.smokeActive = false;

    this._buildVisualsAndPhysics();
  }

  _addFireBrazierLight(x, y, z, intensity = 2.0, distance = 14) {
    const light = new THREE.PointLight(0xf97316, intensity, distance, 1.4);
    light.position.set(x, y, z);
    light.castShadow = false;
    this.meshGroup.add(light);
    this.localLights.push(light);

    if (this.system && this.system.brazierLights) {
      this.system.brazierLights.push({
        light,
        baseIntensity: intensity,
        phase: Math.random() * Math.PI * 2
      });
    }
    return light;
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
    this.steelMat = pbrMaterialSystem.getMaterial('forged_steel');

    const teamHex = this.teamId === 'blue' ? 0x2563eb : (this.teamId === 'red' ? 0xdc2626 : 0xd97706);
    const bannerMat = pbrMaterialSystem.getMaterial('cloth_weave', { teamColor: teamHex });
    const fireCoalMat = new THREE.MeshStandardMaterial({
      color: 0xff3300,
      emissive: 0xff4400,
      emissiveIntensity: 3.2,
      roughness: 0.85
    });

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

      // Flared Stone Base Plinth
      const plinthGeo = new THREE.BoxGeometry(cfg.width * 1.2, 1.6, cfg.depth * 1.2);
      const plinth = new THREE.Mesh(plinthGeo, this.stoneMat);
      plinth.position.y = 0.8;
      plinth.castShadow = true;
      this.meshGroup.add(plinth);

      // Stone Corbel Support Brackets under top platform
      for (let s = -1; s <= 1; s += 2) {
        const corbelGeo = new THREE.BoxGeometry(0.5, 0.9, cfg.depth * 1.08);
        const corbel = new THREE.Mesh(corbelGeo, this.stoneMat);
        corbel.position.set(s * (cfg.width * 0.42), cfg.platformY - 0.5, 0);
        this.meshGroup.add(corbel);
      }

      // Elevated Wooden / Stone Platform Top
      const platGeo = new THREE.BoxGeometry(cfg.width * 1.35, 0.4, cfg.depth * 1.35);
      const plat = new THREE.Mesh(platGeo, this.woodMat);
      plat.position.y = cfg.platformY;
      plat.castShadow = true;
      plat.receiveShadow = true;
      this.meshGroup.add(plat);

      // Crenellation Battlements
      const parapetGeo = new THREE.BoxGeometry(cfg.width * 1.35, 0.85, 0.25);
      const pNorth = new THREE.Mesh(parapetGeo, this.stoneMat);
      pNorth.position.set(0, cfg.platformY + 0.5, (cfg.depth * 1.35) / 2);
      this.meshGroup.add(pNorth);

      const pSouth = new THREE.Mesh(parapetGeo, this.stoneMat);
      pSouth.position.set(0, cfg.platformY + 0.5, -(cfg.depth * 1.35) / 2);
      this.meshGroup.add(pSouth);

      const pWest = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.85, cfg.depth * 1.35), this.stoneMat);
      pWest.position.set(-(cfg.width * 1.35) / 2, cfg.platformY + 0.5, 0);
      this.meshGroup.add(pWest);

      const pEast = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.85, cfg.depth * 1.35), this.stoneMat);
      pEast.position.set((cfg.width * 1.35) / 2, cfg.platformY + 0.5, 0);
      this.meshGroup.add(pEast);

      // Wall-mounted iron torch sconce on front of tower
      const sconceArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.6), this.ironMat);
      sconceArm.position.set(0, 3.2, cfg.depth / 2 + 0.3);
      this.meshGroup.add(sconceArm);
      const torchCup = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.1, 0.3, 6), fireCoalMat);
      torchCup.position.set(0, 3.4, cfg.depth / 2 + 0.55);
      this.meshGroup.add(torchCup);
      this._addFireBrazierLight(0, 3.6, cfg.depth / 2 + 0.65, 1.8, 12);

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
      // Main Stone Wall Body
      const wallGeo = new THREE.BoxGeometry(cfg.width, cfg.height, cfg.depth * 0.7);
      const wall = new THREE.Mesh(wallGeo, this.stoneMat);
      wall.position.set(0, cfg.height / 2, -cfg.depth * 0.15);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.meshGroup.add(wall);

      // Inner Rampart Walkway Floor (walkway on inner side)
      const walkwayGeo = new THREE.BoxGeometry(cfg.width, 0.35, cfg.depth);
      const walkway = new THREE.Mesh(walkwayGeo, this.woodMat);
      walkway.position.set(0, cfg.platformY, 0);
      walkway.castShadow = true;
      walkway.receiveShadow = true;
      this.meshGroup.add(walkway);

      // Outer Parapet Shield with arrow-slits
      const parapetGeo = new THREE.BoxGeometry(cfg.width, 0.95, 0.35);
      const parapet = new THREE.Mesh(parapetGeo, this.stoneMat);
      parapet.position.set(0, cfg.height + 0.45, -cfg.depth / 2 + 0.18);
      parapet.castShadow = true;
      this.meshGroup.add(parapet);

      // Stone corbels supporting outer parapet
      for (let c = -3; c <= 3; c += 1.5) {
        const corbelGeo = new THREE.BoxGeometry(0.4, 0.6, 0.45);
        const corbel = new THREE.Mesh(corbelGeo, this.stoneMat);
        corbel.position.set(c, cfg.height - 0.25, -cfg.depth / 2 + 0.15);
        this.meshGroup.add(corbel);
      }

      // Merlon battlements along top
      for (let m = -3; m <= 3; m += 2) {
        const merlonGeo = new THREE.BoxGeometry(0.9, 0.55, 0.38);
        const merlon = new THREE.Mesh(merlonGeo, this.stoneMat);
        merlon.position.set(m * 1.0, cfg.height + 1.0, -cfg.depth / 2 + 0.18);
        this.meshGroup.add(merlon);
      }

      // Inner wooden safety railing
      const railGeo = new THREE.BoxGeometry(cfg.width, 0.15, 0.15);
      const rail = new THREE.Mesh(railGeo, this.woodMat);
      rail.position.set(0, cfg.platformY + 0.75, cfg.depth / 2 - 0.1);
      this.meshGroup.add(rail);

      // Inner torch sconce
      const sconce = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.1, 0.25, 6), fireCoalMat);
      sconce.position.set(0, cfg.platformY + 0.9, cfg.depth / 2 - 0.15);
      this.meshGroup.add(sconce);
      this._addFireBrazierLight(0, cfg.platformY + 1.1, cfg.depth / 2 - 0.15, 1.4, 9);

      this._createPhysicsBox(cfg.width, cfg.height, cfg.depth, cfg.height / 2);

    // ════════════════════════════════════════════════════
    // 3. FORTIFIED GATEHOUSE
    // ════════════════════════════════════════════════════
    } else if (cfg.id === 'gatehouse') {
      const towerWidth = 2.8;
      const archSpan = 4.8;

      // Left Flanking Tower
      const leftTowerGeo = new THREE.BoxGeometry(towerWidth, cfg.height, cfg.depth);
      const leftTower = new THREE.Mesh(leftTowerGeo, this.stoneMat);
      leftTower.position.set(-archSpan / 2 - towerWidth / 2, cfg.height / 2, 0);
      leftTower.castShadow = true;
      leftTower.receiveShadow = true;
      this.meshGroup.add(leftTower);

      // Left Tower Buttress Base
      const leftButtressGeo = new THREE.BoxGeometry(towerWidth * 1.15, 2.2, cfg.depth * 1.25);
      const leftButtress = new THREE.Mesh(leftButtressGeo, this.stoneMat);
      leftButtress.position.set(-archSpan / 2 - towerWidth / 2, 1.1, 0);
      this.meshGroup.add(leftButtress);

      // Right Flanking Tower
      const rightTower = leftTower.clone();
      rightTower.position.set(archSpan / 2 + towerWidth / 2, cfg.height / 2, 0);
      this.meshGroup.add(rightTower);

      const rightButtress = leftButtress.clone();
      rightButtress.position.set(archSpan / 2 + towerWidth / 2, 1.1, 0);
      this.meshGroup.add(rightButtress);

      // Overhead Lintel Arch & Walkway
      const lintelGeo = new THREE.BoxGeometry(archSpan, 2.4, cfg.depth);
      const lintel = new THREE.Mesh(lintelGeo, this.stoneMat);
      lintel.position.set(0, cfg.height - 1.2, 0);
      lintel.castShadow = true;
      lintel.receiveShadow = true;
      this.meshGroup.add(lintel);

      // Machicolation corbel brackets beneath the lintel
      for (let b = -1.5; b <= 1.5; b += 1.0) {
        const bracketGeo = new THREE.BoxGeometry(0.4, 0.7, cfg.depth * 1.05);
        const bracket = new THREE.Mesh(bracketGeo, this.stoneMat);
        bracket.position.set(b, cfg.height - 2.5, 0);
        this.meshGroup.add(bracket);
      }

      // Overhead Parapet & Merlons
      const topParapet = new THREE.Mesh(new THREE.BoxGeometry(cfg.width, 0.8, 0.3), this.stoneMat);
      topParapet.position.set(0, cfg.height + 0.4, -cfg.depth / 2 + 0.15);
      this.meshGroup.add(topParapet);

      // Gatehouse Team Banners on flanking towers
      const bannerGeo = new THREE.BoxGeometry(0.1, 2.2, 1.2);
      const bLeft = new THREE.Mesh(bannerGeo, bannerMat);
      bLeft.position.set(-archSpan / 2 - towerWidth / 2, cfg.height + 0.5, -cfg.depth / 2 - 0.1);
      this.meshGroup.add(bLeft);

      const bRight = new THREE.Mesh(bannerGeo, bannerMat);
      bRight.position.set(archSpan / 2 + towerWidth / 2, cfg.height + 0.5, -cfg.depth / 2 - 0.1);
      this.meshGroup.add(bRight);

      // Two Standing Iron Fire Braziers Flanking the Gate Entry
      [-1, 1].forEach(side => {
        const brazierX = side * (archSpan / 2 + 0.8);
        const bPed = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.4, 8), this.stoneMat);
        bPed.position.set(brazierX, 0.7, -cfg.depth / 2 - 0.8);
        this.meshGroup.add(bPed);

        const bBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.3, 0.35, 8), this.ironMat);
        bBowl.position.set(brazierX, 1.5, -cfg.depth / 2 - 0.8);
        this.meshGroup.add(bBowl);

        const bCoals = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3, 0), fireCoalMat);
        bCoals.position.set(brazierX, 1.65, -cfg.depth / 2 - 0.8);
        this.meshGroup.add(bCoals);

        this._addFireBrazierLight(brazierX, 1.85, -cfg.depth / 2 - 0.8, 2.2, 14);
      });

      // Destructible Center Iron/Oak Portcullis Gate
      const gateGeo = new THREE.BoxGeometry(archSpan, cfg.height - 2.4, 0.4);
      this.gateMesh = new THREE.Mesh(gateGeo, this.woodMat);
      this.gateMesh.position.set(0, (cfg.height - 2.4) / 2, 0);
      this.gateMesh.castShadow = true;

      // Iron Studs & Banding on Gate
      const ironBandGeo = new THREE.BoxGeometry(archSpan * 0.98, 0.15, 0.44);
      const gBand1 = new THREE.Mesh(ironBandGeo, this.ironMat);
      gBand1.position.y = 1.0;
      this.gateMesh.add(gBand1);
      const gBand2 = new THREE.Mesh(ironBandGeo, this.ironMat);
      gBand2.position.y = -1.0;
      this.gateMesh.add(gBand2);

      // Vertical Iron Portcullis Spikes at Bottom of Gate
      for (let sp = -archSpan * 0.42; sp <= archSpan * 0.42; sp += 0.6) {
        const spikeGeo = new THREE.ConeGeometry(0.08, 0.5, 6);
        const spike = new THREE.Mesh(spikeGeo, this.ironMat);
        spike.rotation.x = Math.PI;
        spike.position.set(sp, -(cfg.height - 2.4) / 2, 0);
        this.gateMesh.add(spike);
      }

      this.meshGroup.add(this.gateMesh);

      // Create compound physical colliders for towers + lintel
      this._createGatehousePhysics(towerWidth, archSpan, cfg.height, cfg.depth);

    // ════════════════════════════════════════════════════
    // 4. STRONGHOLD KEEP
    // ════════════════════════════════════════════════════
    } else if (cfg.id === 'keep') {
      // Tiered Stepped Plinth Foundation
      const plinthGeo = new THREE.BoxGeometry(cfg.width * 1.15, 1.8, cfg.depth * 1.15);
      const plinth = new THREE.Mesh(plinthGeo, this.stoneMat);
      plinth.position.y = 0.9;
      plinth.castShadow = true;
      plinth.receiveShadow = true;
      this.meshGroup.add(plinth);

      // Main Fortress Citadel Body
      const keepGeo = new THREE.BoxGeometry(cfg.width, cfg.height, cfg.depth);
      const keepBodyMesh = new THREE.Mesh(keepGeo, this.stoneMat);
      keepBodyMesh.position.y = cfg.height / 2;
      keepBodyMesh.castShadow = true;
      keepBodyMesh.receiveShadow = true;
      this.meshGroup.add(keepBodyMesh);

      // Grand Front Entrance Portico & Iron-Studded Archway
      const porticoGeo = new THREE.BoxGeometry(5.2, 4.6, 1.8);
      const portico = new THREE.Mesh(porticoGeo, this.stoneMat);
      portico.position.set(0, 2.3, -cfg.depth / 2 - 0.7);
      portico.castShadow = true;
      this.meshGroup.add(portico);

      // Double Oak Doors in Portico
      const doorGeo = new THREE.BoxGeometry(2.8, 3.4, 0.3);
      const doors = new THREE.Mesh(doorGeo, this.woodMat);
      doors.position.set(0, 1.7, -cfg.depth / 2 - 1.5);
      const doorHinges = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.2, 0.34), this.ironMat);
      doorHinges.position.set(0, 1.7, -cfg.depth / 2 - 1.5);
      this.meshGroup.add(doors);
      this.meshGroup.add(doorHinges);

      // Stone Entrance Steps
      for (let st = 0; st < 4; st++) {
        const stepWidth = 4.4 - st * 0.3;
        const step = new THREE.Mesh(new THREE.BoxGeometry(stepWidth, 0.3, 0.6), this.stoneMat);
        step.position.set(0, 0.15 + st * 0.3, -cfg.depth / 2 - 1.7 - (3 - st) * 0.55);
        this.meshGroup.add(step);
      }

      // 4 Corner Turrets
      const turretRadius = 2.0;
      const turretHeight = cfg.height + 2.8;
      const turretGeo = new THREE.CylinderGeometry(turretRadius, turretRadius * 1.1, turretHeight, 8);
      const roofMat = pbrMaterialSystem.getMaterial('roof_tiles');
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
        const roofGeo = new THREE.ConeGeometry(turretRadius * 1.3, 2.8, 8);
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(c.x, turretHeight + 1.4, c.z);
        this.meshGroup.add(roof);

        // Turret Top Fire Brazier with Warm Point Light
        const tBrazier = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.2, 0.35, 6), this.ironMat);
        tBrazier.position.set(c.x, turretHeight + 0.3, c.z);
        this.meshGroup.add(tBrazier);

        const tCoal = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), fireCoalMat);
        tCoal.position.set(c.x, turretHeight + 0.45, c.z);
        this.meshGroup.add(tCoal);

        this._addFireBrazierLight(c.x, turretHeight + 0.8, c.z, 2.0, 15);
      });

      // Majestic Central Tower & Banner Spire
      const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 5.5, 6), this.woodMat);
      flagPole.position.set(0, cfg.height + 2.75, 0);
      this.meshGroup.add(flagPole);

      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 3.4), bannerMat);
      flag.position.set(0.1, cfg.height + 3.9, 1.7);
      this.meshGroup.add(flag);

      this._createPhysicsBox(cfg.width + 1.5, cfg.height, cfg.depth + 1.5, cfg.height / 2);

    // ════════════════════════════════════════════════════
    // 5. GRAND STONE STAIRCASE
    // ════════════════════════════════════════════════════
    } else if (cfg.id === 'staircase_stone') {
      const stepCount = 10;
      const stepH = cfg.height / stepCount;
      const stepD = cfg.depth / stepCount;

      // Tiered Solid Stone Steps
      for (let i = 0; i < stepCount; i++) {
        const treadGeo = new THREE.BoxGeometry(cfg.width, stepH * (i + 1), stepD);
        const tread = new THREE.Mesh(treadGeo, this.stoneMat);
        tread.position.set(0, (stepH * (i + 1)) / 2, -cfg.depth / 2 + (i + 0.5) * stepD);
        tread.castShadow = true;
        tread.receiveShadow = true;
        this.meshGroup.add(tread);
      }

      // Left and Right Heavy Stone Balustrades
      [-1, 1].forEach(side => {
        const balustradeX = side * (cfg.width / 2 + 0.25);
        for (let i = 0; i < stepCount; i++) {
          const balGeo = new THREE.BoxGeometry(0.5, stepH * (i + 1) + 0.9, stepD);
          const bal = new THREE.Mesh(balGeo, this.stoneMat);
          bal.position.set(balustradeX, (stepH * (i + 1) + 0.9) / 2, -cfg.depth / 2 + (i + 0.5) * stepD);
          bal.castShadow = true;
          this.meshGroup.add(bal);
        }

        // Entrance Plinths with Fire Braziers at Bottom of Stairs
        const plinthGeo = new THREE.BoxGeometry(0.8, 1.4, 0.8);
        const plinth = new THREE.Mesh(plinthGeo, this.stoneMat);
        plinth.position.set(balustradeX, 0.7, -cfg.depth / 2 - 0.4);
        this.meshGroup.add(plinth);

        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.25, 0.3, 8), this.ironMat);
        bowl.position.set(balustradeX, 1.5, -cfg.depth / 2 - 0.4);
        this.meshGroup.add(bowl);

        const coal = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25, 0), fireCoalMat);
        coal.position.set(balustradeX, 1.62, -cfg.depth / 2 - 0.4);
        this.meshGroup.add(coal);

        this._addFireBrazierLight(balustradeX, 1.85, -cfg.depth / 2 - 0.4, 1.8, 12);
      });

      // Smooth ramp physics collider
      this._createPhysicsRamp(cfg.width, cfg.height, cfg.depth, 0);

    // ════════════════════════════════════════════════════
    // 6. RAMPART ACCESS STAIRS
    // ════════════════════════════════════════════════════
    } else if (cfg.id === 'rampart_stairs') {
      const stepCount = 10;
      const stepH = cfg.height / stepCount;
      const stepD = cfg.depth / stepCount;

      // Heavy Timber Stringers (Left and Right)
      const slope = Math.atan2(cfg.height, cfg.depth);
      const strLength = Math.sqrt(cfg.height * cfg.height + cfg.depth * cfg.depth);
      [-1, 1].forEach(side => {
        const stringerGeo = new THREE.BoxGeometry(0.2, 0.4, strLength);
        const stringer = new THREE.Mesh(stringerGeo, this.woodMat);
        stringer.rotation.x = slope;
        stringer.position.set(side * (cfg.width / 2 - 0.1), cfg.height / 2, 0);
        stringer.castShadow = true;
        this.meshGroup.add(stringer);
      });

      // Timber Plank Steps
      for (let i = 0; i < stepCount; i++) {
        const stepGeo = new THREE.BoxGeometry(cfg.width - 0.3, 0.12, stepD * 1.05);
        const step = new THREE.Mesh(stepGeo, this.woodMat);
        step.position.set(0, (i + 1) * stepH, -cfg.depth / 2 + (i + 0.5) * stepD);
        step.castShadow = true;
        step.receiveShadow = true;
        this.meshGroup.add(step);
      }

      // Vertical Timber Support Posts underneath
      const post1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, cfg.height * 0.5, 6), this.woodMat);
      post1.position.set(0, cfg.height * 0.25, 0);
      this.meshGroup.add(post1);

      const post2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, cfg.height * 0.9, 6), this.woodMat);
      post2.position.set(0, cfg.height * 0.45, cfg.depth * 0.35);
      this.meshGroup.add(post2);

      // Angled Timber Handrail along open side
      const handrailGeo = new THREE.BoxGeometry(0.15, 0.15, strLength);
      const handrail = new THREE.Mesh(handrailGeo, this.woodMat);
      handrail.rotation.x = slope;
      handrail.position.set(-cfg.width / 2 + 0.1, cfg.height / 2 + 0.85, 0);
      this.meshGroup.add(handrail);

      // Smooth ramp physics collider
      this._createPhysicsRamp(cfg.width, cfg.height, cfg.depth, 0);

    // ════════════════════════════════════════════════════
    // 7. CITADEL COURTYARD TERRACE
    // ════════════════════════════════════════════════════
    } else if (cfg.id === 'courtyard_terrace') {
      // Main Stone Retaining Platform Body
      const terraceGeo = new THREE.BoxGeometry(cfg.width, cfg.height, cfg.depth);
      const terrace = new THREE.Mesh(terraceGeo, this.stoneMat);
      terrace.position.y = cfg.height / 2;
      terrace.castShadow = true;
      terrace.receiveShadow = true;
      this.meshGroup.add(terrace);

      // Recessed Blind Arches along the Front Face for architectural depth
      for (let a = -cfg.width * 0.38; a <= cfg.width * 0.38; a += 4.5) {
        const archPillar = new THREE.Mesh(new THREE.BoxGeometry(0.6, cfg.height * 0.85, 0.3), this.stoneMat);
        archPillar.position.set(a, cfg.height * 0.45, -cfg.depth / 2 - 0.1);
        this.meshGroup.add(archPillar);
      }

      // Stone Balustrade on Left, Right, and Back
      const balW = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.85, cfg.depth), this.stoneMat);
      balW.position.set(-cfg.width / 2 + 0.2, cfg.height + 0.42, 0);
      this.meshGroup.add(balW);

      const balE = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.85, cfg.depth), this.stoneMat);
      balE.position.set(cfg.width / 2 - 0.2, cfg.height + 0.42, 0);
      this.meshGroup.add(balE);

      // Front Balustrades leaving a wide 6m center opening for stairs/passage
      const balFrontL = new THREE.Mesh(new THREE.BoxGeometry((cfg.width - 6.0) / 2, 0.85, 0.4), this.stoneMat);
      balFrontL.position.set(-cfg.width / 2 + (cfg.width - 6.0) / 4, cfg.height + 0.42, -cfg.depth / 2 + 0.2);
      this.meshGroup.add(balFrontL);

      const balFrontR = new THREE.Mesh(new THREE.BoxGeometry((cfg.width - 6.0) / 2, 0.85, 0.4), this.stoneMat);
      balFrontR.position.set(cfg.width / 2 - (cfg.width - 6.0) / 4, cfg.height + 0.42, -cfg.depth / 2 + 0.2);
      this.meshGroup.add(balFrontR);

      this._createPhysicsBox(cfg.width, cfg.height, cfg.depth, cfg.height / 2);

    // ════════════════════════════════════════════════════
    // 8. ARMORY WEAPON RACK
    // ════════════════════════════════════════════════════
    } else if (cfg.id === 'weapon_rack') {
      // Wooden A-Frame Uprights
      [-1, 1].forEach(side => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, cfg.height, 0.15), this.woodMat);
        post.position.set(side * (cfg.width / 2 - 0.2), cfg.height / 2, 0);
        this.meshGroup.add(post);

        const baseFoot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, cfg.depth), this.woodMat);
        baseFoot.position.set(side * (cfg.width / 2 - 0.2), 0.08, 0);
        this.meshGroup.add(baseFoot);
      });

      // Crossbars with weapon resting notches
      const bar1 = new THREE.Mesh(new THREE.BoxGeometry(cfg.width, 0.12, 0.2), this.woodMat);
      bar1.position.set(0, cfg.height * 0.4, 0);
      this.meshGroup.add(bar1);

      const bar2 = new THREE.Mesh(new THREE.BoxGeometry(cfg.width, 0.12, 0.2), this.woodMat);
      bar2.position.set(0, cfg.height * 0.85, 0);
      this.meshGroup.add(bar2);

      // 4 Upright Halberds / Spears
      for (let s = -0.6; s <= 0.6; s += 0.4) {
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), this.woodMat);
        shaft.position.set(s, 1.1, 0);
        this.meshGroup.add(shaft);

        const spearHead = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 4), this.steelMat);
        spearHead.position.set(s, 2.3, 0);
        this.meshGroup.add(spearHead);

        const axeBlade = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.03), this.steelMat);
        axeBlade.position.set(s + 0.1, 2.1, 0);
        this.meshGroup.add(axeBlade);
      }

      // 2 Painted Kite Shields hanging on rack sides
      [-1, 1].forEach(side => {
        const shieldGeo = new THREE.BoxGeometry(0.06, 0.9, 0.55);
        const shield = new THREE.Mesh(shieldGeo, bannerMat);
        shield.position.set(side * (cfg.width / 2 + 0.05), cfg.height * 0.5, 0);
        shield.rotation.y = side * 0.2;
        this.meshGroup.add(shield);
      });

      this._createPhysicsBox(cfg.width, cfg.height, cfg.depth, cfg.height / 2);

    // ════════════════════════════════════════════════════
    // 9. SIEGE SUPPLY CACHE
    // ════════════════════════════════════════════════════
    } else if (cfg.id === 'siege_supply_cache') {
      // 3 Wooden Supply Crates
      const crate1 = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 1.0), this.woodMat);
      crate1.position.set(-0.5, 0.4, -0.4);
      crate1.castShadow = true;
      this.meshGroup.add(crate1);

      const crate2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.8), this.woodMat);
      crate2.position.set(0.55, 0.35, -0.3);
      crate2.rotation.y = 0.25;
      crate2.castShadow = true;
      this.meshGroup.add(crate2);

      const crate3 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), this.woodMat);
      crate3.position.set(-0.4, 1.1, -0.35);
      crate3.rotation.y = -0.15;
      crate3.castShadow = true;
      this.meshGroup.add(crate3);

      // Iron corner straps on main crate
      const strap = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.82, 0.08), this.ironMat);
      strap.position.set(-0.5, 0.4, -0.4);
      this.meshGroup.add(strap);

      // 2 Oak Barrels / Casks with Iron Hoops
      const barrelGeo = new THREE.CylinderGeometry(0.36, 0.44, 0.95, 10);
      const b1 = new THREE.Mesh(barrelGeo, this.woodMat);
      b1.position.set(0.4, 0.48, 0.55);
      b1.castShadow = true;
      this.meshGroup.add(b1);

      const hoop1 = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.1, 10), this.ironMat);
      hoop1.position.set(0.4, 0.65, 0.55);
      this.meshGroup.add(hoop1);
      const hoop2 = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.1, 10), this.ironMat);
      hoop2.position.set(0.4, 0.3, 0.55);
      this.meshGroup.add(hoop2);

      const b2 = new THREE.Mesh(barrelGeo, this.woodMat);
      b2.position.set(-0.5, 0.48, 0.5);
      b2.rotation.z = Math.PI / 2; // Tipped barrel
      b2.castShadow = true;
      this.meshGroup.add(b2);

      // Grain / Tar Sacks Bundle
      const sackGeo = new THREE.DodecahedronGeometry(0.35, 1);
      const sackMat = pbrMaterialSystem.getMaterial('cloth_weave', { color: 0xc8b28f });
      const sack = new THREE.Mesh(sackGeo, sackMat);
      sack.scale.set(1.2, 0.8, 1.1);
      sack.position.set(0.05, 0.28, 0.4);
      this.meshGroup.add(sack);

      this._createPhysicsBox(cfg.width, cfg.height, cfg.depth, cfg.height / 2);

    // ════════════════════════════════════════════════════
    // 10. SPIKE BARRICADE (CHEVAL-DE-FRISE)
    // ════════════════════════════════════════════════════
    } else if (cfg.id === 'spike_barricade') {
      // Heavy Horizontal Timber Trunk
      const trunkGeo = new THREE.CylinderGeometry(0.22, 0.26, cfg.width, 8);
      const trunk = new THREE.Mesh(trunkGeo, this.woodMat);
      trunk.rotation.z = Math.PI / 2;
      trunk.position.set(0, 0.6, 0);
      trunk.castShadow = true;
      this.meshGroup.add(trunk);

      // 7 Crossed Sharpened Wooden Stakes with Forged Steel Tips
      const stakeCount = 7;
      const spacing = (cfg.width * 0.85) / (stakeCount - 1);
      for (let i = 0; i < stakeCount; i++) {
        const posX = -cfg.width * 0.42 + i * spacing;

        // Forward angled stake
        const stakeFwd = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 2.2, 6), this.woodMat);
        stakeFwd.rotation.x = -Math.PI / 3.2;
        stakeFwd.rotation.y = (Math.random() - 0.5) * 0.15;
        stakeFwd.position.set(posX, 0.7, -0.3);
        stakeFwd.castShadow = true;
        this.meshGroup.add(stakeFwd);

        // Steel Spike Tip
        const tipFwd = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.35, 6), this.steelMat);
        tipFwd.rotation.x = -Math.PI / 3.2;
        tipFwd.position.set(posX, 1.45, -0.75);
        this.meshGroup.add(tipFwd);

        // Rear support stake
        const stakeRear = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.8, 6), this.woodMat);
        stakeRear.rotation.x = Math.PI / 3.4;
        stakeRear.position.set(posX, 0.6, 0.25);
        stakeRear.castShadow = true;
        this.meshGroup.add(stakeRear);
      }

      // Iron chains binding the center
      const chainGeo = new THREE.TorusGeometry(0.3, 0.05, 6, 12);
      const chain = new THREE.Mesh(chainGeo, this.ironMat);
      chain.position.set(0, 0.6, 0);
      this.meshGroup.add(chain);

      this._createPhysicsBox(cfg.width, cfg.height, cfg.depth, cfg.height / 2);

    // ════════════════════════════════════════════════════
    // 11. IRON FIRE BRAZIER
    // ════════════════════════════════════════════════════
    } else if (cfg.id === 'brazier_fire') {
      // 3-Legged Forged Iron Tripod Stand
      for (let l = 0; l < 3; l++) {
        const ang = (l * Math.PI * 2) / 3;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.2, 6), this.ironMat);
        leg.position.set(Math.cos(ang) * 0.3, 0.55, Math.sin(ang) * 0.3);
        leg.rotation.z = Math.sin(ang) * 0.18;
        leg.rotation.x = -Math.cos(ang) * 0.18;
        this.meshGroup.add(leg);
      }

      // Iron Ring Rim
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 6, 16), this.ironMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 1.1;
      this.meshGroup.add(ring);

      // Iron Fire Cauldron Bowl
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.25, 0.45, 8), this.ironMat);
      bowl.position.y = 1.15;
      bowl.castShadow = true;
      this.meshGroup.add(bowl);

      // Emissive Glowing Coal Fire Core
      const coals = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 1), fireCoalMat);
      coals.position.y = 1.35;
      this.meshGroup.add(coals);

      // Warm dynamic flickering Point Light
      this._addFireBrazierLight(0, 1.55, 0, 2.2, 14);

      this._createPhysicsBox(cfg.width, cfg.height, cfg.depth, cfg.height / 2);

    // ════════════════════════════════════════════════════
    // 12. MOUNTED DEFENSIVE BALLISTA
    // ════════════════════════════════════════════════════
    } else if (cfg.id === 'siege_ballista') {
      // Swivel Turntable Base
      const basePlatform = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 0.3, 10), this.woodMat);
      basePlatform.position.y = 0.15;
      basePlatform.castShadow = true;
      this.meshGroup.add(basePlatform);

      // Heavy Carriage Frame
      const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 2.4), this.woodMat);
      carriage.position.set(0, 0.65, 0);
      carriage.castShadow = true;
      this.meshGroup.add(carriage);

      // Central Guide Rail
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 2.6), this.ironMat);
      rail.position.set(0, 1.1, 0.1);
      this.meshGroup.add(rail);

      // Recurve Wooden Bow Limbs
      [-1, 1].forEach(side => {
        const limb = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.16, 0.12), this.woodMat);
        limb.rotation.y = -side * 0.35;
        limb.position.set(side * 0.75, 1.1, -0.9);
        this.meshGroup.add(limb);
      });

      // Giant Steel-Tipped Ballista Spear Bolt
      const boltShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), this.woodMat);
      boltShaft.rotation.x = Math.PI / 2;
      boltShaft.position.set(0, 1.22, 0.2);
      this.meshGroup.add(boltShaft);

      const boltHead = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 4), this.steelMat);
      boltHead.rotation.x = -Math.PI / 2;
      boltHead.position.set(0, 1.22, -1.15);
      this.meshGroup.add(boltHead);

      // Winch crank wheels
      const gear = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 8), this.ironMat);
      gear.rotation.z = Math.PI / 2;
      gear.position.set(0.45, 0.75, 0.8);
      this.meshGroup.add(gear);

      this._createPhysicsBox(cfg.width, cfg.height, cfg.depth, cfg.height / 2);

    // ════════════════════════════════════════════════════
    // 13. WOODEN PALISADE
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
    // 14. HEAVY TIMBER BRIDGE
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

  _createPhysicsRamp(w, h, d, centerY = 0) {
    if (!this.world) return;
    const p = this.position;
    const slope = Math.atan2(h, d);
    const hyp = Math.sqrt(h * h + d * d);

    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(p.x, p.y + centerY + h / 2, p.z)
      .setRotation({
        x: 0,
        y: Math.sin(this.rotationY * 0.5),
        z: 0,
        w: Math.cos(this.rotationY * 0.5)
      });
    this.body = this.world.createRigidBody(bodyDesc);

    // Tilted ramp cuboid for smooth snag-free climbing
    const rampCol = RAPIER.ColliderDesc.cuboid(w / 2, 0.25, hyp / 2)
      .setRotation({
        x: Math.sin(slope * 0.5),
        y: 0,
        z: 0,
        w: Math.cos(slope * 0.5)
      })
      .setFriction(0.85)
      .setRestitution(0.05);
    this.collider = this.world.createCollider(rampCol, this.body);

    // Flat landing at top edge
    const topCol = RAPIER.ColliderDesc.cuboid(w / 2, 0.2, 0.5)
      .setTranslation(0, h / 2 - 0.1, d / 2)
      .setFriction(0.85);
    this.world.createCollider(topCol, this.body);
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

    // Clean up dynamic lights
    this._cleanupLights();

    // Fade out and remove visual mesh
    if (this.meshGroup && this.scene) {
      this.scene.remove(this.meshGroup);
    }

    // Signal navigation graph that obstacle is now passable rubble
    this.system.onStructureCollapsed(this);
    console.log(`[StructureSystem] Collapsed structure: ${this.id}`);
  }

  _cleanupLights() {
    if (this.localLights && this.localLights.length > 0) {
      this.localLights.forEach(l => {
        if (this.system && this.system.brazierLights) {
          const idx = this.system.brazierLights.findIndex(item => item.light === l);
          if (idx !== -1) this.system.brazierLights.splice(idx, 1);
        }
        l.dispose?.();
      });
      this.localLights = [];
    }
  }

  destroy() {
    this._cleanupLights();

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

    this.brazierLights = [];
    this.fireFlickerTimer = 0;

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

    // Organic flame flicker for torch braziers
    if (this.brazierLights && this.brazierLights.length > 0) {
      this.fireFlickerTimer += dt * 6.5;
      for (let i = 0; i < this.brazierLights.length; i++) {
        const item = this.brazierLights[i];
        if (item && item.light && item.light.parent) {
          const noise = Math.sin(this.fireFlickerTimer * 1.6 + item.phase) * 0.32 +
                        Math.cos(this.fireFlickerTimer * 2.8 + item.phase * 2) * 0.18;
          item.light.intensity = Math.max(0.7, item.baseIntensity + noise);
        }
      }
    }

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
    this.brazierLights = [];

    this.activeDebrisBodies.forEach(d => {
      if (d.body && this.world) this.world.removeRigidBody(d.body);
      if (d.mesh) this.debrisGroup.remove(d.mesh);
    });
    this.activeDebrisBodies = [];
  }
}
