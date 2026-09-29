import React, { useState } from 'react';
import { useSandboxStore } from '../store/useSandboxStore';
import { sandboxEngine } from '../sandbox/SandboxEngine';
import { soundSystem } from '../sandbox/SoundSystem';
import { BATTLEGROUND_MAPS, SCENARIO_TYPES } from '../sandbox/MapConfigs';
import {
  Castle,
  Mountain,
  Waves,
  Flag,
  Shield,
  Target,
  Swords,
  Timer,
  CheckCircle2,
  X,
  Compass,
  AlertCircle
} from 'lucide-react';

const MAP_ICONS = {
  castle_siege_plains: Castle,
  mountain_pass: Mountain,
  river_crossing: Waves,
  highland_outposts: Flag
};

export const ScenarioPickerModal = ({ isOpen, onClose }) => {
  const {
    activeMapId,
    scenarioType,
    enforceDeploymentZones,
    setMapId,
    setScenarioType,
    setEnforceDeploymentZones
  } = useSandboxStore();

  const [selectedMap, setSelectedMap] = useState(activeMapId || 'castle_siege_plains');
  const [selectedScenario, setSelectedScenario] = useState(scenarioType || 'SIEGE');
  const [zonesEnforced, setZonesEnforced] = useState(enforceDeploymentZones);

  if (!isOpen) return null;

  const currentMapData = BATTLEGROUND_MAPS[selectedMap] || BATTLEGROUND_MAPS.castle_siege_plains;

  const handleDeploy = () => {
    soundSystem.playVictoryFanfare?.();
    setMapId(selectedMap);
    setScenarioType(selectedScenario);
    setEnforceDeploymentZones(zonesEnforced);

    sandboxEngine.loadBattlegroundMap(selectedMap, selectedScenario);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian-950/80 backdrop-blur-md animate-fade-in select-none">
      <div className="fantasy-panel-ornate max-w-4xl w-full p-6 flex flex-col gap-6 shadow-2xl border border-gold-600/40 relative">

        {/* Close Button */}
        <button
          onClick={() => {
            soundSystem.playUIClick?.();
            onClose();
          }}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-parchment-400 hover:text-gold-300 hover:bg-obsidian-800/80 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Castle className="w-5 h-5 text-gold-500" />
            <h2 className="font-cinzel font-black text-xl text-gold-gradient uppercase tracking-widest">
              Battleground & Siege Realm
            </h2>
          </div>
          <p className="font-crimsonText text-sm text-parchment-300 italic">
            Select a 3D terrain profile, fortress fortifications layout, and siege objective mode.
          </p>
        </div>

        {/* ═══ 4 Selectable Battlegrounds ═══ */}
        <div className="flex flex-col gap-2">
          <span className="font-cinzel text-xs uppercase tracking-wider text-gold-400 font-bold">
            1. Select Battleground Realm
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.values(BATTLEGROUND_MAPS).map((map) => {
              const Icon = MAP_ICONS[map.id] || Castle;
              const isSelected = selectedMap === map.id;

              return (
                <button
                  key={map.id}
                  onClick={() => {
                    setSelectedMap(map.id);
                    setSelectedScenario(map.defaultScenario);
                    soundSystem.playSwordSlash?.();
                  }}
                  className={`p-3.5 rounded-xl border flex flex-col items-start gap-2.5 transition-all text-left group ${
                    isSelected
                      ? 'bg-gradient-to-b from-obsidian-850 to-obsidian-950 border-gold-400 shadow-gold-glow'
                      : 'bg-obsidian-900/60 border-gold-900/30 hover:border-gold-700/50 hover:bg-obsidian-850'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${isSelected ? 'bg-gold-500 text-obsidian-950 shadow-md' : 'bg-obsidian-800 text-gold-400'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-cinzel text-xs font-bold text-parchment-100 group-hover:text-gold-300">
                      {map.name}
                    </h3>
                    <span className="text-[10px] font-crimsonText text-parchment-400 leading-tight block mt-0.5">
                      {map.subtitle}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══ Scenario Objectives & Deployment Settings ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-obsidian-950/70 p-4 rounded-xl border border-gold-900/30">

          {/* Left: Objective Type Selector */}
          <div className="flex flex-col gap-2">
            <span className="font-cinzel text-xs uppercase tracking-wider text-gold-400 font-bold">
              2. Objective & Win Condition
            </span>
            <div className="flex flex-col gap-2">
              {Object.values(SCENARIO_TYPES).map((sc) => {
                const isSelected = selectedScenario === sc.id;
                return (
                  <button
                    key={sc.id}
                    onClick={() => {
                      setSelectedScenario(sc.id);
                      soundSystem.playUIClick?.();
                    }}
                    className={`p-2.5 rounded-lg border text-left transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-gold-500 bg-obsidian-800/90 text-gold-300'
                        : 'border-gold-900/20 bg-obsidian-900/40 text-parchment-400 hover:text-parchment-200'
                    }`}
                  >
                    <div>
                      <div className="font-cinzel text-xs font-bold">{sc.name}</div>
                      <div className="text-[11px] font-crimsonText text-parchment-400 mt-0.5 leading-snug">{sc.desc}</div>
                    </div>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-gold-400 shrink-0 ml-2" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Map Tactical Intel & Deployment Toggle */}
          <div className="flex flex-col justify-between gap-3 border-t md:border-t-0 md:border-l border-gold-900/30 pt-3 md:pt-0 md:pl-4">
            <div className="flex flex-col gap-2">
              <span className="font-cinzel text-xs uppercase tracking-wider text-gold-400 font-bold flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-gold-500" /> Realm Tactical Intel
              </span>
              <p className="font-crimsonText text-xs text-parchment-300 italic leading-relaxed">
                "{currentMapData.desc}"
              </p>

              <div className="grid grid-cols-2 gap-2 mt-1 text-[11px] font-mono text-parchment-400">
                <div className="bg-obsidian-900 p-2 rounded border border-gold-900/20">
                  <span className="text-gold-500 font-bold block text-[9px] uppercase font-cinzel">Fortifications</span>
                  {currentMapData.defaultStructures.length} Structures Pre-laid
                </div>
                <div className="bg-obsidian-900 p-2 rounded border border-gold-900/20">
                  <span className="text-gold-500 font-bold block text-[9px] uppercase font-cinzel">Time Limit</span>
                  {currentMapData.timeLimit} Seconds
                </div>
              </div>
            </div>

            {/* Deployment Zones Enforcement Toggle */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-obsidian-900 border border-gold-900/30">
              <div className="flex flex-col">
                <span className="font-cinzel text-xs font-bold text-parchment-200">Enforce Deployment Zones</span>
                <span className="font-crimsonText text-[11px] text-parchment-400">
                  Restrict unit placement to team staging boundaries
                </span>
              </div>
              <input
                type="checkbox"
                checked={zonesEnforced}
                onChange={(e) => {
                  setZonesEnforced(e.target.checked);
                  soundSystem.playUIClick?.();
                }}
                className="w-4 h-4 accent-gold-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gold-800/30">
          <button
            onClick={() => {
              soundSystem.playUIClick?.();
              onClose();
            }}
            className="btn-fantasy-secondary px-5 py-2 text-xs"
          >
            Cancel
          </button>
          <button
            onClick={handleDeploy}
            className="btn-fantasy-primary px-6 py-2 text-xs font-bold flex items-center gap-2"
          >
            <Swords className="w-4 h-4" />
            <span>Deploy to Battleground</span>
          </button>
        </div>
      </div>
    </div>
  );
};
