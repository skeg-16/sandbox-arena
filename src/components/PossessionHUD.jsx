import React from 'react';
import { useSandboxStore } from '../store/useSandboxStore';
import { sandboxEngine } from '../sandbox/SandboxEngine';
import { soundSystem } from '../sandbox/SoundSystem';
import { Gamepad2, X, Heart, Swords, Zap, Flame, Sparkles } from 'lucide-react';

export const PossessionHUD = () => {
  const {
    isPossessing,
    possessedUnit,
    possessionCombo,
    possessionComboText,
    possessionUltCooldown,
    possessionUltMaxCooldown
  } = useSandboxStore();

  if (!isPossessing || !possessedUnit) return null;

  const handleExit = () => {
    soundSystem.playSwordSlash();
    if (sandboxEngine.possessionController) {
      sandboxEngine.possessionController.exitPossession();
    }
  };

  const hpPercent = Math.max(0, Math.min(100, (possessedUnit.health / possessedUnit.maxHealth) * 100));
  const isLowHP = hpPercent < 30;

  // Ultimate readiness
  const isUltReady = (possessionUltCooldown || 0) <= 0;
  const ultProgress = Math.min(100, Math.max(0, ((possessionUltMaxCooldown - possessionUltCooldown) / (possessionUltMaxCooldown || 1)) * 100));
  const ultName = possessedUnit.typeConfig.ultimateName || 'Ultimate Ability';
  const fightStyle = possessedUnit.typeConfig.fightStyle || 'Active Combat';

  return (
    <>
      {/* Center Aiming Reticle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
        <div className="w-10 h-10 flex items-center justify-center">
          {/* Outer ring */}
          <div className="absolute w-10 h-10 rounded-full border-2 border-gold-400/50"
            style={{ boxShadow: '0 0 12px rgba(201, 168, 76, 0.3)' }} />
          {/* Inner crosshair */}
          <div className="absolute w-0.5 h-3 bg-gold-400/60 -top-0.5 left-1/2 -translate-x-1/2" />
          <div className="absolute w-0.5 h-3 bg-gold-400/60 -bottom-0.5 left-1/2 -translate-x-1/2" />
          <div className="absolute h-0.5 w-3 bg-gold-400/60 top-1/2 -translate-y-1/2 -left-0.5" />
          <div className="absolute h-0.5 w-3 bg-gold-400/60 top-1/2 -translate-y-1/2 -right-0.5" />
          {/* Center dot */}
          <div className={`w-1.5 h-1.5 rounded-full ${isLowHP ? 'bg-crimson-400 animate-ping' : 'bg-gold-400'}`} />
        </div>
      </div>

      {/* Dynamic Fighting Game Combo Counter */}
      {possessionCombo > 0 && (
        <div className="absolute top-1/2 right-1/4 -translate-y-1/2 z-30 pointer-events-none animate-bounce flex flex-col items-center">
          <div
            className={`font-cinzel font-black tracking-widest uppercase text-center px-4 py-1.5 rounded-lg border shadow-2xl ${
              possessionCombo === 3
                ? 'text-yellow-300 bg-red-950/80 border-yellow-400 text-2xl scale-125'
                : possessionCombo === 2
                ? 'text-amber-400 bg-obsidian-900/80 border-amber-500 text-xl scale-110'
                : 'text-parchment-200 bg-obsidian-900/70 border-gold-600/40 text-lg'
            }`}
            style={{
              textShadow: possessionCombo === 3 ? '0 0 16px #facc15, 0 0 30px #ef4444' : '0 0 10px #f59e0b',
              boxShadow: possessionCombo === 3 ? '0 0 25px rgba(239, 68, 68, 0.5)' : 'none'
            }}
          >
            {possessionComboText}
          </div>
          <span className="font-cinzel text-[10px] text-parchment-400 tracking-widest mt-1 uppercase">
            {possessionCombo === 3 ? '★ HEAVY IMPACT FINISHER ★' : 'CHAIN COMBO'}
          </span>
        </div>
      )}

      {/* Top Center Control Header - Slim Mobile Pill / Desktop Panel */}
      <div className="absolute top-2 md:top-4 left-1/2 -translate-x-1/2 z-40 fantasy-panel px-3 py-1.5 md:px-5 md:py-2.5 rounded-full md:rounded-2xl max-w-[95%] md:max-w-md animate-fade-in-down backdrop-blur-md bg-obsidian-950/80 border border-gold-600/40 shadow-xl">
        <div className="flex items-center gap-2 md:gap-3">
          {/* Deity Emblem & Name */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Gamepad2 className="w-3.5 h-3.5 text-gold-400 animate-pulse" />
            <span className="font-cinzel font-black text-[11px] md:text-xs uppercase text-gold-300 tracking-wider">
              {possessedUnit.typeConfig.name}
            </span>
          </div>

          {/* Slim Live HP Bar */}
          <div className="flex items-center gap-1.5 flex-1 min-w-[70px] md:min-w-[120px]">
            <Heart className={`w-3 h-3 ${isLowHP ? 'text-crimson-400 animate-pulse' : 'text-crimson-400'} shrink-0`} />
            <div className="hp-bar-track flex-1" style={{ height: '6px' }}>
              <div
                className={possessedUnit.teamId === 'blue' ? 'hp-bar-fill-blue' : 'hp-bar-fill-red'}
                style={{
                  width: `${hpPercent}%`,
                  transition: 'width 0.15s ease-out',
                }}
              />
            </div>
            <span className="font-crimsonText text-[10px] md:text-xs font-bold text-parchment-200 shrink-0">
              {Math.round(possessedUnit.health)}
            </span>
          </div>

          {/* Exit Button */}
          <button
            onClick={handleExit}
            className="btn-fantasy-danger px-2 py-0.5 text-[9px] md:text-[10px] flex items-center gap-1 shrink-0 rounded-full"
          >
            <X className="w-2.5 h-2.5" /> Exit
          </button>
        </div>
      </div>

      {/* Ultimate Ability Widget (Desktop Only) */}
      <div className="hidden lg:flex absolute bottom-6 right-8 z-40 fantasy-panel px-5 py-3 items-center gap-4 animate-fade-in-up"
        style={{ border: isUltReady ? '2px solid rgba(250, 204, 21, 0.8)' : '1px solid rgba(201, 168, 76, 0.25)', boxShadow: isUltReady ? '0 0 20px rgba(250, 204, 21, 0.3)' : 'none' }}>
        <div className="relative w-12 h-12 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-obsidian-700 bg-obsidian-900" />
          {isUltReady ? (
            <div className="absolute inset-0 rounded-full border-2 border-yellow-400 animate-ping opacity-75" />
          ) : (
            <div
              className="absolute inset-0 rounded-full border-2 border-yellow-500/60"
              style={{
                clipPath: `polygon(50% 50%, -50% -50%, ${ultProgress}% -50%, ${ultProgress}% 150%, -50% 150%)`
              }}
            />
          )}
          <Zap className={`w-6 h-6 relative z-10 ${isUltReady ? 'text-yellow-400 animate-pulse' : 'text-parchment-500'}`} />
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-cinzel font-black text-xs uppercase text-gold-300">
              {ultName}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
              isUltReady ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40' : 'bg-obsidian-800 text-parchment-500'
            }`}>
              {isUltReady ? '[Q] READY' : `${Math.ceil(possessionUltCooldown)}s`}
            </span>
          </div>
          <span className="font-crimsonText text-[11px] text-parchment-400 max-w-[200px] truncate">
            {possessedUnit.typeConfig.ultimateDesc || 'Devastating Signature Strike'}
          </span>
        </div>
      </div>

      {/* Bottom Controls Legend (Desktop) */}
      <div className="hidden lg:flex absolute bottom-6 left-1/2 -translate-x-1/2 z-40 fantasy-panel px-6 py-3 items-center gap-4 animate-fade-in-up">
        {[
          { key: 'Mouse', label: 'Aim / Look', color: 'text-amber-300' },
          { key: 'WASD', label: 'Move', color: 'text-gold-400' },
          { key: 'LMB', label: '3-Hit Combo', color: 'text-crimson-300' },
          { key: 'Q / RMB', label: 'Ultimate', color: 'text-yellow-300' },
          { key: 'Space', label: 'Jump', color: 'text-blue-300' },
          { key: 'Shift', label: 'Sprint', color: 'text-emerald-300' },
          { key: 'E / Esc', label: 'Exit', color: 'text-parchment-400' },
        ].map((ctrl, i) => (
          <div key={ctrl.key} className="flex items-center gap-2">
            {i > 0 && <div className="w-px h-4 bg-gold-800/20" />}
            <span className={`px-2 py-0.5 rounded-md bg-obsidian-800 border border-gold-800/20 font-cinzel font-bold text-[10px] ${ctrl.color}`}>
              {ctrl.key}
            </span>
            <span className="font-crimsonText text-xs text-parchment-400">{ctrl.label}</span>
          </div>
        ))}
      </div>

      {/* ═══ MOBILE ULTRA-COMPACT COMBAT CONTROLS ═══ */}
      {/* Left: Compact Translucent Virtual D-Pad (only ~75px wide) */}
      <div className="flex lg:hidden absolute bottom-3 left-3 z-40 flex-col items-center gap-0.5 select-none pointer-events-auto opacity-75 hover:opacity-100 active:opacity-100 transition-opacity">
        <button
          onTouchStart={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.w = true; }}
          onTouchEnd={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.w = false; }}
          onMouseDown={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.w = true; }}
          onMouseUp={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.w = false; }}
          className="w-9 h-9 rounded-lg bg-obsidian-950/60 backdrop-blur-sm border border-gold-500/30 flex items-center justify-center text-gold-300 active:bg-gold-500/30 active:scale-90 shadow-md text-xs font-bold"
        >
          ▲
        </button>
        <div className="flex items-center gap-0.5">
          <button
            onTouchStart={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.a = true; }}
            onTouchEnd={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.a = false; }}
            onMouseDown={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.a = true; }}
            onMouseUp={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.a = false; }}
            className="w-9 h-9 rounded-lg bg-obsidian-950/60 backdrop-blur-sm border border-gold-500/30 flex items-center justify-center text-gold-300 active:bg-gold-500/30 active:scale-90 shadow-md text-xs font-bold"
          >
            ◀
          </button>
          <button
            onTouchStart={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.s = true; }}
            onTouchEnd={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.s = false; }}
            onMouseDown={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.s = true; }}
            onMouseUp={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.s = false; }}
            className="w-9 h-9 rounded-lg bg-obsidian-950/60 backdrop-blur-sm border border-gold-500/30 flex items-center justify-center text-gold-300 active:bg-gold-500/30 active:scale-90 shadow-md text-xs font-bold"
          >
            ▼
          </button>
          <button
            onTouchStart={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.d = true; }}
            onTouchEnd={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.d = false; }}
            onMouseDown={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.d = true; }}
            onMouseUp={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.d = false; }}
            className="w-9 h-9 rounded-lg bg-obsidian-950/60 backdrop-blur-sm border border-gold-500/30 flex items-center justify-center text-gold-300 active:bg-gold-500/30 active:scale-90 shadow-md text-xs font-bold"
          >
            ▶
          </button>
        </div>
      </div>

      {/* Right: Compact Translucent Action Buttons (only ~95px wide) */}
      <div className="flex lg:hidden absolute bottom-3 right-3 z-40 items-end gap-2 select-none pointer-events-auto opacity-80 hover:opacity-100 active:opacity-100 transition-opacity">
        <div className="flex flex-col gap-1.5 items-center">
          {/* Jump Button */}
          <button
            onClick={() => sandboxEngine.possessionController?.jump()}
            className="w-9 h-9 rounded-xl bg-blue-950/60 backdrop-blur-sm border border-blue-400/40 flex items-center justify-center text-blue-200 font-cinzel font-bold text-[9px] shadow-md active:scale-90"
            title="Jump"
          >
            JUMP
          </button>
          {/* Ultimate Button */}
          <button
            onClick={() => sandboxEngine.possessionController?.ultimate()}
            disabled={!isUltReady}
            className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center font-cinzel font-bold text-[9px] shadow-lg transition-all active:scale-90 border backdrop-blur-sm ${
              isUltReady
                ? 'bg-amber-600/70 border-amber-300 text-yellow-100 animate-pulse shadow-amber-500/30'
                : 'bg-obsidian-950/50 border-gold-800/30 text-parchment-500/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>ULT</span>
          </button>
        </div>

        {/* Ergonomic Attack Button */}
        <button
          onClick={() => sandboxEngine.possessionController?.attack()}
          className="w-14 h-14 rounded-full bg-gradient-to-br from-crimson-600/80 via-crimson-700/80 to-obsidian-950/80 backdrop-blur-sm border-2 border-gold-400/80 text-parchment-50 flex flex-col items-center justify-center shadow-crimson-glow active:scale-90 transition-transform"
        >
          <Swords className="w-5 h-5 text-gold-200" />
          <span className="font-cinzel font-black text-[9px] uppercase tracking-wider mt-0.5 text-gold-100">ATK</span>
        </button>
      </div>

      <div className="absolute inset-0 pointer-events-none z-[4]"
        style={{
          boxShadow: `inset 0 0 100px rgba(201, 168, 76, 0.08), inset 0 0 200px rgba(6, 5, 8, 0.4)`,
        }}
      />
    </>
  );
};

