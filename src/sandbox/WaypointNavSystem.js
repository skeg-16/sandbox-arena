/**
 * WaypointNavSystem.js
 * Lightweight 2D/3D waypoint graph navigation for in-browser siege AI.
 * Paths units around cliffs, deep water, and walls, funneling through
 * bridges and gates, and dynamically opening new routes when walls collapse.
 *
 * Fully protected against infinite loops, graph cycles, and memory leaks.
 */

export class WaypointNavSystem {
  constructor(terrainSystem) {
    this.terrainSystem = terrainSystem;
    this.nodes = [];
    this.gridWidth = 24;
    this.gridHeight = 20;
    this.minX = -48;
    this.maxX = 48;
    this.minZ = -36;
    this.maxZ = 36;
    this.stepX = (this.maxX - this.minX) / (this.gridWidth - 1);
    this.stepZ = (this.maxZ - this.minZ) / (this.gridHeight - 1);
  }

  buildGraph(structureSystem) {
    this.nodes = [];

    // 1. Generate grid nodes
    for (let gz = 0; gz < this.gridHeight; gz++) {
      for (let gx = 0; gx < this.gridWidth; gx++) {
        const x = this.minX + gx * this.stepX;
        const z = this.minZ + gz * this.stepZ;
        const y = this.terrainSystem.getHeight(x, z);

        // Evaluate terrain passability
        const normal = this.terrainSystem.getNormal(x, z);
        const isCliff = normal.y < 0.65; // Slope > ~48 degrees is impassable
        const isDeepWater = this.terrainSystem.hasWater && (this.terrainSystem.waterLevel - y > 1.2);

        let isBlocked = isCliff || isDeepWater;

        // Check if blocked by an intact structure
        if (!isBlocked && structureSystem) {
          for (const s of structureSystem.structures) {
            if (s.isDestroyed) continue;
            const dx = Math.abs(x - s.position.x);
            const dz = Math.abs(z - s.position.z);
            const halfW = s.typeConfig.width * 0.55;
            const halfD = (s.typeConfig.depth || 3.0) * 0.55;

            // Bridges are walkable!
            if (s.typeConfig.id === 'bridge') continue;

            // Gatehouse: if gate breached, central lane is open
            if (s.typeConfig.id === 'gatehouse' && s.isGateBreached && dx < 2.2) {
              continue;
            }

            if (dx < halfW && dz < halfD) {
              isBlocked = true;
              break;
            }
          }
        }

        this.nodes.push({
          id: gz * this.gridWidth + gx,
          gx,
          gz,
          x,
          y,
          z,
          isBlocked,
          neighbors: []
        });
      }
    }

    // 2. Connect 8-way adjacent neighbors
    this.reconnectNeighbors();
    console.log(`[WaypointNavSystem] Built safe navigation graph: ${this.nodes.length} nodes`);
  }

  unblockArea(centerPos, radius = 5.0) {
    let unblockedCount = 0;
    this.nodes.forEach(node => {
      const dx = node.x - centerPos.x;
      const dz = node.z - centerPos.z;
      if (dx * dx + dz * dz <= radius * radius) {
        if (node.isBlocked) {
          node.isBlocked = false;
          unblockedCount++;
        }
      }
    });

    if (unblockedCount > 0) {
      this.reconnectNeighbors();
      console.log(`[WaypointNavSystem] Unblocked ${unblockedCount} nodes around breach.`);
    }
  }

  reconnectNeighbors() {
    const directions = [
      { dx: 1, dz: 0 }, { dx: -1, dz: 0 }, { dx: 0, dz: 1 }, { dx: 0, dz: -1 },
      { dx: 1, dz: 1 }, { dx: -1, dz: 1 }, { dx: 1, dz: -1 }, { dx: -1, dz: -1 }
    ];

    this.nodes.forEach(node => {
      node.neighbors = [];
      if (node.isBlocked) return;

      directions.forEach(d => {
        const nx = node.gx + d.dx;
        const nz = node.gz + d.dz;
        if (nx >= 0 && nx < this.gridWidth && nz >= 0 && nz < this.gridHeight) {
          const neighbor = this.nodes[nz * this.gridWidth + nx];
          if (neighbor && !neighbor.isBlocked) {
            node.neighbors.push(neighbor);
          }
        }
      });
    });
  }

  getNearestNode(pos) {
    if (!pos || this.nodes.length === 0) return null;
    const gx = Math.max(0, Math.min(this.gridWidth - 1, Math.round((pos.x - this.minX) / this.stepX)));
    const gz = Math.max(0, Math.min(this.gridHeight - 1, Math.round((pos.z - this.minZ) / this.stepZ)));
    return this.nodes[gz * this.gridWidth + gx] || null;
  }

  /**
   * Fast line-of-sight raycast across waypoint grid.
   */
  hasLineOfSight(startPos, endPos) {
    const dx = endPos.x - startPos.x;
    const dz = endPos.z - startPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 4.5) return true;

    const steps = Math.min(16, Math.ceil(dist / 2.5));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const checkX = startPos.x + dx * t;
      const checkZ = startPos.z + dz * t;
      const node = this.getNearestNode({ x: checkX, z: checkZ });
      if (node && node.isBlocked) {
        return false;
      }
    }
    return true;
  }

  /**
   * Returns next steering target position for unit.
   * If direct path is clear, returns targetPos directly.
   * Otherwise runs safe, bounded A* to route around obstacles.
   */
  getNextWaypoint(startPos, targetPos) {
    if (!startPos || !targetPos) return targetPos;

    // Fast check: direct line of sight or very close (< 6m)
    const distSq = (targetPos.x - startPos.x) ** 2 + (targetPos.z - startPos.z) ** 2;
    if (distSq < 36 || this.hasLineOfSight(startPos, targetPos)) {
      return targetPos;
    }

    const startNode = this.getNearestNode(startPos);
    const endNode = this.getNearestNode(targetPos);

    if (!startNode || !endNode || startNode === endNode) {
      return targetPos;
    }

    // A* Search with strict closedSet and cycle protection
    const openSet = [startNode];
    const openSetIds = new Set([startNode.id]);
    const closedSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    gScore.set(startNode.id, 0);
    fScore.set(startNode.id, Math.hypot(endNode.x - startNode.x, endNode.z - startNode.z));

    let iterations = 0;
    const maxIterations = 40; // Strictly capped to guarantee 60fps

    while (openSet.length > 0 && iterations < maxIterations) {
      iterations++;

      // Find lowest fScore node in openSet
      let current = openSet[0];
      let lowestF = fScore.get(current.id) || Infinity;
      let currentIdx = 0;

      for (let i = 1; i < openSet.length; i++) {
        const score = fScore.get(openSet[i].id) || Infinity;
        if (score < lowestF) {
          lowestF = score;
          current = openSet[i];
          currentIdx = i;
        }
      }

      // Check goal reached (or close to destination)
      if (current === endNode || Math.hypot(current.x - endNode.x, current.z - endNode.z) < 6.0) {
        // Reconstruct path with strict cycle detection and max-step safety
        let curr = current;
        const path = [curr];
        const visited = new Set([curr.id]);
        let safety = 0;

        while (cameFrom.has(curr.id) && safety < 30) {
          safety++;
          curr = cameFrom.get(curr.id);
          if (visited.has(curr.id)) break; // Cycle prevented!
          visited.add(curr.id);
          path.unshift(curr);
        }

        const nextNode = path[1] || path[0];
        return { x: nextNode.x, y: nextNode.y, z: nextNode.z };
      }

      openSet.splice(currentIdx, 1);
      openSetIds.delete(current.id);
      closedSet.add(current.id); // Mark closed!

      for (const neighbor of current.neighbors) {
        if (closedSet.has(neighbor.id)) continue; // Skip closed nodes!

        const tentativeG = (gScore.get(current.id) || 0) + Math.hypot(neighbor.x - current.x, neighbor.z - current.z);
        if (tentativeG < (gScore.get(neighbor.id) || Infinity)) {
          cameFrom.set(neighbor.id, current);
          gScore.set(neighbor.id, tentativeG);
          const h = Math.hypot(endNode.x - neighbor.x, endNode.z - neighbor.z);
          fScore.set(neighbor.id, tentativeG + h);

          if (!openSetIds.has(neighbor.id)) {
            openSet.push(neighbor);
            openSetIds.add(neighbor.id);
          }
        }
      }
    }

    return targetPos;
  }
}
