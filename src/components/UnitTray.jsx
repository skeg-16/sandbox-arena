import React, { useState, useEffect, useMemo } from 'react';
import { useSandboxStore } from '../store/useSandboxStore';
import { UNIT_TYPES, TEAMS } from '../sandbox/UnitConfig';
import { UNIT_TRAITS } from '../sandbox/UnitTraits';
import { soundSystem } from '../sandbox/SoundSystem';
import { sandboxEngine } from '../sandbox/SandboxEngine';
import { Unit3DPreview } from './Unit3DPreview';
import {
  Swords,
  Maximize2,
  Target,
  Sparkles,
  Shield,
  ShieldAlert,
  Zap,
  Crown,
  Disc,
  Flame,
  Coins,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Layers,
  Crosshair,
  Award,
  Wind,
  Ghost,
  Compass,
  Waves,
  Unlock,
  Lock,
  Trash2,
  X,
  Heart,
  Activity,
  FlameKindling,
  Play
} from 'lucide-react';

const ICON_MAP = {
  Swords,
  Maximize2,
  Target,
  Sparkles,
  Shield,
  Zap,
  Crown,
  Disc,
  Flame,
  Crosshair,
  Award,
  Wind,
  Ghost,
  Compass,
  Waves
};

const TRAIT_ICONS = {
  Shield,
  Flame,
  ShieldAlert,
  Zap,
  Sparkles
};

// Rarity color indicators
const getRarityInfo = (cost) => {
  if (cost >= 800) return { border: 'rgba(239, 68, 68, 0.85)', bg: 'rgba(220, 38, 38, 0.25)', glow: '#ef4444', label: 'Mythic Deity' };
  if (cost >= 400) return { border: 'rgba(245, 208, 110, 0.7)', bg: 'rgba(201, 168, 76, 0.15)', glow: '#f5d06e', label: 'Legendary' };
  if (cost >= 250) return { border: 'rgba(168, 85, 247, 0.6)', bg: 'rgba(168, 85, 247, 0.15)', glow: '#a855f7', label: 'Epic' };
  if (cost >= 150) return { border: 'rgba(59, 130, 246, 0.5)', bg: 'rgba(59, 130, 246, 0.15)', glow: '#3b82f6', label: 'Rare' };
  return { border: 'rgba(201, 168, 76, 0.25)', bg: 'transparent', glow: '#94a3b8', label: 'Common' };
};

const CATEGORIES = [
  { id: 'ALL', label: 'All (26)' },
  { id: 'DEITY', label: '⚡ Gods (4)', unitIds: ['zeus', 'ares', 'hades', 'poseidon'] },
  { id: 'INFANTRY', label: 'Infantry', unitIds: ['swordsman', 'spearman', 'berserker', 'samurai', 'gladiator'] },
  { id: 'MARTIAL', label: 'Martial', unitIds: ['assassin', 'monk', 'duelist', 'ninja', 'archer'] },
  { id: 'ARCANE', label: 'Arcane', unitIds: ['mage', 'paladin', 'necromancer', 'pyromancer', 'frost_witch'] },
  { id: 'HEAVY', label: 'Heavy', unitIds: ['shield_bearer', 'cavalry', 'dragon_knight', 'golem', 'giant', 'catapult', 'battering_ram'] },
  { id: 'SIEGE', label: 'Siege', unitIds: ['battering_ram', 'catapult'] }
];

export const UnitTray = () => {
  const {
    gamePhase,
    gameMode,
    isPossessing,
    activeTeam,
    selectedUnitType,
    selectedTrait,
    remainingGold,
    campaignGoldBudget,
    enforceDeploymentZones,
    formationMode,
    totalUnitsPlaced,
    blueCount,
    redCount,
    setActiveTeam,
    setSelectedUnitType,
    setSelectedTrait,
    setEnforceDeploymentZones,
    setFormationMode
  } = useSandboxStore();

  // Sidebar starts open on desktop, and closed on mobile to prevent clutter
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
  });

  const [activeCategory, setActiveCategory] = useState('ALL');
  const [isTraitMenuOpen, setIsTraitMenuOpen] = useState(false);
  const [isFormationPickerOpen, setIsFormationPickerOpen] = useState(false);

  const FORMATION_OPTIONS = [
    { id: '1', label: '1x', name: '1x Single', desc: '1 Unit' },
    { id: '3', label: '3x', name: '3x Line', desc: '3 Units' },
    { id: '5', label: '5x', name: '5x Wall', desc: '5 Units' },
    { id: '10', label: '10x', name: '10x Platoon', desc: '10 Units' },
    { id: '20', label: '20x', name: '20x Cohort', desc: '20 Units' },
    { id: '50', label: '50x', name: '50x Legion', desc: '50 Units' },
  ];

  const currentFormation = FORMATION_OPTIONS.find(f =>
    formationMode === f.id ||
    (f.id === '1' && (formationMode === 'SINGLE' || !formationMode)) ||
    (f.id === '3' && formationMode === 'LINE_3') ||
    (f.id === '5' && formationMode === 'WALL_5') ||
    (f.id === '10' && formationMode === 'PLATOON_10') ||
    (f.id === '20' && formationMode === 'BATTALION_20') ||
    (f.id === '50' && formationMode === 'LEGION_50')
  ) || FORMATION_OPTIONS[0];

  const cycleFormation = () => {
    const currentIndex = FORMATION_OPTIONS.findIndex(f => f.id === currentFormation.id);
    const nextIndex = (currentIndex + 1) % FORMATION_OPTIONS.length;
    const nextF = FORMATION_OPTIONS[nextIndex];
    setFormationMode(nextF.id);
    sandboxEngine.placementManager?.setFormation();
    soundSystem.playSwordSlash();
  };

  const selectedUnit = UNIT_TYPES[selectedUnitType] || UNIT_TYPES.swordsman;
  const currentTrait = UNIT_TRAITS[selectedTrait] || UNIT_TRAITS.none;
  const CurrentTraitIcon = TRAIT_ICONS[currentTrait.icon] || Shield;
  const SelectedIcon = ICON_MAP[selectedUnit.iconName] || Swords;
  const rarity = getRarityInfo(selectedUnit.cost);

  const handleToggleDeploymentZones = () => {
    const next = !enforceDeploymentZones;
    setEnforceDeploymentZones(next);
    if (sandboxEngine.threeScene && sandboxEngine.terrainSystem?.currentMap) {
      sandboxEngine.threeScene.updateDeploymentZones(
        sandboxEngine.terrainSystem.currentMap.deploymentZones,
        next
      );
    }
    soundSystem.playSwordSlash();
  };

  const filteredUnits = useMemo(() => {
    return Object.values(UNIT_TYPES).filter((unit) => {
      if (activeCategory === 'ALL') return true;
      const cat = CATEGORIES.find(c => c.id === activeCategory);
      return cat ? cat.unitIds.includes(unit.id) : true;
    });
  }, [activeCategory]);

  if (gamePhase !== 'PLACEMENT' || isPossessing) return null;

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* Mobile Backdrop when Forces drawer is open */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 sm:hidden pointer-events-auto"
        />
      )}

      {/* 1. LEFT SIDEBAR / CARD DRAWER */}
      <div
        className={`fixed z-30 flex flex-col transition-all duration-300 pointer-events-none ${
          isSidebarOpen
            ? 'inset-x-2 top-12 bottom-2 sm:inset-x-auto sm:left-3 sm:top-14 sm:bottom-3 sm:w-[380px] md:w-[410px]'
            : 'top-14 left-3 w-auto'
        }`}
      >
        {/* Toggle Button when Collapsed (Desktop only, mobile has it in bottom dock) */}
        {!isSidebarOpen && (
          <button
            onClick={() => {
              setIsSidebarOpen(true);
              soundSystem.playSwordSlash();
            }}
            className="pointer-events-auto fantasy-panel px-3 py-2 hidden sm:flex items-center gap-2.5 shadow-2xl border border-gold-500/50 bg-obsidian-950/95 hover:bg-obsidian-900 text-gold-300 rounded-2xl group transition-all animate-fade-in-right"
            title="Open Character Preview & Army Deck"
          >
            <div className="p-1.5 rounded-lg bg-gold-600/20 text-gold-400 group-hover:scale-110 transition-transform">
              <SelectedIcon className="w-4 h-4" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-cinzel text-xs font-bold uppercase text-gold-200">
                {selectedUnit.name}
              </span>
              <span className="text-[10px] text-parchment-400 font-crimsonText">
                Tap to inspect & change
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-gold-500 group-hover:translate-x-0.5 transition-transform ml-1" />
          </button>
        )}

        {/* Full Sidebar Card when Open */}
        {isSidebarOpen && (
          <div className="pointer-events-auto flex flex-col h-full bg-obsidian-950/95 backdrop-blur-xl border border-gold-600/40 rounded-2xl shadow-2xl overflow-hidden animate-fade-in-right">

            {/* ═══ Header: Forces Title, Team Switcher & Collapse ═══ */}
            <div className="p-3 border-b border-gold-800/30 flex items-center justify-between shrink-0 bg-obsidian-900/60">
              <div className="flex items-center gap-2">
                <Swords className="w-4 h-4 text-gold-400" />
                <span className="font-cinzel font-black text-xs uppercase tracking-widest text-gold-gradient">
                  Army Selection
                </span>
              </div>

              {/* Team Switcher Tabs */}
              <div className="flex items-center gap-1 bg-obsidian-950 p-0.5 rounded-lg border border-gold-800/30">
                <button
                  onClick={() => {
                    setActiveTeam('blue');
                    soundSystem.playSwordSlash();
                  }}
                  className={`px-2.5 py-1 rounded-md font-cinzel font-bold text-[10px] uppercase transition-all ${
                    activeTeam === 'blue'
                      ? 'bg-blue-600 text-blue-100 shadow-blue-glow border border-blue-400/50'
                      : 'text-parchment-400 hover:text-parchment-200'
                  }`}
                >
                  Blue
                </button>
                <button
                  onClick={() => {
                    setActiveTeam('red');
                    soundSystem.playSwordSlash();
                  }}
                  className={`px-2.5 py-1 rounded-md font-cinzel font-bold text-[10px] uppercase transition-all ${
                    activeTeam === 'red'
                      ? 'bg-red-600 text-red-100 shadow-red-glow border border-red-400/50'
                      : 'text-parchment-400 hover:text-parchment-200'
                  }`}
                >
                  Red
                </button>
              </div>

              {/* Collapse Button */}
              <button
                onClick={() => {
                  setIsSidebarOpen(false);
                  soundSystem.playSwordSlash();
                }}
                className="p-1 rounded-lg text-parchment-400 hover:text-gold-300 hover:bg-obsidian-800 transition-colors"
                title="Collapse Sidebar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ═══ Scrollable Sidebar Content ═══ */}
            <div
              className="flex-1 overflow-y-auto overflow-x-hidden p-3 flex flex-col gap-3"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#b45309 transparent' }}
            >
              {/* ═══ 1. 3D Character Turntable Showcase ═══ */}
              <div className="relative rounded-xl border border-gold-700/30 bg-gradient-to-b from-obsidian-900/90 to-obsidian-950 overflow-hidden shadow-inner flex flex-col items-center">
                {/* Rarity & Cost Badges on top of 3D preview */}
                <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
                  <span
                    className="px-2 py-0.5 rounded text-[9px] font-cinzel font-bold uppercase tracking-wider border shadow-md"
                    style={{ borderColor: rarity.border, color: rarity.glow, backgroundColor: 'rgba(6, 5, 8, 0.8)' }}
                  >
                    {rarity.label}
                  </span>
                  {selectedUnit.isBoss && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-amber-300 bg-amber-950/80 border border-amber-500/60 animate-pulse">
                      ⚡ GOD
                    </span>
                  )}
                </div>

                <div className="absolute top-2 right-2 z-10">
                  {gameMode === 'CAMPAIGN' ? (
                    <span className="px-2 py-0.5 rounded bg-gold-950/80 border border-gold-500/60 text-gold-300 font-cinzel font-black text-xs shadow">
                      {selectedUnit.cost + currentTrait.cost}g
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-obsidian-900/80 border border-gold-800/40 text-parchment-300 font-cinzel text-[10px]">
                      {selectedUnit.health} HP
                    </span>
                  )}
                </div>

                {/* 3D WebGL Canvas Turntable */}
                <Unit3DPreview
                  unitTypeId={selectedUnitType}
                  teamId={activeTeam}
                  traitId={selectedTrait}
                />

                {/* Unit Name & Lore Banner below 3D model */}
                <div className="w-full p-2.5 bg-obsidian-950/90 border-t border-gold-800/25 flex flex-col">
                  <span className="font-cinzel font-black text-sm uppercase text-gold-gradient tracking-wide">
                    {selectedUnit.name}
                  </span>
                  <span className="text-[10px] text-amber-400/90 font-crimsonText italic font-semibold">
                    {selectedUnit.fightStyle}
                  </span>
                  <p className="text-[10px] text-parchment-400 font-crimsonText leading-snug mt-1 line-clamp-2">
                    {selectedUnit.desc}
                  </p>
                </div>
              </div>

              {/* ═══ 2. Combat Power & Signature Ultimate ═══ */}
              <div className="p-2.5 rounded-xl bg-obsidian-900/60 border border-gold-800/20 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-gold-400">
                    <Zap className="w-3.5 h-3.5" />
                    <span className="font-cinzel text-[10px] font-bold uppercase tracking-wider">
                      Ultimate Ability
                    </span>
                  </div>
                  <span className="font-mono text-[9px] text-amber-300/80">
                    {selectedUnit.ultimateCooldown}s CD
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-cinzel text-xs font-black text-yellow-300">
                    {selectedUnit.ultimateName || 'Signature Strike'}
                  </span>
                  <span className="text-[10px] text-parchment-300 font-crimsonText leading-tight mt-0.5">
                    {selectedUnit.ultimateDesc || 'Devastating heavy combat ability'}
                  </span>
                </div>
              </div>

              {/* ═══ 3. Combat Stats Breakdown ═══ */}
              <div className="p-2.5 rounded-xl bg-obsidian-900/60 border border-gold-800/20 flex flex-col gap-2">
                <span className="font-cinzel text-[10px] font-bold uppercase tracking-wider text-parchment-400">
                  Combat Attributes
                </span>

                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  {/* Health */}
                  <div className="flex flex-col gap-0.5">
                    <div className="flex justify-between text-parchment-300">
                      <span className="flex items-center gap-1 text-crimson-400 font-sans">
                        <Heart className="w-2.5 h-2.5" /> HP
                      </span>
                      <span>{selectedUnit.health}</span>
                    </div>
                    <div className="w-full bg-obsidian-950 rounded-full h-1.5 overflow-hidden border border-gold-800/20">
                      <div
                        className="bg-crimson-500 h-full rounded-full"
                        style={{ width: `${Math.min(100, (selectedUnit.health / 1650) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Damage */}
                  <div className="flex flex-col gap-0.5">
                    <div className="flex justify-between text-parchment-300">
                      <span className="flex items-center gap-1 text-amber-400 font-sans">
                        <Swords className="w-2.5 h-2.5" /> Damage
                      </span>
                      <span>{selectedUnit.damage}</span>
                    </div>
                    <div className="w-full bg-obsidian-950 rounded-full h-1.5 overflow-hidden border border-gold-800/20">
                      <div
                        className="bg-amber-500 h-full rounded-full"
                        style={{ width: `${Math.min(100, (selectedUnit.damage / 160) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Move Speed */}
                  <div className="flex flex-col gap-0.5">
                    <div className="flex justify-between text-parchment-300">
                      <span className="flex items-center gap-1 text-emerald-400 font-sans">
                        <Wind className="w-2.5 h-2.5" /> Speed
                      </span>
                      <span>{selectedUnit.moveSpeed}</span>
                    </div>
                    <div className="w-full bg-obsidian-950 rounded-full h-1.5 overflow-hidden border border-gold-800/20">
                      <div
                        className="bg-emerald-500 h-full rounded-full"
                        style={{ width: `${Math.min(100, (selectedUnit.moveSpeed / 6.0) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Range */}
                  <div className="flex flex-col gap-0.5">
                    <div className="flex justify-between text-parchment-300">
                      <span className="flex items-center gap-1 text-blue-400 font-sans">
                        <Crosshair className="w-2.5 h-2.5" /> Range
                      </span>
                      <span>{selectedUnit.attackRange}m</span>
                    </div>
                    <div className="w-full bg-obsidian-950 rounded-full h-1.5 overflow-hidden border border-gold-800/20">
                      <div
                        className="bg-blue-500 h-full rounded-full"
                        style={{ width: `${Math.min(100, (selectedUnit.attackRange / 20.0) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ═══ 4. Combat Trait Selection ═══ */}
              <div className="p-2.5 rounded-xl bg-obsidian-900/60 border border-gold-800/20 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-cinzel text-[10px] font-bold uppercase tracking-wider text-parchment-400 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-gold-400" /> Combat Trait
                  </span>
                  <span className="text-[10px] text-amber-300 font-crimsonText">
                    {currentTrait.name}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1">
                  {Object.values(UNIT_TRAITS).map((trait) => {
                    const IconComp = TRAIT_ICONS[trait.icon] || Shield;
                    const isSelected = selectedTrait === trait.id;
                    return (
                      <button
                        key={trait.id}
                        onClick={() => {
                          setSelectedTrait(trait.id);
                          soundSystem.playSwordSlash();
                        }}
                        className={`p-1.5 rounded-lg flex flex-col items-center gap-1 text-center border transition-all ${
                          isSelected
                            ? 'bg-gold-600/30 border-gold-500/60 text-gold-200 shadow-ember'
                            : 'bg-obsidian-950/70 border-gold-800/20 text-parchment-400 hover:text-parchment-200'
                        }`}
                        title={trait.desc}
                      >
                        <IconComp className="w-3.5 h-3.5" style={{ color: trait.color }} />
                        <span className="font-cinzel text-[9px] font-bold leading-none truncate w-full">
                          {trait.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ═══ 5. Category Filter Tabs & 26-Unit Army Roster ═══ */}
              <div className="flex flex-col gap-2 pt-1 border-t border-gold-800/30">
                <span className="font-cinzel text-[10px] font-bold uppercase tracking-wider text-gold-400">
                  Select Unit (26 Available)
                </span>

                {/* Category Pills */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setActiveCategory(cat.id);
                        soundSystem.playSwordSlash();
                      }}
                      className={`px-2 py-0.5 rounded text-[9px] font-cinzel font-semibold whitespace-nowrap transition-all ${
                        activeCategory === cat.id
                          ? 'bg-gold-500/30 text-gold-200 border border-gold-500/50 shadow-sm'
                          : 'bg-obsidian-900/60 text-parchment-400 hover:text-parchment-200 border border-gold-800/20'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Units Grid */}
                <div className="grid grid-cols-3 gap-1.5 max-h-52 overflow-y-auto p-1" style={{ scrollbarWidth: 'thin' }}>
                  {filteredUnits.map((unit) => {
                    const IconComponent = ICON_MAP[unit.iconName] || Swords;
                    const isSelected = selectedUnitType === unit.id;
                    const unitRarity = getRarityInfo(unit.cost);
                    return (
                      <button
                        key={unit.id}
                        onClick={() => {
                          setSelectedUnitType(unit.id);
                          soundSystem.playSwordSlash();
                        }}
                        className={`p-1.5 rounded-xl border flex flex-col items-center justify-between text-center transition-all cursor-pointer relative group ${
                          isSelected
                            ? activeTeam === 'blue'
                              ? 'bg-blue-950/70 border-blue-400 shadow-blue-glow scale-105 z-10'
                              : 'bg-red-950/70 border-red-400 shadow-red-glow scale-105 z-10'
                            : 'bg-obsidian-900/80 hover:bg-obsidian-800 border-gold-800/20 hover:border-gold-500/40'
                        }`}
                        style={{ minHeight: '62px' }}
                      >
                        <div
                          className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: unitRarity.glow }}
                        />
                        <div className={`p-1 rounded-md ${isSelected ? 'text-gold-200' : 'text-parchment-400'}`}>
                          <IconComponent className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-cinzel text-[9px] font-bold text-parchment-200 truncate w-full leading-tight mt-0.5">
                          {unit.name}
                        </span>
                        <span className="font-mono text-[8px] text-amber-400/80">
                          {gameMode === 'CAMPAIGN' ? `${unit.cost}g` : `${unit.health} HP`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Multi-Deploy Formation Stamp Selector */}
              <div className="flex flex-col gap-1 pt-1 border-t border-gold-800/30">
                <div className="flex items-center justify-between text-[10px] text-parchment-400 font-cinzel">
                  <span>Formation Stamp:</span>
                  <span className="text-gold-300 font-bold font-mono">
                    {formationMode === '50' || formationMode === 'LEGION_50' ? 'Legion Swarm (50x)' :
                     formationMode === '20' || formationMode === 'BATTALION_20' ? 'Battalion (20x)' :
                     formationMode === '10' || formationMode === 'PLATOON_10' ? 'Platoon (10x)' :
                     formationMode === '5' || formationMode === 'WALL_5' ? 'Phalanx Wall (5x)' :
                     formationMode === '3' || formationMode === 'LINE_3' ? 'Line Rank (3x)' : 'Single (1x)'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 bg-obsidian-900/90 p-1 rounded-xl border border-gold-800/40">
                  {[
                    { id: '1', label: '1x Single', desc: '1 Unit' },
                    { id: '3', label: '3x Line', desc: '3 Units' },
                    { id: '5', label: '5x Wall', desc: '5 Units' },
                    { id: '10', label: '10x Platoon', desc: '10 Units' },
                    { id: '20', label: '20x Cohort', desc: '20 Units' },
                    { id: '50', label: '50x Legion', desc: '50 Units' }
                  ].map((f) => {
                    const isActive = formationMode === f.id ||
                      (f.id === '1' && (formationMode === 'SINGLE' || !formationMode)) ||
                      (f.id === '3' && formationMode === 'LINE_3') ||
                      (f.id === '5' && formationMode === 'WALL_5') ||
                      (f.id === '10' && formationMode === 'PLATOON_10') ||
                      (f.id === '20' && formationMode === 'BATTALION_20') ||
                      (f.id === '50' && formationMode === 'LEGION_50');
                    return (
                      <button
                        key={f.id}
                        onClick={() => {
                          setFormationMode(f.id);
                          sandboxEngine.placementManager?.setFormation();
                          soundSystem.playSwordSlash();
                        }}
                        className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                          isActive
                            ? 'bg-gold-500 text-obsidian-950 font-bold shadow-ember'
                            : 'text-parchment-400 hover:text-parchment-200 hover:bg-obsidian-800'
                        }`}
                      >
                        <div className="text-[10px] font-cinzel font-bold leading-tight">{f.label}</div>
                        <div className="text-[8px] font-mono opacity-80 leading-tight">{f.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ready to Deploy Button */}
              <button
                onClick={() => {
                  setIsSidebarOpen(false);
                  soundSystem.playSwordSlash();
                }}
                className="w-full btn-fantasy-battle py-3 text-xs flex items-center justify-center gap-2 mt-1 shadow-ember font-cinzel font-black uppercase tracking-wider"
              >
                <Swords className="w-4 h-4" />
                <span>Deploy {selectedUnit.name} ({currentFormation.label})</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 2. MINIMAL FLOATING BOTTOM DOCK: Spacious, Mobile-First, Uncrowded */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className={`fixed bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto select-none max-w-[96vw] ${isSidebarOpen ? 'hidden sm:block' : ''}`}>
        {/* Mini Popover for Formation Multipliers */}
        {isFormationPickerOpen && (
          <>
            <div
              onClick={() => setIsFormationPickerOpen(false)}
              className="fixed inset-0 z-20"
            />
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-obsidian-950/95 backdrop-blur-xl border border-gold-600/50 p-2.5 rounded-2xl shadow-2xl flex flex-col gap-2 min-w-[240px] animate-fade-in-up z-30 pointer-events-auto">
              <div className="flex items-center justify-between border-b border-gold-800/40 pb-1 px-1">
                <span className="text-[10px] font-cinzel font-bold text-gold-300 uppercase tracking-wider flex items-center gap-1">
                  <Layers className="w-3 h-3 text-gold-400" /> Multiplier Drop
                </span>
                <button
                  onClick={() => setIsFormationPickerOpen(false)}
                  className="text-parchment-400 hover:text-gold-300 text-xs p-0.5"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5 font-mono">
                {FORMATION_OPTIONS.map((f) => {
                  const isActive = currentFormation.id === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => {
                        setFormationMode(f.id);
                        sandboxEngine.placementManager?.setFormation();
                        soundSystem.playSwordSlash();
                        setIsFormationPickerOpen(false);
                      }}
                      className={`py-2 px-1 rounded-xl text-center transition-all ${
                        isActive
                          ? 'bg-gold-500 text-obsidian-950 font-bold shadow-ember scale-95'
                          : 'bg-obsidian-900/90 text-parchment-300 hover:bg-obsidian-800 border border-gold-800/30'
                      }`}
                    >
                      <div className="text-xs font-cinzel font-black">{f.label}</div>
                      <div className="text-[8px] font-mono opacity-75">{f.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* The Clean Dock */}
        <div className="fantasy-panel px-2.5 py-1.5 rounded-full backdrop-blur-md bg-obsidian-950/90 border border-gold-600/40 shadow-2xl flex items-center gap-1.5 md:gap-2 animate-fade-in-up">

          {/* Quick Team Toggle */}
          <button
            onClick={() => {
              setActiveTeam(activeTeam === 'blue' ? 'red' : 'blue');
              soundSystem.playSwordSlash();
            }}
            className={`px-2.5 py-1 rounded-full text-[10px] font-cinzel font-bold border transition-all active:scale-95 flex items-center gap-1 shrink-0 ${
              activeTeam === 'blue'
                ? 'bg-blue-900/80 text-blue-200 border-blue-400/60 shadow-blue-glow'
                : 'bg-red-900/80 text-red-200 border-red-400/60 shadow-red-glow'
            }`}
            title="Switch placing team"
          >
            <div className={`w-2 h-2 rounded-full ${activeTeam === 'blue' ? 'bg-blue-400 animate-pulse' : 'bg-red-400 animate-pulse'}`} />
            <span>{activeTeam === 'blue' ? 'Blue' : 'Red'}</span>
          </button>

          {/* Active Unit Badge - Opens Army Deck on click */}
          <button
            onClick={() => {
              setIsSidebarOpen(true);
              soundSystem.playSwordSlash();
            }}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-obsidian-900/80 border border-gold-800/40 hover:border-gold-500/60 active:scale-95 transition-all text-left shrink-0"
            title="Inspect 3D model, traits, powers & units"
          >
            <div className="p-1 rounded-full bg-gold-600/20 text-gold-400">
              <SelectedIcon className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col leading-none pr-1">
              <span className="font-cinzel text-[11px] font-bold text-gold-200 max-w-[85px] sm:max-w-[120px] truncate">
                {selectedUnit.name}
              </span>
              <span className="text-[7.5px] text-parchment-400 font-mono">
                Deck ▲
              </span>
            </div>
          </button>

          {/* Mobile Formation Dropdown Pill */}
          <div className="flex md:hidden items-center shrink-0">
            <button
              onClick={cycleFormation}
              className="px-2 py-1 rounded-l-full bg-gold-600/20 hover:bg-gold-600/30 border-y border-l border-gold-500/50 text-gold-300 font-mono text-[10px] font-bold active:scale-95 transition-all"
              title="Tap to cycle multiplier (1x, 3x, 5x, 10x, 20x, 50x)"
            >
              {currentFormation.label}
            </button>
            <button
              onClick={() => setIsFormationPickerOpen(!isFormationPickerOpen)}
              className="px-1 py-1 rounded-r-full bg-gold-600/20 hover:bg-gold-600/30 border-y border-r border-gold-500/50 text-gold-400 text-[10px] active:scale-95 transition-all"
              title="Choose formation"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          {/* Desktop Full Formation Strip */}
          <div className="hidden md:flex items-center gap-0.5 bg-obsidian-900/90 p-0.5 rounded-full border border-gold-800/40 font-mono text-[9px]">
            {FORMATION_OPTIONS.map((f) => {
              const isActive = currentFormation.id === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => {
                    setFormationMode(f.id);
                    sandboxEngine.placementManager?.setFormation();
                    soundSystem.playSwordSlash();
                  }}
                  className={`px-1.5 py-0.5 rounded-full font-bold transition-all ${
                    isActive
                      ? 'bg-gold-500 text-obsidian-950 shadow-ember font-black'
                      : 'text-parchment-400 hover:text-parchment-200'
                  }`}
                  title={f.desc}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Mobile Primary Action Button: START BATTLE / FIGHT */}
          <button
            onClick={() => {
              sandboxEngine.startBattle();
              soundSystem.playBluntHit();
            }}
            disabled={totalUnitsPlaced === 0 || blueCount === 0 || redCount === 0}
            className={`px-3 py-1 rounded-full font-cinzel font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95 shrink-0 ${
              totalUnitsPlaced > 0 && blueCount > 0 && redCount > 0
                ? 'btn-fantasy-battle animate-pulse shadow-ember'
                : 'bg-obsidian-800 text-parchment-500/40 border border-obsidian-700 cursor-not-allowed'
            }`}
            title={
              totalUnitsPlaced === 0
                ? 'Place units to fight'
                : blueCount === 0
                ? 'Need Blue units'
                : redCount === 0
                ? 'Need Red units'
                : 'Commence Battle!'
            }
          >
            <Play className="w-3 h-3 fill-current" />
            <span>
              {totalUnitsPlaced > 0 && blueCount > 0 && redCount > 0
                ? 'Fight!'
                : totalUnitsPlaced > 0
                ? `${blueCount}v${redCount}`
                : 'Place'}
            </span>
          </button>

          {/* Quick Clear Button (Only appears if units are deployed) */}
          {totalUnitsPlaced > 0 && (
            <button
              onClick={() => {
                sandboxEngine.clearAll(true);
                soundSystem.playSwordSlash();
              }}
              className="p-1 rounded-full text-rose-400/80 hover:text-rose-300 hover:bg-rose-950/40 active:scale-90 transition-all shrink-0"
              title="Clear all deployed units"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </>
  );
};
