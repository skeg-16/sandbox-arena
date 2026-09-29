import * as THREE from 'three';
import { useSandboxStore } from '../store/useSandboxStore';
import { soundSystem } from './SoundSystem';

export class PossessionController {
  constructor(sandboxEngine) {
    this.engine = sandboxEngine;
    this.keys = {
      w: false,
      a: false,
      s: false,
      d: false,
      space: false,
      shift: false
    };
    this.isAttacking = false;
    this.targetYaw = 0;
    this.targetPitch = 0.08;
    this.yaw = 0;
    this.pitch = 0.08;
    this.previousYaw = 0;
    this.currentVelocity = { x: 0, z: 0 };
    this.torsoRoll = 0;
    this.torsoPitch = 0;

    this._bindEvents();
  }

  _bindEvents() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const state = useSandboxStore.getState();
      const key = e.key.toLowerCase();

      // Quick-possess inspected unit with [E] key
      if (!state.isPossessing) {
        if (key === 'e') {
          const inspected = state.inspectedUnit;
          if (inspected && !inspected.isDead) {
            this.possessUnit(inspected);
          }
        }
        return;
      }

      // In possession controls:
      if (key === 'w' || key === 'arrowup') this.keys.w = true;
      if (key === 'a' || key === 'arrowleft') this.keys.a = true;
      if (key === 's' || key === 'arrowdown') this.keys.s = true;
      if (key === 'd' || key === 'arrowright') this.keys.d = true;
      if (key === ' ') {
        this.keys.space = true;
        this.jump();
      }
      if (key === 'shift') this.keys.shift = true;
      if (key === 'q') {
        this.ultimate();
      }
      if (key === 'e' || key === 'escape') {
        this.exitPossession();
      }
    });

    window.addEventListener('keyup', (e) => {
      const state = useSandboxStore.getState();
      if (!state.isPossessing) return;

      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') this.keys.w = false;
      if (key === 'a' || key === 'arrowleft') this.keys.a = false;
      if (key === 's' || key === 'arrowdown') this.keys.s = false;
      if (key === 'd' || key === 'arrowright') this.keys.d = false;
      if (key === ' ') this.keys.space = false;
      if (key === 'shift') this.keys.shift = false;
    });

    // Reset keys when window loses focus to prevent ghost walking
    window.addEventListener('blur', () => {
      this.keys.w = false;
      this.keys.a = false;
      this.keys.s = false;
      this.keys.d = false;
      this.keys.space = false;
      this.keys.shift = false;
      this.currentVelocity = { x: 0, z: 0 };
    });

    // Prevent context menu during possession
    window.addEventListener('contextmenu', (e) => {
      const state = useSandboxStore.getState();
      if (state.isPossessing) {
        e.preventDefault();
      }
    });

    // Mouse movement for true third-person aim & look with smooth damping
    window.addEventListener('mousemove', (e) => {
      const state = useSandboxStore.getState();
      if (!state.isPossessing) return;

      const canvas = this.engine.threeScene?.renderer?.domElement;
      const isLocked = document.pointerLockElement === canvas;

      // Allow camera steering if pointer is locked, button is held, or relative movement is present
      const sensitivity = 0.0024;
      const dx = e.movementX !== undefined ? e.movementX : 0;
      const dy = e.movementY !== undefined ? e.movementY : 0;

      if (isLocked || e.buttons > 0 || Math.abs(dx) > 0 || Math.abs(dy) > 0) {
        this.targetYaw -= dx * sensitivity;
        this.targetPitch = Math.max(-0.6, Math.min(0.7, this.targetPitch + dy * sensitivity));
      }
    });

    // Touch aim & camera steering for mobile during possession
    let touchAimPrev = { x: 0, y: 0 };
    window.addEventListener('touchstart', (e) => {
      const state = useSandboxStore.getState();
      if (!state.isPossessing) return;
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        if (t.clientX > window.innerWidth * 0.35) {
          touchAimPrev = { x: t.clientX, y: t.clientY };
          break;
        }
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      const state = useSandboxStore.getState();
      if (!state.isPossessing) return;
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        if (t.clientX > window.innerWidth * 0.35) {
          const dx = t.clientX - touchAimPrev.x;
          const dy = t.clientY - touchAimPrev.y;
          const touchSensitivity = 0.005;
          this.targetYaw -= dx * touchSensitivity;
          this.targetPitch = Math.max(-0.6, Math.min(0.7, this.targetPitch + dy * touchSensitivity));
          touchAimPrev = { x: t.clientX, y: t.clientY };
          break;
        }
      }
    }, { passive: true });

    // Left click attacks (LMB); Right click triggers Ultimate (RMB)
    window.addEventListener('mousedown', (e) => {
      const state = useSandboxStore.getState();
      if (!state.isPossessing) return;

      const canvas = this.engine.threeScene?.renderer?.domElement;
      if (canvas && canvas.isConnected && document.body.contains(canvas) && document.pointerLockElement !== canvas) {
        try {
          canvas.requestPointerLock();
        } catch (err) {}
      }

      if (e.button === 0) {
        this.attack();
      } else if (e.button === 2) {
        e.preventDefault();
        this.ultimate();
      }
    });
  }

  possessUnit(unit) {
    if (!unit || unit.isDead) return;

    // Release any previous possessed unit
    const prevUnit = useSandboxStore.getState().possessedUnit;
    if (prevUnit && prevUnit !== unit) {
      prevUnit.isPossessed = false;
    }

    // Reset input state immediately so unit starts fully at rest
    this.keys = {
      w: false,
      a: false,
      s: false,
      d: false,
      space: false,
      shift: false
    };
    this.currentVelocity = { x: 0, z: 0 };

    // Tag unit as possessed & clear autonomous AI targeting
    unit.isPossessed = true;
    unit.targetUnit = null;
    unit.targetStructure = null;
    unit.objectiveDestination = null;

    const store = useSandboxStore.getState();
    store.setPossessedUnit(unit);

    // Initialize camera yaw to match the unit's orientation or team direction
    if (unit.body) {
      const rot = unit.body.rotation();
      const currentYaw = 2 * Math.atan2(rot.y, rot.w);
      if (!isNaN(currentYaw) && Math.abs(currentYaw) > 0.05) {
        this.targetYaw = currentYaw;
        this.yaw = currentYaw;
      } else {
        const defaultYaw = unit.teamId === 'blue' ? Math.PI / 2 : -Math.PI / 2;
        this.targetYaw = defaultYaw;
        this.yaw = defaultYaw;
      }
    } else {
      const defaultYaw = unit.teamId === 'blue' ? Math.PI / 2 : -Math.PI / 2;
      this.targetYaw = defaultYaw;
      this.yaw = defaultYaw;
    }
    this.pitch = 0.08;
    this.targetPitch = 0.08;
    this.previousYaw = this.yaw;
    this.torsoRoll = 0;
    this.torsoPitch = 0;

    // Immediately stop any prior momentum and lock upright
    if (unit.body) {
      unit.body.setEnabledRotations(false, true, false, true);
      unit.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      unit.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      const halfYaw = this.yaw * 0.5;
      unit.body.setRotation({ x: 0, y: Math.sin(halfYaw), z: 0, w: Math.cos(halfYaw) }, true);
      unit.updateMeshFromPhysics();
    }

    // Set stable ground contact friction so unit DOES NOT SLIDE on slopes
    if (unit.collider) {
      unit.collider.setFriction(0.8);
      unit.collider.setRestitution(0.0);
    }

    // Switch camera mode to POSSESSED and pass unit
    if (this.engine.threeScene) {
      this.engine.threeScene.setCameraMode('POSSESSED', unit);

      // Request pointer lock on canvas for seamless FPS/TPS control
      const canvas = this.engine.threeScene.renderer?.domElement;
      if (canvas && canvas.isConnected && document.body.contains(canvas) && canvas.requestPointerLock) {
        try {
          canvas.requestPointerLock();
        } catch (err) {}
      }
    }

    soundSystem.playVictoryFanfare();
  }

  exitPossession() {
    const store = useSandboxStore.getState();
    const unit = store.possessedUnit;

    if (unit) {
      unit.isPossessed = false;
      if (unit.body) {
        unit.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        unit.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
      if (unit.collider) {
        unit.collider.setFriction(0.6);
        unit.collider.setRestitution(0.1);
      }
      // Reset unit limb and torso rotations to natural idle
      if (unit.leftLeg && unit.rightLeg) {
        unit.leftLeg.rotation.x = 0;
        unit.rightLeg.rotation.x = 0;
        if (unit.leftArm) unit.leftArm.rotation.x = 0;
        if (unit.rightArm) unit.rightArm.rotation.x = 0;
        if (unit.bodyGroup) {
          unit.bodyGroup.rotation.x = 0;
          unit.bodyGroup.rotation.z = 0;
        }
      }
    }

    this.keys = {
      w: false,
      a: false,
      s: false,
      d: false,
      space: false,
      shift: false
    };
    this.currentVelocity = { x: 0, z: 0 };

    store.setPossessedUnit(null);

    // Release pointer lock
    if (document.exitPointerLock && document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch (err) {}
    }

    if (this.engine.threeScene) {
      this.engine.threeScene.setCameraMode('ORBIT');
    }

    soundSystem.playSwordSlash();
  }

  jump() {
    const { possessedUnit } = useSandboxStore.getState();
    if (!possessedUnit || !possessedUnit.body || possessedUnit.isDead) return;

    const linvel = possessedUnit.body.linvel();
    // Only jump if roughly grounded
    if (Math.abs(linvel.y) < 2.0) {
      possessedUnit.body.setLinvel({ x: linvel.x, y: 8.5, z: linvel.z }, true);
      soundSystem.playSwordSlash();
    }
  }

  attack() {
    const { possessedUnit } = useSandboxStore.getState();
    if (!possessedUnit || !possessedUnit.body || possessedUnit.isDead) return;

    if (possessedUnit.attackCooldown <= 0) {
      this.isAttacking = true;
      setTimeout(() => {
        this.isAttacking = false;
      }, 350);

      // Find closest enemy in crosshair cone
      const pos = possessedUnit.body.translation();
      const forwardX = Math.sin(this.yaw);
      const forwardZ = Math.cos(this.yaw);

      let targetUnit = null;
      let minDistance = Infinity;

      this.engine.units.forEach((u) => {
        if (u.isDead || u.teamId === possessedUnit.teamId || !u.body) return;
        const uPos = u.body.translation();
        const dx = uPos.x - pos.x;
        const dz = uPos.z - pos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Direction check (within ~80 deg cone in front)
        const dot = (dx * forwardX + dz * forwardZ) / (dist || 1);
        if (dot > 0.35 && dist < minDistance) {
          minDistance = dist;
          targetUnit = u;
        }
      });

      // Target dummy if no enemy nearby so attack VFX and swings always trigger
      const attackRange = possessedUnit.typeConfig.attackRange || 3.0;
      const targetObj = targetUnit || {
        body: {
          translation: () => ({
            x: pos.x + forwardX * Math.min(attackRange, 3.5),
            y: pos.y + 0.8,
            z: pos.z + forwardZ * Math.min(attackRange, 3.5)
          })
        },
        takeDamage: () => {},
        triggerKnockdown: () => {}
      };

      possessedUnit.executeAttack(targetObj, minDistance, this.engine.projectileSystem);

      const step = possessedUnit.comboStep;
      const comboText = step === 1 ? '✦ 3-HIT COMBO FINISHER! ✦' : `Step ${step - 1} / 3`;
      useSandboxStore.getState().setPossessionCombo(step, comboText);

      // Lower attack cooldown while possessed for high-intensity action
      possessedUnit.attackCooldown = Math.max(0.25, (possessedUnit.typeConfig.attackCooldown || 1.2) * 0.65);
    }
  }

  ultimate() {
    const { possessedUnit } = useSandboxStore.getState();
    if (!possessedUnit || !possessedUnit.body || possessedUnit.isDead) return;

    if (possessedUnit.ultimateCooldown <= 0) {
      this.isAttacking = true;
      setTimeout(() => {
        this.isAttacking = false;
      }, 500);

      // Find closest enemy in forward cone
      const pos = possessedUnit.body.translation();
      const forwardX = Math.sin(this.yaw);
      const forwardZ = Math.cos(this.yaw);

      let targetUnit = null;
      let minDistance = Infinity;

      this.engine.units.forEach((u) => {
        if (u.isDead || u.teamId === possessedUnit.teamId || !u.body) return;
        const uPos = u.body.translation();
        const dx = uPos.x - pos.x;
        const dz = uPos.z - pos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        const dot = (dx * forwardX + dz * forwardZ) / (dist || 1);
        if (dot > 0.25 && dist < minDistance) {
          minDistance = dist;
          targetUnit = u;
        }
      });

      const attackRange = possessedUnit.typeConfig.attackRange || 3.5;
      const targetObj = targetUnit || {
        body: {
          translation: () => ({
            x: pos.x + forwardX * Math.min(attackRange, 4.0),
            y: pos.y + 0.8,
            z: pos.z + forwardZ * Math.min(attackRange, 4.0)
          })
        },
        takeDamage: () => {},
        triggerKnockdown: () => {}
      };

      possessedUnit.executeUltimate(targetObj, this.engine.projectileSystem);

      useSandboxStore.getState().setPossessionUltCooldown(
        possessedUnit.ultimateCooldown,
        possessedUnit.maxUltimateCooldown
      );
    }
  }

  update(dt) {
    const { possessedUnit, isPossessing } = useSandboxStore.getState();
    if (!isPossessing || !possessedUnit || !possessedUnit.body || possessedUnit.isDead) {
      if (isPossessing && possessedUnit && possessedUnit.isDead) {
        this.exitPossession();
      }
      return;
    }

    // Sync combo & ultimate cooldown in UI store
    if (possessedUnit.comboTimer <= 0 && useSandboxStore.getState().possessionCombo > 0) {
      useSandboxStore.getState().setPossessionCombo(0, '');
    }
    useSandboxStore.getState().setPossessionUltCooldown(
      possessedUnit.ultimateCooldown || 0,
      possessedUnit.maxUltimateCooldown || 10
    );

    // ═══ 1. SMOOTH MOUSE LOOK DAMPING ═══
    const lookDamping = 1.0 - Math.exp(-28.0 * dt);
    this.yaw += (this.targetYaw - this.yaw) * lookDamping;
    this.pitch += (this.targetPitch - this.pitch) * lookDamping;

    // ═══ 2. STABILIZED COMBAT STANCE: Strict upright locking ═══
    possessedUnit.body.setEnabledRotations(false, true, false, true);
    possessedUnit.body.setAngvel({ x: 0, y: 0, z: 0 }, true);

    // Orient character to match camera horizontal look direction (aiming crosshair)
    const halfYaw = this.yaw * 0.5;
    possessedUnit.body.setRotation(
      { x: 0, y: Math.sin(halfYaw), z: 0, w: Math.cos(halfYaw) },
      true
    );

    // ═══ 3. RESPONSIVE WASD MOVEMENT ═══
    const forwardX = Math.sin(this.yaw);
    const forwardZ = Math.cos(this.yaw);
    const rightX = -Math.cos(this.yaw);
    const rightZ = Math.sin(this.yaw);

    let moveX = 0;
    let moveZ = 0;

    if (this.keys.w) {
      moveX += forwardX;
      moveZ += forwardZ;
    }
    if (this.keys.s) {
      moveX -= forwardX;
      moveZ -= forwardZ;
    }
    if (this.keys.d) {
      moveX += rightX;
      moveZ += rightZ;
    }
    if (this.keys.a) {
      moveX -= rightX;
      moveZ -= rightZ;
    }

    const isMoving = this.keys.w || this.keys.s || this.keys.a || this.keys.d;
    const linvel = possessedUnit.body.linvel();

    const baseSpeed = Math.max(8.5, (possessedUnit.typeConfig.moveSpeed || 4.0) * 1.85);
    const speedMultiplier = this.keys.shift ? 1.65 : 1.0;
    const maxSpeed = baseSpeed * speedMultiplier;

    if (isMoving) {
      const len = Math.sqrt(moveX * moveX + moveZ * moveZ) || 1;
      const targetVx = (moveX / len) * maxSpeed;
      const targetVz = (moveZ / len) * maxSpeed;

      const accel = 16.0;
      this.currentVelocity.x += (targetVx - this.currentVelocity.x) * Math.min(1.0, dt * accel);
      this.currentVelocity.z += (targetVz - this.currentVelocity.z) * Math.min(1.0, dt * accel);
    } else {
      // Crisp stopping: Immediately halt horizontal velocity so unit NEVER slides or walks on its own
      const brake = 22.0;
      this.currentVelocity.x += (0 - this.currentVelocity.x) * Math.min(1.0, dt * brake);
      this.currentVelocity.z += (0 - this.currentVelocity.z) * Math.min(1.0, dt * brake);
      if (Math.abs(this.currentVelocity.x) < 0.05) this.currentVelocity.x = 0;
      if (Math.abs(this.currentVelocity.z) < 0.05) this.currentVelocity.z = 0;
    }

    // Apply linear velocity preserving vertical gravity / jump velocity
    possessedUnit.body.setLinvel({ x: this.currentVelocity.x, y: linvel.y, z: this.currentVelocity.z }, true);
    possessedUnit.updateMeshFromPhysics();

    // ═══ 4. ORGANIC MOTION SUITE: LEANING, BANKING & WALKING BOB ═══
    const currentSpeed = Math.sqrt(this.currentVelocity.x * this.currentVelocity.x + this.currentVelocity.z * this.currentVelocity.z);
    const speedRatio = Math.min(1.0, currentSpeed / (maxSpeed || 1));

    // Dynamic Turn Rate calculation for banking into turns
    const turnDelta = this.yaw - this.previousYaw;
    const turnRate = turnDelta / Math.max(dt, 0.001);
    this.previousYaw = this.yaw;

    // Bank into turns & strafe tilt
    let strafeInput = 0;
    if (this.keys.d) strafeInput += 1;
    if (this.keys.a) strafeInput -= 1;
    const targetRoll = (-turnRate * 0.035) + (strafeInput * 0.09 * speedRatio);
    this.torsoRoll += (targetRoll - this.torsoRoll) * Math.min(1.0, dt * 10.0);

    // Pitch lean forward when moving forward, slight lean back when backpedaling
    let forwardInput = 0;
    if (this.keys.w) forwardInput += 1;
    if (this.keys.s) forwardInput -= 0.6;
    const targetPitch = forwardInput * speedRatio * (this.keys.shift ? 0.16 : 0.09);
    this.torsoPitch += (targetPitch - this.torsoPitch) * Math.min(1.0, dt * 10.0);

    // Apply body banking & lean
    if (possessedUnit.bodyGroup) {
      possessedUnit.bodyGroup.rotation.z = this.torsoRoll;
      possessedUnit.bodyGroup.rotation.x = this.torsoPitch;
    }

    // Fluid limb walking animations ONLY while moving
    if (currentSpeed > 0.4 && isMoving) {
      possessedUnit.walkCyclePhase += dt * currentSpeed * 1.5;
      const legSwing = Math.sin(possessedUnit.walkCyclePhase) * 0.75 * speedRatio;
      if (possessedUnit.leftLeg) possessedUnit.leftLeg.rotation.x = legSwing;
      if (possessedUnit.rightLeg) possessedUnit.rightLeg.rotation.x = -legSwing;

      if (!this.isAttacking) {
        if (possessedUnit.leftArm) possessedUnit.leftArm.rotation.x = -legSwing * 0.55;
        if (possessedUnit.rightArm) possessedUnit.rightArm.rotation.x = legSwing * 0.55;
      }
    } else {
      // Immediate clean idle posture when stopped
      if (possessedUnit.leftLeg) possessedUnit.leftLeg.rotation.x = 0;
      if (possessedUnit.rightLeg) possessedUnit.rightLeg.rotation.x = 0;
      if (!this.isAttacking) {
        if (possessedUnit.leftArm) possessedUnit.leftArm.rotation.x = 0;
        if (possessedUnit.rightArm) possessedUnit.rightArm.rotation.x = 0;
      }
    }
  }
}
