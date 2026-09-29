import React from 'react';
import { CAMPAIGN_LEVELS } from '../sandbox/CampaignConfig';
import { sandboxEngine } from '../sandbox/SandboxEngine';
import { useSandboxStore } from '../store/useSandboxStore';
import { soundSystem } from '../sandbox/SoundSystem';
import { Target, Coins, ShieldAlert, X, ChevronRight, Crown } from 'lucide-react';

export const CampaignModal = ({ isOpen, onClose }) => {
  const { currentLevelIndex, gameMode } = useSandboxStore();

  if (!isOpen) return null;

  const handleSelectLevel = (idx) => {
    soundSystem.playBluntHit();
    sandboxEngine.loadCampaignLevel(idx);
    onClose();
  };

  return (
    <div className="fantasy-modal-overlay animate-fade-in" onClick={onClose}>
      <div className="fantasy-modal max-w-3xl w-full animate-scale-in overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 shrink-0" style={{ borderBottom: '1px solid rgba(201, 168, 76, 0.2)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-gold-500 to-gold-700 border border-gold-400/50 shadow-gold-glow">
              <Crown className="w-5 h-5 text-obsidian-950" />
            </div>
            <div>
              <h2 className="font-cinzel text-xl font-black uppercase text-gold-gradient tracking-wider">
                Campaign Conquest
              </h2>
              <p className="font-crimsonText text-xs text-parchment-400 italic mt-0.5">
                Test your strategy across hand-crafted tactical challenges
              </p>
            </div>
          </div>
          <button
            onClick={() => { soundSystem.playSwordSlash(); onClose(); }}
            className="p-2 rounded-xl bg-obsidian-800 hover:bg-obsidian-700 text-parchment-400 hover:text-parchment-200 transition-all border border-gold-800/15"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Levels Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto pr-1 my-1 max-h-[60vh]">
          {CAMPAIGN_LEVELS.map((lvl, idx) => {
            const isCurrent = gameMode === 'CAMPAIGN' && currentLevelIndex === idx;

            return (
              <button
                key={lvl.level}
                onClick={() => handleSelectLevel(idx)}
                className={`flex items-start justify-between p-4 rounded-xl text-left transition-all hover:scale-[1.01] group ${
                  isCurrent ? 'scale-[1.01]' : ''
                }`}
                style={{
                  background: isCurrent
                    ? 'rgba(201, 168, 76, 0.08)'
                    : 'rgba(17, 14, 23, 0.8)',
                  border: isCurrent
                    ? '2px solid rgba(201, 168, 76, 0.5)'
                    : '1px solid rgba(201, 168, 76, 0.15)',
                  boxShadow: isCurrent
                    ? '0 0 20px rgba(201, 168, 76, 0.2), 0 4px 16px rgba(0, 0, 0, 0.5)'
                    : '0 2px 8px rgba(0, 0, 0, 0.4)',
                }}
              >
                <div className="flex flex-col gap-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-cinzel text-[10px] font-bold text-gold-600 bg-gold-900/30 px-2 py-0.5 rounded-md border border-gold-800/20">
                      LVL {lvl.level}
                    </span>
                    <span className="font-cinzel font-bold text-sm text-parchment-100 group-hover:text-gold-300 transition-colors">
                      {lvl.title}
                    </span>
                  </div>
                  <span className="font-crimsonText text-xs text-parchment-400 leading-snug italic">
                    {lvl.desc}
                  </span>
                  <div className="flex items-center gap-3 pt-1 font-crimsonText text-xs font-bold">
                    <span className="flex items-center gap-1 text-gold-400">
                      <Coins className="w-3.5 h-3.5" /> {lvl.budget} Gold
                    </span>
                    <span className="text-parchment-700">•</span>
                    <span className="flex items-center gap-1 text-crimson-300">
                      <ShieldAlert className="w-3.5 h-3.5" /> {lvl.enemies.length} Foes
                    </span>
                  </div>
                </div>

                <div className="p-2 rounded-xl shrink-0 transition-all ml-3"
                  style={{
                    background: 'rgba(201, 168, 76, 0.08)',
                    border: '1px solid rgba(201, 168, 76, 0.15)',
                  }}>
                  <ChevronRight className="w-5 h-5 text-gold-600 group-hover:text-gold-300 transition-colors" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
