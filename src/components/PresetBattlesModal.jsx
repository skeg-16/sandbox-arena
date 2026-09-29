import React, { useState } from 'react';
import { PRESET_SCENARIOS } from '../sandbox/PresetBattles';
import { sandboxEngine } from '../sandbox/SandboxEngine';
import { useSandboxStore } from '../store/useSandboxStore';
import { soundSystem } from '../sandbox/SoundSystem';
import { Crown, Zap, Sparkles, Swords, Ghost, Flame, X } from 'lucide-react';

const ICON_MAP = { Crown, Zap, Sparkles, Swords, Ghost, Flame };

export const PresetBattlesModal = ({ isOpen, onClose }) => {
  const { gamePhase } = useSandboxStore();
  const [activeTab, setActiveTab] = useState('boss');

  if (!isOpen) return null;

  const handleSelect = (scenario) => {
    soundSystem.playBluntHit();
    sandboxEngine.loadPresetScenario(scenario);
    onClose();
  };

  const filteredScenarios = PRESET_SCENARIOS.filter(s => s.category === activeTab);

  return (
    <div className="fantasy-modal-overlay animate-fade-in" onClick={onClose}>
      <div className="fantasy-modal max-w-2xl w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3" style={{ borderBottom: '1px solid rgba(201, 168, 76, 0.2)' }}>
          <div>
            <h2 className="font-cinzel text-xl font-black uppercase text-gold-gradient tracking-wider">
              Battle Scenarios & Boss Fights
            </h2>
            <p className="font-crimsonText text-xs text-parchment-400 italic mt-0.5">
              Load instant epic formations & mythic deity clashes onto the arena
            </p>
          </div>
          <button
            onClick={() => { soundSystem.playSwordSlash(); onClose(); }}
            className="p-2 rounded-xl bg-obsidian-800 hover:bg-obsidian-700 text-parchment-400 hover:text-parchment-200 transition-all border border-gold-800/15"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 my-2.5 p-1 bg-obsidian-950/80 rounded-xl border border-gold-800/20">
          <button
            onClick={() => { soundSystem.playSwordSlash(); setActiveTab('boss'); }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-cinzel font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2 ${
              activeTab === 'boss'
                ? 'bg-gradient-to-r from-red-900/80 via-amber-900/60 to-red-900/80 text-amber-200 border border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                : 'text-parchment-400 hover:text-parchment-200 hover:bg-obsidian-850'
            }`}
          >
            <Crown className="w-4 h-4 text-amber-400" />
            Mythic Boss Fights (5)
          </button>

          <button
            onClick={() => { soundSystem.playSwordSlash(); setActiveTab('classic'); }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-cinzel font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2 ${
              activeTab === 'classic'
                ? 'bg-gradient-to-r from-blue-900/80 to-indigo-900/80 text-blue-200 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                : 'text-parchment-400 hover:text-parchment-200 hover:bg-obsidian-850'
            }`}
          >
            <Swords className="w-4 h-4 text-blue-400" />
            Classic Formations (4)
          </button>
        </div>

        {/* Preset Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-2 max-h-[60vh] overflow-y-auto pr-1">
          {filteredScenarios.map((scenario) => {
            const IconComponent = ICON_MAP[scenario.icon] || Swords;
            const isBoss = scenario.category === 'boss';

            return (
              <button
                key={scenario.id}
                onClick={() => handleSelect(scenario)}
                disabled={gamePhase !== 'PLACEMENT'}
                className="flex items-start gap-3 p-3.5 rounded-xl text-left transition-all hover:scale-[1.02] group relative overflow-hidden"
                style={{
                  background: isBoss ? 'linear-gradient(135deg, rgba(28, 14, 16, 0.85), rgba(18, 12, 22, 0.9))' : 'rgba(17, 14, 23, 0.8)',
                  border: isBoss ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(201, 168, 76, 0.15)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = isBoss ? 'rgba(239, 68, 68, 0.7)' : 'rgba(201, 168, 76, 0.45)';
                  e.currentTarget.style.boxShadow = isBoss ? '0 4px 20px rgba(0, 0, 0, 0.6), 0 0 15px rgba(239, 68, 68, 0.25)' : '0 4px 20px rgba(0, 0, 0, 0.6), 0 0 15px rgba(201, 168, 76, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = isBoss ? 'rgba(239, 68, 68, 0.35)' : 'rgba(201, 168, 76, 0.15)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.4)';
                }}
              >
                <div className="p-3 rounded-xl shrink-0 transition-all"
                  style={{
                    background: isBoss ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(217, 119, 6, 0.15))' : 'linear-gradient(135deg, rgba(201, 168, 76, 0.15), rgba(168, 137, 48, 0.08))',
                    border: isBoss ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(201, 168, 76, 0.25)',
                  }}>
                  <IconComponent className={`w-6 h-6 ${isBoss ? 'text-red-400' : 'text-gold-400'}`} />
                </div>
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-cinzel font-bold text-sm text-parchment-100 group-hover:text-gold-300 transition-colors">
                      {scenario.name}
                    </span>
                    {scenario.badge && (
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-red-950/80 text-red-300 border border-red-500/40 tracking-wider">
                        {scenario.badge}
                      </span>
                    )}
                  </div>
                  <span className="font-crimsonText text-xs text-parchment-400 leading-snug italic">
                    {scenario.desc}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="ornate-divider mt-2" />
        <p className="font-crimsonText text-[11px] text-parchment-600 text-center italic">
          Loading a scenario clears current battlefield units and sets up formations instantly
        </p>
      </div>
    </div>
  );
};
