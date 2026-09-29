import React from 'react';
import { useSandboxStore } from '../store/useSandboxStore';
import { sandboxEngine } from '../sandbox/SandboxEngine';
import { soundSystem } from '../sandbox/SoundSystem';
import { Eye, X, Heart, Crosshair, Gamepad2, Swords, Shield } from 'lucide-react';

export const UnitInspectorCard = () => {
  const { inspectedUnit, cameraMode, setInspectedUnit, setCameraMode } = useSandboxStore();

  if (!inspectedUnit) return null;

  const isDead = inspectedUnit.isDead;
  const hpPercent = Math.max(0, Math.min(100, (inspectedUnit.health / inspectedUnit.maxHealth) * 100));

  const handleToggleFollow = () => {
    soundSystem.playSwordSlash();
    if (cameraMode === 'FOLLOW') {
      sandboxEngine.threeScene.setCameraMode('ORBIT');
      setCameraMode('ORBIT');
    } else {
      sandboxEngine.threeScene.setCameraMode('FOLLOW', inspectedUnit);
      setCameraMode('FOLLOW');
    }
  };

  const handlePossess = () => {
    soundSystem.playBluntHit();
    if (sandboxEngine.possessionController) {
      sandboxEngine.possessionController.possessUnit(inspectedUnit);
      setInspectedUnit(null);
    }
  };

  const handleClose = () => {
    soundSystem.playSwordSlash();
    if (cameraMode === 'FOLLOW') {
      sandboxEngine.threeScene.setCameraMode('ORBIT');
      setCameraMode('ORBIT');
    }
    setInspectedUnit(null);
  };

  const teamColor = inspectedUnit.teamId === 'blue';

  return (
    <div className="absolute bottom-24 right-4 z-30 w-72 fantasy-panel p-4 animate-fade-in-up flex flex-col gap-3">
      {/* Header with Team Indicator */}
      <div className="flex items-center justify-between pb-2" style={{ borderBottom: '1px solid rgba(201, 168, 76, 0.15)' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-9 flex items-center justify-center"
            style={{
              clipPath: 'polygon(50% 0%, 100% 20%, 100% 80%, 50% 100%, 0% 80%, 0% 20%)',
              background: teamColor
                ? 'linear-gradient(180deg, #3b82f6, #1e40af)'
                : 'linear-gradient(180deg, #ef4444, #991b1b)',
            }}
          >
            <Shield className="w-3 h-3 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-cinzel font-bold text-sm text-parchment-100 uppercase tracking-wider">
              {inspectedUnit.typeConfig.name}
            </span>
            <span className={`font-crimsonText text-[10px] italic ${teamColor ? 'text-blue-400' : 'text-red-400'}`}>
              House {inspectedUnit.teamId.charAt(0).toUpperCase() + inspectedUnit.teamId.slice(1)}
            </span>
          </div>
        </div>

        <button
          onClick={handleClose}
          className="p-1.5 rounded-lg bg-obsidian-800 hover:bg-obsidian-700 text-parchment-500 hover:text-parchment-200 transition-all border border-gold-800/10"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* HP Bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs">
          <span className="font-crimsonText text-parchment-400 flex items-center gap-1">
            <Heart className="w-3 h-3 text-crimson-400 fill-current" /> Health
          </span>
          <span className="font-crimsonText font-bold text-parchment-200">
            {Math.round(inspectedUnit.health)} / {inspectedUnit.maxHealth}
          </span>
        </div>
        <div className="hp-bar-track">
          <div
            className={teamColor ? 'hp-bar-fill-blue' : 'hp-bar-fill-red'}
            style={{ width: `${hpPercent}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs p-2.5 rounded-xl bg-obsidian-900/60 border border-gold-800/10 font-crimsonText">
        <div>
          <span className="text-parchment-600 block text-[10px] uppercase font-cinzel tracking-wider">Status</span>
          <span className={isDead ? 'text-crimson-300 font-bold' : (inspectedUnit.isEnraged ? 'text-red-400 font-bold animate-pulse' : (inspectedUnit.isKnockedDown ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'))}>
            {isDead ? '☠ FALLEN' : (inspectedUnit.isEnraged ? '⚡ ENRAGED' : (inspectedUnit.isKnockedDown ? '⚡ STAGGERED' : '✦ ACTIVE'))}
          </span>
        </div>
        <div>
          <span className="text-parchment-600 block text-[10px] uppercase font-cinzel tracking-wider">Damage</span>
          <span className="text-gold-400 font-bold">
            <Swords className="w-3 h-3 inline mr-1" />{inspectedUnit.typeConfig.damage}
          </span>
        </div>
      </div>

      {/* Deity / Boss Special Indicator */}
      {inspectedUnit.typeConfig.isBoss && (
        <div className="p-2 rounded-lg bg-red-950/40 border border-red-500/30 flex flex-col gap-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-cinzel font-bold text-amber-300 uppercase tracking-wider">
              {inspectedUnit.typeConfig.title || 'Mythic Deity'}
            </span>
            <span className="text-[9px] font-mono text-red-300 font-bold uppercase">BOSS</span>
          </div>
          {inspectedUnit.typeConfig.ultimateName && (
            <div className="text-[11px] font-crimsonText text-parchment-300 italic">
              Ultimate: <span className="text-amber-200 font-semibold">{inspectedUnit.typeConfig.ultimateName}</span>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-2 pt-1">
        <button
          onClick={handlePossess}
          disabled={isDead}
          className="btn-fantasy-primary flex items-center justify-center gap-2 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Gamepad2 className="w-4 h-4" /> Possess Unit
        </button>

        <button
          onClick={handleToggleFollow}
          disabled={isDead}
          className={`btn-fantasy flex items-center justify-center gap-2 py-2 ${
            cameraMode === 'FOLLOW'
              ? 'bg-gold-500/30 text-gold-300 border border-gold-500/40 shadow-ember'
              : 'bg-obsidian-800 text-parchment-300 border border-gold-800/15 hover:border-gold-800/30'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {cameraMode === 'FOLLOW' ? (
            <>
              <Crosshair className="w-3.5 h-3.5 animate-spin" /> Free Camera
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5 text-gold-500" /> Follow Unit
            </>
          )}
        </button>
      </div>
    </div>
  );
};
