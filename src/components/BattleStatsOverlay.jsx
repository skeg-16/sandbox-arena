import React, { useEffect, useState } from 'react';
import { useSandboxStore } from '../store/useSandboxStore';
import { sandboxEngine } from '../sandbox/SandboxEngine';
import { soundSystem } from '../sandbox/SoundSystem';
import { Trophy, RotateCcw, Repeat, Skull, Shield, Swords, Crown, Target, Award } from 'lucide-react';

export const BattleStatsOverlay = () => {
  const {
    gamePhase,
    blueCount,
    redCount,
    blueInitialCount,
    redInitialCount,
    battleAwards
  } = useSandboxStore();

  const [showVictory, setShowVictory] = useState(false);
  const [animPhase, setAnimPhase] = useState(0);

  const isVictory =
    gamePhase === 'VICTORY_BLUE' ||
    gamePhase === 'VICTORY_RED' ||
    gamePhase === 'DRAW';

  useEffect(() => {
    if (isVictory) {
      // Staggered reveal animation
      setTimeout(() => setShowVictory(true), 100);
      setTimeout(() => setAnimPhase(1), 300);  // Icon appears
      setTimeout(() => setAnimPhase(2), 700);  // Title appears
      setTimeout(() => setAnimPhase(3), 1000); // Stats appear
      setTimeout(() => setAnimPhase(4), 1300); // Accolades appear
      setTimeout(() => setAnimPhase(5), 1600); // Buttons appear
    } else {
      setShowVictory(false);
      setAnimPhase(0);
    }
  }, [isVictory]);

  if (!isVictory) return null;

  const blueLosses = (blueInitialCount || 0) - blueCount;
  const redLosses = (redInitialCount || 0) - redCount;

  const victoryConfig = {
    VICTORY_BLUE: {
      title: 'House Blue Victorious',
      subtitle: 'The battlefield is yours, Commander.',
      color: 'text-blue-300',
      iconBg: 'from-blue-600 to-blue-900',
      borderColor: 'border-blue-500/50',
      glowColor: 'rgba(59, 130, 246, 0.3)',
    },
    VICTORY_RED: {
      title: 'House Red Victorious',
      subtitle: 'Victory is forged in blood and steel.',
      color: 'text-red-300',
      iconBg: 'from-red-600 to-red-900',
      borderColor: 'border-red-500/50',
      glowColor: 'rgba(239, 68, 68, 0.3)',
    },
    DRAW: {
      title: 'Mutual Annihilation',
      subtitle: 'Neither house remains standing. The arena claims all.',
      color: 'text-gold-400',
      iconBg: 'from-gold-600 to-gold-800',
      borderColor: 'border-gold-500/50',
      glowColor: 'rgba(201, 168, 76, 0.3)',
    },
  };

  const cfg = victoryConfig[gamePhase] || victoryConfig.DRAW;

  return (
    <div
      className={`absolute inset-0 z-30 flex items-center justify-center transition-all duration-500 ${
        showVictory ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        background: 'rgba(6, 5, 8, 0.75)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Rotating rays behind the victory panel */}
      <div className="victory-rays" />

      {/* Victory Panel */}
      <div
        className={`relative fantasy-panel-ornate p-6 sm:p-8 max-w-lg w-full flex flex-col items-center gap-4 sm:gap-5 transition-all duration-500 max-h-[92vh] overflow-y-auto ${
          showVictory ? 'scale-100' : 'scale-90'
        }`}
        style={{
          boxShadow: `0 0 60px ${cfg.glowColor}, 0 20px 60px rgba(0, 0, 0, 0.8)`,
        }}
      >
        {/* Trophy Icon */}
        <div
          className={`transition-all duration-700 ${
            animPhase >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
          }`}
          style={{ transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
        >
          <div className={`p-4 sm:p-5 rounded-2xl bg-gradient-to-br ${cfg.iconBg} border ${cfg.borderColor} shadow-xl`}>
            <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-parchment-50" />
          </div>
        </div>

        {/* Title */}
        <div
          className={`flex flex-col items-center gap-1.5 transition-all duration-700 text-center ${
            animPhase >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <h2 className={`font-cinzel text-2xl sm:text-3xl font-black uppercase tracking-wider ${cfg.color} victory-title`}
            style={{ textShadow: `0 0 30px ${cfg.glowColor}` }}>
            {cfg.title}
          </h2>
          <p className="font-crimsonText text-xs sm:text-sm text-parchment-400 italic">
            {cfg.subtitle}
          </p>
        </div>

        {/* Ornate Divider */}
        <div className={`w-full transition-all duration-500 ${
          animPhase >= 2 ? 'opacity-100' : 'opacity-0'
        }`}>
          <div className="ornate-divider" />
        </div>

        {/* Battle Stats Breakdown */}
        <div
          className={`w-full grid grid-cols-2 gap-2.5 transition-all duration-700 ${
            animPhase >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {/* Blue Stats */}
          <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-obsidian-900/60 border border-blue-800/30">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-cinzel text-[11px] font-bold text-blue-300 uppercase tracking-wider">House Blue</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[11px] font-crimsonText">
              <span className="text-parchment-500">Survivors:</span>
              <span className="text-blue-300 font-bold">{blueCount}</span>
              <span className="text-parchment-500">Casualties:</span>
              <span className="text-crimson-300 font-bold">{blueLosses}</span>
              <span className="text-parchment-500">Started:</span>
              <span className="text-parchment-200 font-bold">{blueInitialCount || 0}</span>
            </div>
          </div>

          {/* Red Stats */}
          <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-obsidian-900/60 border border-red-800/30">
            <div className="flex items-center gap-1.5">
              <Skull className="w-3.5 h-3.5 text-red-400" />
              <span className="font-cinzel text-[11px] font-bold text-red-300 uppercase tracking-wider">House Red</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[11px] font-crimsonText">
              <span className="text-parchment-500">Survivors:</span>
              <span className="text-red-300 font-bold">{redCount}</span>
              <span className="text-parchment-500">Casualties:</span>
              <span className="text-crimson-300 font-bold">{redLosses}</span>
              <span className="text-parchment-500">Started:</span>
              <span className="text-parchment-200 font-bold">{redInitialCount || 0}</span>
            </div>
          </div>
        </div>

        {/* ═══ COMBAT ACCOLADES & MVP SECTION ═══ */}
        {battleAwards && (battleAwards.mvp || battleAwards.vanguard || battleAwards.sniper) && (
          <div
            className={`w-full flex flex-col gap-2 transition-all duration-700 ${
              animPhase >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <div className="flex items-center justify-between px-1">
              <span className="font-cinzel text-[10px] uppercase tracking-widest text-gold-400 font-bold flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-gold-400" /> Combat Accolades
              </span>
              <span className="text-[9px] font-mono text-parchment-500">Honor of the Realm</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Battle MVP */}
              {battleAwards.mvp && (
                <div className="p-2 rounded-xl bg-obsidian-950/80 border border-gold-600/40 flex flex-col gap-1 shadow-ember">
                  <div className="flex items-center gap-1 text-gold-400">
                    <Crown className="w-3 h-3 text-gold-400" />
                    <span className="font-cinzel text-[9px] font-black uppercase tracking-wider">Battle MVP</span>
                  </div>
                  <div className="font-cinzel text-xs font-bold text-parchment-100 truncate">
                    {battleAwards.mvp.name}
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px] font-mono text-amber-400">
                    <span>{battleAwards.mvp.damageDealt} DMG</span>
                    <span>•</span>
                    <span>{battleAwards.mvp.kills} Kills</span>
                  </div>
                  <div className="text-[8px] font-crimsonText uppercase text-parchment-500">
                    {battleAwards.mvp.teamId === 'blue' ? 'House Blue' : 'House Red'}
                  </div>
                </div>
              )}

              {/* Iron Vanguard */}
              {battleAwards.vanguard && (
                <div className="p-2 rounded-xl bg-obsidian-950/80 border border-blue-500/40 flex flex-col gap-1 shadow-blue-glow">
                  <div className="flex items-center gap-1 text-blue-400">
                    <Shield className="w-3 h-3 text-blue-400" />
                    <span className="font-cinzel text-[9px] font-black uppercase tracking-wider">Iron Vanguard</span>
                  </div>
                  <div className="font-cinzel text-xs font-bold text-parchment-100 truncate">
                    {battleAwards.vanguard.name}
                  </div>
                  <div className="text-[9px] font-mono text-blue-300">
                    {battleAwards.vanguard.damageAbsorbed} Absorbed
                  </div>
                  <div className="text-[8px] font-crimsonText uppercase text-parchment-500">
                    {battleAwards.vanguard.teamId === 'blue' ? 'House Blue' : 'House Red'}
                  </div>
                </div>
              )}

              {/* Deadliest Sniper */}
              {battleAwards.sniper && (
                <div className="p-2 rounded-xl bg-obsidian-950/80 border border-emerald-500/40 flex flex-col gap-1">
                  <div className="flex items-center gap-1 text-emerald-400">
                    <Target className="w-3 h-3 text-emerald-400" />
                    <span className="font-cinzel text-[9px] font-black uppercase tracking-wider">Deadliest Sniper</span>
                  </div>
                  <div className="font-cinzel text-xs font-bold text-parchment-100 truncate">
                    {battleAwards.sniper.name}
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px] font-mono text-emerald-300">
                    <span>{battleAwards.sniper.damageDealt} DMG</span>
                    <span>•</span>
                    <span>{battleAwards.sniper.kills} Kills</span>
                  </div>
                  <div className="text-[8px] font-crimsonText uppercase text-parchment-500">
                    {battleAwards.sniper.teamId === 'blue' ? 'House Blue' : 'House Red'}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div
          className={`flex items-center gap-3 w-full mt-1 transition-all duration-700 ${
            animPhase >= 5 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <button
            onClick={() => {
              sandboxEngine.resetBattle();
              soundSystem.playSwordSlash();
            }}
            className="flex-1 btn-fantasy-secondary flex items-center justify-center gap-2 py-3"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Edit Setup</span>
          </button>

          <button
            onClick={() => {
              sandboxEngine.replayBattle();
              soundSystem.playBluntHit();
            }}
            className="flex-1 btn-fantasy-primary flex items-center justify-center gap-2 py-3"
          >
            <Repeat className="w-4 h-4" />
            <span>Replay Battle</span>
          </button>
        </div>
      </div>
    </div>
  );
};
