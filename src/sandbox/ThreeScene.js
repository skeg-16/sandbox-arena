import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ENVIRONMENTS } from './EnvironmentConfig';
import { pbrMaterialSystem } from './PBRMaterialSystem';

export class ThreeSceneManager {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();

    // Camera setup
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 500);
    this.camera.position.set(0, 22, 42);
    this.camera.lookAt(0, 0, 0);

    // Camera State
    this.cameraMode = 'ORBIT'; // ORBIT | COMMANDER | FOLLOW
    this.followTarget = null;
    this.cameraTarget = new THREE.Vector3(0, 1.5, 0);
    this.spherical = new THREE.Spherical(48, Math.PI / 3.5, 0);
    this.possessionController = null;

    // Free Camera WASD / Arrow Movement Keys
    this.freeCamKeys = {
      w: false, a: false, s: false, d: false,
      up: false, down: false, left: false, right: false,
      shift: false
    };

    this.isMouseDown = false;
    this.mouseButton = -1;
    this.previousMousePosition = { x: 0, y: 0 };
    this.zoomSpeed = 0.0015;

    // Lighting References
    this.hemiLight = null;
    this.sunLight = null;
    this.groundMesh = null;
    this.activeEnvId = 'plains';

    // Environment Props & Atmosphere
    this.envProps = [];
    this.ancientProps = [];
    this.brazierLights = [];
    this.terrainTexture = null;
    this.atmosphericParticles = null;
    this.particleVelocities = null;

    // Time tracking for animated elements & camera shake
    this.elapsedTime = 0;
    this.cameraShakeTrauma = 0;

    // Renderer setup with enhanced settings
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    container.appendChild(this.renderer.domElement);

    // Connect renderer capabilities to PBR system (anisotropy)
    pbrMaterialSystem.setRenderer(this.renderer);

    // Image-Based Lighting (IBL) via PMREM RoomEnvironment for realistic PBR metal sheen & reflections
    try {
      const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      pmremGenerator.compileEquirectangularShader();
      const roomEnv = new RoomEnvironment();
      this.scene.environment = pmremGenerator.fromScene(roomEnv, 0.04).texture;
      pmremGenerator.dispose();
      console.log('[ThreeSceneManager] Initialized PMREM IBL environment map');
    } catch (e) {
      console.warn('[ThreeSceneManager] Failed to init RoomEnvironment:', e);
    }

    // Raycasting
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    // Build Environment & Ground
    this._setupLighting();
    this._setupArenaGround();
    this._setupEnvironmentProps();
    this._setupAncientBattlefieldProps();
    this._setupAtmosphericParticles();
    this.setEnvironment('plains');

    // Event Listeners
    this._bindEvents();
  }

  _setupLighting() {
    // Hemisphere light for global ambient
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x334155, 0.7);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

    // Main Directional Sun Light with enhanced shadows
    this.sunLight = new THREE.DirectionalLight(0xfffbeb, 1.4);
    this.sunLight.position.set(30, 45, 25);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 120;
    const shadowDist = 45;
    this.sunLight.shadow.camera.left = -shadowDist;
    this.sunLight.shadow.camera.right = shadowDist;
    this.sunLight.shadow.camera.top = shadowDist;
    this.sunLight.shadow.camera.bottom = -shadowDist;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    // Warm fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0xffedd5, 0.25);
    fillLight.position.set(-20, 20, -15);
    this.scene.add(fillLight);

    // Subtle rim/back light
    const rimLight = new THREE.DirectionalLight(0xc9a84c, 0.15);
    rimLight.position.set(0, 10, -40);
    this.scene.add(rimLight);
  }

  /**
   * Generates high-res dynamic terrain canvas texture with biome soil,
   * central clash trench (churned mud & battle scars), and troop staging areas.
   */
  _createProceduralTerrainTexture(envId) {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Palettes per biome
    let baseColor1, baseColor2, clashDark, clashMid, accentColor, soilDetail;
    if (envId === 'volcano') {
      baseColor1 = '#171412';
      baseColor2 = '#292524';
      clashDark = '#451a03';
      clashMid = '#7c2d12';
      accentColor = '#f97316'; // Glowing magma
      soilDetail = 'rgba(249, 115, 22, 0.08)';
    } else if (envId === 'snow') {
      baseColor1 = '#f8fafc';
      baseColor2 = '#e2e8f0';
      clashDark = '#64748b';
      clashMid = '#94a3b8';
      accentColor = '#38bdf8'; // Frost fracture
      soilDetail = 'rgba(56, 189, 248, 0.06)';
    } else if (envId === 'desert') {
      baseColor1 = '#fde047';
      baseColor2 = '#ca8a04';
      clashDark = '#78350f';
      clashMid = '#92400e';
      accentColor = '#d97706';
      soilDetail = 'rgba(120, 53, 15, 0.08)';
    } else { // Plains
      baseColor1 = '#22c55e';
      baseColor2 = '#15803d';
      clashDark = '#3e2723';
      clashMid = '#5d4037';
      accentColor = '#854d0e';
      soilDetail = 'rgba(0, 0, 0, 0.07)';
    }

    // 1. Organic Base Gradient
    const bgGrad = ctx.createRadialGradient(size / 2, size / 2, 40, size / 2, size / 2, size * 0.65);
    bgGrad.addColorStop(0, baseColor1);
    bgGrad.addColorStop(0.7, baseColor2);
    bgGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, size, size);

    // 2. Soil and vegetation speckle noise
    for (let i = 0; i < 4500; i++) {
      const px = Math.random() * size;
      const py = Math.random() * size;
      const rad = Math.random() * 2.2 + 0.6;
      ctx.fillStyle = Math.random() > 0.4 ? soilDetail : 'rgba(255, 255, 255, 0.04)';
      ctx.beginPath();
      ctx.arc(px, py, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Central Clash Trench & Trampled Battlefield Scars (Along X = 512, where armies collide)
    const centerX = size / 2;
    const clashGrad = ctx.createLinearGradient(centerX - 110, 0, centerX + 110, 0);
    clashGrad.addColorStop(0, 'rgba(0,0,0,0)');
    clashGrad.addColorStop(0.25, clashMid + '99');
    clashGrad.addColorStop(0.5, clashDark + 'ee');
    clashGrad.addColorStop(0.75, clashMid + '99');
    clashGrad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = clashGrad;
    ctx.fillRect(centerX - 120, 0, 240, size);

    // Trampled foot tracks & battle ruts along clash front
    for (let i = 0; i < 350; i++) {
      const cx = centerX + (Math.random() - 0.5) * 150;
      const cy = Math.random() * size;
      const rw = Math.random() * 16 + 6;
      const rh = Math.random() * 8 + 3;
      ctx.fillStyle = Math.random() > 0.4 ? clashDark + 'aa' : clashMid + '88';
      ctx.beginPath();
      ctx.ellipse(cx, cy, rw, rh, (Math.random() - 0.5) * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }

    // Glowing magma veins or icy frost fissures for volcano/snow
    if (envId === 'volcano' || envId === 'snow') {
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 3.0;
      ctx.shadowColor = accentColor;
      ctx.shadowBlur = 12;
      for (let j = 0; j < 5; j++) {
        ctx.beginPath();
        let sx = centerX + (Math.random() - 0.5) * 70;
        let sy = Math.random() * size * 0.2 + j * (size * 0.18);
        ctx.moveTo(sx, sy);
        for (let k = 0; k < 6; k++) {
          sx += (Math.random() - 0.5) * 35;
          sy += Math.random() * 45 + 15;
          ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }

    // 4. Staging Area Dirt Rings (Left: Blue, Right: Red)
    const blueStaging = ctx.createRadialGradient(size * 0.28, size * 0.5, 30, size * 0.28, size * 0.5, 180);
    blueStaging.addColorStop(0, clashMid + '44');
    blueStaging.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = blueStaging;
    ctx.fillRect(0, 0, size * 0.5, size);

    const redStaging = ctx.createRadialGradient(size * 0.72, size * 0.5, 30, size * 0.72, size * 0.5, 180);
    redStaging.addColorStop(0, clashMid + '44');
    redStaging.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = redStaging;
    ctx.fillRect(size * 0.5, 0, size * 0.5, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  _setupArenaGround() {
    const groundGeo = new THREE.PlaneGeometry(100, 100, 128, 128);
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const distFromCenter = Math.sqrt(x * x + y * y);
      if (distFromCenter > 38) {
        const hill = Math.sin(x * 0.15) * Math.cos(y * 0.15) * 2.5 + (distFromCenter - 38) * 0.15;
        pos.setZ(i, hill);
      } else {
        // Subtle micro-terrain variation in the arena
        const microNoise = Math.sin(x * 0.8) * Math.cos(y * 0.6) * 0.06;
        pos.setZ(i, microNoise);
      }
    }
    groundGeo.computeVertexNormals();

    this.terrainTexture = this._createProceduralTerrainTexture(this.activeEnvId);

    const groundMat = new THREE.MeshStandardMaterial({
      map: this.terrainTexture,
      roughness: 0.82,
      metalness: 0.05,
      flatShading: true,
      envMapIntensity: 0.5,
    });

    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);

    this._setupTeamZoneMarkers();
    this._setupPlacementGrid();
  }

  _setupTeamZoneMarkers() {
    // Center divider line — ornate golden line
    const dividerGeo = new THREE.BoxGeometry(0.15, 0.03, 70);
    const dividerMat = new THREE.MeshBasicMaterial({
      color: 0xc9a84c,
      transparent: true,
      opacity: 0.45,
    });
    const divider = new THREE.Mesh(dividerGeo, dividerMat);
    divider.position.set(0, 0.02, 0);
    this.scene.add(divider);

    // Team zone tints
    const blueZoneGeo = new THREE.PlaneGeometry(45, 60);
    const blueZoneMat = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide
    });
    const blueZone = new THREE.Mesh(blueZoneGeo, blueZoneMat);
    blueZone.rotation.x = -Math.PI / 2;
    blueZone.position.set(-23.5, 0.015, 0);
    this.scene.add(blueZone);

    const redZoneGeo = new THREE.PlaneGeometry(45, 60);
    const redZoneMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide
    });
    const redZone = new THREE.Mesh(redZoneGeo, redZoneMat);
    redZone.rotation.x = -Math.PI / 2;
    redZone.position.set(23.5, 0.015, 0);
    this.scene.add(redZone);
  }

  _setupPlacementGrid() {
    // Hex-inspired grid overlay for tactical placement
    const gridHelper = new THREE.GridHelper(80, 40, 0xc9a84c, 0xc9a84c);
    gridHelper.material.opacity = 0.04;
    gridHelper.material.transparent = true;
    gridHelper.position.y = 0.02;
    this.scene.add(gridHelper);
  }

  _setupEnvironmentProps() {
    // Scatter rocks around the arena edges
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.95,
      metalness: 0.1,
      flatShading: true,
    });

    const rockPositions = [
      { x: -42, z: -20, s: 1.8, ry: 0.4 },
      { x: -38, z: 25, s: 1.2, ry: 1.2 },
      { x: 40, z: -15, s: 2.0, ry: 2.5 },
      { x: 35, z: 28, s: 1.5, ry: 0.8 },
      { x: -44, z: 0, s: 2.5, ry: 1.0 },
      { x: 42, z: 5, s: 1.3, ry: 3.0 },
      { x: 0, z: -35, s: 1.7, ry: 0.5 },
      { x: -5, z: 34, s: 1.1, ry: 2.0 },
    ];

    rockPositions.forEach((rp) => {
      const rock = new THREE.Mesh(rockGeo, rockMat.clone());
      rock.position.set(rp.x, rp.s * 0.3, rp.z);
      rock.scale.setScalar(rp.s);
      rock.rotation.set(rp.ry, rp.ry * 0.7, rp.ry * 0.3);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.scene.add(rock);
      this.envProps.push(rock);
    });

    // Scatter simple "tree" shapes (low-poly cones on cylinders) around edges
    this._addTreeCluster(-40, -28, 5);
    this._addTreeCluster(38, -25, 4);
    this._addTreeCluster(-35, 30, 3);
    this._addTreeCluster(40, 30, 4);
    this._addTreeCluster(-45, 10, 2);
    this._addTreeCluster(45, -5, 3);
  }

  _addTreeCluster(cx, cz, count) {
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 2.5, 6);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x5c4033,
      roughness: 0.9,
      flatShading: true,
    });
    const foliageGeo = new THREE.ConeGeometry(1.6, 3.5, 6);
    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0x2d6a3a,
      roughness: 0.8,
      flatShading: true,
    });

    for (let i = 0; i < count; i++) {
      const ox = (Math.random() - 0.5) * 8;
      const oz = (Math.random() - 0.5) * 8;
      const scale = 0.7 + Math.random() * 0.8;

      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(cx + ox, scale * 1.25, cz + oz);
      trunk.scale.setScalar(scale);
      trunk.castShadow = true;
      this.scene.add(trunk);
      this.envProps.push(trunk);

      const foliage = new THREE.Mesh(foliageGeo, foliageMat.clone());
      foliage.position.set(cx + ox, scale * 3.5, cz + oz);
      foliage.scale.setScalar(scale);
      foliage.castShadow = true;
      this.scene.add(foliage);
      this.envProps.push(foliage);
    }
  }

  _setupAncientBattlefieldProps() {
    // 1. ANCIENT STANDING RUNIC MENHIRS (Megalithic stone pillars on hilltops with glowing runic glyphs)
    const menhirPositions = [
      { x: -36, z: -32, s: 1.4, ry: 0.3, runeColor: 0x60a5fa }, // Northwest Blue ridge
      { x: -38, z: 30, s: 1.2, ry: 1.2, runeColor: 0x60a5fa },  // Southwest Blue ridge
      { x: 36, z: -30, s: 1.3, ry: -0.5, runeColor: 0xf87171 }, // Northeast Red ridge
      { x: 38, z: 32, s: 1.5, ry: 2.1, runeColor: 0xf87171 },  // Southeast Red ridge
    ];

    menhirPositions.forEach((mp) => {
      const menhirGroup = new THREE.Group();

      // Weathered stone monolith pillar
      const stoneGeo = new THREE.BoxGeometry(1.4 * mp.s, 4.8 * mp.s, 0.9 * mp.s);
      const stoneMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.92,
        metalness: 0.15,
        flatShading: true
      });
      const stone = new THREE.Mesh(stoneGeo, stoneMat);
      stone.position.y = (4.8 * mp.s) / 2;
      stone.castShadow = true;
      stone.receiveShadow = true;
      menhirGroup.add(stone);

      // Glowing carved rune bands
      for (let b = 0; b < 3; b++) {
        const runeBandGeo = new THREE.BoxGeometry(1.45 * mp.s, 0.22 * mp.s, 0.95 * mp.s);
        const runeMat = new THREE.MeshStandardMaterial({
          color: mp.runeColor,
          emissive: mp.runeColor,
          emissiveIntensity: 1.2,
          roughness: 0.3
        });
        const runeBand = new THREE.Mesh(runeBandGeo, runeMat);
        runeBand.position.y = (1.5 + b * 1.1) * mp.s;
        menhirGroup.add(runeBand);
      }

      menhirGroup.position.set(mp.x, 0.5, mp.z);
      menhirGroup.rotation.y = mp.ry;
      this.scene.add(menhirGroup);
      this.ancientProps.push(menhirGroup);
    });

    // 2. WATCH BRAZIERS / WAR PYRES (Iron tripod firestands on perimeter ridges)
    const brazierPositions = [
      { x: -44, z: -8, y: 1.6 },
      { x: -44, z: 8, y: 1.6 },
      { x: 44, z: -8, y: 1.6 },
      { x: 44, z: 8, y: 1.6 },
    ];

    brazierPositions.forEach((bp) => {
      const bGroup = new THREE.Group();

      // Pedestal stand
      const standGeo = new THREE.CylinderGeometry(0.3, 0.5, 1.8, 6);
      const standMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.35 });
      const stand = new THREE.Mesh(standGeo, standMat);
      stand.position.y = 0.9;
      stand.castShadow = true;
      bGroup.add(stand);

      // Iron fire bowl
      const bowlGeo = new THREE.CylinderGeometry(0.9, 0.4, 0.5, 8);
      const bowl = new THREE.Mesh(bowlGeo, standMat);
      bowl.position.y = 1.9;
      bGroup.add(bowl);

      // Glowing ember bed
      const emberGeo = new THREE.SphereGeometry(0.65, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      const emberMat = new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xea580c,
        emissiveIntensity: 1.8,
        roughness: 0.4
      });
      const ember = new THREE.Mesh(emberGeo, emberMat);
      ember.position.y = 2.0;
      bGroup.add(ember);

      // Warm flickering point light
      const pLight = new THREE.PointLight(0xf97316, 1.8, 14, 1.5);
      pLight.position.set(0, 2.3, 0);
      bGroup.add(pLight);
      this.brazierLights.push(pLight);

      bGroup.position.set(bp.x, bp.y, bp.z);
      this.scene.add(bGroup);
      this.ancientProps.push(bGroup);
    });

    // 3. WEATHERED DEFENSIVE PALISADES (Spiked logs guarding outskirts)
    const palisadePositions = [
      { x: -30, z: -35, count: 5, ry: 0.2 },
      { x: 30, z: -35, count: 5, ry: -0.2 },
      { x: -30, z: 35, count: 5, ry: -0.3 },
      { x: 30, z: 35, count: 5, ry: 0.3 },
    ];

    palisadePositions.forEach((pp) => {
      const pGroup = new THREE.Group();
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9, flatShading: true });

      for (let i = 0; i < pp.count; i++) {
        const spikeGeo = new THREE.ConeGeometry(0.2, 2.2, 5);
        const spike = new THREE.Mesh(spikeGeo, woodMat);
        spike.position.set((i - 2) * 0.45, 1.0, 0);
        spike.rotation.x = Math.PI / 8;
        spike.castShadow = true;
        pGroup.add(spike);
      }

      pGroup.position.set(pp.x, 0.2, pp.z);
      pGroup.rotation.y = pp.ry;
      this.scene.add(pGroup);
      this.ancientProps.push(pGroup);
    });
  }

  _setupAtmosphericParticles() {
    // 350 particles with floating / drifting animation
    const count = 350;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    this.particleVelocities = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 90;
      positions[i * 3 + 1] = Math.random() * 16 + 0.8;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 90;
      sizes[i] = Math.random() * 3.5 + 1.2;

      this.particleVelocities.push({
        vx: (Math.random() - 0.5) * 0.8,
        vy: Math.random() * 0.5 + 0.2,
        vz: (Math.random() - 0.5) * 0.8,
        phase: Math.random() * Math.PI * 2
      });
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
      color: 0xfef9e7,
      size: 0.18,
      transparent: true,
      opacity: 0.35,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.atmosphericParticles = new THREE.Points(geo, mat);
    this.scene.add(this.atmosphericParticles);
  }

  setEnvironment(envId) {
    const config = ENVIRONMENTS[envId] || ENVIRONMENTS.plains;
    this.activeEnvId = config.id;

    this.scene.background = new THREE.Color(config.skyColor);
    this.scene.fog = new THREE.FogExp2(config.fogColor, config.fogDensity);

    // Regenerate and update procedural battlefield terrain texture with clash trench
    if (this.groundMesh) {
      if (this.groundMesh.material.map) {
        this.groundMesh.material.map.dispose();
      }
      this.terrainTexture = this._createProceduralTerrainTexture(envId);
      this.groundMesh.material.map = this.terrainTexture;
      this.groundMesh.material.needsUpdate = true;
    }

    if (this.sunLight) {
      this.sunLight.color.setHex(config.sunColor);
      this.sunLight.intensity = config.sunIntensity;
      this.sunLight.position.set(config.sunPosition.x, config.sunPosition.y, config.sunPosition.z);
    }
    if (this.hemiLight) {
      this.hemiLight.color.setHex(config.ambientColor);
      this.hemiLight.intensity = config.ambientIntensity;
    }

    // Update atmospheric particle color & opacity based on environment
    if (this.atmosphericParticles) {
      const particleColors = {
        plains: 0xfef9e7,
        volcano: 0xf97316,
        snow: 0xe0f2fe,
        desert: 0xfde68a,
      };
      this.atmosphericParticles.material.color.setHex(particleColors[envId] || 0xfef9e7);
      this.atmosphericParticles.material.opacity = envId === 'volcano' ? 0.6 : envId === 'snow' ? 0.45 : 0.35;
    }

    // Update tree/foliage colors based on environment
    this.envProps.forEach((prop) => {
      if (prop.geometry.type === 'ConeGeometry') {
        const foliageColors = {
          plains: 0x2d6a3a,
          volcano: 0x3d2020,
          snow: 0x4a6741,
          desert: 0x7a6a2e,
        };
        prop.material.color.setHex(foliageColors[envId] || 0x2d6a3a);
      }
    });
  }

  setCameraMode(mode, targetUnit = null) {
    this.cameraMode = mode;
    if (targetUnit) {
      this.followTarget = targetUnit;
    }

    if (mode === 'COMMANDER' || mode === 'TACTICAL') {
      this.cameraTarget.set(0, 1.5, 0);
      this.spherical.set(65, 0.08, 0); // Directly overhead top-down view
      this._updateCameraPosition();
    } else if (mode === 'ORBIT') {
      this.cameraTarget.set(0, 1.5, 0);
      this.spherical.set(48, Math.PI / 3.5, 0);
      this._updateCameraPosition();
    } else if (mode === 'POSSESSED') {
      const unit = targetUnit || this.followTarget;
      if (unit && unit.body) {
        this.followTarget = unit;
        const pos = unit.body.translation();
        const scale = unit.typeConfig?.scale || 1.0;
        const headHeight = 1.35 * scale;
        const focalPoint = new THREE.Vector3(pos.x, pos.y + headHeight, pos.z);
        const yaw = this.possessionController ? this.possessionController.yaw : 0;
        const pitch = this.possessionController ? this.possessionController.pitch : 0.08;
        const cosPitch = Math.cos(pitch);
        const forward = new THREE.Vector3(
          Math.sin(yaw) * cosPitch,
          -Math.sin(pitch),
          Math.cos(yaw) * cosPitch
        ).normalize();
        const dynamicDist = 3.8 * scale;
        const heightOffset = 0.65 * scale;
        const snapPos = focalPoint.clone()
          .sub(forward.clone().multiplyScalar(dynamicDist))
          .add(new THREE.Vector3(0, heightOffset, 0));
        this.camera.position.copy(snapPos);
        this.camera.lookAt(focalPoint.clone().add(forward.clone().multiplyScalar(30.0)));
      }
    }
  }

  shakeCamera(intensity = 0.3) {
    this.cameraShakeTrauma = Math.min(1.0, this.cameraShakeTrauma + intensity);
  }

  updateCameraFollow(dt) {
    if (this.cameraMode === 'POSSESSED') {
      const target = this.followTarget || (this.possessionController?.engine?.units?.find(u => u.isPossessed));
      if (target && target.body) {
        this.followTarget = target;
        const pos = target.body.translation();
        const scale = target.typeConfig?.scale || 1.0;
        const headHeight = 1.35 * scale;
        const focalPoint = new THREE.Vector3(pos.x, pos.y + headHeight, pos.z);

      const yaw = this.possessionController ? this.possessionController.yaw : 0;
      const pitch = this.possessionController ? this.possessionController.pitch : 0.08;

      const cosPitch = Math.cos(pitch);
      const forward = new THREE.Vector3(
        Math.sin(yaw) * cosPitch,
        -Math.sin(pitch),
        Math.cos(yaw) * cosPitch
      ).normalize();

      const right = new THREE.Vector3(
        Math.cos(yaw),
        0,
        -Math.sin(yaw)
      ).normalize();

      // Camera positioned directly behind the character's back and elevated for clear battlefield visibility
      const isSprinting = this.possessionController?.keys?.shift &&
        (Math.abs(this.possessionController?.currentVelocity?.x || 0) > 0.1 || Math.abs(this.possessionController?.currentVelocity?.z || 0) > 0.1);
      const dynamicDist = (isSprinting ? 4.35 : 3.8) * scale;
      const heightOffset = (isSprinting ? 0.72 : 0.65) * scale;

      const desiredCamPos = focalPoint.clone()
        .sub(forward.clone().multiplyScalar(dynamicDist))
        .add(new THREE.Vector3(0, heightOffset, 0));

      // Fast responsive tracking for smooth 3rd-person action
      this.camera.position.lerp(desiredCamPos, Math.min(1.0, dt * 25.0));

      // Camera looks forward down the crosshair
      const lookTarget = focalPoint.clone().add(forward.clone().multiplyScalar(30.0));
      this.camera.lookAt(lookTarget);

      // Smooth sprint dynamic FOV
      const targetFov = isSprinting ? 50 : 45;
      if (Math.abs(this.camera.fov - targetFov) > 0.1) {
        this.camera.fov += (targetFov - this.camera.fov) * Math.min(1.0, dt * 5.0);
        this.camera.updateProjectionMatrix();
      }
    }
  } else if (this.cameraMode === 'FOLLOW' && this.followTarget && this.followTarget.body) {
      const pos = this.followTarget.body.translation();
      const rot = this.followTarget.body.rotation();
      const scale = this.followTarget.typeConfig?.scale || 1.0;
      const targetPos = new THREE.Vector3(pos.x, pos.y + 1.2 * scale, pos.z);

      const yaw = 2 * Math.atan2(rot.y, rot.w);
      const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
      const followDist = 6.2 * scale;
      const followHeight = 3.4 * scale;

      const desiredCamPos = targetPos.clone()
        .sub(forward.clone().multiplyScalar(followDist))
        .add(new THREE.Vector3(0, followHeight, 0));

      this.cameraTarget.lerp(targetPos, Math.min(1.0, dt * 6.0));
      this.camera.position.lerp(desiredCamPos, Math.min(1.0, dt * 6.0));
      this.camera.lookAt(this.cameraTarget);
    } else if (this.cameraMode !== 'POSSESSED') {
      // Free Camera Navigation via WASD & Arrow Keys
      this.updateFreeCamera(dt);
    }

    // Reset camera FOV when exiting possession
    if (this.cameraMode !== 'POSSESSED' && Math.abs(this.camera.fov - 45) > 0.1) {
      this.camera.fov += (45 - this.camera.fov) * Math.min(1.0, dt * 5.0);
      this.camera.updateProjectionMatrix();
    }

    // Dynamic Camera Shake on heavy hits / stomps / explosions
    if (this.cameraShakeTrauma > 0) {
      const traumaSq = this.cameraShakeTrauma * this.cameraShakeTrauma;
      const shakeAmt = traumaSq * 0.9;
      this.camera.position.x += (Math.random() - 0.5) * shakeAmt;
      this.camera.position.y += (Math.random() - 0.5) * shakeAmt;
      this.camera.position.z += (Math.random() - 0.5) * shakeAmt;
      this.cameraShakeTrauma = Math.max(0, this.cameraShakeTrauma - dt * 2.5);
    }

    // Animate atmospheric particles with biome-specific wind drift & swirling
    this.elapsedTime += dt;
    if (this.atmosphericParticles && this.particleVelocities) {
      const positions = this.atmosphericParticles.geometry.attributes.position.array;
      const isVolcano = this.activeEnvId === 'volcano';
      const isSnow = this.activeEnvId === 'snow';

      for (let i = 0; i < positions.length / 3; i++) {
        const vel = this.particleVelocities[i];
        if (!vel) continue;

        if (isVolcano) {
          // Fiery embers rise upward like an active furnace
          positions[i * 3 + 1] += dt * 2.2;
          positions[i * 3] += Math.sin(this.elapsedTime * 2.0 + vel.phase) * 0.02;
          if (positions[i * 3 + 1] > 18) {
            positions[i * 3 + 1] = 0.5;
            positions[i * 3] = (Math.random() - 0.5) * 80;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
          }
        } else if (isSnow) {
          // Wind-driven blizzard snowfall
          positions[i * 3 + 1] -= dt * 3.5;
          positions[i * 3] += dt * 4.0; // horizontal blizzard wind
          if (positions[i * 3 + 1] < 0.2 || positions[i * 3] > 45) {
            positions[i * 3 + 1] = 18;
            positions[i * 3] = (Math.random() - 0.5) * 90 - 20;
          }
        } else {
          // Gentle floating motes
          positions[i * 3 + 1] += Math.sin(this.elapsedTime * 0.6 + vel.phase) * 0.005;
          positions[i * 3] += Math.cos(this.elapsedTime * 0.4 + vel.phase) * 0.003;
          if (positions[i * 3 + 1] > 18) positions[i * 3 + 1] = 1;
          if (positions[i * 3 + 1] < 0) positions[i * 3 + 1] = 15;
        }
      }
      this.atmosphericParticles.geometry.attributes.position.needsUpdate = true;
    }

    // Flicker war pyres / braziers
    if (this.brazierLights && this.brazierLights.length > 0) {
      for (let i = 0; i < this.brazierLights.length; i++) {
        const pl = this.brazierLights[i];
        pl.intensity = 1.7 + Math.sin(this.elapsedTime * 8.0 + i * 2.5) * 0.35;
      }
    }
  }

  _bindEvents() {
    const canvas = this.renderer.domElement;

    canvas.addEventListener('mousedown', (e) => {
      if (this.cameraMode === 'POSSESSED') return;
      this.isMouseDown = true;
      this.mouseButton = e.button;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    canvas.addEventListener('mousemove', (e) => {
      if (this.cameraMode === 'POSSESSED' || !this.isMouseDown || this.cameraMode === 'FOLLOW') return;

      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;

      if (this.mouseButton === 2 || (this.mouseButton === 0 && e.altKey)) {
        this.spherical.theta -= deltaX * 0.005;
        this.spherical.phi -= deltaY * 0.005;
        const minPhi = 0.05;
        const maxPhi = Math.PI / 2 - 0.05;
        this.spherical.phi = Math.max(minPhi, Math.min(maxPhi, this.spherical.phi));
        this._updateCameraPosition();
      } else if (this.mouseButton === 1 || (this.mouseButton === 0 && e.shiftKey)) {
        const panSpeed = 0.04;
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        this.cameraTarget.addScaledVector(right, -deltaX * panSpeed);
        this.cameraTarget.addScaledVector(forward, deltaY * panSpeed);
        this._updateCameraPosition();
      }

      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
      this.mouseButton = -1;
    });

    canvas.addEventListener('wheel', (e) => {
      if (this.cameraMode === 'FOLLOW' || this.cameraMode === 'POSSESSED') return;
      e.preventDefault();
      this.spherical.radius += e.deltaY * this.zoomSpeed * this.spherical.radius * 0.1;
      this.spherical.radius = Math.max(5, Math.min(120, this.spherical.radius));
      this._updateCameraPosition();
    }, { passive: false });

    // ═══ Mobile Touch Controls (1-finger Orbit, 2-finger Pinch-Zoom & Pan) ═══
    let touchStartDist = 0;
    let touchStartCenter = { x: 0, y: 0 };
    let touchPrevPos = { x: 0, y: 0 };
    let isTouching = false;
    let touchCount = 0;

    canvas.addEventListener('touchstart', (e) => {
      if (this.cameraMode === 'POSSESSED') return;
      touchCount = e.touches.length;
      if (touchCount === 1) {
        touchPrevPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        isTouching = true;
      } else if (touchCount === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchStartDist = Math.hypot(dx, dy);
        touchStartCenter = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2
        };
        isTouching = true;
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      if (this.cameraMode === 'POSSESSED' || !isTouching || this.cameraMode === 'FOLLOW') return;
      if (e.cancelable) e.preventDefault();

      if (e.touches.length === 1 && touchCount === 1) {
        const clientX = e.touches[0].clientX;
        const clientY = e.touches[0].clientY;
        const deltaX = clientX - touchPrevPos.x;
        const deltaY = clientY - touchPrevPos.y;

        this.spherical.theta -= deltaX * 0.007;
        this.spherical.phi -= deltaY * 0.007;
        const minPhi = 0.05;
        const maxPhi = Math.PI / 2 - 0.05;
        this.spherical.phi = Math.max(minPhi, Math.min(maxPhi, this.spherical.phi));
        this._updateCameraPosition();

        touchPrevPos = { x: clientX, y: clientY };
      } else if (e.touches.length >= 2) {
        // Pinch-to-zoom
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDist = Math.hypot(dx, dy);

        if (touchStartDist > 0 && currentDist > 0) {
          const pinchDelta = touchStartDist - currentDist;
          this.spherical.radius += pinchDelta * 0.08;
          this.spherical.radius = Math.max(5, Math.min(120, this.spherical.radius));
          touchStartDist = currentDist;
        }

        // Two-finger pan
        const currentCenter = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2
        };
        const panDeltaX = currentCenter.x - touchStartCenter.x;
        const panDeltaY = currentCenter.y - touchStartCenter.y;

        const panSpeed = 0.035;
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        this.cameraTarget.addScaledVector(right, -panDeltaX * panSpeed);
        this.cameraTarget.addScaledVector(forward, panDeltaY * panSpeed);
        touchStartCenter = currentCenter;

        this._updateCameraPosition();
      }
    }, { passive: false });

    const handleTouchEnd = (e) => {
      touchCount = e.touches.length;
      if (touchCount === 0) {
        isTouching = false;
        touchStartDist = 0;
      } else if (touchCount === 1) {
        touchPrevPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };
    canvas.addEventListener('touchend', handleTouchEnd);
    canvas.addEventListener('touchcancel', handleTouchEnd);

    // Keyboard listeners for Free Camera WASD & Arrow navigation
    this._onKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (this.cameraMode === 'POSSESSED') return;

      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') this.freeCamKeys.w = this.freeCamKeys.up = true;
      if (key === 's' || key === 'arrowdown') this.freeCamKeys.s = this.freeCamKeys.down = true;
      if (key === 'a' || key === 'arrowleft') this.freeCamKeys.a = this.freeCamKeys.left = true;
      if (key === 'd' || key === 'arrowright') this.freeCamKeys.d = this.freeCamKeys.right = true;
      if (e.shiftKey || key === 'shift') this.freeCamKeys.shift = true;
    };

    this._onKeyUp = (e) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || key === 'arrowup') this.freeCamKeys.w = this.freeCamKeys.up = false;
      if (key === 's' || key === 'arrowdown') this.freeCamKeys.s = this.freeCamKeys.down = false;
      if (key === 'a' || key === 'arrowleft') this.freeCamKeys.a = this.freeCamKeys.left = false;
      if (key === 'd' || key === 'arrowright') this.freeCamKeys.d = this.freeCamKeys.right = false;
      if (!e.shiftKey && key === 'shift') this.freeCamKeys.shift = false;
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);

    window.addEventListener('resize', () => this.onWindowResize());
  }

  updateFreeCamera(dt) {
    if (this.cameraMode === 'POSSESSED' || this.cameraMode === 'FOLLOW') return;

    const keys = this.freeCamKeys;
    if (!keys) return;

    let moveX = 0;
    let moveZ = 0;

    if (keys.w || keys.up) moveZ += 1;
    if (keys.s || keys.down) moveZ -= 1;
    if (keys.a || keys.left) moveX -= 1;
    if (keys.d || keys.right) moveX += 1;

    if (moveX === 0 && moveZ === 0) return;

    const len = Math.hypot(moveX, moveZ);
    if (len > 0) {
      moveX /= len;
      moveZ /= len;
    }

    // Free camera navigation speed: 28 units/sec, Shift key boosts to 55 units/sec
    const speed = (keys.shift ? 55 : 28) * dt;

    // Camera forward vector projected onto horizontal XZ plane
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    // Camera right vector
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    this.cameraTarget.addScaledVector(forward, moveZ * speed);
    this.cameraTarget.addScaledVector(right, moveX * speed);

    // Keep camera target within battlefield boundaries
    this.cameraTarget.x = Math.max(-50, Math.min(50, this.cameraTarget.x));
    this.cameraTarget.z = Math.max(-38, Math.min(38, this.cameraTarget.z));

    // Adapt camera target Y to terrain elevation
    if (this.terrainSystem) {
      const targetGroundY = this.terrainSystem.getHeight(this.cameraTarget.x, this.cameraTarget.z);
      this.cameraTarget.y = targetGroundY + 1.5;
    }

    this._updateCameraPosition();
  }

  setBattlegroundCamera(mapConfig) {
    if (!mapConfig) return;

    if (mapConfig.defaultCamera) {
      const { target, spherical } = mapConfig.defaultCamera;
      if (target) {
        this.cameraTarget.set(target.x, target.y, target.z);
      }
      if (spherical) {
        this.spherical.radius = spherical.radius;
        this.spherical.phi = spherical.phi;
        this.spherical.theta = spherical.theta;
      }
    } else {
      this.spherical.radius = 48;
      this.spherical.phi = Math.PI / 3.5;
      this.spherical.theta = 0;
      this.cameraTarget.set(0, 1.5, 0);
    }
    this._updateCameraPosition();
  }

  _updateCameraPosition() {
    if (this.cameraMode === 'FOLLOW') return;
    this.camera.position.setFromSpherical(this.spherical).add(this.cameraTarget);

    // Dynamic terrain collision avoidance: never allow camera to clip below ground or inside cliffs
    if (this.terrainSystem) {
      const terrainHeight = this.terrainSystem.getHeight(this.camera.position.x, this.camera.position.z);
      const minAltitude = terrainHeight + 2.4;
      if (this.camera.position.y < minAltitude) {
        this.camera.position.y = minAltitude;
      }
    }

    this.camera.lookAt(this.cameraTarget);
  }

  applyBattlegroundLighting(mapConfig) {
    if (!mapConfig) return;

    if (this.sunLight && mapConfig.sunPosition) {
      this.sunLight.position.set(mapConfig.sunPosition.x, mapConfig.sunPosition.y, mapConfig.sunPosition.z);
      this.sunLight.color.setHex(mapConfig.sunColor || 0xffedd5);
      this.sunLight.intensity = mapConfig.sunIntensity || 1.4;
    }

    if (this.hemiLight) {
      this.hemiLight.color.setHex(mapConfig.ambientColor || 0xffffff);
      this.hemiLight.intensity = mapConfig.ambientIntensity || 0.7;
    }

    if (this.scene) {
      this.scene.background = new THREE.Color(mapConfig.skyColor || 0x1e293b);
      this.scene.fog = new THREE.FogExp2(mapConfig.fogColor || 0x0f172a, mapConfig.fogDensity || 0.007);
    }
  }

  updateDeploymentZones(deploymentZones, isEnforced = true) {
    if (!this.deploymentGroup) {
      this.deploymentGroup = new THREE.Group();
      this.scene.add(this.deploymentGroup);
    }

    while (this.deploymentGroup.children.length > 0) {
      this.deploymentGroup.remove(this.deploymentGroup.children[0]);
    }

    if (!deploymentZones || !isEnforced) return;

    const createZoneBox = (zone, colorHex) => {
      const w = zone.maxX - zone.minX;
      const d = zone.maxZ - zone.minZ;
      const cx = (zone.minX + zone.maxX) / 2;
      const cz = (zone.minZ + zone.maxZ) / 2;
      const cy = this.terrainSystem ? this.terrainSystem.getHeight(cx, cz) + 0.05 : 0.05;

      // Tinted floor
      const planeGeo = new THREE.PlaneGeometry(w, d);
      planeGeo.rotateX(-Math.PI / 2);
      const planeMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide
      });
      const plane = new THREE.Mesh(planeGeo, planeMat);
      plane.position.set(cx, cy, cz);
      this.deploymentGroup.add(plane);

      // Boundary Border Outline
      const edges = new THREE.EdgesGeometry(planeGeo);
      const lineMat = new THREE.LineBasicMaterial({ color: colorHex, linewidth: 2, transparent: true, opacity: 0.6 });
      const line = new THREE.LineSegments(edges, lineMat);
      line.position.set(cx, cy + 0.02, cz);
      this.deploymentGroup.add(line);
    };

    if (deploymentZones.blue) createZoneBox(deploymentZones.blue, 0x3b82f6);
    if (deploymentZones.red) createZoneBox(deploymentZones.red, 0xef4444);
  }

  getGroundIntersection(mouseX, mouseY, structureSystem = null) {
    this.mouse.x = mouseX;
    this.mouse.y = mouseY;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // 1. Check fortification structures for garrison platform raycasting
    if (structureSystem && structureSystem.structures) {
      for (const struct of structureSystem.structures) {
        if (struct.isDestroyed || !struct.meshGroup) continue;
        const structHits = this.raycaster.intersectObjects(struct.meshGroup.children, true);
        if (structHits.length > 0) {
          const hit = structHits[0].point;
          const isGarrison = hit.y >= (struct.position.y + 2.0);
          return {
            x: hit.x,
            y: hit.y,
            z: hit.z,
            isGarrison,
            structure: struct
          };
        }
      }
    }

    // 2. Check 3D terrain mesh
    if (this.terrainMesh) {
      const terrainHits = this.raycaster.intersectObject(this.terrainMesh);
      if (terrainHits.length > 0) {
        const p = terrainHits[0].point;
        return { x: p.x, y: p.y, z: p.z, isGarrison: false };
      }
    }

    // 3. Analytical height calculation fallback
    const target = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, target);
    if (hit) {
      const y = this.terrainSystem ? this.terrainSystem.getHeight(target.x, target.z) : 0;
      return { x: target.x, y, z: target.z, isGarrison: false };
    }
    return null;
  }

  onWindowResize() {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  setGraphicsQuality(level) {
    pbrMaterialSystem.setQuality(level);

    if (this.renderer) {
      if (level === 'LOW') {
        this.renderer.setPixelRatio(1.0);
      } else if (level === 'MEDIUM') {
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.2));
      } else if (level === 'HIGH') {
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      } else { // ULTRA
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
      }
    }

    if (this.sunLight) {
      this.sunLight.castShadow = (level !== 'LOW');
      if (this.sunLight.shadow) {
        const size = level === 'LOW' ? 512 : (level === 'MEDIUM' ? 1024 : (level === 'ULTRA' ? 2048 : 1536));
        this.sunLight.shadow.mapSize.width = size;
        this.sunLight.shadow.mapSize.height = size;
      }
    }

    // Dynamic light culling for forward rendering
    if (this.brazierLights) {
      const maxActive = level === 'LOW' ? 0 : (level === 'MEDIUM' ? 2 : (level === 'HIGH' ? 4 : 8));
      this.brazierLights.forEach((light, idx) => {
        if (light) light.visible = idx < maxActive;
      });
    }

    // Atmospheric particle visibility
    if (this.atmosphericParticles) {
      this.atmosphericParticles.visible = level !== 'LOW';
    }
  }

  dispose() {
    if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown);
    if (this._onKeyUp) window.removeEventListener('keyup', this._onKeyUp);
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
