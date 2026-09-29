import * as THREE from 'three';

export class HealthBarManager {
  constructor(scene) {
    this.scene = scene;
    this.bars = new Map(); // unitId -> { sprite, canvas, ctx, texture }
  }

  updateUnitHealthBar(unit) {
    if (!unit.body || unit.isDead) {
      this.removeUnitHealthBar(unit.id);
      return;
    }

    // Only render health bar if unit has taken damage or is being inspected
    const healthPercent = Math.max(0, unit.health / unit.maxHealth);
    if (healthPercent >= 1.0) {
      this.removeUnitHealthBar(unit.id);
      return;
    }

    let item = this.bars.get(unit.id);
    if (!item) {
      // Create new Canvas texture sprite for overhead HP bar
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 16;
      const ctx = canvas.getContext('2d');
      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
      const sprite = new THREE.Sprite(spriteMat);
      
      const scale = unit.typeConfig.scale || 1.0;
      sprite.scale.set(1.6 * scale, 0.2 * scale, 1);

      this.scene.add(sprite);
      item = { sprite, canvas, ctx, texture, lastHealthPercent: -1 };
      this.bars.set(unit.id, item);
    }

    const { ctx, canvas, texture, sprite } = item;

    // Performance Optimization: Only redraw 2D canvas and upload to GPU when HP actually changes
    const roundedPercent = Math.round(healthPercent * 100) / 100;
    if (item.lastHealthPercent !== roundedPercent) {
      item.lastHealthPercent = roundedPercent;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background Container
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);

      // Health Fill
      const fillWidth = (canvas.width - 4) * healthPercent;
      ctx.fillStyle = unit.teamId === 'blue' ? '#3b82f6' : '#ef4444';
      ctx.fillRect(2, 2, fillWidth, canvas.height - 4);

      texture.needsUpdate = true;
    }

    // Position sprite overhead above unit torso
    const pos = unit.body.translation();
    const heightOffset = (unit.typeConfig.scale || 1.0) * 1.8 + 0.4;
    sprite.position.set(pos.x, pos.y + heightOffset, pos.z);
  }

  removeUnitHealthBar(unitId) {
    const item = this.bars.get(unitId);
    if (item) {
      this.scene.remove(item.sprite);
      item.sprite.material.dispose();
      item.texture.dispose();
      this.bars.delete(unitId);
    }
  }

  clear() {
    this.bars.forEach(item => {
      this.scene.remove(item.sprite);
      item.sprite.material.dispose();
      item.texture.dispose();
    });
    this.bars.clear();
  }
}
