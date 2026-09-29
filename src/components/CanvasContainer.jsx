import React, { useEffect, useRef } from 'react';
import { sandboxEngine } from '../sandbox/SandboxEngine';
import { useSandboxStore } from '../store/useSandboxStore';
import { soundSystem } from '../sandbox/SoundSystem';

export const CanvasContainer = () => {
  const containerRef = useRef(null);
  const { gamePhase, activeTeam, selectedUnitType, cameraMode, isPossessing, setCameraMode } = useSandboxStore();

  useEffect(() => {
    if (containerRef.current) {
      sandboxEngine.init(containerRef.current);
    }
    return () => {
      sandboxEngine.dispose();
    };
  }, []);

  // Sync active selection to placement manager
  useEffect(() => {
    if (sandboxEngine.placementManager) {
      sandboxEngine.placementManager.setSelection(selectedUnitType, activeTeam);
    }
  }, [selectedUnitType, activeTeam]);

  // Global Tactical [T] and Follow [F] Hotkeys
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in an input or currently possessing a unit
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (useSandboxStore.getState().isPossessing) return;

      if (e.key === 't' || e.key === 'T') {
        const nextMode = cameraMode === 'COMMANDER' ? 'ORBIT' : 'COMMANDER';
        setCameraMode(nextMode);
        if (sandboxEngine.threeScene) {
          sandboxEngine.threeScene.setCameraMode(nextMode);
        }
        soundSystem.playSwordSlash();
      } else if (e.key === 'f' || e.key === 'F') {
        const nextMode = cameraMode === 'FOLLOW' ? 'ORBIT' : 'FOLLOW';
        setCameraMode(nextMode);
        if (sandboxEngine.threeScene) {
          sandboxEngine.threeScene.setCameraMode(nextMode);
        }
        soundSystem.playSwordSlash();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cameraMode, setCameraMode]);

  const rmbDownPos = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    if (isPossessing) return;
    if (e.button === 2) {
      rmbDownPos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e) => {
    if (isPossessing) return;
    if (gamePhase !== 'PLACEMENT' || !sandboxEngine.placementManager) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const cursorInfo = sandboxEngine.updatePlacementCursor(mouseX, mouseY);

    // Drag-to-paint units along drag path if LMB is held (e.buttons === 1) without Alt key
    if (e.buttons === 1 && !e.altKey && cursorInfo) {
      sandboxEngine.placeUnit(selectedUnitType, activeTeam, cursorInfo, true);
    }
  };

  const handleMouseUp = () => {
    sandboxEngine.resetDragState();
  };

  const handleMouseLeave = () => {
    sandboxEngine.resetDragState();
    if (sandboxEngine.placementManager) {
      sandboxEngine.placementManager.hideGhost();
    }
  };

  const handleClick = (e) => {
    if (isPossessing || e.altKey || e.button !== 0) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    // Check if clicking existing unit to inspect
    const inspected = sandboxEngine.inspectUnitAt(mouseX, mouseY);
    if (inspected) return;

    if (gamePhase === 'PLACEMENT') {
      const cursorInfo = sandboxEngine.updatePlacementCursor(mouseX, mouseY);
      if (cursorInfo) {
        sandboxEngine.placeUnit(selectedUnitType, activeTeam, cursorInfo, false);
      }
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault(); // Prevent default context menu
    if (isPossessing || gamePhase !== 'PLACEMENT') return;

    // If mouse was dragged while right button was down, it was camera orbit rotation, not unit deletion
    const dist = Math.hypot(e.clientX - rmbDownPos.current.x, e.clientY - rmbDownPos.current.y);
    if (dist > 6) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    sandboxEngine.removeUnitAt(mouseX, mouseY);
  };

  // ═══ Mobile Touch Handlers (Tap to Place/Inspect, Long-Press to Delete) ═══
  const touchStartPos = useRef({ x: 0, y: 0, time: 0 });
  const longPressTimer = useRef(null);
  const isTouchAction = useRef(false);

  const handleTouchStart = (e) => {
    if (isPossessing || e.touches.length !== 1) {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      return;
    }
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    isTouchAction.current = true;

    // Start long-press timer to delete unit under touch
    if (gamePhase === 'PLACEMENT') {
      longPressTimer.current = setTimeout(() => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
        sandboxEngine.removeUnitAt(mouseX, mouseY);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(60);
        }
      }, 500);
    }
  };

  const handleTouchMove = (e) => {
    if (isPossessing || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dist = Math.hypot(touch.clientX - touchStartPos.current.x, touch.clientY - touchStartPos.current.y);
    if (dist > 10 && longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchEnd = (e) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (isPossessing || e.changedTouches.length === 0) return;
    const touch = e.changedTouches[0];
    const dist = Math.hypot(touch.clientX - touchStartPos.current.x, touch.clientY - touchStartPos.current.y);
    const duration = Date.now() - touchStartPos.current.time;

    // Fast tap with minimal movement (< 12px within 400ms) = Tap to Place or Inspect
    if (dist < 12 && duration < 400 && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
      const mouseY = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

      const inspected = sandboxEngine.inspectUnitAt(mouseX, mouseY);
      if (!inspected && gamePhase === 'PLACEMENT') {
        const cursorInfo = sandboxEngine.updatePlacementCursor(mouseX, mouseY);
        if (cursorInfo) {
          sandboxEngine.placeUnit(selectedUnitType, activeTeam, cursorInfo, false);
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(25);
          }
        }
      }
    }

    sandboxEngine.resetDragState();
    if (sandboxEngine.placementManager) {
      sandboxEngine.placementManager.hideGhost();
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full absolute inset-0 cursor-crosshair select-none overflow-hidden bg-obsidian-950"
      style={{ touchAction: 'none' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    />
  );
};
