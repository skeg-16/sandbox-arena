export const CAMPAIGN_LEVELS = [
  {
    level: 1,
    title: 'Level 1: Peasant Skirmish',
    desc: 'Defeat the invading 6 Spearmen using your tactical budget',
    budget: 600,
    enemies: [
      { unitTypeId: 'spearman', position: { x: 12, y: 0, z: -6 } },
      { unitTypeId: 'spearman', position: { x: 12, y: 0, z: -2 } },
      { unitTypeId: 'spearman', position: { x: 12, y: 0, z: 2 } },
      { unitTypeId: 'spearman', position: { x: 12, y: 0, z: 6 } },
      { unitTypeId: 'spearman', position: { x: 16, y: 0, z: -3 } },
      { unitTypeId: 'spearman', position: { x: 16, y: 0, z: 3 } }
    ]
  },
  {
    level: 2,
    title: 'Level 2: The Shield Wall',
    desc: 'Break through 4 heavy Shield Bearers backed by 2 Archers',
    budget: 900,
    enemies: [
      { unitTypeId: 'shield_bearer', position: { x: 12, y: 0, z: -6 } },
      { unitTypeId: 'shield_bearer', position: { x: 12, y: 0, z: -2 } },
      { unitTypeId: 'shield_bearer', position: { x: 12, y: 0, z: 2 } },
      { unitTypeId: 'shield_bearer', position: { x: 12, y: 0, z: 6 } },
      { unitTypeId: 'archer', position: { x: 20, y: 0, z: -4 } },
      { unitTypeId: 'archer', position: { x: 20, y: 0, z: 4 } }
    ]
  },
  {
    level: 3,
    title: 'Level 3: Archers in the Woods',
    desc: 'Survive the volley of 8 deadly Archers protected by Spearmen',
    budget: 1200,
    enemies: [
      { unitTypeId: 'spearman', position: { x: 10, y: 0, z: -5 } },
      { unitTypeId: 'spearman', position: { x: 10, y: 0, z: 5 } },
      { unitTypeId: 'archer', position: { x: 18, y: 0, z: -9 } },
      { unitTypeId: 'archer', position: { x: 18, y: 0, z: -6 } },
      { unitTypeId: 'archer', position: { x: 18, y: 0, z: -3 } },
      { unitTypeId: 'archer', position: { x: 18, y: 0, z: 0 } },
      { unitTypeId: 'archer', position: { x: 18, y: 0, z: 3 } },
      { unitTypeId: 'archer', position: { x: 18, y: 0, z: 6 } },
      { unitTypeId: 'archer', position: { x: 18, y: 0, z: 9 } }
    ]
  },
  {
    level: 4,
    title: 'Level 4: Cavalry Stampede',
    desc: 'Halt the charging momentum of 4 Mounted Cavalry Chargers',
    budget: 1400,
    enemies: [
      { unitTypeId: 'cavalry', position: { x: 18, y: 0, z: -9 } },
      { unitTypeId: 'cavalry', position: { x: 18, y: 0, z: -3 } },
      { unitTypeId: 'cavalry', position: { x: 18, y: 0, z: 3 } },
      { unitTypeId: 'cavalry', position: { x: 18, y: 0, z: 9 } }
    ]
  },
  {
    level: 5,
    title: 'Level 5: Wizard Apprentice',
    desc: 'Survive explosive fireballs from 3 Mages and 6 Swordsmen',
    budget: 1600,
    enemies: [
      { unitTypeId: 'swordsman', position: { x: 10, y: 0, z: -7 } },
      { unitTypeId: 'swordsman', position: { x: 10, y: 0, z: -3 } },
      { unitTypeId: 'swordsman', position: { x: 10, y: 0, z: 0 } },
      { unitTypeId: 'swordsman', position: { x: 10, y: 0, z: 3 } },
      { unitTypeId: 'swordsman', position: { x: 10, y: 0, z: 7 } },
      { unitTypeId: 'mage', position: { x: 20, y: 0, z: -6 } },
      { unitTypeId: 'mage', position: { x: 20, y: 0, z: 0 } },
      { unitTypeId: 'mage', position: { x: 20, y: 0, z: 6 } }
    ]
  },
  {
    level: 6,
    title: 'Level 6: Giant Awakening',
    desc: 'Overthrow a massive Team Red Giant supported by spearmen',
    budget: 1800,
    enemies: [
      { unitTypeId: 'giant', position: { x: 18, y: 0, z: 0 } },
      { unitTypeId: 'spearman', position: { x: 12, y: 0, z: -6 } },
      { unitTypeId: 'spearman', position: { x: 12, y: 0, z: 6 } }
    ]
  },
  {
    level: 7,
    title: 'Level 7: Siege Engine Assault',
    desc: 'Destroy 2 Siege Catapults before they obliterate your army',
    budget: 2200,
    enemies: [
      { unitTypeId: 'catapult', position: { x: 25, y: 0, z: -8 } },
      { unitTypeId: 'catapult', position: { x: 25, y: 0, z: 8 } },
      { unitTypeId: 'shield_bearer', position: { x: 12, y: 0, z: -4 } },
      { unitTypeId: 'shield_bearer', position: { x: 12, y: 0, z: 0 } },
      { unitTypeId: 'shield_bearer', position: { x: 12, y: 0, z: 4 } }
    ]
  },
  {
    level: 8,
    title: 'Level 8: The Combined Horde',
    desc: 'Defeat a 20-unit mixed fantasy battalion',
    budget: 2600,
    enemies: [
      { unitTypeId: 'shield_bearer', position: { x: 12, y: 0, z: -8 } },
      { unitTypeId: 'shield_bearer', position: { x: 12, y: 0, z: -4 } },
      { unitTypeId: 'shield_bearer', position: { x: 12, y: 0, z: 0 } },
      { unitTypeId: 'shield_bearer', position: { x: 12, y: 0, z: 4 } },
      { unitTypeId: 'shield_bearer', position: { x: 12, y: 0, z: 8 } },
      { unitTypeId: 'cavalry', position: { x: 18, y: 0, z: -6 } },
      { unitTypeId: 'cavalry', position: { x: 18, y: 0, z: 6 } },
      { unitTypeId: 'mage', position: { x: 22, y: 0, z: -4 } },
      { unitTypeId: 'mage', position: { x: 22, y: 0, z: 4 } }
    ]
  },
  {
    level: 9,
    title: 'Level 9: Twin Colossi',
    desc: 'Defeat TWO massive Giants simultaneously',
    budget: 3200,
    enemies: [
      { unitTypeId: 'giant', position: { x: 18, y: 0, z: -6 } },
      { unitTypeId: 'giant', position: { x: 18, y: 0, z: 6 } },
      { unitTypeId: 'mage', position: { x: 25, y: 0, z: 0 } }
    ]
  },
  {
    level: 10,
    title: 'Level 10: The Royal Siege Citadel',
    desc: 'The Final Boss Challenge: Catapults, Giants, Cavalry & Mages!',
    budget: 4500,
    enemies: [
      { unitTypeId: 'catapult', position: { x: 28, y: 0, z: -10 } },
      { unitTypeId: 'catapult', position: { x: 28, y: 0, z: 10 } },
      { unitTypeId: 'giant', position: { x: 20, y: 0, z: 0 } },
      { unitTypeId: 'cavalry', position: { x: 16, y: 0, z: -8 } },
      { unitTypeId: 'cavalry', position: { x: 16, y: 0, z: 8 } },
      { unitTypeId: 'mage', position: { x: 22, y: 0, z: -5 } },
      { unitTypeId: 'mage', position: { x: 22, y: 0, z: 5 } }
    ]
  }
];
