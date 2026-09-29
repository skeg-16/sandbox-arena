import React, { useState, useEffect } from 'react';
import { useSandboxStore } from '../store/useSandboxStore';
import { sandboxEngine } from '../sandbox/SandboxEngine';
import { soundSystem } from '../sandbox/SoundSystem';
import {
  Play,
  RotateCcw,
  Trash2,
  Repeat,
  FastForward,
  Layers,
  Volume2,
  VolumeX,
  Target,
  Mountain,
  Video,
  Compass,
  Swords,
  Skull,
  Shield,
  Timer,
  Settings,
  ChevronDown,
  Castle,
  Sparkles,
  AlertTriangle,
  Unlock
} from 'lucide-react';
import { BATTLEGROUND_MAPS } from '../sandbox/MapConfigs';

export const TopNavHeader = ({ onOpenPresets, onOpenEnvPicker, onOpenCampaign, onOpenBattlegrounds }) => {
  const {
    gamePhase,
    gameMode,
    isPossessing,
    gameSpeed,
    totalUnitsPlaced,
    cameraMode,
    blueCount,
    redCount,
    blueInitialCount,
    redInitialCount,
    activeMapId,
    scenarioType,
    graphicsQuality,
    fpsWarning,
    enforceDeploymentZones,
    setGameSpeed,
    setCameraMode,
    setGraphicsQuality,
    setFpsWarning,
    setEnforceDeploymentZones
  } = useSandboxStore();

  const [activeDropdown, setActiveDropdown] = useState(null); // 'modes' | 'settings' | null
  const [isMuted, setIsMuted] = useState(soundSystem.muted);
  const [goreMode, setGoreMode] = useState('ULTRA');
  const [battleTimer, setBattleTimer] = useState(0);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.pointer-events-auto')) {
        setActiveDropdown(null);
      }
    };
    window.addEventListener('pointerdown', handleOutsideClick);
    return () => window.removeEventListener('pointerdown', handleOutsideClick);
  }, []);

  // Battle timer
  useEffect(() => {
    let interval;
    if (gamePhase === 'BATTLE') {
      interval = setInterval(() => {
        setBattleTimer((t) => t + 1);
      }, 1000);
    } else if (gamePhase === 'PLACEMENT') {
      setBattleTimer(0);
    }
    return () => clearInterval(interval);
  }, [gamePhase]);

  // Real-time FPS monitoring with automatic lower-preset recommendation
  const [currentFps, setCurrentFps] = useState(60);
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let lowFpsSeconds = 0;
    let animId;

    const measureFps = () => {
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (now - lastTime));
        setCurrentFps(fps);
        frameCount = 0;
        lastTime = now;

        if (gamePhase === 'BATTLE' && fps < 28 && graphicsQuality !== 'LOW') {
          lowFpsSeconds++;
          if (lowFpsSeconds >= 3) {
            setFpsWarning(true);
          }
        } else {
          lowFpsSeconds = 0;
        }
      }
      animId = requestAnimationFrame(measureFps);
    };

    animId = requestAnimationFrame(measureFps);
    return () => cancelAnimationFrame(animId);
  }, [gamePhase, graphicsQuality, setFpsWarning]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleToggleSound = () => {
    const muted = soundSystem.toggleMute();
    setIsMuted(muted);
    soundSystem.playSwordSlash();
  };

  const handleToggleGore = () => {
    const modes = ['ULTRA', 'NORMAL', 'OFF'];
    const next = modes[(modes.indexOf(goreMode) + 1) % modes.length];
    setGoreMode(next);
    if (sandboxEngine.bloodGoreSystem) {
      sandboxEngine.bloodGoreSystem.goreLevel = next;
    }
    soundSystem.playSwordSlash();
  };

  const handleToggleCamera = (mode) => {
    setCameraMode(mode);
    if (sandboxEngine.threeScene) {
      sandboxEngine.threeScene.setCameraMode(mode);
    }
    soundSystem.playSwordSlash();
  };

  const isBattle = gamePhase === 'BATTLE' || gamePhase === 'VICTORY_BLUE' || gamePhase === 'VICTORY_RED' || gamePhase === 'DRAW';

  if (isPossessing) return null;

  return (
    <header className="absolute top-0 inset-x-0 z-30 pointer-events-none select-none">
      <div className="flex items-start justify-between p-1.5 md:p-3 gap-1.5 md:gap-3">

        {/* ═══ LEFT: Sleek Game Emblem & Title ═══ */}
        <div className="pointer-events-auto fantasy-panel px-2 md:px-3.5 py-1.5 md:py-2 flex items-center gap-1.5 md:gap-2.5 shrink-0 animate-fade-in-down"
          style={{ animationDelay: '100ms' }}>
          <div className="p-1.5 md:p-2 rounded-lg bg-gradient-to-br from-crimson-500 via-crimson-700 to-obsidian-950 border border-crimson-400/40 shadow-crimson-glow">
            <Swords className="w-3.5 h-3.5 md:w-4 md:h-4 text-parchment-50" />
          </div>
          <div className="hidden sm:flex flex-col leading-none">
            <h1 className="font-cinzel font-black text-xs uppercase text-gold-gradient tracking-[0.14em]"
              style={{ textShadow: '0 0 16px rgba(201, 168, 76, 0.25)' }}>
              Battle Sandbox
            </h1>
            <span className="font-crimsonText text-[10px] italic text-parchment-400 mt-0.5 tracking-wide">
              {gameMode === 'CAMPAIGN' ? '⚔ Campaign Realm' : `🏰 ${BATTLEGROUND_MAPS[activeMapId]?.name || 'Dark Fantasy Arena'}`}
            </span>
          </div>
        </div>

        {/* ═══ CENTER: Cinematic Scoreboard with Team Crests ═══ */}
        <div className="pointer-events-auto fantasy-panel-ornate px-2.5 md:px-4 py-1 md:py-2 flex items-center gap-2 md:gap-3 shrink-0 animate-fade-in-down"
          style={{ animationDelay: '200ms' }}>

          {/* Blue Team Crest & Score */}
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-8 h-9 flex items-center justify-center"
                style={{
                  clipPath: 'polygon(50% 0%, 100% 20%, 100% 80%, 50% 100%, 0% 80%, 0% 20%)',
                  background: 'linear-gradient(180deg, #3b82f6 0%, #1e40af 100%)',
                }}>
                <Shield className="w-3.5 h-3.5 text-blue-100" />
              </div>
              <div className="absolute -inset-0.5 animate-crest-pulse opacity-40 pointer-events-none"
                style={{
                  clipPath: 'polygon(50% 0%, 100% 20%, 100% 80%, 50% 100%, 0% 80%, 0% 20%)',
                  background: 'linear-gradient(180deg, rgba(59, 130, 246, 0.3) 0%, transparent 100%)',
                }} />
            </div>
            <div className="flex flex-col items-end">
              <span className="font-cinzel text-[8px] font-bold uppercase text-blue-400 tracking-widest">House Blue</span>
              <div className="flex items-baseline gap-1">
                <span className="font-cinzel text-lg font-black text-blue-300 leading-none">{blueCount}</span>
                <span className="font-crimsonText text-[11px] text-parchment-500">/{blueInitialCount || blueCount}</span>
              </div>
            </div>
          </div>

          {/* VS Separator with Battle Timer */}
          <div className="flex flex-col items-center gap-0.5 px-1">
            <div className="font-cinzel text-[11px] font-black text-gold-500 italic px-2.5 py-0.5 rounded"
              style={{
                background: 'linear-gradient(180deg, rgba(201, 168, 76, 0.15) 0%, transparent 100%)',
                border: '1px solid rgba(201, 168, 76, 0.25)',
                textShadow: '0 0 10px rgba(201, 168, 76, 0.4)',
              }}>
              VS
            </div>
            {isBattle && (
              <div className="flex items-center gap-1 text-[9px] font-crimsonText text-parchment-400">
                <Timer className="w-2.5 h-2.5 text-gold-500" />
                <span>{formatTime(battleTimer)}</span>
              </div>
            )}
          </div>

          {/* Red Team Crest & Score */}
          <div className="flex items-center gap-2.5">
            <div className="flex flex-col items-start">
              <span className="font-cinzel text-[8px] font-bold uppercase text-red-400 tracking-widest">House Red</span>
              <div className="flex items-baseline gap-1">
                <span className="font-cinzel text-lg font-black text-red-300 leading-none">{redCount}</span>
                <span className="font-crimsonText text-[11px] text-parchment-500">/{redInitialCount || redCount}</span>
              </div>
            </div>
            <div className="relative">
              <div className="w-8 h-9 flex items-center justify-center"
                style={{
                  clipPath: 'polygon(50% 0%, 100% 20%, 100% 80%, 50% 100%, 0% 80%, 0% 20%)',
                  background: 'linear-gradient(180deg, #ef4444 0%, #991b1b 100%)',
                }}>
                <Shield className="w-3.5 h-3.5 text-red-100" />
              </div>
              <div className="absolute -inset-0.5 animate-crest-pulse opacity-40 pointer-events-none"
                style={{
                  clipPath: 'polygon(50% 0%, 100% 20%, 100% 80%, 50% 100%, 0% 80%, 0% 20%)',
                  background: 'linear-gradient(180deg, rgba(239, 68, 68, 0.3) 0%, transparent 100%)',
                }} />
            </div>
          </div>
        </div>

        {/* ═══ RIGHT: Streamlined AAA Game Action Dock ═══ */}
        <div className="pointer-events-auto flex items-center gap-2 shrink-0 animate-fade-in-down"
          style={{ animationDelay: '300ms' }}>

          {/* Scenarios / Modes Dropdown Button (Placement Only) */}
          {gamePhase === 'PLACEMENT' && (
            <div className="relative">
              <button
                onClick={() => {
                  setActiveDropdown(activeDropdown === 'modes' ? null : 'modes');
                  soundSystem.playSwordSlash();
                }}
                className={`btn-fantasy-secondary px-2 md:px-3 py-1 md:py-1.5 text-[11px] flex items-center gap-1 md:gap-1.5 transition-all ${
                  activeDropdown === 'modes' ? 'border-gold-400 bg-obsidian-800 text-gold-300' : ''
                }`}
                title="Scenarios, Campaign & Realms"
              >
                <Layers className="w-3.5 h-3.5 text-gold-400" />
                <span className="hidden sm:inline">Scenarios</span>
                <ChevronDown className={`w-3 h-3 text-gold-500 transition-transform duration-200 ${activeDropdown === 'modes' ? 'rotate-180' : ''}`} />
              </button>

              {/* Modes Dropdown Flyout */}
              {activeDropdown === 'modes' && (
                <div className="absolute right-0 top-full mt-2 w-64 fantasy-panel-ornate p-2.5 flex flex-col gap-1.5 shadow-2xl animate-fade-in-down z-50">
                  <div className="px-2 py-1 font-cinzel text-[9px] uppercase tracking-widest text-gold-500 font-bold border-b border-gold-800/30 mb-0.5">
                    Battle Scenarios & Realms
                  </div>

                  <button
                    onClick={() => {
                      if (onOpenBattlegrounds) onOpenBattlegrounds();
                      setActiveDropdown(null);
                      soundSystem.playSwordSlash();
                    }}
                    className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-obsidian-800/80 text-left transition-all group border border-transparent hover:border-gold-800/30"
                  >
                    <div className="p-1.5 rounded-md bg-gradient-to-br from-gold-500 to-amber-800 text-obsidian-950 font-bold shadow-md">
                      <Castle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-cinzel text-xs font-bold text-parchment-100 group-hover:text-gold-300">Battleground & Siege</div>
                      <div className="font-crimsonText text-[11px] text-parchment-400 leading-tight">3D terrain, fortresses & objectives</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onOpenCampaign();
                      setActiveDropdown(null);
                      soundSystem.playSwordSlash();
                    }}
                    className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-obsidian-800/80 text-left transition-all group border border-transparent hover:border-gold-800/30"
                  >
                    <div className="p-1.5 rounded-md bg-gradient-to-br from-amber-600 to-amber-900 text-amber-200 shadow-md">
                      <Target className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-cinzel text-xs font-bold text-parchment-100 group-hover:text-gold-300">Campaign Mode</div>
                      <div className="font-crimsonText text-[11px] text-parchment-400 leading-tight">Tactical levels with gold budgets</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onOpenPresets();
                      setActiveDropdown(null);
                      soundSystem.playSwordSlash();
                    }}
                    className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-obsidian-800/80 text-left transition-all group border border-transparent hover:border-gold-800/30"
                  >
                    <div className="p-1.5 rounded-md bg-gradient-to-br from-indigo-600 to-indigo-900 text-indigo-200 shadow-md">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-cinzel text-xs font-bold text-parchment-100 group-hover:text-gold-300">Preset Battles</div>
                      <div className="font-crimsonText text-[11px] text-parchment-400 leading-tight">Shield wall, charge, and boss battles</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onOpenEnvPicker();
                      setActiveDropdown(null);
                      soundSystem.playSwordSlash();
                    }}
                    className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-obsidian-800/80 text-left transition-all group border border-transparent hover:border-gold-800/30"
                  >
                    <div className="p-1.5 rounded-md bg-gradient-to-br from-emerald-600 to-emerald-900 text-emerald-200 shadow-md">
                      <Mountain className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-cinzel text-xs font-bold text-parchment-100 group-hover:text-gold-300">Environment</div>
                      <div className="font-crimsonText text-[11px] text-parchment-400 leading-tight">Plains, Volcanic, Snow & Desert</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Settings & Simulation Utilities Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => {
                setActiveDropdown(activeDropdown === 'settings' ? null : 'settings');
                soundSystem.playSwordSlash();
              }}
              className={`btn-fantasy-secondary px-2 md:px-3 py-1 md:py-1.5 text-[11px] flex items-center gap-1 md:gap-1.5 transition-all ${
                activeDropdown === 'settings' ? 'border-gold-400 bg-obsidian-800 text-gold-300' : ''
              }`}
              title="Camera, Speed, Audio & Gore Settings"
            >
              <Settings className="w-3.5 h-3.5 text-gold-400" />
              <span className="hidden sm:inline">Settings</span>
              <ChevronDown className={`w-3 h-3 text-gold-500 transition-transform duration-200 ${activeDropdown === 'settings' ? 'rotate-180' : ''}`} />
            </button>

            {/* Settings Dropdown Flyout */}
            {activeDropdown === 'settings' && (
              <div className="absolute right-0 top-full mt-2 w-72 fantasy-panel-ornate p-3 flex flex-col gap-3 shadow-2xl animate-fade-in-down z-50">
                <div className="px-1 font-cinzel text-[9px] uppercase tracking-widest text-gold-500 font-bold border-b border-gold-800/30 pb-1 flex items-center justify-between">
                  <span>Simulation Controls</span>
                  <span className="text-[8px] text-parchment-500 font-sans">Options</span>
                </div>

                {/* Camera View Mode */}
                <div className="flex flex-col gap-1.5">
                  <span className="font-cinzel text-[10px] text-parchment-300 flex items-center gap-1.5">
                    <Video className="w-3 h-3 text-gold-400" /> Camera Angle
                  </span>
                  <div className="grid grid-cols-2 gap-1 bg-obsidian-950 p-1 rounded-xl border border-gold-800/20">
                    <button
                      onClick={() => handleToggleCamera('ORBIT')}
                      className={`flex items-center justify-center gap-1 py-1 rounded-lg text-[10px] font-cinzel font-bold transition-all ${
                        cameraMode === 'ORBIT'
                          ? 'bg-gold-500 text-obsidian-950 shadow-ember'
                          : 'text-parchment-400 hover:text-parchment-200'
                      }`}
                    >
                      <Video className="w-2.5 h-2.5" /> Orbit 3D
                    </button>
                    <button
                      onClick={() => handleToggleCamera('COMMANDER')}
                      className={`flex items-center justify-center gap-1 py-1 rounded-lg text-[10px] font-cinzel font-bold transition-all ${
                        cameraMode === 'COMMANDER'
                          ? 'bg-gold-500 text-obsidian-950 shadow-ember'
                          : 'text-parchment-400 hover:text-parchment-200'
                      }`}
                    >
                      <Compass className="w-2.5 h-2.5" /> Top-Down
                    </button>
                  </div>
                </div>

                {/* Deployment Rules (Enforce Zones vs Free Anywhere) */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-cinzel text-[10px] text-parchment-300 flex items-center gap-1.5">
                      <Shield className="w-3 h-3 text-gold-400" /> Deployment Rules
                    </span>
                    <span className="text-[9px] font-mono text-gold-400">
                      {enforceDeploymentZones ? 'Enforced' : 'Free Placement'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 bg-obsidian-950 p-1 rounded-xl border border-gold-800/20">
                    <button
                      onClick={() => {
                        setEnforceDeploymentZones(true);
                        if (sandboxEngine.threeScene && sandboxEngine.terrainSystem?.currentMap) {
                          sandboxEngine.threeScene.updateDeploymentZones(
                            sandboxEngine.terrainSystem.currentMap.deploymentZones,
                            true
                          );
                        }
                        soundSystem.playSwordSlash();
                      }}
                      className={`flex items-center justify-center gap-1 py-1 rounded-lg text-[10px] font-cinzel font-bold transition-all ${
                        enforceDeploymentZones
                          ? 'bg-gold-500 text-obsidian-950 shadow-ember'
                          : 'text-parchment-400 hover:text-parchment-200'
                      }`}
                    >
                      <Shield className="w-2.5 h-2.5" /> Enforce Zones
                    </button>
                    <button
                      onClick={() => {
                        setEnforceDeploymentZones(false);
                        if (sandboxEngine.threeScene && sandboxEngine.terrainSystem?.currentMap) {
                          sandboxEngine.threeScene.updateDeploymentZones(
                            sandboxEngine.terrainSystem.currentMap.deploymentZones,
                            false
                          );
                        }
                        soundSystem.playSwordSlash();
                      }}
                      className={`flex items-center justify-center gap-1 py-1 rounded-lg text-[10px] font-cinzel font-bold transition-all ${
                        !enforceDeploymentZones
                          ? 'bg-emerald-600 text-obsidian-950 shadow-emerald-900/50'
                          : 'text-parchment-400 hover:text-parchment-200'
                      }`}
                    >
                      <Unlock className="w-2.5 h-2.5" /> Free Anywhere
                    </button>
                  </div>
                </div>

                {/* PBR Graphics Quality Preset */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-cinzel text-[10px] text-parchment-300 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-gold-400" /> PBR Graphics
                    </span>
                    <span className="text-[9px] font-mono text-gold-400 font-bold">{graphicsQuality} ({currentFps} FPS)</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 bg-obsidian-950 p-1 rounded-xl border border-gold-800/20 font-mono">
                    {['LOW', 'MEDIUM', 'HIGH', 'ULTRA'].map((q) => (
                      <button
                        key={q}
                        onClick={() => {
                          setGraphicsQuality(q);
                          sandboxEngine.setGraphicsQuality(q);
                          setFpsWarning(false);
                          soundSystem.playSwordSlash();
                        }}
                        className={`py-1 rounded-lg text-[9px] font-cinzel font-bold transition-all text-center ${
                          graphicsQuality === q
                            ? 'bg-gold-500 text-obsidian-950 shadow-ember'
                            : 'text-parchment-400 hover:text-parchment-200'
                        }`}
                      >
                        {q === 'MEDIUM' ? 'MED' : q}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Simulation Speed */}
                <div className="flex flex-col gap-1.5">
                  <span className="font-cinzel text-[10px] text-parchment-300 flex items-center gap-1.5">
                    <FastForward className="w-3 h-3 text-gold-400" /> Time Scale
                  </span>
                  <div className="grid grid-cols-3 gap-1 bg-obsidian-950 p-1 rounded-xl border border-gold-800/20 font-mono">
                    {[0.5, 1.0, 2.0].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => {
                          setGameSpeed(speed);
                          soundSystem.playSwordSlash();
                        }}
                        className={`py-1 rounded-lg text-[10px] font-cinzel font-bold transition-all text-center ${
                          gameSpeed === speed
                            ? 'bg-gold-500 text-obsidian-950 shadow-ember'
                            : 'text-parchment-400 hover:text-parchment-200'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Blood & Dismemberment */}
                <div className="flex items-center justify-between pt-1.5 border-t border-gold-800/20">
                  <span className="font-cinzel text-[10px] text-parchment-300 flex items-center gap-1.5">
                    <Skull className="w-3 h-3 text-crimson-400" /> 3D Blood & Dismemberment
                  </span>
                  <button
                    onClick={handleToggleGore}
                    className={`px-2.5 py-0.5 rounded-lg text-[10px] font-cinzel font-bold border transition-all ${
                      goreMode === 'ULTRA'
                        ? 'bg-crimson-600/40 text-crimson-200 border-crimson-500/60 shadow-crimson-glow'
                        : 'bg-obsidian-800 text-parchment-400 border-obsidian-700'
                    }`}
                  >
                    {goreMode}
                  </button>
                </div>

                {/* Master Sound */}
                <div className="flex items-center justify-between pt-1.5 border-t border-gold-800/20">
                  <span className="font-cinzel text-[10px] text-parchment-300 flex items-center gap-1.5">
                    {isMuted ? <VolumeX className="w-3 h-3 text-crimson-400" /> : <Volume2 className="w-3 h-3 text-gold-400" />} Master Sound
                  </span>
                  <button
                    onClick={handleToggleSound}
                    className={`px-2.5 py-0.5 rounded-lg text-[10px] font-cinzel font-bold border transition-all ${
                      isMuted
                        ? 'bg-crimson-900/40 text-crimson-300 border-crimson-700/50'
                        : 'bg-gold-600/30 text-gold-300 border-gold-500/40 shadow-ember'
                    }`}
                  >
                    {isMuted ? 'Muted' : 'Enabled'}
                  </button>
                </div>

                {/* Clear Battlefield Army */}
                <div className="pt-2 border-t border-gold-800/30">
                  <button
                    onClick={() => {
                      sandboxEngine.clearAll(true);
                      soundSystem.playSwordSlash();
                      setActiveDropdown(null);
                    }}
                    className="w-full btn-fantasy-danger py-1.5 text-[10px] flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3 h-3" /> Clear All Units
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Primary Action Button (Start Battle / Reset / Replay) */}
          {gamePhase === 'PLACEMENT' ? (
            <button
              onClick={() => {
                sandboxEngine.startBattle();
                soundSystem.playBluntHit();
                setActiveDropdown(null);
              }}
              disabled={totalUnitsPlaced === 0 || blueCount === 0 || redCount === 0}
              className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-1.5 md:py-2 rounded-xl font-cinzel font-black text-[11px] md:text-xs uppercase tracking-wider md:tracking-widest transition-all ${
                totalUnitsPlaced > 0 && blueCount > 0 && redCount > 0
                  ? 'btn-fantasy-battle'
                  : 'bg-obsidian-800 text-parchment-500/40 cursor-not-allowed border border-obsidian-700'
              }`}
              title={
                totalUnitsPlaced === 0
                  ? 'Deploy units to the field to start'
                  : blueCount === 0
                  ? 'Deploy at least one House Blue unit'
                  : redCount === 0
                  ? 'Deploy at least one House Red unit'
                  : 'Commence Battle!'
              }
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>
                {totalUnitsPlaced === 0
                  ? 'Start Battle'
                  : blueCount === 0
                  ? 'Need Blue'
                  : redCount === 0
                  ? 'Need Red'
                  : 'Start Battle'}
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  sandboxEngine.resetBattle();
                  soundSystem.playSwordSlash();
                }}
                className="btn-fantasy-secondary px-3.5 py-1.5 text-xs flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
              <button
                onClick={() => {
                  sandboxEngine.replayBattle();
                  soundSystem.playBluntHit();
                }}
                className="btn-fantasy-primary px-3.5 py-1.5 text-xs flex items-center gap-1.5"
              >
                <Repeat className="w-3.5 h-3.5" /> Replay
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Low-FPS Automatic Preset Suggestion Banner */}
      {fpsWarning && (
        <div className="pointer-events-auto absolute top-14 left-1/2 -translate-x-1/2 bg-amber-950/95 border border-amber-500/60 rounded-xl px-4 py-2 flex items-center gap-3 shadow-2xl backdrop-blur-md z-50 animate-fade-in-down">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="font-cinzel text-xs text-parchment-100">
            Performance dip ({currentFps} FPS) — Consider switching to <span className="text-gold-300 font-bold">{graphicsQuality === 'ULTRA' ? 'High' : (graphicsQuality === 'HIGH' ? 'Medium' : 'Low')}</span> preset.
          </div>
          <button
            onClick={() => {
              const lower = graphicsQuality === 'ULTRA' ? 'HIGH' : (graphicsQuality === 'HIGH' ? 'MEDIUM' : 'LOW');
              setGraphicsQuality(lower);
              sandboxEngine.setGraphicsQuality(lower);
              setFpsWarning(false);
              soundSystem.playSwordSlash();
            }}
            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-obsidian-950 font-cinzel font-bold text-[10px] rounded-lg transition-all"
          >
            Apply Preset
          </button>
          <button
            onClick={() => setFpsWarning(false)}
            className="text-parchment-400 hover:text-parchment-100 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}
    </header>
  );
};
