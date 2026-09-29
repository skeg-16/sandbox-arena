/**
 * MapConfigs.js
 * Data-driven battleground map definitions for 3D terrain, lighting moods,
 * destructible fortification layouts, deployment zones, and siege objectives.
 */

export const SCENARIO_TYPES = {
  SIEGE: {
    id: 'SIEGE',
    name: 'Castle Siege (Attack / Defend)',
    desc: 'Attackers must breach the gate and destroy the Keep before time runs out. Defenders hold the fortress!'
  },
  CAPTURE_POINTS: {
    id: 'CAPTURE_POINTS',
    name: 'Capture Points',
    desc: 'Contest key towers and outposts across the map. Hold the most points to achieve victory!'
  },
  DESTROY_KEEP: {
    id: 'DESTROY_KEEP',
    name: 'Destroy the Keep',
    desc: 'Barge through fortifications to demolish the enemy central fortress keep!'
  },
  ELIMINATION: {
    id: 'ELIMINATION',
    name: 'Classic Elimination',
    desc: 'Total war. The last surviving army standing claims dominion over the realm.'
  }
};

export const BATTLEGROUND_MAPS = {
  castle_siege_plains: {
    id: 'castle_siege_plains',
    name: 'Castle Siege Plains',
    subtitle: 'Rolling Hills & Defender Citadel',
    desc: 'Expansive verdant plains sloping upward into an imposing stone fortress perched upon high ground.',
    defaultScenario: 'SIEGE',
    timeLimit: 180, // 3 minutes
    skyColor: 0x1e293b,
    ambientColor: 0x64748b,
    sunColor: 0xffedd5,
    sunPosition: { x: 35, y: 55, z: 25 },
    fogColor: 0x0f172a,
    fogDensity: 0.007,
    ambientIntensity: 0.75,
    sunIntensity: 1.5,
    waterPlane: { enabled: false },
    deploymentZones: {
      enforced: true,
      blue: { minX: -50, maxX: -10, minZ: -36, maxZ: 36, label: 'Attacker Staging Grounds' },
      red: { minX: 10, maxX: 48, minZ: -36, maxZ: 36, label: 'Defender Citadel Grounds' }
    },
    // Analytical 3D heightmap function
    getHeight: (x, z) => {
      // Gentle rolling plains across western field
      let h = Math.sin(x * 0.08) * 0.9 + Math.cos(z * 0.07) * 0.8;
      // High elevated plateau for fortress on east side (x > 8)
      if (x > 8) {
        const rampFactor = Math.min(1.0, (x - 8) / 10);
        h += rampFactor * 3.4;
      }
      // Edge rim berms to prevent sliding out
      const distFromCenter = Math.sqrt(x * x + z * z);
      if (distFromCenter > 46) {
        h += (distFromCenter - 46) * 0.35;
      }
      return h;
    },
    // Pre-laid fortress layout
    defaultCamera: {
      target: { x: 4, y: 1.8, z: 0 },
      spherical: { radius: 50, phi: Math.PI / 3.4, theta: -Math.PI * 0.28 }
    },
    defaultStructures: [
      // Central Keep
      { id: 'keep_main', type: 'keep', teamId: 'red', position: { x: 34, y: 3.4, z: 0 }, rotationY: 0 },
      // Flanking Watchtowers
      { id: 'tower_north', type: 'watchtower', teamId: 'red', position: { x: 14, y: 2.2, z: -15 }, rotationY: 0 },
      { id: 'tower_south', type: 'watchtower', teamId: 'red', position: { x: 14, y: 2.2, z: 15 }, rotationY: 0 },
      // Gatehouse blocking central path
      { id: 'gatehouse_main', type: 'gatehouse', teamId: 'red', position: { x: 14, y: 2.2, z: 0 }, rotationY: 0 },
      // Castle Wall segments connecting towers to gatehouse
      { id: 'wall_north', type: 'wall_segment', teamId: 'red', position: { x: 14, y: 2.2, z: -7.5 }, rotationY: 0 },
      { id: 'wall_south', type: 'wall_segment', teamId: 'red', position: { x: 14, y: 2.2, z: 7.5 }, rotationY: 0 },
      { id: 'wall_flank_n', type: 'wall_segment', teamId: 'red', position: { x: 14, y: 2.2, z: -22.5 }, rotationY: 0 },
      { id: 'wall_flank_s', type: 'wall_segment', teamId: 'red', position: { x: 14, y: 2.2, z: 22.5 }, rotationY: 0 },
      // Outer wooden palisades / barricades
      { id: 'palisade_1', type: 'palisade', teamId: 'red', position: { x: 0, y: 0.4, z: -12 }, rotationY: 0.15 },
      { id: 'palisade_2', type: 'palisade', teamId: 'red', position: { x: 0, y: 0.4, z: 12 }, rotationY: -0.15 }
    ],
    capturePoints: [],
    treeSpawns: [
      { x: -32, z: -20 }, { x: -28, z: -24 }, { x: -35, z: 18 }, { x: -30, z: 22 },
      { x: -16, z: -26 }, { x: -18, z: 28 }, { x: -8, z: -28 }, { x: -7, z: 30 }
    ]
  },

  mountain_pass: {
    id: 'mountain_pass',
    name: 'Mountain Pass',
    subtitle: 'Narrow Chokepoint & Cliff Bastion',
    desc: 'Towering jagged granite cliffs flanking a perilous canyon gorge, sealed by a massive fortified iron-clad gate.',
    defaultScenario: 'SIEGE',
    timeLimit: 150,
    skyColor: 0x0f172a,
    ambientColor: 0x475569,
    sunColor: 0xfef08a,
    sunPosition: { x: 10, y: 65, z: 15 },
    fogColor: 0x1e293b,
    fogDensity: 0.012,
    ambientIntensity: 0.65,
    sunIntensity: 1.6,
    waterPlane: { enabled: false },
    deploymentZones: {
      enforced: true,
      blue: { minX: -48, maxX: -8, minZ: -8.5, maxZ: 8.5, label: 'Canyon Approach (Attackers)' },
      red: { minX: 8, maxX: 48, minZ: -8.5, maxZ: 8.5, label: 'Fortified Valley (Defenders)' }
    },
    // Optimal camera orientation: looking directly down the canyon gorge from the approach
    defaultCamera: {
      target: { x: -4, y: 1.8, z: 0 },
      spherical: { radius: 44, phi: Math.PI / 3.7, theta: -Math.PI * 0.5 }
    },
    getHeight: (x, z) => {
      // Narrow central canyon floor (|z| < 9 is walkable)
      const absZ = Math.abs(z);
      let h = (Math.sin(x * 0.1) + Math.cos(z * 0.2)) * 0.3;
      if (absZ > 9) {
        // Soaring sheer mountain cliffs on both sides
        const cliffDist = absZ - 9;
        h += Math.min(16.0, cliffDist * cliffDist * 0.22 + cliffDist * 1.2);
        h += Math.sin(x * 0.3 + z * 0.4) * 1.2; // Jagged crags
      }
      return h;
    },
    defaultStructures: [
      // Central Gatehouse blocking the entire canyon pass
      { id: 'pass_gate', type: 'gatehouse', teamId: 'red', position: { x: 0, y: 0.2, z: 0 }, rotationY: 0 },
      // Flanking Watchtowers perched right next to the cliffs
      { id: 'pass_tower_n', type: 'watchtower', teamId: 'red', position: { x: 0, y: 0.6, z: -8 }, rotationY: 0 },
      { id: 'pass_tower_s', type: 'watchtower', teamId: 'red', position: { x: 0, y: 0.6, z: 8 }, rotationY: 0 },
      // Inner Red Keep at the rear of the pass
      { id: 'pass_keep', type: 'keep', teamId: 'red', position: { x: 30, y: 0.3, z: 0 }, rotationY: 0 },
      // Outer Barricades
      { id: 'pass_palisade_1', type: 'palisade', teamId: 'red', position: { x: -14, y: 0.1, z: -3 }, rotationY: 0 },
      { id: 'pass_palisade_2', type: 'palisade', teamId: 'red', position: { x: -14, y: 0.1, z: 3 }, rotationY: 0 }
    ],
    capturePoints: [],
    treeSpawns: [
      { x: -30, z: -7 }, { x: -34, z: 7 }, { x: -22, z: -8 }, { x: -20, z: 8 },
      { x: 18, z: -7 }, { x: 22, z: 7 }, { x: 28, z: -8 }, { x: 35, z: 7 }
    ]
  },

  river_crossing: {
    id: 'river_crossing',
    name: 'River Crossing',
    subtitle: 'Divided River & Contested Bridges',
    desc: 'A rushing river cuts through the battlefield. Units must contest two fortified wooden bridges or risk wading through treacherous waters.',
    defaultScenario: 'CAPTURE_POINTS',
    timeLimit: 200,
    skyColor: 0x1e3a5f,
    ambientColor: 0x94a3b8,
    sunColor: 0xffedd5,
    sunPosition: { x: -20, y: 50, z: 35 },
    fogColor: 0x334155,
    fogDensity: 0.008,
    ambientIntensity: 0.8,
    sunIntensity: 1.4,
    waterPlane: { enabled: true, level: 0.2, color: 0x0284c7, deepThreshold: 1.2 },
    deploymentZones: {
      enforced: true,
      blue: { minX: -48, maxX: -14, minZ: -36, maxZ: 36, label: 'West Riverbank (House Blue)' },
      red: { minX: 14, maxX: 48, minZ: -36, maxZ: 36, label: 'East Riverbank (House Red)' }
    },
    defaultCamera: {
      target: { x: 0, y: 1.5, z: 0 },
      spherical: { radius: 52, phi: Math.PI / 3.4, theta: -Math.PI * 0.25 }
    },
    getHeight: (x, z) => {
      const absX = Math.abs(x);
      let h = 2.0 + Math.sin(x * 0.06) * 0.5 + Math.cos(z * 0.08) * 0.5;
      // River trench depression along X in [-9, 9]
      if (absX < 9) {
        const riverTrench = (1 - absX / 9);
        h -= riverTrench * 3.6; // drops down to y = -1.6
      }
      return h;
    },
    defaultStructures: [
      // North Wooden Bridge spanning over river at z = -14
      { id: 'bridge_north', type: 'bridge', teamId: 'neutral', position: { x: 0, y: 1.8, z: -14 }, rotationY: Math.PI / 2 },
      // South Wooden Bridge spanning over river at z = 14
      { id: 'bridge_south', type: 'bridge', teamId: 'neutral', position: { x: 0, y: 1.8, z: 14 }, rotationY: Math.PI / 2 },
      // Watchtowers defending bridgeheads on West Bank
      { id: 'tower_w_north', type: 'watchtower', teamId: 'blue', position: { x: -13, y: 1.9, z: -14 }, rotationY: 0 },
      { id: 'tower_w_south', type: 'watchtower', teamId: 'blue', position: { x: -13, y: 1.9, z: 14 }, rotationY: 0 },
      // Watchtowers defending bridgeheads on East Bank
      { id: 'tower_e_north', type: 'watchtower', teamId: 'red', position: { x: 13, y: 1.9, z: -14 }, rotationY: 0 },
      { id: 'tower_e_south', type: 'watchtower', teamId: 'red', position: { x: 13, y: 1.9, z: 14 }, rotationY: 0 },
      // Bridgehead barricades
      { id: 'barricade_w_n', type: 'palisade', teamId: 'blue', position: { x: -9, y: 1.8, z: -14 }, rotationY: 0 },
      { id: 'barricade_e_n', type: 'palisade', teamId: 'red', position: { x: 9, y: 1.8, z: -14 }, rotationY: 0 },
      { id: 'barricade_w_s', type: 'palisade', teamId: 'blue', position: { x: -9, y: 1.8, z: 14 }, rotationY: 0 },
      { id: 'barricade_e_s', type: 'palisade', teamId: 'red', position: { x: 9, y: 1.8, z: 14 }, rotationY: 0 }
    ],
    // 3 Capture points: North Bridge, South Bridge, Central Island Shoal
    capturePoints: [
      { id: 'flag_north_bridge', name: 'North Bridge', position: { x: 0, y: 2.1, z: -14 }, radius: 6.0, initialOwner: 'neutral' },
      { id: 'flag_center_crossing', name: 'River Ford', position: { x: 0, y: 0.1, z: 0 }, radius: 6.5, initialOwner: 'neutral' },
      { id: 'flag_south_bridge', name: 'South Bridge', position: { x: 0, y: 2.1, z: 14 }, radius: 6.0, initialOwner: 'neutral' }
    ],
    treeSpawns: [
      { x: -32, z: -25 }, { x: -28, z: -18 }, { x: -35, z: 22 }, { x: -24, z: 30 },
      { x: 30, z: -22 }, { x: 36, z: -16 }, { x: 26, z: 24 }, { x: 34, z: 28 }
    ]
  },

  highland_outposts: {
    id: 'highland_outposts',
    name: 'Highland Outposts',
    subtitle: 'Rolling Knolls & Contested Forts',
    desc: 'Sprawling windswept highland mounds dotted with ancient stone fortifications. Armies battle for strategic hill supremacy.',
    defaultScenario: 'CAPTURE_POINTS',
    timeLimit: 220,
    skyColor: 0x312e81,
    ambientColor: 0x818cf8,
    sunColor: 0xfef08a,
    sunPosition: { x: 40, y: 60, z: -30 },
    fogColor: 0x1e1b4b,
    fogDensity: 0.006,
    ambientIntensity: 0.85,
    sunIntensity: 1.5,
    waterPlane: { enabled: false },
    deploymentZones: {
      enforced: true,
      blue: { minX: -50, maxX: -18, minZ: -36, maxZ: 36, label: 'West Highland Camp (Blue)' },
      red: { minX: 18, maxX: 50, minZ: -36, maxZ: 36, label: 'East Highland Camp (Red)' }
    },
    defaultCamera: {
      target: { x: 0, y: 3.5, z: 0 },
      spherical: { radius: 56, phi: Math.PI / 3.5, theta: -Math.PI * 0.25 }
    },
    getHeight: (x, z) => {
      // 4 prominent rounded knolls/hills
      const hillNW = Math.max(0, 1 - Math.hypot(x - -20, z - -18) / 16) * 4.8;
      const hillSW = Math.max(0, 1 - Math.hypot(x - -20, z - 18) / 16) * 4.8;
      const hillNE = Math.max(0, 1 - Math.hypot(x - 20, z - -18) / 16) * 4.8;
      const hillSE = Math.max(0, 1 - Math.hypot(x - 20, z - 18) / 16) * 4.8;
      const centerSaddle = Math.max(0, 1 - Math.hypot(x, z) / 14) * 2.2;
      const ambientUndulation = Math.sin(x * 0.09) * 0.7 + Math.cos(z * 0.09) * 0.7;
      return hillNW + hillSW + hillNE + hillSE + centerSaddle + ambientUndulation;
    },
    defaultStructures: [
      // 4 Hilltop Outposts with Watchtowers
      { id: 'tower_nw', type: 'watchtower', teamId: 'blue', position: { x: -20, y: 5.2, z: -18 }, rotationY: 0 },
      { id: 'tower_sw', type: 'watchtower', teamId: 'blue', position: { x: -20, y: 5.2, z: 18 }, rotationY: 0 },
      { id: 'tower_ne', type: 'watchtower', teamId: 'red', position: { x: 20, y: 5.2, z: -18 }, rotationY: 0 },
      { id: 'tower_se', type: 'watchtower', teamId: 'red', position: { x: 20, y: 5.2, z: 18 }, rotationY: 0 },
      // Palisade rings around north/south outposts
      { id: 'palisade_nw', type: 'palisade', teamId: 'blue', position: { x: -16, y: 4.8, z: -18 }, rotationY: 0 },
      { id: 'palisade_ne', type: 'palisade', teamId: 'red', position: { x: 16, y: 4.8, z: -18 }, rotationY: 0 },
      { id: 'palisade_sw', type: 'palisade', teamId: 'blue', position: { x: -16, y: 4.8, z: 18 }, rotationY: 0 },
      { id: 'palisade_se', type: 'palisade', teamId: 'red', position: { x: 16, y: 4.8, z: 18 }, rotationY: 0 }
    ],
    // 4 Capture Points corresponding to the 4 hilltops
    capturePoints: [
      { id: 'flag_nw', name: 'Northwest Bastion', position: { x: -20, y: 5.4, z: -18 }, radius: 7.0, initialOwner: 'blue' },
      { id: 'flag_sw', name: 'Southwest Bastion', position: { x: -20, y: 5.4, z: 18 }, radius: 7.0, initialOwner: 'blue' },
      { id: 'flag_ne', name: 'Northeast Bastion', position: { x: 20, y: 5.4, z: -18 }, radius: 7.0, initialOwner: 'red' },
      { id: 'flag_se', name: 'Southeast Bastion', position: { x: 20, y: 5.4, z: 18 }, radius: 7.0, initialOwner: 'red' }
    ],
    treeSpawns: [
      { x: -5, z: -12 }, { x: 5, z: 12 }, { x: 0, z: -25 }, { x: 0, z: 25 },
      { x: -35, z: 0 }, { x: 35, z: 0 }, { x: -8, z: 8 }, { x: 8, z: -8 }
    ]
  }
};
