import React from 'react';
import { ENVIRONMENTS } from '../sandbox/EnvironmentConfig';
import { sandboxEngine } from '../sandbox/SandboxEngine';
import { useSandboxStore } from '../store/useSandboxStore';
import { soundSystem } from '../sandbox/SoundSystem';
import { Trees, Flame, Snowflake, Sun, X, Sparkles } from 'lucide-react';

const ENV_ICONS = {
  plains: Trees,
  volcano: Flame,
  snow: Snowflake,
  desert: Sun
};

const ENV_FLAVOR = {
  plains: { gradient: 'from-emerald-600/20 to-emerald-900/10', border: 'rgba(74, 222, 128, 0.3)' },
  volcano: { gradient: 'from-orange-600/20 to-red-900/10', border: 'rgba(249, 115, 22, 0.3)' },
  snow: { gradient: 'from-sky-400/20 to-blue-900/10', border: 'rgba(56, 189, 248, 0.3)' },
  desert: { gradient: 'from-amber-500/20 to-yellow-900/10', border: 'rgba(234, 179, 8, 0.3)' },
};

export const EnvironmentPickerModal = ({ isOpen, onClose }) => {
  const { activeEnvironment, setEnvironment } = useSandboxStore();

  if (!isOpen) return null;

  const handleSelect = (envId) => {
    soundSystem.playBluntHit();
    setEnvironment(envId);
    if (sandboxEngine.threeScene) {
      sandboxEngine.threeScene.setEnvironment(envId);
    }
    onClose();
  };

  return (
    <div className="fantasy-modal-overlay animate-fade-in" onClick={onClose}>
      <div className="fantasy-modal max-w-xl w-full animate-scale-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3" style={{ borderBottom: '1px solid rgba(201, 168, 76, 0.2)' }}>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-gold-400" />
            <div>
              <h2 className="font-cinzel text-xl font-black uppercase text-gold-gradient tracking-wider">
                Arena Realm
              </h2>
              <p className="font-crimsonText text-xs text-parchment-400 italic mt-0.5">
                Choose the battleground atmosphere and terrain
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

        {/* Environment Grid */}
        <div className="grid grid-cols-2 gap-3 my-2">
          {Object.values(ENVIRONMENTS).map((env) => {
            const IconComponent = ENV_ICONS[env.id] || Trees;
            const isSelected = activeEnvironment === env.id;
            const flavor = ENV_FLAVOR[env.id] || ENV_FLAVOR.plains;

            return (
              <button
                key={env.id}
                onClick={() => handleSelect(env.id)}
                className={`flex items-start gap-3 p-4 rounded-xl text-left transition-all group ${
                  isSelected ? 'scale-[1.02]' : 'hover:scale-[1.01]'
                }`}
                style={{
                  background: isSelected
                    ? 'rgba(201, 168, 76, 0.08)'
                    : 'rgba(17, 14, 23, 0.8)',
                  border: isSelected
                    ? '2px solid rgba(201, 168, 76, 0.5)'
                    : '1px solid rgba(201, 168, 76, 0.15)',
                  boxShadow: isSelected
                    ? '0 0 25px rgba(201, 168, 76, 0.2), 0 4px 16px rgba(0, 0, 0, 0.5)'
                    : '0 2px 8px rgba(0, 0, 0, 0.4)',
                }}
              >
                <div
                  className={`p-3 rounded-xl shrink-0 bg-gradient-to-br ${flavor.gradient} transition-all`}
                  style={{ border: `1px solid ${flavor.border}` }}
                >
                  <IconComponent className="w-6 h-6" style={{ color: flavor.border.replace('0.3', '0.9') }} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className={`font-cinzel font-bold text-sm transition-colors ${
                    isSelected ? 'text-gold-300' : 'text-parchment-100 group-hover:text-gold-400'
                  }`}>
                    {env.name}
                  </span>
                  <span className="font-crimsonText text-xs text-parchment-400 leading-snug italic">
                    {env.desc}
                  </span>
                </div>
                {isSelected && (
                  <div className="ml-auto shrink-0 px-2 py-0.5 rounded-md font-cinzel text-[9px] font-bold uppercase text-gold-400 bg-gold-900/30 border border-gold-700/30">
                    Active
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
