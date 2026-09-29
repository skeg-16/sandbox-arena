import React from 'react';
import { useSandboxStore } from '../store/useSandboxStore';
import { sandboxEngine } from '../sandbox/SandboxEngine';
import { AlertTriangle } from 'lucide-react';

export const HUDOverlay = ({ onOpenEnvPicker, onOpenCampaign }) => {
  const { totalUnitsPlaced, unitCapWarning, gamePhase } = useSandboxStore();

  return (
    <>
      {/* Unit Cap Warning Banner */}
      {unitCapWarning && gamePhase === 'PLACEMENT' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 rounded-xl animate-fade-in-down"
          style={{
            background: 'rgba(201, 168, 76, 0.1)',
            border: '1px solid rgba(201, 168, 76, 0.4)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5), 0 0 15px rgba(201, 168, 76, 0.1)',
          }}
        >
          <AlertTriangle className="w-4 h-4 text-gold-400 shrink-0 animate-pulse" />
          <span className="font-crimsonText text-xs text-gold-300 font-bold">
            High Unit Count ({totalUnitsPlaced}/100+) — Performance may vary
          </span>
        </div>
      )}
    </>
  );
};
