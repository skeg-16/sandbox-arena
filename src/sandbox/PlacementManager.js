/**
 * PlacementManager.js
 * Handles placement ghost projection, 3D terrain elevation snapping,
 * garrison platform elevation, and deployment zone validation.
 */

import * as THREE from 'three';
import { UNIT_TYPES, TEAMS } from './UnitConfig';
import { useSandboxStore } from '../store/useSandboxStore';

export class PlacementManager {
  constructor(scene, threeScene) {
    this.scene = scene;
    this.threeScene = threeScene;
    this.ghostMesh = null;
    this.activeUnitTypeId = null;
    this.activeTeamId = 'blue';
  }

  setPlacementConfig(unitTypeId, teamId) {
    this.activeUnitTypeId = unitTypeId;
    this.activeTeamId = teamId;
    this._rebuildGhost();
  }

  setSelection(unitTypeId, teamId) {
    this.setPlacementConfig(unitTypeId, teamId);
  }

  setFormation() {
    this._rebuildGhost();
  }

  _rebuildGhost() {
    if (this.ghostMesh) {
      this.scene.remove(this.ghostMesh);
      this.ghostMesh = null;
    }

    if (!this.activeUnitTypeId) return;

    const unitConfig = UNIT_TYPES[this.activeUnitTypeId];
    if (!unitConfig) return;

    const teamConfig = TEAMS[this.activeTeamId.toUpperCase()] || TEAMS.BLUE;
    const scale = unitConfig.scale || 1.0;
    const formationMode = useSandboxStore.getState().formationMode || 'SINGLE';

    const offsetsZ = formationMode === 'WALL_5'
      ? [-3.6, -1.8, 0, 1.8, 3.6]
      : (formationMode === 'LINE_3' ? [-1.8, 0, 1.8] : [0]);

    const ghostGroup = new THREE.Group();
    this.ghostMaterials = [];
    this.teamColor = teamConfig.color;

    offsetsZ.forEach((offsetZ) => {
      const subGroup = new THREE.Group();
      subGroup.position.set(0, 0, offsetZ);

      // Translucent ghostly capsule
      const ghostMat = new THREE.MeshBasicMaterial({
        color: teamConfig.color,
        transparent: true,
        opacity: 0.5,
        wireframe: true
      });

      const capsuleGeo = new THREE.CylinderGeometry(0.4 * scale, 0.4 * scale, 1.2 * scale, 8);
      const capsule = new THREE.Mesh(capsuleGeo, ghostMat);
      capsule.position.y = 0.6 * scale;
      subGroup.add(capsule);

      // Placement ring indicator below ghost
      const ringGeo = new THREE.RingGeometry(0.6 * scale, 0.8 * scale, 16);
      const ringMat = new THREE.MeshBasicMaterial({ color: teamConfig.color, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      subGroup.add(ring);

      // Direction arrow on ground ring indicating facing direction
      const arrowGeo = new THREE.ConeGeometry(0.2 * scale, 0.45 * scale, 4);
      const arrowMat = new THREE.MeshBasicMaterial({ color: teamConfig.color });
      const arrow = new THREE.Mesh(arrowGeo, arrowMat);
      arrow.rotation.x = -Math.PI / 2;
      arrow.position.set(0, 0.05, 0.75 * scale);
      subGroup.add(arrow);

      this.ghostMaterials.push(ghostMat, ringMat, arrowMat);
      ghostGroup.add(subGroup);
    });

    this.ghostMesh = ghostGroup;
    this.ghostMesh.visible = false;
    this.scene.add(this.ghostMesh);
  }

  updateCursor(mouseX, mouseY, structureSystem = null, mapConfig = null, enforceZones = true) {
    if (!this.ghostMesh) return null;

    const hit = this.threeScene.getGroundIntersection(mouseX, mouseY, structureSystem);
    if (hit) {
      const clampedX = Math.max(-48, Math.min(48, hit.x));
      const clampedZ = Math.max(-36, Math.min(36, hit.z));
      const y = hit.y;

      this.ghostMesh.position.set(clampedX, y, clampedZ);
      this.ghostMesh.visible = true;

      // Validate deployment zones
      let isValidSide = true;
      if (enforceZones) {
        if (mapConfig && mapConfig.deploymentZones) {
          const zone = mapConfig.deploymentZones[this.activeTeamId];
          if (zone) {
            isValidSide = (
              clampedX >= zone.minX &&
              clampedX <= zone.maxX &&
              clampedZ >= zone.minZ &&
              clampedZ <= zone.maxZ
            );
          }
        } else {
          // Half field division if no specific zones
          isValidSide = (
            (this.activeTeamId === 'blue' && clampedX <= 0) ||
            (this.activeTeamId === 'red' && clampedX >= 0)
          );
        }
      } else {
        // Enforce zones is false -> free placement anywhere across the field!
        isValidSide = true;
      }

      // Visual feedback: if invalid side, tint ghost red
      const activeColor = isValidSide ? this.teamColor : 0xef4444;
      if (this.ghostMaterials) {
        this.ghostMaterials.forEach(m => m.color.setHex(activeColor));
      }

      return {
        x: clampedX,
        y: y,
        z: clampedZ,
        isValidSide,
        isGarrison: hit.isGarrison || false,
        structure: hit.structure || null
      };
    } else {
      this.ghostMesh.visible = false;
      return null;
    }
  }

  hideGhost() {
    if (this.ghostMesh) {
      this.ghostMesh.visible = false;
    }
  }

  dispose() {
    if (this.ghostMesh) {
      this.scene.remove(this.ghostMesh);
      this.ghostMesh = null;
    }
  }
}
