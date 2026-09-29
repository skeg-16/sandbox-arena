import RAPIER from '@dimforge/rapier3d-compat';

class PhysicsWorldManager {
  constructor() {
    this.rapier = null;
    this.world = null;
    this.initialized = false;
    this.groundBody = null;
    this.groundCollider = null;
  }

  async init() {
    if (this.initialized) return;
    await RAPIER.init();
    this.rapier = RAPIER;

    // Create Rapier 3D gravity world
    const gravity = { x: 0.0, y: -9.81, z: 0.0 };
    this.world = new RAPIER.World(gravity);

    // Create Arena Ground Plane (120x120 meters, 2m height box centered at y=-1)
    const groundBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0.0, -1.0, 0.0);
    this.groundBody = this.world.createRigidBody(groundBodyDesc);
    const groundColliderDesc = RAPIER.ColliderDesc.cuboid(60.0, 1.0, 60.0)
      .setFriction(0.8)
      .setRestitution(0.2);
    this.groundCollider = this.world.createCollider(groundColliderDesc, this.groundBody);

    // Optional boundary walls to keep ragdolls from sliding into infinity
    this._createBoundaryWalls(60.0, 8.0);

    this.initialized = true;
    console.log('[PhysicsWorld] Rapier3D WASM initialized successfully');
  }

  _createBoundaryWalls(halfSize, height) {
    const wallThickness = 2.0;
    const walls = [
      { x: halfSize + wallThickness / 2, y: height / 2, z: 0, hx: wallThickness / 2, hy: height / 2, hz: halfSize },
      { x: -(halfSize + wallThickness / 2), y: height / 2, z: 0, hx: wallThickness / 2, hy: height / 2, hz: halfSize },
      { x: 0, y: height / 2, z: halfSize + wallThickness / 2, hx: halfSize, hy: height / 2, hz: wallThickness / 2 },
      { x: 0, y: height / 2, z: -(halfSize + wallThickness / 2), hx: halfSize, hy: height / 2, hz: wallThickness / 2 }
    ];

    walls.forEach(w => {
      const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(w.x, w.y, w.z);
      const body = this.world.createRigidBody(bodyDesc);
      const colliderDesc = RAPIER.ColliderDesc.cuboid(w.hx, w.hy, w.hz).setFriction(0.5);
      this.world.createCollider(colliderDesc, body);
    });
  }

  disableDefaultGround() {
    if (this.groundCollider && this.world) {
      try { this.world.removeCollider(this.groundCollider, false); } catch (e) {}
      this.groundCollider = null;
    }
    if (this.groundBody && this.world) {
      try { this.world.removeRigidBody(this.groundBody); } catch (e) {}
      this.groundBody = null;
    }
  }

  step(dt = 1 / 60) {
    if (!this.world) return;
    // Step simulation
    this.world.timestep = Math.min(dt, 0.05); // cap frame spikes
    this.world.step();
  }

  clear() {
    if (this.world) {
      // Safely free world memory
      this.world.free();
      this.world = null;
    }
    this.initialized = false;
  }

  recreateWorld() {
    if (this.world) {
      this.world.free();
    }
    const gravity = { x: 0.0, y: -9.81, z: 0.0 };
    this.world = new RAPIER.World(gravity);
    
    // Recreate floor
    const groundBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0.0, -1.0, 0.0);
    this.groundBody = this.world.createRigidBody(groundBodyDesc);
    const groundColliderDesc = RAPIER.ColliderDesc.cuboid(60.0, 1.0, 60.0)
      .setFriction(0.8)
      .setRestitution(0.2);
    this.groundCollider = this.world.createCollider(groundColliderDesc, this.groundBody);

    this._createBoundaryWalls(60.0, 8.0);
  }
}

export const physicsWorld = new PhysicsWorldManager();
