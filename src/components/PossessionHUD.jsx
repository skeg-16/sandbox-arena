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

      {/* Top Center Control Header */}
      <div className="absolute top-2 md:top-4 left-1/2 -translate-x-1/2 z-40 fantasy-panel px-3.5 py-2 md:px-6 md:py-3 w-[92%] max-w-sm animate-fade-in-down"
        style={{ border: '2px solid rgba(201, 168, 76, 0.4)' }}>
        <div className="flex flex-col gap-1.5 md:gap-2">
          {/* Title Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-gold-400 animate-pulse shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="font-cinzel font-black text-xs uppercase text-gold-300 tracking-[0.12em] truncate">
                  Possessing {possessedUnit.typeConfig.name}
                </span>
                <span className="text-[9px] md:text-[10px] text-parchment-400 font-crimsonText italic truncate">
                  Fight Style: {fightStyle}
                </span>
              </div>
            </div>

            <button
              onClick={handleExit}
              className="btn-fantasy-danger px-2 py-0.5 md:px-2.5 md:py-1 text-[9px] md:text-[10px] flex items-center gap-1 shrink-0 ml-2"
            >
              <X className="w-3 h-3" /> Exit [E]
            </button>
          </div>

          {/* Live HP Bar */}
          <div className="flex items-center gap-2.5">
            <Heart className={`w-3 h-3 md:w-3.5 md:h-3.5 ${isLowHP ? 'text-crimson-400 animate-pulse' : 'text-crimson-400'} shrink-0`} />
            <div className="hp-bar-track flex-1" style={{ height: '8px' }}>
              <div
                className={possessedUnit.teamId === 'blue' ? 'hp-bar-fill-blue' : 'hp-bar-fill-red'}
                style={{
                  width: `${hpPercent}%`,
                  transition: 'width 0.15s ease-out',
                }}
              />
            </div>
            <span className="font-crimsonText text-xs font-bold text-parchment-200 shrink-0 w-12 text-right">
              {Math.round(possessedUnit.health)} HP
            </span>
          </div>
        </div>
      </div>

      {/* Ultimate Ability Widget (Desktop Only - on mobile it is in the on-screen action dock) */}
      <div className="hidden lg:flex absolute bottom-6 right-8 z-40 fantasy-panel px-5 py-3 items-center gap-4 animate-fade-in-up"
        style={{ border: isUltReady ? '2px solid rgba(250, 204, 21, 0.8)' : '1px solid rgba(201, 168, 76, 0.25)', boxShadow: isUltReady ? '0 0 20px rgba(250, 204, 21, 0.3)' : 'none' }}>
        <div className="relative w-12 h-12 flex items-center justify-center">
          {/* Circular progress background */}
          <div className="absolute inset-0 rounded-full border-2 border-obsidian-700 bg-obsidian-900" />
          {/* Ready Pulse Ring */}
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

      {/* ═══ MOBILE ON-SCREEN COMBAT CONTROLS ═══ */}
      {/* Left: Virtual D-Pad / Movement */}
      <div className="flex lg:hidden absolute bottom-6 left-4 z-40 flex-col items-center gap-1 select-none pointer-events-auto">
        <button
          onTouchStart={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.w = true; }}
          onTouchEnd={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.w = false; }}
          onMouseDown={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.w = true; }}
          onMouseUp={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.w = false; }}
          className="w-12 h-12 rounded-xl bg-obsidian-900/90 border border-gold-600/50 flex items-center justify-center text-gold-300 active:scale-95 active:bg-gold-600/30 shadow-lg text-sm font-black"
        >
          ▲
        </button>
        <div className="flex items-center gap-1">
          <button
            onTouchStart={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.a = true; }}
            onTouchEnd={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.a = false; }}
            onMouseDown={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.a = true; }}
            onMouseUp={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.a = false; }}
            className="w-12 h-12 rounded-xl bg-obsidian-900/90 border border-gold-600/50 flex items-center justify-center text-gold-300 active:scale-95 active:bg-gold-600/30 shadow-lg text-sm font-black"
          >
            ◀
          </button>
          <button
            onTouchStart={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.s = true; }}
            onTouchEnd={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.s = false; }}
            onMouseDown={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.s = true; }}
            onMouseUp={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.s = false; }}
            className="w-12 h-12 rounded-xl bg-obsidian-900/90 border border-gold-600/50 flex items-center justify-center text-gold-300 active:scale-95 active:bg-gold-600/30 shadow-lg text-sm font-black"
          >
            ▼
          </button>
          <button
            onTouchStart={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.d = true; }}
            onTouchEnd={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.d = false; }}
            onMouseDown={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.d = true; }}
            onMouseUp={() => { if (sandboxEngine.possessionController) sandboxEngine.possessionController.keys.d = false; }}
            className="w-12 h-12 rounded-xl bg-obsidian-900/90 border border-gold-600/50 flex items-center justify-center text-gold-300 active:scale-95 active:bg-gold-600/30 shadow-lg text-sm font-black"
          >
            ▶
          </button>
        </div>
      </div>

      {/* Right: Combat Action Buttons (Attack, Ultimate, Jump) */}
      <div className="flex lg:hidden absolute bottom-6 right-4 z-40 items-end gap-3 select-none pointer-events-auto">
        <div className="flex flex-col gap-2">
          {/* Jump Button */}
          <button
            onClick={() => sandboxEngine.possessionController?.jump()}
            className="w-11 h-11 rounded-xl bg-blue-950/90 border border-blue-500/60 flex items-center justify-center text-blue-300 font-cinzel font-bold text-xs shadow-lg active:scale-95"
            title="Jump"
          >
            JUMP
          </button>
          {/* Ultimate Button */}
          <button
            onClick={() => sandboxEngine.possessionController?.ultimate()}
            disabled={!isUltReady}
            className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-cinzel font-bold text-[10px] shadow-2xl transition-all active:scale-95 border ${
              isUltReady
                ? 'bg-gradient-to-br from-amber-500 via-amber-600 to-yellow-600 text-obsidian-950 border-amber-300 animate-pulse'
                : 'bg-obsidian-900/90 border-gold-800/30 text-parchment-500 opacity-60'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>ULT</span>
          </button>
        </div>

        {/* Big Combo Attack Button */}
        <button
          onClick={() => sandboxEngine.possessionController?.attack()}
          className="w-20 h-20 rounded-full bg-gradient-to-br from-crimson-500 via-crimson-600 to-red-800 border-2 border-gold-400 text-parchment-50 flex flex-col items-center justify-center shadow-crimson-glow-lg active:scale-90 transition-transform"
        >
          <Swords className="w-7 h-7" />
          <span className="font-cinzel font-black text-[10px] uppercase tracking-wider mt-0.5">ATTACK</span>
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

