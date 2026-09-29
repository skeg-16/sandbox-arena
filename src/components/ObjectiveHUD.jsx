import React from 'react';
import { useSandboxStore } from '../store/useSandboxStore';
import { Shield, Target, Flag, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const ObjectiveHUD = () => {
  const { gamePhase, isPossessing, objectiveHUD, scenarioType } = useSandboxStore();

  if (isPossessing || !objectiveHUD) return null;
  const isBattle = gamePhase === 'BATTLE';

  const formatTimer = (seconds) => {
    if (seconds === null || seconds === undefined) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isSiege = scenarioType === 'SIEGE' || scenarioType === 'DESTROY_KEEP';
  const isCapture = scenarioType === 'CAPTURE_POINTS';

  return (
    <div className="absolute top-16 inset-x-0 pointer-events-none flex flex-col items-center z-20 select-none animate-fade-in-down">
      <div className="pointer-events-auto fantasy-panel px-4 py-2 flex items-center gap-4 max-w-2xl border border-gold-800/40 shadow-2xl backdrop-blur-md">

        {/* ═══ Round Timer ═══ */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-obsidian-900/80 border border-gold-900/40 text-gold-400">
          <Clock className="w-3.5 h-3.5 text-gold-500" />
          <span className="font-mono text-xs font-bold tracking-wider">
            {formatTimer(objectiveHUD.timeRemaining)}
          </span>
        </div>

        {/* ═══ Siege / Destroy Keep Objective Bar ═══ */}
        {isSiege && (
          <div className="flex items-center gap-4 flex-1">
            {/* Gatehouse Integrity */}
            {objectiveHUD.gateHealth !== null && (
              <div className="flex flex-col gap-0.5 min-w-[130px]">
                <div className="flex items-center justify-between text-[9px] font-cinzel font-bold">
                  <span className="text-parchment-300 flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5 text-amber-500" /> Castle Gate
                  </span>
                  <span className={objectiveHUD.isGateBreached ? 'text-red-400 font-black' : 'text-amber-300'}>
                    {objectiveHUD.isGateBreached ? 'BREACHED!' : `${Math.round(objectiveHUD.gateHealth)} HP`}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-obsidian-950 rounded-full overflow-hidden border border-gold-900/30">
                  <div
                    className={`h-full transition-all duration-300 ${
                      objectiveHUD.isGateBreached ? 'bg-red-600' : 'bg-gradient-to-r from-amber-600 to-amber-400'
                    }`}
                    style={{ width: `${objectiveHUD.isGateBreached ? 0 : Math.max(0, Math.min(100, (objectiveHUD.gateHealth / 700) * 100))}%` }}
                  />
                </div>
              </div>
            )}

            {/* Fortress Keep HP */}
            {objectiveHUD.keepHealth !== null && (
              <div className="flex flex-col gap-0.5 flex-1 min-w-[170px]">
                <div className="flex items-center justify-between text-[9px] font-cinzel font-bold">
                  <span className="text-parchment-200 flex items-center gap-1">
                    <Target className="w-2.5 h-2.5 text-crimson-400" /> Defender Keep
                  </span>
                  <span className="text-crimson-300">
                    {Math.round(objectiveHUD.keepHealth)} / {objectiveHUD.keepMaxHealth || 2800} HP
                  </span>
                </div>
                <div className="w-full h-2 bg-obsidian-950 rounded-full overflow-hidden border border-gold-900/40">
                  <div
                    className="h-full bg-gradient-to-r from-crimson-600 via-crimson-500 to-amber-500 transition-all duration-300"
                    style={{ width: `${Math.max(0, Math.min(100, (objectiveHUD.keepHealth / (objectiveHUD.keepMaxHealth || 2800)) * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ Capture Points Badges ═══ */}
        {isCapture && objectiveHUD.capturePoints && (
          <div className="flex items-center gap-3 flex-1 justify-center">
            {objectiveHUD.capturePoints.map((cp, idx) => {
              const letter = String.fromCharCode(65 + idx);
              const isBlue = cp.owner === 'blue';
              const isRed = cp.owner === 'red';
              const badgeBg = isBlue
                ? 'bg-blue-600 text-blue-100 border-blue-400 shadow-blue-glow'
                : (isRed ? 'bg-red-600 text-red-100 border-red-400 shadow-crimson-glow' : 'bg-obsidian-800 text-parchment-400 border-gold-900/40');

              return (
                <div key={cp.id} className="flex items-center gap-1.5" title={`${cp.name}: Owned by ${cp.owner.toUpperCase()}`}>
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center font-cinzel font-black text-xs border ${badgeBg} transition-all`}>
                    {letter}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] font-cinzel text-parchment-300 leading-none">{cp.name}</span>
                    <span className={`text-[7px] font-bold uppercase mt-0.5 ${isBlue ? 'text-blue-400' : (isRed ? 'text-red-400' : 'text-parchment-500')}`}>
                      {cp.contested ? 'Contested' : cp.owner}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ Objective Hint / Role Tag ═══ */}
        <div className="hidden sm:flex items-center gap-1 text-[9px] font-crimsonText text-parchment-400 italic border-l border-gold-800/30 pl-3">
          {scenarioType === 'SIEGE' && (
            <span>Blue: Attack Citadel | Red: Defend Keep</span>
          )}
          {scenarioType === 'CAPTURE_POINTS' && (
            <span>Hold majority of bastions to win</span>
          )}
          {scenarioType === 'DESTROY_KEEP' && (
            <span>Demolish the central enemy Keep</span>
          )}
          {scenarioType === 'ELIMINATION' && (
            <span>Survive & eliminate all enemies</span>
          )}
        </div>
      </div>
    </div>
  );
};
