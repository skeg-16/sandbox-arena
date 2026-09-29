/**
 * ObjectiveSystem.js
 * Tracks game mode scenarios, round timers, keep integrity, capture points,
 * and determines victory/defeat conditions for both teams.
 */

import * as THREE from 'three';
import { SCENARIO_TYPES } from './MapConfigs';
import { soundSystem } from './SoundSystem';

export class ObjectiveSystem {
  constructor(scene, vfxManager) {
    this.scene = scene;
    this.vfxManager = vfxManager;

    this.scenarioType = 'SIEGE'; // SIEGE | CAPTURE_POINTS | DESTROY_KEEP | ELIMINATION
    this.timeLimit = 180;
    this.timeRemaining = 180;
    this.isTimerActive = false;

    // Capture Points
    this.capturePoints = [];
    this.pointVisuals = []; // Three.js groups for flagpoles and zone rings

    // Keep & Gate References
    this.targetKeep = null;
    this.targetGatehouse = null;

    // Victory state
    this.matchResult = 'ONGOING'; // 'ONGOING' | 'VICTORY_BLUE' | 'VICTORY_RED' | 'DRAW'
  }

  initScenario(scenarioType, mapConfig, structureSystem) {
    this.clear();
    this.scenarioType = scenarioType || mapConfig.defaultScenario || 'SIEGE';
    this.timeLimit = mapConfig.timeLimit || 180;
    this.timeRemaining = this.timeLimit;
    this.matchResult = 'ONGOING';
    this.isTimerActive = false;

    // 1. Locate Keep and Gatehouse in structures
    if (structureSystem && structureSystem.structures) {
      this.targetKeep = structureSystem.structures.find(s => s.typeConfig.id === 'keep') || null;
      this.targetGatehouse = structureSystem.structures.find(s => s.typeConfig.id === 'gatehouse') || null;
    }

    // 2. Initialize Capture Points
    if (this.scenarioType === 'CAPTURE_POINTS' && mapConfig.capturePoints) {
      mapConfig.capturePoints.forEach(cp => {
        const pointData = {
          id: cp.id,
          name: cp.name,
          position: { ...cp.position },
          radius: cp.radius || 6.0,
          owner: cp.initialOwner || 'neutral',
          progress: cp.initialOwner === 'blue' ? 100 : (cp.initialOwner === 'red' ? -100 : 0),
          contested: false,
          blueUnitsNear: 0,
          redUnitsNear: 0
        };
        this.capturePoints.push(pointData);
        this._createCapturePointVisual(pointData);
      });
    }

    console.log(`[ObjectiveSystem] Initialized scenario: ${this.scenarioType}, time: ${this.timeRemaining}s`);
  }

  _createCapturePointVisual(point) {
    const group = new THREE.Group();
    group.position.set(point.position.x, point.position.y, point.position.z);

    // Glowing Ground Ring representing capture radius
    const ringGeo = new THREE.RingGeometry(point.radius - 0.25, point.radius + 0.1, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: point.owner === 'blue' ? 0x3b82f6 : (point.owner === 'red' ? 0xef4444 : 0xfacc15),
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.y = 0.08;
    group.add(ringMesh);

    // Tall Central Flagpole
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.15, 6.0, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 3.0;
    pole.castShadow = true;
    group.add(pole);

    // Team Banner Flag
    const flagGeo = new THREE.BoxGeometry(0.06, 1.4, 2.0);
    const flagMat = new THREE.MeshStandardMaterial({
      color: point.owner === 'blue' ? 0x3b82f6 : (point.owner === 'red' ? 0xef4444 : 0x94a3b8),
      roughness: 0.6
    });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(0.04, 5.0, 1.0);
    group.add(flag);

    this.scene.add(group);
    this.pointVisuals.push({ pointId: point.id, group, ringMesh, ringMat, flag, flagMat });
  }

  startRound() {
    this.isTimerActive = true;
    this.matchResult = 'ONGOING';
  }

  update(dt, units, structureSystem) {
    if (!this.isTimerActive || this.matchResult !== 'ONGOING') return this.matchResult;

    // Round Timer Countdown
    this.timeRemaining = Math.max(0, this.timeRemaining - dt);

    const blueLiving = units.filter(u => u.teamId === 'blue' && !u.isDead);
    const redLiving = units.filter(u => u.teamId === 'red' && !u.isDead);

    // ════════════════════════════════════════════════════
    // 1. SIEGE / DESTROY KEEP LOGIC
    // ════════════════════════════════════════════════════
    if (this.scenarioType === 'SIEGE' || this.scenarioType === 'DESTROY_KEEP') {
      // Check Keep Status
      if (this.targetKeep && this.targetKeep.isDestroyed) {
        this.matchResult = 'VICTORY_BLUE';
        return this.matchResult;
      }

      // Check Defenders Eliminated
      if (redLiving.length === 0 && blueLiving.length > 0) {
        this.matchResult = 'VICTORY_BLUE';
        return this.matchResult;
      }

      // Check Attackers Eliminated
      if (blueLiving.length === 0 && redLiving.length > 0) {
        this.matchResult = 'VICTORY_RED';
        return this.matchResult;
      }

      // Check Time Expired: Defenders successfully held the fort!
      if (this.timeRemaining <= 0) {
        this.matchResult = 'VICTORY_RED';
        return this.matchResult;
      }
    }

    // ════════════════════════════════════════════════════
    // 2. CAPTURE POINTS LOGIC
    // ════════════════════════════════════════════════════
    if (this.scenarioType === 'CAPTURE_POINTS') {
      let blueControlled = 0;
      let redControlled = 0;

      this.capturePoints.forEach(point => {
        // Count units within capture radius
        let blueInZone = 0;
        let redInZone = 0;

        units.forEach(u => {
          if (u.isDead || !u.body) return;
          const uPos = u.body.translation();
          const dx = uPos.x - point.position.x;
          const dz = uPos.z - point.position.z;
          if (dx * dx + dz * dz <= point.radius * point.radius) {
            if (u.teamId === 'blue') blueInZone++;
            else if (u.teamId === 'red') redInZone++;
          }
        });

        point.blueUnitsNear = blueInZone;
        point.redUnitsNear = redInZone;
        point.contested = blueInZone > 0 && redInZone > 0;

        // Shift capture progress
        const captureRate = 22.0 * dt; // percent per second
        if (blueInZone > redInZone) {
          point.progress = Math.min(100, point.progress + captureRate * (blueInZone - redInZone));
          if (point.progress >= 100) {
            if (point.owner !== 'blue') soundSystem.playComboFinisher?.();
            point.owner = 'blue';
          }
        } else if (redInZone > blueInZone) {
          point.progress = Math.max(-100, point.progress - captureRate * (redInZone - blueInZone));
          if (point.progress <= -100) {
            if (point.owner !== 'red') soundSystem.playComboFinisher?.();
            point.owner = 'red';
          }
        }

        if (point.owner === 'blue') blueControlled++;
        else if (point.owner === 'red') redControlled++;

        // Update 3D visual ring & flag color
        this._updatePointVisual(point);
      });

      // Instant win if all points held by one team
      if (this.capturePoints.length > 0) {
        if (blueControlled === this.capturePoints.length) {
          this.matchResult = 'VICTORY_BLUE';
          return this.matchResult;
        } else if (redControlled === this.capturePoints.length) {
          this.matchResult = 'VICTORY_RED';
          return this.matchResult;
        }
      }

      // Time Expired: Team holding highest points wins
      if (this.timeRemaining <= 0) {
        if (blueControlled > redControlled) {
          this.matchResult = 'VICTORY_BLUE';
        } else if (redControlled > blueControlled) {
          this.matchResult = 'VICTORY_RED';
        } else {
          this.matchResult = blueLiving.length >= redLiving.length ? 'VICTORY_BLUE' : 'VICTORY_RED';
        }
        return this.matchResult;
      }
    }

    // ════════════════════════════════════════════════════
    // 3. CLASSIC ELIMINATION FALLBACK
    // ════════════════════════════════════════════════════
    if (this.scenarioType === 'ELIMINATION') {
      if (blueLiving.length === 0 && redLiving.length === 0) {
        this.matchResult = 'DRAW';
      } else if (blueLiving.length > 0 && redLiving.length === 0) {
        this.matchResult = 'VICTORY_BLUE';
      } else if (redLiving.length > 0 && blueLiving.length === 0) {
        this.matchResult = 'VICTORY_RED';
      }
    }

    return this.matchResult;
  }

  _updatePointVisual(point) {
    const visual = this.pointVisuals.find(v => v.pointId === point.id);
    if (!visual) return;

    let targetHex = 0x94a3b8; // Neutral grey
    if (point.owner === 'blue') targetHex = 0x3b82f6;
    else if (point.owner === 'red') targetHex = 0xef4444;

    visual.ringMat.color.setHex(targetHex);
    visual.flagMat.color.setHex(targetHex);

    // Pulse zone opacity if currently contested
    if (point.contested) {
      visual.ringMat.opacity = 0.3 + Math.sin(performance.now() * 0.008) * 0.25;
    } else {
      visual.ringMat.opacity = 0.45;
    }
  }

  getHUDState() {
    return {
      scenarioType: this.scenarioType,
      timeRemaining: Math.ceil(this.timeRemaining),
      timeLimit: this.timeLimit,
      keepHealth: this.targetKeep ? Math.max(0, this.targetKeep.health) : null,
      keepMaxHealth: this.targetKeep ? this.targetKeep.maxHealth : null,
      isGateBreached: this.targetGatehouse ? this.targetGatehouse.isGateBreached : null,
      gateHealth: this.targetGatehouse ? Math.max(0, this.targetGatehouse.gateHealth) : null,
      capturePoints: this.capturePoints.map(cp => ({
        id: cp.id,
        name: cp.name,
        owner: cp.owner,
        progress: cp.progress,
        contested: cp.contested,
        blueUnits: cp.blueUnitsNear,
        redUnits: cp.redUnitsNear
      }))
    };
  }

  clear() {
    this.pointVisuals.forEach(v => {
      if (this.scene) this.scene.remove(v.group);
    });
    this.pointVisuals = [];
    this.capturePoints = [];
    this.targetKeep = null;
    this.targetGatehouse = null;
    this.isTimerActive = false;
  }
}
