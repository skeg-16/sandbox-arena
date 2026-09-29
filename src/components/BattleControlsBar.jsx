import React, { useState } from 'react';
import { useSandboxStore } from '../store/useSandboxStore';
import { sandboxEngine } from '../sandbox/SandboxEngine';
import { soundSystem } from '../sandbox/SoundSystem';
import { Play, RotateCcw, Trash2, Repeat, FastForward, Layers, Volume2, VolumeX } from 'lucide-react';

export const BattleControlsBar = ({ onOpenPresets }) => {
  const { gamePhase, gameSpeed, totalUnitsPlaced, setGameSpeed } = useSandboxStore();
  const [isMuted, setIsMuted] = useState(soundSystem.muted);

  const handleToggleSound = () => {
    const muted = soundSystem.toggleMute();
    setIsMuted(muted);
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl px-4 py-2.5 shadow-2xl">
      {/* Start Battle Button */}
      {gamePhase === 'PLACEMENT' && (
        <button
          onClick={() => sandboxEngine.startBattle()}
          disabled={totalUnitsPlaced === 0}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl font-black text-sm uppercase tracking-wider transition-all shadow-lg ${
            totalUnitsPlaced > 0
              ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white shadow-emerald-500/40 hover:scale-105 active:scale-95'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
          }`}
        >
          <Play className="w-4 h-4 fill-current" />
          Start Battle
        </button>
      )}

      {/* Battle Active or Victory Controls */}
      {gamePhase !== 'PLACEMENT' && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => sandboxEngine.resetBattle()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs uppercase bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all hover:scale-105"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>

          <button
            onClick={() => sandboxEngine.replayBattle()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs uppercase bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all hover:scale-105"
          >
            <Repeat className="w-3.5 h-3.5" />
            Replay
          </button>
        </div>
      )}

      {/* Preset Scenarios Button */}
      {gamePhase === 'PLACEMENT' && (
        <button
          onClick={onOpenPresets}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs bg-indigo-950/80 hover:bg-indigo-900/90 text-indigo-300 border border-indigo-700/80 transition-all hover:scale-105 shadow-md"
          title="Open preset scenarios"
        >
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          Presets
        </button>
      )}

      {/* Clear All Button */}
      <button
        onClick={() => sandboxEngine.clearAll(true)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs uppercase bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 transition-all hover:scale-105"
        title="Clear all placed units"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Clear
      </button>

      {/* Divider */}
      <div className="w-px h-6 bg-slate-700/80 mx-0.5" />

      {/* Game Speed Control Toggles */}
      <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
        <FastForward className="w-3.5 h-3.5 text-slate-400 ml-1.5" />

        {[0.25, 0.5, 1.0, 2.0].map((speed) => (
          <button
            key={speed}
            onClick={() => setGameSpeed(speed)}
            className={`px-2 py-1 rounded-lg text-xs font-bold font-mono transition-all ${
              gameSpeed === speed
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30 font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {speed === 0.25 ? '0.25x' : `${speed}x`}
          </button>
        ))}
      </div>

      {/* Sound Mute/Unmute Toggle */}
      <button
        onClick={handleToggleSound}
        className={`p-2 rounded-xl border transition-all ${
          isMuted
            ? 'bg-slate-800 text-rose-400 border-rose-900/80'
            : 'bg-slate-800 text-emerald-400 border-emerald-900/80'
        }`}
        title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
      >
        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>
    </div>
  );
};
