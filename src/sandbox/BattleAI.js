/**
 * BattleAI.js
 * Objective-aware AI targeting for Siege, Capture Points, and Elimination.
 * Units target enemies, funnel towards contested capture points, and
 * siege units attack fortifications and gates.
 */

export class BattleAISystem {
  constructor() {
    this.updateInterval = 0.12; // Update AI targets at ~8Hz instead of 60Hz
    this.timer = 0;
    this.blueUnits = [];
    this.redUnits = [];
  }

  update(allUnits, objectiveSystem = null, structureSystem = null, dt = 0.016) {
    this.timer -= dt;
    const shouldFullRefresh = this.timer <= 0;
    if (shouldFullRefresh) {
      this.timer = this.updateInterval;
      this.blueUnits = [];
      this.redUnits = [];
      for (let i = 0; i < allUnits.length; i++) {
        const u = allUnits[i];
        if (!u.isDead) {
          if (u.teamId === 'blue') this.blueUnits.push(u);
          else this.redUnits.push(u);
        }
      }
    }

    const blueUnits = this.blueUnits;
    const redUnits = this.redUnits;

    for (let i = 0; i < allUnits.length; i++) {
      const unit = allUnits[i];
      if (unit.isDead || !unit.body || unit.isPossessed) continue;

      // Keep current target if still alive and valid, avoiding full search every frame
      if (!shouldFullRefresh && unit.targetUnit && !unit.targetUnit.isDead && unit.targetUnit.body) {
        continue;
      }

      // If not a full refresh, only update a fraction of units per frame to spread CPU cost
      if (!shouldFullRefresh && unit.targetUnit) {
        continue;
      }

      const opposingTeam = unit.teamId === 'blue' ? redUnits : blueUnits;
      const pos = unit.body.translation();
      const isSiegeUnit = unit.typeConfig.id === 'battering_ram' || unit.typeConfig.id === 'catapult';

      // 1. Siege units prioritize structures if available
      if (isSiegeUnit && structureSystem) {
        const struct = structureSystem.findTargetStructure(pos, unit.teamId, 45);
        if (struct) {
          unit.targetStructure = struct;
          unit.targetUnit = null;
          continue;
        }
      }

      // 2. Find nearest living enemy unit (fast squared Euclidean check)
      let nearestEnemy = null;
      let minDistanceSq = Infinity;

      for (let j = 0; j < opposingTeam.length; j++) {
        const enemy = opposingTeam[j];
        if (!enemy.body) continue;
        const enemyPos = enemy.body.translation();
        const dx = enemyPos.x - pos.x;
        const dz = enemyPos.z - pos.z;
        const distSq = dx * dx + dz * dz;

        if (distSq < minDistanceSq) {
          minDistanceSq = distSq;
          nearestEnemy = enemy;
        }
      }

      // 3. In Capture Points mode, if no enemy is close (< 14m), path towards nearest contested/enemy point
      if ((!nearestEnemy || minDistanceSq > 196) && objectiveSystem && objectiveSystem.scenarioType === 'CAPTURE_POINTS') {
        const points = objectiveSystem.capturePoints;
        let bestPoint = null;
        let bestDistSq = Infinity;

        for (let k = 0; k < points.length; k++) {
          const cp = points[k];
          if (cp.owner !== unit.teamId) {
            const dx = cp.position.x - pos.x;
            const dz = cp.position.z - pos.z;
            const dSq = dx * dx + dz * dz;
            if (dSq < bestDistSq) {
              bestDistSq = dSq;
              bestPoint = cp;
            }
          }
        }

        if (bestPoint) {
          unit.targetUnit = nearestEnemy;
          unit.targetStructure = null;
          unit.objectiveDestination = bestPoint.position;
          continue;
        }
      }

      unit.targetUnit = nearestEnemy;
      unit.objectiveDestination = null;
    }

    // Match Result is resolved by ObjectiveSystem if active, else standard elimination
    if (objectiveSystem) {
      return objectiveSystem.matchResult;
    }

    if (blueUnits.length === 0 && redUnits.length === 0) {
      return 'DRAW';
    } else if (blueUnits.length > 0 && redUnits.length === 0) {
      return 'VICTORY_BLUE';
    } else if (redUnits.length > 0 && blueUnits.length === 0) {
      return 'VICTORY_RED';
    }

    return 'ONGOING';
  }
}
