import React, { useState, useEffect, useRef } from 'react';
import { useSandboxStore } from '../store/useSandboxStore';
import { UNIT_TYPES, TEAMS } from '../sandbox/UnitConfig';
import { UNIT_TRAITS } from '../sandbox/UnitTraits';
import { soundSystem } from '../sandbox/SoundSystem';
import { sandboxEngine } from '../sandbox/SandboxEngine';
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
  Move
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
  { id: 'DEITY', label: '⚡ Gods & Bosses (4)', unitIds: ['zeus', 'ares', 'hades', 'poseidon'] },
  { id: 'INFANTRY', label: 'Infantry', unitIds: ['swordsman', 'spearman', 'berserker', 'samurai', 'gladiator'] },
  { id: 'MARTIAL', label: 'Martial & Rogues', unitIds: ['assassin', 'monk', 'duelist', 'ninja', 'archer'] },
  { id: 'ARCANE', label: 'Holy & Arcane', unitIds: ['mage', 'paladin', 'necromancer', 'pyromancer', 'frost_witch'] },
  { id: 'HEAVY', label: 'Heavy & Titans', unitIds: ['shield_bearer', 'cavalry', 'dragon_knight', 'golem', 'giant', 'catapult', 'battering_ram'] },
  { id: 'SIEGE', label: 'Siege Engines', unitIds: ['battering_ram', 'catapult'] }
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
    setActiveTeam,
    setSelectedUnitType,
    setSelectedTrait,
    setEnforceDeploymentZones
  } = useSandboxStore();

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

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [isTraitMenuOpen, setIsTraitMenuOpen] = useState(false);
  const scrollRef = useRef(null);

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -260, behavior: 'smooth' });
      soundSystem.playUIClick();
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 260, behavior: 'smooth' });
      soundSystem.playUIClick();
    }
  };

  // Close trait menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.trait-dropdown-container')) {
        setIsTraitMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', handleOutsideClick);
    return () => window.removeEventListener('pointerdown', handleOutsideClick);
  }, []);

  if (gamePhase !== 'PLACEMENT' || isPossessing) return null;

  const currentTrait = UNIT_TRAITS[selectedTrait] || UNIT_TRAITS.none;
  const CurrentTraitIcon = TRAIT_ICONS[currentTrait.icon] || Shield;
  const selectedUnit = UNIT_TYPES[selectedUnitType] || UNIT_TYPES.swordsman;
  const SelectedIcon = ICON_MAP[selectedUnit.iconName] || Swords;

  // Filter units according to category
  const filteredUnits = Object.values(UNIT_TYPES).filter((unit) => {
    if (activeCategory === 'ALL') return true;
    const cat = CATEGORIES.find(c => c.id === activeCategory);
    return cat ? cat.unitIds.includes(unit.id) : true;
  });

  return (
    <div className="absolute bottom-1.5 md:bottom-3 left-1/2 -translate-x-1/2 z-20 w-[98%] md:w-[95%] max-w-5xl select-none transition-all duration-300">

      {/* ═══ COLLAPSED MINIMAL DOCK TRIGGER ═══ */}
      {isCollapsed ? (
        <div className="flex justify-center animate-fade-in">
          <div className="fantasy-panel px-4 py-2 flex items-center gap-3 shadow-2xl border border-gold-600/40 bg-obsidian-950/95">

            {/* Team Crest Indicator */}
            <div className={`px-2 py-0.5 rounded text-[10px] font-cinzel font-bold border ${
              activeTeam === 'blue'
                ? 'bg-blue-900/60 text-blue-200 border-blue-500/50'
                : 'bg-red-900/60 text-red-200 border-red-500/50'
            }`}>
              {activeTeam === 'blue' ? 'House Blue' : 'House Red'}
            </div>

            {/* Current Selected Unit */}
            <div className="flex items-center gap-2 pr-2 border-r border-gold-800/30">
              <div className="p-1 rounded bg-obsidian-800 text-gold-400 border border-gold-800/30">
                <SelectedIcon className="w-3.5 h-3.5" />
              </div>
              <span className="font-cinzel text-xs font-bold text-parchment-100">
                {selectedUnit.name}
              </span>
            </div>

            {/* Current Trait Indicator */}
            <div className="flex items-center gap-1.5 text-xs font-crimsonText text-parchment-300 pr-2 border-r border-gold-800/30">
              <CurrentTraitIcon className="w-3.5 h-3.5" style={{ color: currentTrait.color }} />
              <span>{currentTrait.name}</span>
            </div>

            {/* Expand Army Button */}
            <button
              onClick={() => {
                setIsCollapsed(false);
                soundSystem.playSwordSlash();
              }}
              className="btn-fantasy-primary px-3 py-1 text-[10px] flex items-center gap-1.5 shadow-ember"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Expand Army (21 Units)</span>
            </button>
          </div>
        </div>
      ) : (

        /* ═══ EXPANDED COMPACT COMMANDER DOCK ═══ */
        <div className="fantasy-panel-ornate p-1.5 md:p-2.5 flex flex-col gap-1.5 md:gap-2 shadow-2xl animate-fade-in bg-obsidian-950/95">

          {/* ═══ Header Row: Team, Gold, Category Tabs, Trait Selector & Collapse ═══ */}
          <div className="flex items-center justify-between gap-2 px-1">

            {/* Left: Team Realm Switcher & Campaign Gold */}
            <div className="flex items-center gap-2 shrink-0">
              {gameMode === 'CAMPAIGN' ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-obsidian-900 border border-gold-600/40 text-gold-400 font-cinzel text-xs font-bold shadow-sm">
                  <Coins className="w-3.5 h-3.5" />
                  <span>{remainingGold} / {campaignGoldBudget}g</span>
                </div>
              ) : (
                <div className="inline-flex rounded-lg bg-obsidian-900 p-0.5 border border-gold-800/30">
                  <button
                    onClick={() => {
                      setActiveTeam('blue');
                      soundSystem.playSwordSlash();
                    }}
                    className={`px-3 py-1 rounded-md font-cinzel font-bold text-[10px] uppercase tracking-wider transition-all ${
                      activeTeam === 'blue'
                        ? 'bg-gradient-to-r from-blue-700 to-blue-900 text-blue-100 shadow-md border border-blue-400/50'
                        : 'text-parchment-400 hover:text-parchment-200'
                    }`}
                  >
                    House Blue
                  </button>
                  <button
                    onClick={() => {
                      setActiveTeam('red');
                      soundSystem.playSwordSlash();
                    }}
                    className={`px-3 py-1 rounded-md font-cinzel font-bold text-[10px] uppercase tracking-wider transition-all ${
                      activeTeam === 'red'
                        ? 'bg-gradient-to-r from-red-700 to-red-900 text-red-100 shadow-md border border-red-400/50'
                        : 'text-parchment-400 hover:text-parchment-200'
                    }`}
                  >
                    House Red
                  </button>
                </div>
              )}

              {/* Free Placement / Zones Toggle (Sandbox Mode) */}
              {gameMode !== 'CAMPAIGN' && (
                <button
                  onClick={handleToggleDeploymentZones}
                  className={`px-2.5 py-1 rounded-lg font-cinzel font-bold text-[10px] uppercase tracking-wider transition-all flex items-center gap-1.5 border shadow-sm ${
                    !enforceDeploymentZones
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 shadow-emerald-900/30'
                      : 'bg-obsidian-900 text-parchment-400 border-gold-800/30 hover:text-parchment-200'
                  }`}
                  title={
                    !enforceDeploymentZones
                      ? 'Free Placement Active: Deploy units anywhere across the map without boundary restriction'
                      : 'Deployment Zones Active: Deploy units within designated team zones'
                  }
                >
                  {!enforceDeploymentZones ? <Unlock className="w-3 h-3 text-emerald-400" /> : <Lock className="w-3 h-3 text-gold-400" />}
                  <span>{!enforceDeploymentZones ? 'Free Deploy' : 'Zones'}</span>
                </button>
              )}
            </div>

            {/* Center: Unit Category Tabs */}
            <div className="flex items-center gap-1 bg-obsidian-900/90 p-0.5 rounded-lg border border-gold-800/25 shrink-0 overflow-x-auto">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    soundSystem.playSwordSlash();
                  }}
                  className={`px-2.5 py-0.5 rounded text-[10px] font-cinzel font-semibold transition-all whitespace-nowrap ${
                    activeCategory === cat.id
                      ? 'bg-gold-600/30 text-gold-300 border border-gold-500/40 shadow-sm'
                      : 'text-parchment-500 hover:text-parchment-300'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Right: Trait Modifier Popover & Collapse Toggle */}
            <div className="flex items-center gap-2 shrink-0">

              {/* Trait Selector Popover */}
              <div className="relative trait-dropdown-container">
                <button
                  onClick={() => {
                    setIsTraitMenuOpen(!isTraitMenuOpen);
                    soundSystem.playSwordSlash();
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-obsidian-900 border border-gold-800/30 text-parchment-200 hover:border-gold-500/50 text-[10px] font-cinzel transition-all"
                  title="Unit Trait Modifiers"
                >
                  <CurrentTraitIcon className="w-3 h-3" style={{ color: currentTrait.color }} />
                  <span>{currentTrait.name}</span>
                  <ChevronDown className={`w-2.5 h-2.5 text-gold-500 transition-transform ${isTraitMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Trait Menu Popover */}
                {isTraitMenuOpen && (
                  <div className="absolute right-0 bottom-full mb-2 w-60 fantasy-panel-ornate p-2 flex flex-col gap-1 shadow-2xl animate-fade-in-down z-50 bg-obsidian-950">
                    <div className="px-2 py-0.5 font-cinzel text-[9px] uppercase tracking-widest text-gold-500 font-bold border-b border-gold-800/30 mb-0.5">
                      Combat Traits
                    </div>
                    {Object.values(UNIT_TRAITS).map((trait) => {
                      const IconComp = TRAIT_ICONS[trait.icon] || Shield;
                      const isSelected = selectedTrait === trait.id;
                      return (
                        <button
                          key={trait.id}
                          onClick={() => {
                            setSelectedTrait(trait.id);
                            setIsTraitMenuOpen(false);
                            soundSystem.playSwordSlash();
                          }}
                          className={`flex items-center gap-2 p-1.5 rounded-lg text-left transition-all border ${
                            isSelected
                              ? 'bg-obsidian-800 text-parchment-100 border-gold-500/50 shadow-ember'
                              : 'border-transparent hover:bg-obsidian-900 text-parchment-400 hover:text-parchment-100'
                          }`}
                        >
                          <IconComp className="w-3.5 h-3.5 shrink-0" style={{ color: trait.color }} />
                          <div className="flex flex-col">
                            <span className="font-cinzel text-[11px] font-bold leading-tight">{trait.name}</span>
                            <span className="font-crimsonText text-[10px] text-parchment-400 leading-none">{trait.desc}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Collapse Dock Button */}
              <button
                onClick={() => {
                  setIsCollapsed(true);
                  soundSystem.playSwordSlash();
                }}
                className="p-1 rounded-lg bg-obsidian-900 hover:bg-obsidian-800 text-parchment-400 hover:text-gold-300 border border-gold-800/20 transition-all"
                title="Collapse Army Dock"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ═══ Controls Guide Strip (Desktop Only) ═══ */}
          <div className="hidden md:flex items-center justify-between px-2.5 py-1 bg-obsidian-900/60 rounded-lg border border-gold-800/15 text-[10px] font-mono text-parchment-400">
            <div className="flex items-center gap-2">
              <span className="text-gold-400 font-cinzel font-bold text-[9px] flex items-center gap-1">
                <Move className="w-2.5 h-2.5" /> Camera:
              </span>
              <span className="flex items-center gap-1 text-[9px]">
                <kbd className="px-1 py-0.5 bg-obsidian-950 border border-gold-800/40 rounded text-gold-300 font-bold">WASD</kbd>
                <span className="text-parchment-500">/</span>
                <kbd className="px-1 py-0.5 bg-obsidian-950 border border-gold-800/40 rounded text-gold-300 font-bold">Arrows</kbd>
                <span>Pan Field</span>
              </span>
              <span className="text-gold-800">·</span>
              <span className="flex items-center gap-1 text-[9px]">
                <kbd className="px-1 py-0.5 bg-obsidian-950 border border-gold-800/40 rounded text-gold-300 font-bold">Shift</kbd>
                <span>Fast</span>
              </span>
              <span className="text-gold-800">·</span>
              <span className="text-[9px]"><strong className="text-parchment-200">RMB Drag:</strong> Orbit</span>
              <span className="text-gold-800">·</span>
              <span className="text-[9px]"><strong className="text-parchment-200">Scroll:</strong> Zoom</span>
            </div>
            <div className="flex items-center gap-2 text-[9px]">
              <span><strong className="text-gold-400 font-cinzel">Deploy:</strong> <strong className="text-parchment-200">LMB Click/Drag:</strong> Place</span>
              <span className="text-gold-800">·</span>
              <span><strong className="text-parchment-200">RMB Click:</strong> Delete</span>
              <span className="text-gold-800">·</span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-obsidian-950 border border-gold-800/40 rounded text-gold-300 font-bold">T</kbd>
                <span>Tactical View</span>
              </span>
            </div>
          </div>

          {/* ═══ Bottom Row: Horizontally Scrollable 21-Unit Army Cards ═══ */}
          <div className="relative flex items-center pt-1 border-t border-gold-800/20">
            <button
              onClick={scrollLeft}
              className="p-1.5 text-gold-400 hover:text-gold-200 bg-obsidian-900/90 hover:bg-obsidian-800 rounded-l-lg border border-gold-800/30 shrink-0 z-10 shadow"
              title="Scroll Left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div
              ref={scrollRef}
              className="flex items-center gap-2 overflow-x-auto py-1 px-1.5 scroll-smooth flex-1"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {filteredUnits.map((unit) => {
                const IconComponent = ICON_MAP[unit.iconName] || Swords;
                const isSelected = selectedUnitType === unit.id;
                const rarity = getRarityInfo(unit.cost);
                const traitCfg = UNIT_TRAITS[selectedTrait] || UNIT_TRAITS.none;
                const totalCost = unit.cost + traitCfg.cost;

                const activeTeamBorder = activeTeam === 'blue'
                  ? 'border-blue-500 shadow-blue-glow bg-blue-950/40'
                  : 'border-red-500 shadow-red-glow bg-red-950/40';

                return (
                  <button
                    key={unit.id}
                    onClick={() => {
                      setSelectedUnitType(unit.id);
                      soundSystem.playSwordSlash();
                    }}
                    className={`group relative flex flex-col items-center justify-between p-1.5 md:p-2 rounded-xl transition-all duration-150 cursor-pointer border shrink-0 w-20 md:w-24 ${
                      isSelected
                        ? `${activeTeamBorder} scale-105 z-10`
                        : 'bg-obsidian-900/80 hover:bg-obsidian-800 border-gold-800/20 hover:border-gold-500/40'
                    }`}
                    style={{
                      minHeight: '66px',
                      borderColor: isSelected ? undefined : rarity.border
                    }}
                  >
                    {/* Rarity Indicator Pip */}
                    <div
                      className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: rarity.glow, boxShadow: `0 0 4px ${rarity.glow}` }}
                      title={rarity.label}
                    />

                    {/* Unit Class Icon */}
                    <div className={`p-1.5 rounded-lg transition-all ${
                      isSelected
                        ? activeTeam === 'blue'
                          ? 'bg-blue-600 text-blue-100 shadow'
                          : 'bg-red-600 text-red-100 shadow'
                        : 'bg-obsidian-950 text-parchment-300 group-hover:text-gold-300'
                    }`}>
                      <IconComponent className="w-4 h-4" />
                    </div>

                    {/* Unit Name */}
                    <span className="font-cinzel text-[10px] font-bold text-parchment-100 truncate w-full text-center tracking-tight leading-tight mt-1">
                      {unit.name}
                    </span>

                    {/* Fighting Style Tag */}
                    <span className="text-[8px] text-amber-300/80 font-crimsonText italic truncate w-full text-center leading-none">
                      {unit.fightStyle || 'Combat'}
                    </span>

                    {/* Unit Cost or HP Badge */}
                    <div className="w-full flex items-center justify-center mt-0.5">
                      {gameMode === 'CAMPAIGN' ? (
                        <span className="font-crimsonText text-[10px] font-bold text-gold-400">
                          {totalCost}g
                        </span>
                      ) : (
                        <span className="font-crimsonText text-[10px] text-parchment-400">
                          {unit.health} HP
                        </span>
                      )}
                    </div>

                    {/* Hover Tooltip with Fight Style & Ultimate */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col p-2.5 rounded-lg bg-obsidian-950/95 border border-gold-700/50 shadow-2xl z-50 pointer-events-none w-52 text-left">
                      <span className="font-cinzel text-xs font-bold text-gold-300">{unit.name}</span>
                      <span className="text-[10px] text-amber-400 font-crimsonText italic font-semibold">{unit.fightStyle}</span>
                      <p className="text-[10px] text-parchment-300 font-crimsonText leading-tight mt-1">{unit.desc}</p>
                      {unit.ultimateName && (
                        <div className="mt-1.5 pt-1 border-t border-gold-800/30 flex flex-col">
                          <span className="text-[9px] font-cinzel font-bold text-yellow-400 flex items-center gap-1">
                            <Zap className="w-2.5 h-2.5" /> Ult: {unit.ultimateName}
                          </span>
                          <span className="text-[9px] text-parchment-400 font-crimsonText leading-tight">{unit.ultimateDesc}</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={scrollRight}
              className="p-1.5 text-gold-400 hover:text-gold-200 bg-obsidian-900/90 hover:bg-obsidian-800 rounded-r-lg border border-gold-800/30 shrink-0 z-10 shadow"
              title="Scroll Right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}
    </div>
  );
};
