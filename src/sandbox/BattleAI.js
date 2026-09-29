/**
 * BattleAI.js
 * Objective-aware AI targeting for Siege, Capture Points, and Elimination.
 * Units target enemies, funnel towards contested capture points, and
 * siege units attack fortifications and gates.
 */

export class BattleAISystem {
  constructor() {}

  update(allUnits, objectiveSystem = null, structureSystem = null) {
    const blueUnits = allUnits.filter(u => u.teamId === 'blue' && !u.isDead);
    const redUnits = allUnits.filter(u => u.teamId === 'red' && !u.isDead);

    allUnits.forEach(unit => {
      if (unit.isDead || !unit.body || unit.isPossessed) return;

      const opposingTeam = unit.teamId === 'blue' ? redUnits : blueUnits;
      const pos = unit.body.translation();
      const isSiegeUnit = unit.typeConfig.id === 'battering_ram' || unit.typeConfig.id === 'catapult';

      // 1. Siege units prioritize structures if available
      if (isSiegeUnit && structureSystem) {
        const struct = structureSystem.findTargetStructure(pos, unit.teamId, 45);
        if (struct) {
          unit.targetStructure = struct;
          unit.targetUnit = null;
          return;
        }
      }

      // 2. Find nearest living enemy unit
      let nearestEnemy = null;
      let minDistanceSq = Infinity;

      opposingTeam.forEach(enemy => {
        if (!enemy.body) return;
        const enemyPos = enemy.body.translation();
        const dx = enemyPos.x - pos.x;
        const dz = enemyPos.z - pos.z;
        const distSq = dx * dx + dz * dz;

        if (distSq < minDistanceSq) {
          minDistanceSq = distSq;
          nearestEnemy = enemy;
        }
      });

      // 3. In Capture Points mode, if no enemy is close (< 14m), path towards nearest contested/enemy point
      if ((!nearestEnemy || minDistanceSq > 14 * 14) && objectiveSystem && objectiveSystem.scenarioType === 'CAPTURE_POINTS') {
        const points = objectiveSystem.capturePoints;
        let bestPoint = null;
        let bestDistSq = Infinity;

        points.forEach(cp => {
          if (cp.owner !== unit.teamId) {
            const dx = cp.position.x - pos.x;
            const dz = cp.position.z - pos.z;
            const dSq = dx * dx + dz * dz;
            if (dSq < bestDistSq) {
              bestDistSq = dSq;
              bestPoint = cp;
            }
          }
        });

        if (bestPoint) {
          unit.targetUnit = nearestEnemy; // Keep attacking if enemy is encountered on way
          unit.targetStructure = null;
          // Destination hint for steering
          unit.objectiveDestination = bestPoint.position;
          return;
        }
      }

      unit.targetUnit = nearestEnemy;
      unit.objectiveDestination = null;
    });

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
