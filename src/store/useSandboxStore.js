import { create } from 'zustand';

export const useSandboxStore = create((set, get) => ({
  gameMode: 'SANDBOX', // SANDBOX | CAMPAIGN
  gamePhase: 'PLACEMENT', // PLACEMENT | BATTLE | PAUSED | VICTORY_BLUE | VICTORY_RED | DRAW
  activeTeam: 'blue', // blue | red
  selectedUnitType: 'swordsman',
  selectedTrait: 'none', // none | fire | iron | haste | vampire
  gameSpeed: 1.0, // 0.5 | 1.0 | 2.0
  activeEnvironment: 'plains', // plains | volcano | snow | desert
  cameraMode: 'ORBIT', // ORBIT | COMMANDER | FOLLOW | POSSESSED
  inspectedUnit: null,
  possessedUnit: null,
  isPossessing: false,
  possessionCombo: 0, // 0, 1, 2, 3
  possessionComboText: '',
  possessionUltCooldown: 0, // seconds remaining
  possessionUltMaxCooldown: 10,

  // Battleground, Siege & Terrain State
  activeMapId: 'castle_siege_plains',
  scenarioType: 'SIEGE', // SIEGE | CAPTURE_POINTS | DESTROY_KEEP | ELIMINATION
  enforceDeploymentZones: true,
  objectiveHUD: null,

  // Graphics Quality Preset & Performance Budget (Auto-detect mobile for 60 FPS performance)
  graphicsQuality: (typeof window !== 'undefined' && (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || (window.innerWidth < 768 && ('ontouchstart' in window || navigator.maxTouchPoints > 0)))) ? 'MEDIUM' : 'HIGH',
  fpsWarning: false,

  // Multi-Deploy Formation Stamp Mode
  formationMode: 'SINGLE', // SINGLE | LINE_3 | WALL_5

  // Post-Battle Accolades & MVP
  battleAwards: null,

  // Campaign State
  currentLevelIndex: 0,
  campaignGoldBudget: 1000,
  remainingGold: 1000,

  blueCount: 0,
  redCount: 0,
  blueInitialCount: 0,
  redInitialCount: 0,
  totalUnitsPlaced: 0,
  unitCapWarning: false,

  setGameMode: (mode) => set({ gameMode: mode }),
  setGamePhase: (phase) => set({ gamePhase: phase }),
  setActiveTeam: (teamId) => set({ activeTeam: teamId }),
  setSelectedUnitType: (unitTypeId) => set({ selectedUnitType: unitTypeId }),
  setSelectedTrait: (traitId) => set({ selectedTrait: traitId }),
  setFormationMode: (mode) => set({ formationMode: mode }),
  setBattleAwards: (awards) => set({ battleAwards: awards }),
  setGameSpeed: (speed) => set({ gameSpeed: speed }),
  setEnvironment: (envId) => set({ activeEnvironment: envId }),
  setCameraMode: (mode) => set({ cameraMode: mode }),
  setInspectedUnit: (unit) => set({ inspectedUnit: unit }),
  setMapId: (mapId) => set({ activeMapId: mapId }),
  setScenarioType: (scenario) => set({ scenarioType: scenario }),
  setEnforceDeploymentZones: (enforce) => set({ enforceDeploymentZones: enforce }),
  setObjectiveHUD: (data) => set({ objectiveHUD: data }),
  setGraphicsQuality: (quality) => set({ graphicsQuality: quality }),
  setFpsWarning: (warn) => set({ fpsWarning: warn }),

  setPossessedUnit: (unit) =>
    set({
      possessedUnit: unit,
      isPossessing: !!unit,
      cameraMode: unit ? 'POSSESSED' : 'ORBIT',
      possessionCombo: 0,
      possessionComboText: '',
      possessionUltCooldown: unit ? (unit.ultimateCooldown || 0) : 0,
      possessionUltMaxCooldown: unit ? (unit.maxUltimateCooldown || 10) : 10
    }),

  setPossessionCombo: (combo, text) =>
    set({ possessionCombo: combo, possessionComboText: text }),

  setPossessionUltCooldown: (cd, maxCd) =>
    set({ possessionUltCooldown: cd, ...(maxCd !== undefined ? { possessionUltMaxCooldown: maxCd } : {}) }),

  initCampaignLevel: (levelIndex, budget) =>
    set({
      gameMode: 'CAMPAIGN',
      currentLevelIndex: levelIndex,
      campaignGoldBudget: budget,
      remainingGold: budget,
      activeTeam: 'blue',
      gamePhase: 'PLACEMENT'
    }),

  deductGold: (amount) =>
    set((state) => ({ remainingGold: Math.max(0, state.remainingGold - amount) })),

  refundGold: (amount) =>
    set((state) => ({ remainingGold: Math.min(state.campaignGoldBudget, state.remainingGold + amount) })),

  updateCounts: (blue, red, isInitial = false) =>
    set((state) => {
      const total = blue + red;
      return {
        blueCount: blue,
        redCount: red,
        totalUnitsPlaced: total,
        unitCapWarning: total >= 100,
        ...(isInitial ? { blueInitialCount: blue, redInitialCount: red } : {})
      };
    }),

  resetStore: () => set((state) => ({
    gamePhase: 'PLACEMENT',
    inspectedUnit: null,
    possessedUnit: null,
    isPossessing: false,
    cameraMode: 'ORBIT',
    blueCount: 0,
    redCount: 0,
    blueInitialCount: 0,
    redInitialCount: 0,
    totalUnitsPlaced: 0,
    unitCapWarning: false,
    battleAwards: null,
    remainingGold: state.campaignGoldBudget
  }))
}));
