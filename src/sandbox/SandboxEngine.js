import { physicsWorld } from './PhysicsWorld';
import { ThreeSceneManager } from './ThreeScene';
import { ActiveRagdollUnit } from './ActiveRagdollUnit';
import { BattleAISystem } from './BattleAI';
import { ProjectileSystem } from './ProjectileSystem';
import { PlacementManager, getFormationOffsets } from './PlacementManager';
import { VFXManager } from './VFXManager';
import { HealthBarManager } from './HealthBarManager';
import { BloodGoreSystem } from './BloodGoreSystem';
import { PossessionController } from './PossessionController';
import { CAMPAIGN_LEVELS } from './CampaignConfig';
import { UNIT_TRAITS } from './UnitTraits';
import { UNIT_TYPES } from './UnitConfig';
import { soundSystem } from './SoundSystem';
import { useSandboxStore } from '../store/useSandboxStore';
import { TerrainSystem } from './TerrainSystem';
import { StructureSystem } from './StructureSystem';
import { ObjectiveSystem } from './ObjectiveSystem';
import { WaypointNavSystem } from './WaypointNavSystem';
import { DecalSystem } from './DecalSystem';
import { BATTLEGROUND_MAPS } from './MapConfigs';

export class SandboxEngine {
  constructor() {
    this.threeScene = null;
    this.placementManager = null;
    this.projectileSystem = null;
    this.vfxManager = null;
    this.healthBarManager = null;
    this.bloodGoreSystem = null;
    this.decalSystem = null;
    this.possessionController = null;
    this.battleAI = new BattleAISystem();

    // Terrain, Fortification, Objective & Navigation Systems
    this.terrainSystem = null;
    this.structureSystem = null;
    this.objectiveSystem = null;
    this.waypointNavSystem = null;

    this.units = [];
    this.initialPlacementConfig = [];
    this.animFrameId = null;
    this.lastTime = performance.now();
    this.isRunning = false;
    this.lastPlacedPos = null;
  }

  async init(container) {
    // 1. Init Rapier3D WASM
    await physicsWorld.init();

    // 2. Init Three.js WebGL Scene
    this.threeScene = new ThreeSceneManager(container);

    // 3. Init Systems & Managers
    this.vfxManager = new VFXManager(this.threeScene.scene, this.threeScene.camera, this.threeScene);
    this.healthBarManager = new HealthBarManager(this.threeScene.scene);
    this.bloodGoreSystem = new BloodGoreSystem(this.threeScene.scene);
    this.possessionController = new PossessionController(this);
    this.threeScene.possessionController = this.possessionController;

    this.projectileSystem = new ProjectileSystem(
      this.threeScene.scene,
      physicsWorld.world,
      this.vfxManager,
      this.bloodGoreSystem
    );
    this.placementManager = new PlacementManager(this.threeScene.scene, this.threeScene);

    // 4. Init Terrain, Fortifications, Objectives & Navmesh Systems
    this.terrainSystem = new TerrainSystem(this.threeScene.scene, physicsWorld.world);
    this.threeScene.terrainSystem = this.terrainSystem;
    this.decalSystem = new DecalSystem(this.threeScene.scene, this.terrainSystem);
    this.projectileSystem.decalSystem = this.decalSystem;
    if (this.bloodGoreSystem) this.bloodGoreSystem.decalSystem = this.decalSystem;

    this.structureSystem = new StructureSystem(this.threeScene.scene, physicsWorld.world, this.vfxManager, this.terrainSystem);
    this.structureSystem.engineUnits = this.units;
    this.objectiveSystem = new ObjectiveSystem(this.threeScene.scene, this.vfxManager);
    this.waypointNavSystem = new WaypointNavSystem(this.terrainSystem);

    // Dynamic unblocking hooks for breached gates and collapsed walls
    this.structureSystem.onGateBreachedCallback = (struct) => {
      if (this.waypointNavSystem) {
        this.waypointNavSystem.unblockArea(struct.position, 6.0);
      }
    };
    this.structureSystem.onStructureCollapsedCallback = (struct) => {
      if (this.waypointNavSystem) {
        this.waypointNavSystem.unblockArea(struct.position, (struct.typeConfig?.width || 6.0) * 0.8);
      }
    };

    // Load Default Battleground Map
    const initialMapId = useSandboxStore.getState().activeMapId || 'castle_siege_plains';
    this.loadBattlegroundMap(initialMapId);

    // 5. Start Render & Game Loop
    this.isRunning = true;
    this.lastTime = performance.now();
    this.tick();

    console.log('[SandboxEngine] Ultra Engine initialized with 3D Terrain, Fortifications & Siege Objectives!');
  }

  loadBattlegroundMap(mapId, scenarioType = null) {
    const mapConfig = BATTLEGROUND_MAPS[mapId] || BATTLEGROUND_MAPS.castle_siege_plains;
    const store = useSandboxStore.getState();
    store.setMapId(mapConfig.id);
    store.setScenarioType(scenarioType || mapConfig.defaultScenario);

    // 1. Clear current units, structures, objectives
    this.clearAll(true);
    physicsWorld.disableDefaultGround();

    // 2. Build 3D Terrain
    this.terrainSystem.buildTerrain(mapConfig);
    this.threeScene.terrainMesh = this.terrainSystem.terrainMesh;

    // 3. Apply Map Lighting, Atmosphere & Initial Camera Perspective
    this.threeScene.applyBattlegroundLighting(mapConfig);
    this.threeScene.setBattlegroundCamera(mapConfig);

    // 4. Load Map Fortifications
    this.structureSystem.loadMapStructures(mapConfig.defaultStructures);

    // 5. Build Waypoint Navigation Graph
    this.waypointNavSystem.buildGraph(this.structureSystem);

    // 6. Initialize Objectives & Timers
    this.objectiveSystem.initScenario(scenarioType || mapConfig.defaultScenario, mapConfig, this.structureSystem);

    // 7. Update Deployment Zones overlay
    this.threeScene.updateDeploymentZones(mapConfig.deploymentZones, store.enforceDeploymentZones);

    console.log(`[SandboxEngine] Loaded battleground: ${mapConfig.name} (${mapConfig.defaultScenario})`);
  }

  tick = () => {
    if (!this.isRunning) return;

    this.animFrameId = requestAnimationFrame(this.tick);

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    const { gamePhase, gameSpeed, updateCounts, setGamePhase, setObjectiveHUD } = useSandboxStore.getState();
    const scaledDt = dt * gameSpeed;

    // UPDATE CAMERA FOLLOW LERP
    if (this.threeScene) {
      this.threeScene.updateCameraFollow(dt);
    }

    // UPDATE POSSESSION CONTROLLER
    if (this.possessionController) {
      this.possessionController.update(scaledDt);
    }

    // UPDATE VFX PARTICLES & 3D BLOOD GORE SYSTEM
    if (this.vfxManager) {
      this.vfxManager.update(scaledDt);
    }
    if (this.bloodGoreSystem) {
      this.bloodGoreSystem.update(scaledDt);
    }

    // STEP PHYSICS WORLD & UPDATE ACTIVE UNITS
    if (gamePhase === 'BATTLE') {
      // 1. Update Objectives & Round Timer
      const victoryResult = this.objectiveSystem ? this.objectiveSystem.update(scaledDt, this.units, this.structureSystem) : 'ONGOING';

      // 2. Update AI targeting with objective & structure awareness
      this.battleAI.update(this.units, this.objectiveSystem, this.structureSystem);

      // 3. Update Destructible Structure physics & debris
      if (this.structureSystem) {
        this.structureSystem.update(scaledDt);
      }

      // 4. Step Rapier Physics World
      physicsWorld.step(scaledDt);

      // 5. Update Units with slope, terrain, and structure interactions
      this.units.forEach(unit => unit.update(
        scaledDt,
        this.units,
        this.projectileSystem,
        this.vfxManager,
        this.bloodGoreSystem,
        this.terrainSystem,
        this.structureSystem,
        this.waypointNavSystem
      ));

      this.projectileSystem.update(scaledDt, this.units);

      // 6. Update Terrain Water Ripples and Ground Damage Decals
      if (this.decalSystem) this.decalSystem.update(scaledDt);
      if (this.terrainSystem) this.terrainSystem.update(scaledDt);

      // 7. Push Live Objective HUD State to Zustand store
      if (this.objectiveSystem) {
        setObjectiveHUD(this.objectiveSystem.getHUDState());
      }

      // 7. Check Victory State
      if (victoryResult !== 'ONGOING' && gamePhase === 'BATTLE') {
        soundSystem.stopWarDrums();

        if (this.possessionController) {
          this.possessionController.exitPossession();
        }

        // Calculate Battle Accolades & MVP
        const allUnits = this.units || [];
        let mvpUnit = null;
        let mvpScore = -1;
        let vanguardUnit = null;
        let vanguardScore = -1;
        let sniperUnit = null;
        let sniperScore = -1;

        allUnits.forEach(u => {
          const kills = u.kills || 0;
          const dmg = u.damageDealt || 0;
          const score = dmg + kills * 100;
          if (score > mvpScore && (kills > 0 || dmg > 0)) {
            mvpScore = score;
            mvpUnit = {
              name: u.typeConfig?.name || 'Warrior',
              unitTypeId: u.typeConfig?.id || 'swordsman',
              teamId: u.teamId,
              kills,
              damageDealt: Math.round(dmg),
              traitId: u.traitId || 'none'
            };
          }

          const absorbed = u.damageAbsorbed || 0;
          if (absorbed > vanguardScore && absorbed > 0) {
            vanguardScore = absorbed;
            vanguardUnit = {
              name: u.typeConfig?.name || 'Defender',
              unitTypeId: u.typeConfig?.id || 'swordsman',
              teamId: u.teamId,
              damageAbsorbed: Math.round(absorbed),
              traitId: u.traitId || 'none'
            };
          }

          const isRanged = u.typeConfig && (u.typeConfig.category === 'ARCANE' || (u.typeConfig.attackRange || 0) > 8.0);
          if (isRanged && (kills > 0 || dmg > 0) && score > sniperScore) {
            sniperScore = score;
            sniperUnit = {
              name: u.typeConfig?.name || 'Ranger',
              unitTypeId: u.typeConfig?.id || 'archer',
              teamId: u.teamId,
              kills,
              damageDealt: Math.round(dmg)
            };
          }
        });

        useSandboxStore.getState().setBattleAwards({
          mvp: mvpUnit,
          vanguard: vanguardUnit,
          sniper: sniperUnit
        });

        if (victoryResult === 'VICTORY_BLUE') {
          setGamePhase('VICTORY_BLUE');
          soundSystem.playVictoryFanfare();
        } else if (victoryResult === 'VICTORY_RED') {
          setGamePhase('VICTORY_RED');
          soundSystem.playVictoryFanfare();
        } else if (victoryResult === 'DRAW') {
          setGamePhase('DRAW');
        }
      }
    } else {
      const { isPossessing } = useSandboxStore.getState();
      if (isPossessing) {
        physicsWorld.step(scaledDt);
      }
      this.units.forEach(unit => unit.updateMeshFromPhysics());
    }

    // UPDATE OVERHEAD HEALTH BARS
    if (this.healthBarManager) {
      this.units.forEach(unit => this.healthBarManager.updateUnitHealthBar(unit));
    }

    // UPDATE LIVE UNIT COUNTS
    const blueCount = this.units.filter(u => u.teamId === 'blue' && !u.isDead).length;
    const redCount = this.units.filter(u => u.teamId === 'red' && !u.isDead).length;
    updateCounts(blueCount, redCount, gamePhase === 'PLACEMENT');

    // RENDER THREE SCENE
    this.threeScene.render();
  };

  inspectUnitAt(mouseX, mouseY) {
    const pos = this.threeScene.getGroundIntersection(mouseX, mouseY, this.structureSystem);
    if (!pos) return false;

    let closestUnit = null;
    let minDist = 2.4;

    this.units.forEach(u => {
      if (!u.body) return;
      const uPos = u.body.translation();
      const dx = uPos.x - pos.x;
      const dz = uPos.z - pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < minDist) {
        minDist = dist;
        closestUnit = u;
      }
    });

    if (closestUnit) {
      useSandboxStore.getState().setInspectedUnit(closestUnit);
      soundSystem.playSwordSlash();
      return true;
    }
    return false;
  }

  updatePlacementCursor(mouseX, mouseY) {
    if (!this.placementManager) return null;
    const store = useSandboxStore.getState();
    const mapConfig = this.terrainSystem?.currentMap;
    return this.placementManager.updateCursor(
      mouseX,
      mouseY,
      this.structureSystem,
      mapConfig,
      store.enforceDeploymentZones
    );
  }

  placeSingleUnit(unitTypeId, teamId, position, overrideTrait = null, isGarrisoned = false) {
    const store = useSandboxStore.getState();
    const traitId = overrideTrait || store.selectedTrait || 'none';
    const typeCfg = UNIT_TYPES[unitTypeId];
    const traitCfg = UNIT_TRAITS[traitId] || UNIT_TRAITS.none;
    const totalCost = (typeCfg ? typeCfg.cost : 50) + traitCfg.cost;

    const isRanged = typeCfg && (typeCfg.category === 'ARCANE' || typeCfg.attackRange > 8.0);
    const actualGarrison = isRanged && (isGarrisoned || position.isGarrison || false);
    const groundY = this.terrainSystem ? this.terrainSystem.getHeight(position.x, position.z) : 0;
    const actualY = actualGarrison ? position.y : groundY;

    const unitPos = { x: position.x, y: actualY, z: position.z };

    const unit = new ActiveRagdollUnit(
      this.threeScene.scene,
      physicsWorld.world,
      unitTypeId,
      teamId,
      unitPos,
      this.vfxManager,
      traitId,
      this.bloodGoreSystem
    );

    unit.unitCost = totalCost;
    unit.isGarrisoned = actualGarrison;

    this.units.push(unit);
    this.initialPlacementConfig.push({
      unitTypeId,
      teamId,
      position: { x: unitPos.x, y: unitPos.y, z: unitPos.z },
      traitId,
      isGarrisoned: actualGarrison
    });
  }

  placeUnit(unitTypeId, teamId, position, minDistanceCheck = true, overrideTrait = null, isGarrisoned = false) {
    const store = useSandboxStore.getState();
    if (store.gamePhase !== 'PLACEMENT') return;

    if (minDistanceCheck && this.lastPlacedPos) {
      const dx = position.x - this.lastPlacedPos.x;
      const dz = position.z - this.lastPlacedPos.z;
      if (Math.sqrt(dx * dx + dz * dz) < 1.6) return;
    }

    // Check deployment zone validity if enforced
    if (position.isValidSide !== undefined && !position.isValidSide && store.enforceDeploymentZones) {
      return;
    }

    const traitId = overrideTrait || store.selectedTrait || 'none';
    const typeCfg = UNIT_TYPES[unitTypeId];
    const traitCfg = UNIT_TRAITS[traitId] || UNIT_TRAITS.none;
    const totalCost = (typeCfg ? typeCfg.cost : 50) + traitCfg.cost;

    const isRanged = typeCfg && (typeCfg.category === 'ARCANE' || typeCfg.attackRange > 8.0);
    const actualGarrison = isRanged && (isGarrisoned || position.isGarrison || false);

    // Multi-Deploy Formation Offsets: 1, 3, 5, 10, 20, 50
    const offsets = (!actualGarrison && !position.isGarrison)
      ? getFormationOffsets(store.formationMode, teamId)
      : [{ dx: 0, dz: 0 }];

    const mapConfig = BATTLEGROUND_MAPS[store.activeMapId] || BATTLEGROUND_MAPS.castle_siege_plains;

    for (const offset of offsets) {
      if (store.gameMode === 'CAMPAIGN' && teamId === 'blue') {
        const curGold = useSandboxStore.getState().remainingGold;
        if (curGold < totalCost) {
          break;
        }
        store.deductGold(totalCost);
      }

      const clampedX = Math.max(-48, Math.min(48, position.x + offset.dx));
      const clampedZ = Math.max(-36, Math.min(36, position.z + offset.dz));

      // Check deployment zones if enforced
      if (store.enforceDeploymentZones && position.isValidSide !== undefined) {
        if (mapConfig && mapConfig.deploymentZones) {
          const zone = mapConfig.deploymentZones[teamId];
          if (zone) {
            const inZone = clampedX >= zone.minX && clampedX <= zone.maxX && clampedZ >= zone.minZ && clampedZ <= zone.maxZ;
            if (!inZone) continue;
          }
        } else {
          const inHalf = (teamId === 'blue' && clampedX <= 0) || (teamId === 'red' && clampedX >= 0);
          if (!inHalf) continue;
        }
      }

      const groundY = this.terrainSystem ? this.terrainSystem.getHeight(clampedX, clampedZ) : 0;
      const actualY = actualGarrison ? position.y : groundY;

      const unitPos = { x: clampedX, y: actualY, z: clampedZ };

      const unit = new ActiveRagdollUnit(
        this.threeScene.scene,
        physicsWorld.world,
        unitTypeId,
        teamId,
        unitPos,
        this.vfxManager,
        traitId,
        this.bloodGoreSystem
      );

      unit.unitCost = totalCost;
      unit.isGarrisoned = actualGarrison;

      this.units.push(unit);
      this.initialPlacementConfig.push({
        unitTypeId,
        teamId,
        position: { x: unitPos.x, y: unitPos.y, z: unitPos.z },
        traitId,
        isGarrisoned: actualGarrison
      });
    }

    this.lastPlacedPos = { x: position.x, z: position.z };

    // Update real-time counts immediately
    let blueCount = 0;
    let redCount = 0;
    this.units.forEach(u => {
      if (u.teamId === 'blue') blueCount++;
      else redCount++;
    });
    store.updateCounts(blueCount, redCount, true);
  }

  resetDragState() {
    this.lastPlacedPos = null;
  }

  loadPresetScenario(scenario) {
    const store = useSandboxStore.getState();
    store.setGameMode('SANDBOX');
    this.clearAll(true);
    const presetUnits = scenario.generate();
    presetUnits.forEach(u => {
      this.placeSingleUnit(u.unitTypeId, u.teamId, u.position, u.traitId || 'none');
    });
    this.resetDragState();
    let blueCount = 0;
    let redCount = 0;
    this.units.forEach(u => {
      if (u.teamId === 'blue') blueCount++;
      else redCount++;
    });
    store.updateCounts(blueCount, redCount, true);
  }

  loadCampaignLevel(levelIdx) {
    const level = CAMPAIGN_LEVELS[levelIdx];
    if (!level) return;

    this.clearAll(true);
    const store = useSandboxStore.getState();
    store.initCampaignLevel(levelIdx, level.budget);

    level.enemies.forEach(e => {
      const unit = new ActiveRagdollUnit(
        this.threeScene.scene,
        physicsWorld.world,
        e.unitTypeId,
        'red',
        e.position,
        this.vfxManager,
        'none',
        this.bloodGoreSystem
      );
      this.units.push(unit);
    });

    this.resetDragState();
  }

  removeUnitAt(mouseX, mouseY) {
    const store = useSandboxStore.getState();
    if (store.gamePhase !== 'PLACEMENT') return;

    const pos = this.threeScene.getGroundIntersection(mouseX, mouseY, this.structureSystem);
    if (!pos) return;

    let closestIdx = -1;
    let minDistance = 2.2;

    this.units.forEach((u, idx) => {
      if (store.gameMode === 'CAMPAIGN' && u.teamId === 'red') return;

      const uPos = u.body.translation();
      const dx = uPos.x - pos.x;
      const dz = uPos.z - pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = idx;
      }
    });

    if (closestIdx !== -1) {
      const unit = this.units[closestIdx];
      if (store.gameMode === 'CAMPAIGN' && unit.teamId === 'blue') {
        store.refundGold(unit.unitCost || 50);
      }
      if (this.healthBarManager) this.healthBarManager.removeUnitHealthBar(unit.id);
      unit.destroy();
      this.units.splice(closestIdx, 1);

      const snapshotIdx = this.initialPlacementConfig.findIndex(
        cfg => cfg.teamId === unit.teamId && Math.abs(cfg.position.x - unit.body.translation().x) < 1.0
      );
      if (snapshotIdx !== -1) {
        this.initialPlacementConfig.splice(snapshotIdx, 1);
      }
    }
  }

  startBattle() {
    if (this.units.length === 0) return;
    if (this.objectiveSystem) {
      this.objectiveSystem.startRound();
    }
    soundSystem.startWarDrums();
    useSandboxStore.getState().setGamePhase('BATTLE');
  }

  resetBattle() {
    soundSystem.stopWarDrums();
    const store = useSandboxStore.getState();
    if (store.gameMode === 'CAMPAIGN') {
      this.loadCampaignLevel(store.currentLevelIndex);
      return;
    }

    const savedConfig = [...this.initialPlacementConfig];
    this.clearAll(false);

    // Re-initialize default map fortifications & objectives
    const mapConfig = BATTLEGROUND_MAPS[store.activeMapId] || BATTLEGROUND_MAPS.castle_siege_plains;
    if (this.structureSystem) {
      this.structureSystem.loadMapStructures(mapConfig.defaultStructures);
    }
    if (this.waypointNavSystem) {
      this.waypointNavSystem.buildGraph(this.structureSystem);
    }
    if (this.objectiveSystem) {
      this.objectiveSystem.initScenario(store.scenarioType || mapConfig.defaultScenario, mapConfig, this.structureSystem);
    }

    savedConfig.forEach(cfg => {
      this.placeSingleUnit(cfg.unitTypeId, cfg.teamId, cfg.position, cfg.traitId || 'none', cfg.isGarrisoned);
    });

    let blueCount = 0;
    let redCount = 0;
    this.units.forEach(u => {
      if (u.teamId === 'blue') blueCount++;
      else redCount++;
    });
    store.updateCounts(blueCount, redCount, true);

    useSandboxStore.getState().setGamePhase('PLACEMENT');
  }

  replayBattle() {
    this.resetBattle();
    this.startBattle();
  }

  clearAll(clearSnapshot = true) {
    soundSystem.stopWarDrums();
    this.units.forEach(u => u.destroy());
    this.units = [];
    if (this.projectileSystem) this.projectileSystem.clear();
    if (this.vfxManager) this.vfxManager.clear();
    if (this.healthBarManager) this.healthBarManager.clear();
    if (this.bloodGoreSystem) this.bloodGoreSystem.clear();
    if (this.decalSystem) this.decalSystem.clear();

    if (clearSnapshot) {
      this.initialPlacementConfig = [];
      useSandboxStore.getState().resetStore();
    }
  }

  setGraphicsQuality(level) {
    if (this.threeScene) {
      this.threeScene.setGraphicsQuality(level);
    }
  }

  dispose() {
    this.isRunning = false;
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.clearAll();
    if (this.structureSystem) this.structureSystem.clear();
    if (this.terrainSystem) this.terrainSystem.clear();
    if (this.objectiveSystem) this.objectiveSystem.clear();
    if (this.placementManager) this.placementManager.dispose();
    if (this.threeScene) this.threeScene.dispose();
    physicsWorld.clear();
  }
}

export const sandboxEngine = new SandboxEngine();
