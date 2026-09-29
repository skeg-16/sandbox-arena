export const PRESET_SCENARIOS = [
  // ═══════════════════════════════════════════════════════════════
  // 1. MYTHIC BOSS FIGHTS & DEITY DUELS
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'zeus_vs_ares',
    name: 'Zeus vs Ares: Clash of the Gods',
    category: 'boss',
    desc: 'Olympus supreme storm lord Zeus confronts war incarnation Ares in an apocalyptic 1v1 duel',
    icon: 'Zap',
    badge: 'GOD DUEL',
    generate: () => {
      return [
        { unitTypeId: 'zeus', teamId: 'blue', position: { x: -16, y: 0, z: 0 } },
        { unitTypeId: 'ares', teamId: 'red', position: { x: 16, y: 0, z: 0 } }
      ];
    }
  },
  {
    id: 'mortals_vs_zeus',
    name: '60 Mortals vs Zeus',
    category: 'boss',
    desc: 'Can a legion of 60 swordsmen, spearmen, archers & cavalry overwhelm the Lord of Thunder?',
    icon: 'Crown',
    badge: 'RAID BOSS',
    generate: () => {
      const units = [];
      // Boss Zeus on Red
      units.push({ unitTypeId: 'zeus', teamId: 'red', position: { x: 22, y: 0, z: 0 } });

      // 60 Mortals on Blue in ranks
      const mortalTypes = ['swordsman', 'spearman', 'archer', 'shield_bearer', 'cavalry'];
      for (let i = 0; i < 60; i++) {
        const row = Math.floor(i / 10);
        const col = (i % 10) - 4.5;
        const type = mortalTypes[i % mortalTypes.length];
        units.push({
          unitTypeId: type,
          teamId: 'blue',
          position: { x: -10 - row * 3.0, y: 0, z: col * 2.8 }
        });
      }
      return units;
    }
  },
  {
    id: 'titanomachy',
    name: 'Titanomachy: War of the Gods',
    category: 'boss',
    desc: 'Zeus & Poseidon join forces against Ares & Hades backed by vanguard legions',
    icon: 'Swords',
    badge: '4 DEITIES',
    generate: () => {
      const units = [];
      // Blue Gods: Zeus & Poseidon
      units.push({ unitTypeId: 'zeus', teamId: 'blue', position: { x: -22, y: 0, z: -6 } });
      units.push({ unitTypeId: 'poseidon', teamId: 'blue', position: { x: -22, y: 0, z: 6 } });

      // Blue Guard: Paladins, Cavalry, Archers
      for (let i = 0; i < 16; i++) {
        const type = i < 6 ? 'paladin' : (i < 11 ? 'cavalry' : 'archer');
        units.push({
          unitTypeId: type,
          teamId: 'blue',
          position: { x: -14 - Math.floor(i / 4) * 3, y: 0, z: ((i % 4) - 1.5) * 4 }
        });
      }

      // Red Gods: Ares & Hades
      units.push({ unitTypeId: 'ares', teamId: 'red', position: { x: 22, y: 0, z: -6 } });
      units.push({ unitTypeId: 'hades', teamId: 'red', position: { x: 22, y: 0, z: 6 } });

      // Red Guard: Berserkers, Samurai, Necromancers
      for (let i = 0; i < 16; i++) {
        const type = i < 6 ? 'berserker' : (i < 11 ? 'samurai' : 'necromancer');
        units.push({
          unitTypeId: type,
          teamId: 'red',
          position: { x: 14 + Math.floor(i / 4) * 3, y: 0, z: ((i % 4) - 1.5) * 4 }
        });
      }
      return units;
    }
  },
  {
    id: 'hades_underworld_siege',
    name: 'Hades: Underworld Soul Harvest',
    category: 'boss',
    desc: 'Hades summons dark horrors against a holy crusade of Paladins & Shield Bearers',
    icon: 'Ghost',
    badge: 'BOSS SIEGE',
    generate: () => {
      const units = [];
      // Boss Hades on Red
      units.push({ unitTypeId: 'hades', teamId: 'red', position: { x: 24, y: 0, z: 0 } });

      // Hades dark host
      for (let i = 0; i < 16; i++) {
        const type = i < 4 ? 'necromancer' : (i < 8 ? 'frost_witch' : 'berserker');
        units.push({
          unitTypeId: type,
          teamId: 'red',
          position: { x: 16 + Math.floor(i / 4) * 3, y: 0, z: ((i % 4) - 1.5) * 4.5 }
        });
      }

      // Holy Crusade on Blue
      for (let i = 0; i < 20; i++) {
        const type = i < 6 ? 'paladin' : (i < 12 ? 'shield_bearer' : 'mage');
        units.push({
          unitTypeId: type,
          teamId: 'blue',
          position: { x: -14 - Math.floor(i / 5) * 3.5, y: 0, z: ((i % 5) - 2) * 3.5 }
        });
      }
      return units;
    }
  },
  {
    id: 'ares_blood_arena',
    name: "Ares: Blood God's Arena",
    category: 'boss',
    desc: 'Ares takes on 2 towering Giants, 4 Golems, and an elite battalion of Monks & Berserkers',
    icon: 'Crown',
    badge: 'SURVIVAL',
    generate: () => {
      const units = [];
      // Boss Ares on Red
      units.push({ unitTypeId: 'ares', teamId: 'red', position: { x: 18, y: 0, z: 0 } });

      // Blue Monsters & Elite Warriors
      units.push({ unitTypeId: 'giant', teamId: 'blue', position: { x: -16, y: 0, z: -5 } });
      units.push({ unitTypeId: 'giant', teamId: 'blue', position: { x: -16, y: 0, z: 5 } });

      for (let i = 0; i < 4; i++) {
        units.push({
          unitTypeId: 'golem',
          teamId: 'blue',
          position: { x: -10, y: 0, z: (i - 1.5) * 4 }
        });
      }

      for (let i = 0; i < 12; i++) {
        const type = i % 2 === 0 ? 'berserker' : 'monk';
        units.push({
          unitTypeId: type,
          teamId: 'blue',
          position: { x: -6 - Math.floor(i / 4) * 3, y: 0, z: ((i % 4) - 1.5) * 3.5 }
        });
      }
      return units;
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // 2. CLASSIC BATTLE FORMATIONS
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'david_vs_goliath',
    name: 'David vs Goliath',
    category: 'classic',
    desc: '1 Massive Team Red Giant vs 20 Team Blue Swordsmen',
    icon: 'Crown',
    generate: () => {
      const units = [];
      units.push({ unitTypeId: 'giant', teamId: 'red', position: { x: 18, y: 0, z: 0 } });

      for (let i = 0; i < 20; i++) {
        const row = Math.floor(i / 5);
        const col = (i % 5) - 2;
        units.push({
          unitTypeId: 'swordsman',
          teamId: 'blue',
          position: { x: -16 - row * 3, y: 0, z: col * 3 }
        });
      }
      return units;
    }
  },
  {
    id: 'cavalry_charge',
    name: 'Cavalry Charge',
    category: 'classic',
    desc: '6 Heavy Cavalry Chargers vs 14 Shield Bearer Front-Liners',
    icon: 'Zap',
    generate: () => {
      const units = [];
      for (let i = 0; i < 6; i++) {
        units.push({
          unitTypeId: 'cavalry',
          teamId: 'blue',
          position: { x: -22, y: 0, z: (i - 2.5) * 4 }
        });
      }
      for (let i = 0; i < 14; i++) {
        const col = (i % 7) - 3;
        const row = Math.floor(i / 7);
        units.push({
          unitTypeId: 'shield_bearer',
          teamId: 'red',
          position: { x: 12 + row * 3, y: 0, z: col * 2.8 }
        });
      }
      return units;
    }
  },
  {
    id: 'siege_and_magic',
    name: 'Siege & Magic Bombardment',
    category: 'classic',
    desc: '2 Siege Catapults & 4 Mages vs 25 Spearman Rush',
    icon: 'Sparkles',
    generate: () => {
      const units = [];
      units.push({ unitTypeId: 'catapult', teamId: 'red', position: { x: 28, y: 0, z: -8 } });
      units.push({ unitTypeId: 'catapult', teamId: 'red', position: { x: 28, y: 0, z: 8 } });

      for (let i = 0; i < 4; i++) {
        units.push({
          unitTypeId: 'mage',
          teamId: 'red',
          position: { x: 20, y: 0, z: (i - 1.5) * 6 }
        });
      }

      for (let i = 0; i < 25; i++) {
        const row = Math.floor(i / 5);
        const col = (i % 5) - 2;
        units.push({
          unitTypeId: 'spearman',
          teamId: 'blue',
          position: { x: -12 - row * 3.5, y: 0, z: col * 3.2 }
        });
      }
      return units;
    }
  },
  {
    id: 'grand_royale',
    name: 'Grand 60-Unit Battle Royale',
    category: 'classic',
    desc: '30 vs 30 Full Mixed Fantasy Armies',
    icon: 'Swords',
    generate: () => {
      const units = [];
      const types = ['swordsman', 'spearman', 'archer', 'mage', 'shield_bearer', 'cavalry'];

      for (let i = 0; i < 30; i++) {
        const type = types[i % types.length];
        const row = Math.floor(i / 6);
        const col = (i % 6) - 2.5;
        units.push({
          unitTypeId: type,
          teamId: 'blue',
          position: { x: -14 - row * 3.5, y: 0, z: col * 3.5 }
        });
      }

      for (let i = 0; i < 30; i++) {
        const type = types[i % types.length];
        const row = Math.floor(i / 6);
        const col = (i % 6) - 2.5;
        units.push({
          unitTypeId: type,
          teamId: 'red',
          position: { x: 14 + row * 3.5, y: 0, z: col * 3.5 }
        });
      }
      return units;
    }
  }
];
