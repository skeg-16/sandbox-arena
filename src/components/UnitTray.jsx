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
  FlameKindling
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
      {/* 1. LEFT SIDEBAR: Character 3D Showcase & Unit Deployment Deck */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div
        className={`fixed top-14 bottom-3 left-3 z-30 flex flex-col transition-all duration-300 pointer-events-none ${
          isSidebarOpen ? 'w-[320px] sm:w-[360px] md:w-[390px]' : 'w-auto'
        }`}
      >
        {/* Toggle Button when Collapsed */}
        {!isSidebarOpen && (
          <button
            onClick={() => {
              setIsSidebarOpen(true);
              soundSystem.playSwordSlash();
            }}
            className="pointer-events-auto fantasy-panel px-3 py-2 flex items-center gap-2.5 shadow-2xl border border-gold-500/50 bg-obsidian-950/95 hover:bg-obsidian-900 text-gold-300 rounded-2xl group transition-all animate-fade-in-right"
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
                    {formationMode === 'WALL_5' ? 'Phalanx Wall (x5)' : (formationMode === 'LINE_3' ? 'Line Rank (x3)' : 'Single (x1)')}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 bg-obsidian-900/90 p-1 rounded-xl border border-gold-800/40">
                  {[
                    { id: 'SINGLE', label: '1x Single', desc: '1 Unit' },
                    { id: 'LINE_3', label: '3x Line', desc: '3 Units' },
                    { id: 'WALL_5', label: '5x Wall', desc: '5 Units' }
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => {
                        setFormationMode(f.id);
                        sandboxEngine.placementManager?.setFormation();
                        soundSystem.playSwordSlash();
                      }}
                      className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                        formationMode === f.id
                          ? 'bg-gold-500 text-obsidian-950 font-bold shadow-ember'
                          : 'text-parchment-400 hover:text-parchment-200 hover:bg-obsidian-800'
                      }`}
                    >
                      <div className="text-[10px] font-cinzel font-bold leading-tight">{f.label}</div>
                      <div className="text-[8px] font-mono opacity-80 leading-tight">{f.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Ready to Deploy Button */}
              <button
                onClick={() => {
                  setIsSidebarOpen(false);
                  soundSystem.playSwordSlash();
                }}
                className="w-full btn-fantasy-battle py-2.5 text-xs flex items-center justify-center gap-2 mt-1 shadow-ember"
              >
                <Swords className="w-4 h-4" />
                <span>DEPLOY ON BATTLEFIELD</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 2. MINIMAL FLOATING BOTTOM DOCK: Keeps the 3D battlefield open! */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="fixed bottom-2.5 left-1/2 -translate-x-1/2 z-20 pointer-events-auto select-none">
        <div className="fantasy-panel px-3 py-1.5 rounded-full backdrop-blur-md bg-obsidian-950/85 border border-gold-600/40 shadow-2xl flex items-center gap-2 animate-fade-in-up">

          {/* Quick Team Toggle */}
          <button
            onClick={() => {
              setActiveTeam(activeTeam === 'blue' ? 'red' : 'blue');
              soundSystem.playSwordSlash();
            }}
            className={`px-2 py-0.5 rounded-full text-[10px] font-cinzel font-bold border transition-all active:scale-95 ${
              activeTeam === 'blue'
                ? 'bg-blue-900/80 text-blue-200 border-blue-400/60 shadow-blue-glow'
                : 'bg-red-900/80 text-red-200 border-red-400/60 shadow-red-glow'
            }`}
          >
            {activeTeam === 'blue' ? 'House Blue' : 'House Red'}
          </button>

          {/* Active Unit Badge - Opens Sidebar on click */}
          <button
            onClick={() => {
              setIsSidebarOpen(true);
              soundSystem.playSwordSlash();
            }}
            className="flex items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            title="Click to view 3D Preview, Traits & Powers"
          >
            <div className="p-1 rounded-full bg-obsidian-800 text-gold-400 border border-gold-800/40">
              <SelectedIcon className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col text-left leading-none">
              <span className="font-cinzel text-xs font-bold text-gold-200">
                {selectedUnit.name}
              </span>
              <span className="text-[8px] text-parchment-500 font-mono">
                Tap arena to place
              </span>
            </div>
          </button>

          {/* Quick Formation Stamp Switcher */}
          <div className="flex items-center gap-0.5 bg-obsidian-900/90 p-0.5 rounded-full border border-gold-800/40 font-mono text-[9px]">
            {[
              { id: 'SINGLE', label: 'x1', title: 'Single Unit' },
              { id: 'LINE_3', label: 'x3', title: 'Line Formation (3 Units)' },
              { id: 'WALL_5', label: 'x5', title: 'Phalanx Wall (5 Units)' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setFormationMode(f.id);
                  sandboxEngine.placementManager?.setFormation();
                  soundSystem.playSwordSlash();
                }}
                className={`px-1.5 py-0.5 rounded-full font-bold transition-all ${
                  formationMode === f.id
                    ? 'bg-gold-500 text-obsidian-950 shadow-ember font-black'
                    : 'text-parchment-400 hover:text-parchment-200'
                }`}
                title={f.title}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Quick Change Unit Button */}
          <button
            onClick={() => {
              setIsSidebarOpen(!isSidebarOpen);
              soundSystem.playSwordSlash();
            }}
            className="btn-fantasy-primary px-2.5 py-0.5 text-[9px] rounded-full flex items-center gap-1 shadow-ember"
          >
            <Layers className="w-3 h-3" />
            <span>Forces</span>
          </button>

          {/* Quick Clear All */}
          <button
            onClick={() => {
              sandboxEngine.clearAll(true);
              soundSystem.playSwordSlash();
            }}
            className="p-1 rounded-full text-rose-400/80 hover:text-rose-300 hover:bg-rose-950/40 active:scale-90 transition-all"
            title="Clear all units"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>
  );
};
