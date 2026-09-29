import React, { useEffect, useState } from 'react';
import { sandboxEngine } from '../sandbox/SandboxEngine';
import { useSandboxStore } from '../store/useSandboxStore';
import { Zap, Crown, Ghost, Waves, Flame } from 'lucide-react';

export const BossHealthBarOverlay = () => {
  const [bosses, setBosses] = useState([]);
  const { isPossessing, possessedUnit } = useSandboxStore();

  useEffect(() => {
    const interval = setInterval(() => {
      if (!sandboxEngine || !sandboxEngine.units) return;

      const activeBosses = sandboxEngine.units
        .filter(u => u.typeConfig && u.typeConfig.isBoss && !u.isDead)
        .map(u => ({
          id: u.id,
          name: u.typeConfig.name,
          title: u.typeConfig.title || 'Mythic Deity',
          health: Math.max(0, Math.round(u.health)),
          maxHealth: u.maxHealth,
          healthPct: Math.max(0, Math.min(100, (u.health / u.maxHealth) * 100)),
          isEnraged: !!u.isEnraged,
          teamId: u.teamId,
          typeId: u.typeConfig.id
        }));

      setBosses(activeBosses);
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // When possessing a boss, don't render a duplicate boss bar for oneself (PossessionHUD already shows it)
  const displayBosses = isPossessing && possessedUnit
    ? bosses.filter(b => b.id !== possessedUnit.id)
    : bosses;

  if (displayBosses.length === 0) return null;

  const getDeityIcon = (typeId) => {
    switch (typeId) {
      case 'zeus':
        return <Zap className="w-4 h-4 md:w-5 md:h-5 text-amber-300 animate-pulse" />;
      case 'ares':
        return <Crown className="w-4 h-4 md:w-5 md:h-5 text-red-500 animate-bounce" />;
      case 'hades':
        return <Ghost className="w-4 h-4 md:w-5 md:h-5 text-emerald-400 animate-pulse" />;
      case 'poseidon':
        return <Waves className="w-4 h-4 md:w-5 md:h-5 text-cyan-400 animate-pulse" />;
      default:
        return <Flame className="w-4 h-4 md:w-5 md:h-5 text-amber-500" />;
    }
  };

  const getTeamColors = (teamId, isEnraged) => {
    if (isEnraged) {
      return {
        border: 'border-red-500/80 shadow-[0_0_25px_rgba(239,68,68,0.6)]',
        bg: 'bg-red-950/60',
        fill: 'bg-gradient-to-r from-red-600 via-amber-500 to-red-500',
        glow: 'rgba(239, 68, 68, 0.4)',
        badge: 'bg-red-900/90 text-red-200 border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)]'
      };
    }
    if (teamId === 'blue') {
      return {
        border: 'border-blue-500/60 shadow-[0_0_20px_rgba(59,130,246,0.3)]',
        bg: 'bg-blue-950/40',
        fill: 'bg-gradient-to-r from-blue-600 via-indigo-400 to-cyan-400',
        glow: 'rgba(59, 130, 246, 0.3)',
        badge: 'bg-blue-900/80 text-blue-200 border-blue-500/50'
      };
    }
    return {
      border: 'border-amber-600/60 shadow-[0_0_20px_rgba(217,119,6,0.3)]',
      bg: 'bg-amber-950/40',
      fill: 'bg-gradient-to-r from-red-600 via-amber-500 to-amber-400',
      glow: 'rgba(239, 68, 68, 0.3)',
      badge: 'bg-red-900/80 text-red-200 border-red-500/50'
    };
  };

  return (
    <div className={`fixed ${isPossessing ? 'top-20 md:top-24' : 'top-14 md:top-16'} left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center gap-1.5 md:gap-2.5 w-[94%] max-w-xl px-2 md:px-4 transition-all duration-300`}>
      {displayBosses.map((boss) => {
        const theme = getTeamColors(boss.teamId, boss.isEnraged);
        return (
          <div
            key={boss.id}
            className={`w-full relative backdrop-blur-md rounded-lg p-1.5 md:p-2.5 px-3 md:px-4 border ${theme.border} ${theme.bg} transition-all duration-300`}
            style={{
              background: 'linear-gradient(180deg, rgba(12, 10, 18, 0.85) 0%, rgba(6, 5, 10, 0.95) 100%)',
              boxShadow: `0 8px 32px -4px rgba(0,0,0,0.8), 0 0 20px -2px ${theme.glow}`
            }}
          >
            {/* Header: Deity Icon, Name, Title, and Enrage Badge */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 md:gap-2">
                <div className="p-0.5 md:p-1 rounded-md bg-black/40 border border-white/10 flex items-center justify-center">
                  {getDeityIcon(boss.typeId)}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <span className="font-serif tracking-widest uppercase font-bold text-xs md:text-sm text-amber-200 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                      {boss.name}
                    </span>
                    <span className={`text-[9px] uppercase font-mono px-1 py-0.2 rounded border ${
                      boss.teamId === 'blue' ? 'text-blue-300 border-blue-500/40 bg-blue-950/60' : 'text-red-300 border-red-500/40 bg-red-950/60'
                    }`}>
                      {boss.teamId}
                    </span>
                  </div>
                  <div className="hidden sm:block text-[10px] text-amber-400/80 font-sans tracking-wide">
                    {boss.title}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 md:gap-3">
                {boss.isEnraged && (
                  <span className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded-full border animate-pulse ${theme.badge}`}>
                    ⚡ ENRAGED
                  </span>
                )}
                <span className="font-mono text-[11px] md:text-xs text-amber-100 font-semibold drop-shadow">
                  {boss.health} / {boss.maxHealth}
                </span>
              </div>
            </div>

            {/* Health Bar Track */}
            <div className="relative h-2 md:h-3 w-full bg-black/70 rounded-full overflow-hidden border border-white/10 p-[1px]">
              {/* Fill Bar */}
              <div
                className={`h-full rounded-full transition-all duration-200 ease-out ${theme.fill}`}
                style={{ width: `${boss.healthPct}%` }}
              />
              {/* Shimmer light streak */}
              <div
                className="absolute inset-0 opacity-25 pointer-events-none bg-gradient-to-r from-transparent via-white to-transparent"
                style={{
                  backgroundSize: '200% 100%'
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
