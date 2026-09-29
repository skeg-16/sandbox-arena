import React, { useState, useCallback } from 'react';
import { CanvasContainer } from './components/CanvasContainer';
import { TopNavHeader } from './components/TopNavHeader';
import { UnitTray } from './components/UnitTray';
import { PresetBattlesModal } from './components/PresetBattlesModal';
import { EnvironmentPickerModal } from './components/EnvironmentPickerModal';
import { CampaignModal } from './components/CampaignModal';
import { ScenarioPickerModal } from './components/ScenarioPickerModal';
import { ObjectiveHUD } from './components/ObjectiveHUD';
import { UnitInspectorCard } from './components/UnitInspectorCard';
import { PossessionHUD } from './components/PossessionHUD';
import { BattleStatsOverlay } from './components/BattleStatsOverlay';
import { BossHealthBarOverlay } from './components/BossHealthBarOverlay';
import { SplashScreen } from './components/SplashScreen';

export function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);
  const [isEnvPickerOpen, setIsEnvPickerOpen] = useState(false);
  const [isCampaignOpen, setIsCampaignOpen] = useState(false);
  const [isBattlegroundsOpen, setIsBattlegroundsOpen] = useState(false);

  const handleEnterArena = useCallback(() => {
    setShowSplash(false);
  }, []);

  if (showSplash) {
    return <SplashScreen onEnter={handleEnterArena} />;
  }

  return (
    <main className="w-screen h-screen relative bg-obsidian-950 overflow-hidden font-sans select-none">
      {/* 3D WebGL Canvas Engine */}
      <CanvasContainer />

      {/* Cinematic HUD Header & Overlays */}
      <TopNavHeader
        onOpenPresets={() => setIsPresetsOpen(true)}
        onOpenEnvPicker={() => setIsEnvPickerOpen(true)}
        onOpenCampaign={() => setIsCampaignOpen(true)}
        onOpenBattlegrounds={() => setIsBattlegroundsOpen(true)}
      />

      <ObjectiveHUD />
      <UnitTray />
      <UnitInspectorCard />
      <PossessionHUD />
      <BattleStatsOverlay />
      <BossHealthBarOverlay />

      {/* Modals */}
      <ScenarioPickerModal
        isOpen={isBattlegroundsOpen}
        onClose={() => setIsBattlegroundsOpen(false)}
      />

      <PresetBattlesModal
        isOpen={isPresetsOpen}
        onClose={() => setIsPresetsOpen(false)}
      />

      <EnvironmentPickerModal
        isOpen={isEnvPickerOpen}
        onClose={() => setIsEnvPickerOpen(false)}
      />

      <CampaignModal
        isOpen={isCampaignOpen}
        onClose={() => setIsCampaignOpen(false)}
      />

      {/* Screen-edge vignette for immersion */}
      <div className="absolute inset-0 pointer-events-none z-[5]"
        style={{
          boxShadow: 'inset 0 0 120px rgba(6, 5, 8, 0.5), inset 0 0 40px rgba(6, 5, 8, 0.3)',
        }}
      />
    </main>
  );
}
