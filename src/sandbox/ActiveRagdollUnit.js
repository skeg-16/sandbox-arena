import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { TEAMS, UNIT_TYPES } from './UnitConfig';
import { soundSystem } from './SoundSystem';
import { useSandboxStore } from '../store/useSandboxStore';
import { pbrMaterialSystem } from './PBRMaterialSystem';

let unitIdCounter = 1;

export class ActiveRagdollUnit {
  constructor(scene, rapierWorld, unitTypeId, teamId, position, vfxManager = null, traitId = 'none', bloodGoreSystem = null) {
    this.id = `unit_${unitIdCounter++}`;
    this.scene = scene;
    this.world = rapierWorld;
    this.vfxManager = vfxManager;
    this.bloodGoreSystem = bloodGoreSystem;
    this.typeConfig = { ...UNIT_TYPES[unitTypeId] };
    this.traitId = traitId;
    this.team = TEAMS[teamId.toUpperCase()] || TEAMS.BLUE;
    this.teamId = teamId.toLowerCase();

    // Trait Stat Modifiers
    if (this.traitId === 'iron') {
      this.typeConfig.health += 100;
    } else if (this.traitId === 'haste') {
      this.typeConfig.moveSpeed *= 1.5;
    }

    // Stats & State
    this.health = this.typeConfig.health;
    this.maxHealth = this.typeConfig.health;
    this.isDead = false;
    this.isKnockedDown = false;
    this.knockdownTimer = 0;
    this.attackCooldown = 0;
    this.comboStep = 1;
    this.comboTimer = 0;
    this.ultimateCooldown = 2.0; // Initial warmup before first ultimate
    this.maxUltimateCooldown = this.typeConfig.ultimateCooldown || 10.0;
    this.isEnraged = false;
    this.isPossessed = false;
    this.walkCyclePhase = Math.random() * Math.PI * 2;
    this.targetUnit = null;
    this.targetStructure = null;
    this.isGarrisoned = false;

    // Ragdoll / Physics properties
    this.body = null;
    this.collider = null;
    this.headMesh = null;
    this.bodyGroup = new THREE.Group();

    // Visual Mesh Parts for Procedural Active Ragdoll Swing
    this.leftArm = null;
    this.rightArm = null;
    this.weaponMesh = null;
    this.leftLeg = null;
    this.rightLeg = null;
    this.shieldMesh = null;

    // Build visual and physics bodies
    this._createPhysicsAndVisuals(position);
  }

  _createPhysicsAndVisuals(position) {
    const scale = this.typeConfig.scale;
    const mass = this.typeConfig.mass;
    const teamHex = this.team.color;

    // ----------------------------------------------------
    // 1. RAPIER PHYSICS BODY
    // ----------------------------------------------------
    const capsuleRadius = 0.4 * scale;
    const capsuleHeight = 1.0 * scale;

    // Initial orientation: Blue faces East (+X, angle = π/2), Red faces West (-X, angle = -π/2)
    const initialYaw = this.teamId === 'blue' ? Math.PI / 2 : -Math.PI / 2;
    const halfYaw = initialYaw * 0.5;

    if (this.world && RAPIER) {
      const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y + capsuleHeight / 2 + capsuleRadius, position.z)
        .setRotation({ x: 0, y: Math.sin(halfYaw), z: 0, w: Math.cos(halfYaw) })
        .setAdditionalMass(mass)
        .setLinearDamping(0.8)
        .setAngularDamping(2.5)
        .setCanSleep(true);

      this.body = this.world.createRigidBody(bodyDesc);

      const colliderDesc = RAPIER.ColliderDesc.capsule(capsuleHeight / 2, capsuleRadius)
        .setFriction(0.6)
        .setRestitution(0.1);

      this.collider = this.world.createCollider(colliderDesc, this.body);

      // Lock angular axes except Y to keep unit mostly upright while alive (Inverted Pendulum concept)
      this.body.setEnabledRotations(false, true, false, true);
    }

    // ----------------------------------------------------
    // 2. REALISTIC PBR HUMANOID PIPELINE
    // ----------------------------------------------------
    // Authentic materials: Team colors appear on tabards/cloth, NOT tinting entire models!
    const tabardMat = pbrMaterialSystem.getMaterial('cloth_weave', { teamColor: teamHex });
    const skinMat = pbrMaterialSystem.getMaterial('human_skin');
    const faceMat = pbrMaterialSystem.getMaterial('warrior_face', { teamColor: this.teamId });
    const steelMat = pbrMaterialSystem.getMaterial('forged_steel');
    const chainmailMat = pbrMaterialSystem.getMaterial('chainmail');
    const woodMat = pbrMaterialSystem.getMaterial('dark_timber');
    const leatherMat = pbrMaterialSystem.getMaterial('worn_leather');

    // Sculpted Anatomical Torso (Upper Chest + Waist)
    const upperChestGeo = new THREE.BoxGeometry(0.72 * scale, 0.55 * scale, 0.42 * scale);
    const upperChest = new THREE.Mesh(upperChestGeo, tabardMat);
    upperChest.position.y = 0.55 * scale;
    upperChest.castShadow = true;

    const waistGeo = new THREE.CylinderGeometry(0.3 * scale, 0.26 * scale, 0.45 * scale, 8);
    const waistMesh = new THREE.Mesh(waistGeo, chainmailMat);
    waistMesh.position.y = 0.1 * scale;
    waistMesh.castShadow = true;

    // Leather Belt & Forged Steel Buckle
    const beltGeo = new THREE.BoxGeometry(0.66 * scale, 0.12 * scale, 0.42 * scale);
    const beltMesh = new THREE.Mesh(beltGeo, leatherMat);
    beltMesh.position.y = -0.1 * scale;

    const buckleGeo = new THREE.BoxGeometry(0.14 * scale, 0.14 * scale, 0.44 * scale);
    const buckleMesh = new THREE.Mesh(buckleGeo, steelMat);
    beltMesh.add(buckleMesh);

    this.bodyGroup.add(upperChest, waistMesh, beltMesh);

    // Sculpted Neck & Proportional Head with Facial Features
    const neckGeo = new THREE.CylinderGeometry(0.12 * scale, 0.14 * scale, 0.2 * scale, 8);
    const neckMesh = new THREE.Mesh(neckGeo, skinMat);
    neckMesh.position.y = 0.9 * scale;

    const headGeo = new THREE.SphereGeometry(0.28 * scale, 14, 14);
    this.headMesh = new THREE.Mesh(headGeo, faceMat);
    this.headMesh.position.y = 1.1 * scale;
    this.headMesh.rotation.y = -Math.PI / 2; // Orient warrior face forward along character forward axis
    this.headMesh.castShadow = true;

    this.bodyGroup.add(neckMesh, this.headMesh);

    // Realistic Articulated Arms (Deltoid Bicep + Forearm Bracer)
    const upperArmGeo = new THREE.CylinderGeometry(0.11 * scale, 0.09 * scale, 0.42 * scale, 8);
    const forearmGeo = new THREE.CylinderGeometry(0.09 * scale, 0.08 * scale, 0.42 * scale, 8);
    const legThighGeo = new THREE.CylinderGeometry(0.13 * scale, 0.1 * scale, 0.48 * scale, 8);
    const legCalfGeo = new THREE.CylinderGeometry(0.11 * scale, 0.11 * scale, 0.48 * scale, 8);

    // Left Arm
    this.leftArm = new THREE.Group();
    const lUpperArm = new THREE.Mesh(upperArmGeo, skinMat);
    lUpperArm.position.y = -0.2 * scale;
    const lForearm = new THREE.Mesh(forearmGeo, leatherMat);
    lForearm.position.y = -0.55 * scale;
    lUpperArm.castShadow = true;
    lForearm.castShadow = true;
    this.leftArm.add(lUpperArm, lForearm);
    this.leftArm.position.set(-0.44 * scale, 0.7 * scale, 0);

    // Right Arm
    this.rightArm = new THREE.Group();
    const rUpperArm = new THREE.Mesh(upperArmGeo, skinMat);
    rUpperArm.position.y = -0.2 * scale;
    const rForearm = new THREE.Mesh(forearmGeo, leatherMat);
    rForearm.position.y = -0.55 * scale;
    rUpperArm.castShadow = true;
    rForearm.castShadow = true;
    this.rightArm.add(rUpperArm, rForearm);
    this.rightArm.position.set(0.44 * scale, 0.7 * scale, 0);

    // Left Leg
    this.leftLeg = new THREE.Group();
    const lThigh = new THREE.Mesh(legThighGeo, chainmailMat);
    lThigh.position.y = -0.24 * scale;
    const lCalf = new THREE.Mesh(legCalfGeo, leatherMat);
    lCalf.position.y = -0.65 * scale;
    lThigh.castShadow = true;
    lCalf.castShadow = true;
    this.leftLeg.add(lThigh, lCalf);
    this.leftLeg.position.set(-0.2 * scale, -0.2 * scale, 0);

    // Right Leg
    this.rightLeg = new THREE.Group();
    const rThigh = new THREE.Mesh(legThighGeo, chainmailMat);
    rThigh.position.y = -0.24 * scale;
    const rCalf = new THREE.Mesh(legCalfGeo, leatherMat);
    rCalf.position.y = -0.65 * scale;
    rThigh.castShadow = true;
    rCalf.castShadow = true;
    this.rightLeg.add(rThigh, rCalf);
    this.rightLeg.position.set(0.2 * scale, -0.2 * scale, 0);

    this.bodyGroup.add(this.leftArm, this.rightArm, this.leftLeg, this.rightLeg);

    // ----------------------------------------------------
    // 3. UNIT-SPECIFIC SILHOUETTE ACCESORIES & WEAPONS
    // ----------------------------------------------------
    this._attachUnitEquipment(scale, steelMat, woodMat, tabardMat);

    // Add body group to Three scene
    this.scene.add(this.bodyGroup);
    this.updateMeshFromPhysics();
  }

  _attachUnitEquipment(scale, metalMat, woodMat, bodyMat) {
    const type = this.typeConfig.id;

    if (type === 'swordsman') {
      // God of War Spartan/Norse Blade Champion
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8, roughness: 0.2 });
      const runeMat = new THREE.MeshStandardMaterial({
        color: this.team.color,
        emissive: this.team.color,
        emissiveIntensity: 0.95
      });

      // 1. Sculpted Bronze Cuirass Chestplate
      const chestPlateGeo = new THREE.BoxGeometry(0.75 * scale, 0.9 * scale, 0.45 * scale);
      const chestPlate = new THREE.Mesh(chestPlateGeo, metalMat);
      chestPlate.position.set(0, 0.45 * scale, 0);

      // Gold Chest Trim
      const trimGeo = new THREE.BoxGeometry(0.77 * scale, 0.12 * scale, 0.47 * scale);
      const trim = new THREE.Mesh(trimGeo, goldMat);
      trim.position.set(0, 0.7 * scale, 0);
      chestPlate.add(trim);
      this.bodyGroup.add(chestPlate);

      // 2. Heavy Shoulder Pauldrons
      const pauldronGeo = new THREE.SphereGeometry(0.25 * scale, 6, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      const lPauldron = new THREE.Mesh(pauldronGeo, metalMat);
      lPauldron.position.set(0, -0.05 * scale, 0);
      lPauldron.rotation.z = Math.PI / 4;
      this.leftArm.add(lPauldron);

      const rPauldron = lPauldron.clone();
      rPauldron.rotation.z = -Math.PI / 4;
      this.rightArm.add(rPauldron);

      // 3. Crested Spartan Helmet with Glowing Visor
      const helmGeo = new THREE.CylinderGeometry(0.32 * scale, 0.35 * scale, 0.45 * scale, 8);
      const helm = new THREE.Mesh(helmGeo, metalMat);
      helm.position.y = 1.05 * scale;

      // Crest Plume
      const crestGeo = new THREE.BoxGeometry(0.08 * scale, 0.3 * scale, 0.65 * scale);
      const crestMat = new THREE.MeshStandardMaterial({ color: this.team.color, roughness: 0.4 });
      const crest = new THREE.Mesh(crestGeo, crestMat);
      crest.position.y = 0.3 * scale;
      helm.add(crest);

      // Glowing Visor Eyes
      const visorGeo = new THREE.BoxGeometry(0.3 * scale, 0.08 * scale, 0.1 * scale);
      const visor = new THREE.Mesh(visorGeo, runeMat);
      visor.position.set(0, 0.02 * scale, 0.3 * scale);
      helm.add(visor);

      this.bodyGroup.add(helm);
      this.headMesh = helm;

      // 4. Fur Pelt / Warrior Cape
      const capeGeo = new THREE.PlaneGeometry(0.8 * scale, 1.2 * scale);
      const capeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, side: THREE.DoubleSide, roughness: 0.9 });
      const cape = new THREE.Mesh(capeGeo, capeMat);
      cape.position.set(0, 0.2 * scale, -0.28 * scale);
      cape.rotation.x = Math.PI / 12;
      this.bodyGroup.add(cape);

      // 5. Leviathan / Runic Broadsword
      const swordGroup = new THREE.Group();
      
      const hiltGeo = new THREE.CylinderGeometry(0.04 * scale, 0.04 * scale, 0.4 * scale, 6);
      const hilt = new THREE.Mesh(hiltGeo, woodMat);
      
      const guardGeo = new THREE.BoxGeometry(0.45 * scale, 0.06 * scale, 0.12 * scale);
      const guard = new THREE.Mesh(guardGeo, goldMat);
      guard.position.y = 0.2 * scale;
      swordGroup.add(hilt, guard);

      const bladeGeo = new THREE.BoxGeometry(0.14 * scale, 1.4 * scale, 0.03 * scale);
      const blade = new THREE.Mesh(bladeGeo, metalMat);
      blade.position.y = 0.9 * scale;

      const runeStripGeo = new THREE.BoxGeometry(0.04 * scale, 1.2 * scale, 0.04 * scale);
      const runeStrip = new THREE.Mesh(runeStripGeo, runeMat);
      blade.add(runeStrip);

      swordGroup.add(blade);
      swordGroup.position.set(0, -0.4 * scale, 0.4 * scale);
      swordGroup.rotation.x = Math.PI / 3;

      this.rightArm.add(swordGroup);
      this.weaponMesh = swordGroup;

    } else if (type === 'spearman') {
      // God of War Valkyrie / Spartan Spear Guardian
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.2 });
      const runeMat = new THREE.MeshStandardMaterial({
        color: this.team.color,
        emissive: this.team.color,
        emissiveIntensity: 0.95
      });

      // 1. Scale Mail Cuirass & Pteruges War Kilt
      const chestGeo = new THREE.CylinderGeometry(0.38 * scale, 0.32 * scale, 0.95 * scale, 8);
      const chest = new THREE.Mesh(chestGeo, metalMat);
      chest.position.y = 0.48 * scale;

      for (let i = 0; i < 6; i++) {
        const stripGeo = new THREE.BoxGeometry(0.12 * scale, 0.4 * scale, 0.03 * scale);
        const strip = new THREE.Mesh(stripGeo, goldMat);
        const angle = (i / 6) * Math.PI * 2;
        strip.position.set(Math.sin(angle) * 0.35 * scale, -0.4 * scale, Math.cos(angle) * 0.35 * scale);
        chest.add(strip);
      }
      this.bodyGroup.add(chest);

      // 2. Winged Valkyrie / Corinthian Helmet
      const helmGeo = new THREE.ConeGeometry(0.38 * scale, 0.65 * scale, 8);
      const helm = new THREE.Mesh(helmGeo, metalMat);
      helm.position.y = 1.15 * scale;

      const wingGeo = new THREE.ConeGeometry(0.08 * scale, 0.45 * scale, 4);
      const lWing = new THREE.Mesh(wingGeo, goldMat);
      lWing.position.set(-0.3 * scale, 0.1 * scale, 0);
      lWing.rotation.z = Math.PI / 4;

      const rWing = lWing.clone();
      rWing.position.set(0.3 * scale, 0.1 * scale, 0);
      rWing.rotation.z = -Math.PI / 4;
      helm.add(lWing, rWing);

      const visorGeo = new THREE.BoxGeometry(0.28 * scale, 0.06 * scale, 0.1 * scale);
      const visor = new THREE.Mesh(visorGeo, runeMat);
      visor.position.set(0, -0.15 * scale, 0.3 * scale);
      helm.add(visor);

      this.bodyGroup.add(helm);
      this.headMesh = helm;

      // 3. Spiked Pauldrons
      const pauldronGeo = new THREE.ConeGeometry(0.2 * scale, 0.3 * scale, 5);
      const lPauldron = new THREE.Mesh(pauldronGeo, metalMat);
      lPauldron.position.set(-0.05 * scale, 0.1 * scale, 0);
      lPauldron.rotation.z = Math.PI / 3;
      this.leftArm.add(lPauldron);

      const rPauldron = lPauldron.clone();
      rPauldron.position.set(0.05 * scale, 0.1 * scale, 0);
      rPauldron.rotation.z = -Math.PI / 3;
      this.rightArm.add(rPauldron);

      // 4. Draupnir Runic War Spear
      const spearGroup = new THREE.Group();

      const shaftGeo = new THREE.CylinderGeometry(0.04 * scale, 0.04 * scale, 3.2 * scale, 6);
      const shaft = new THREE.Mesh(shaftGeo, woodMat);

      const guardGeo = new THREE.CylinderGeometry(0.1 * scale, 0.1 * scale, 0.15 * scale, 6);
      const guard = new THREE.Mesh(guardGeo, goldMat);
      guard.position.y = 1.2 * scale;
      shaft.add(guard);

      const tipGeo = new THREE.ConeGeometry(0.16 * scale, 0.7 * scale, 4);
      const tip = new THREE.Mesh(tipGeo, metalMat);
      tip.position.y = 1.6 * scale;

      const runeStripGeo = new THREE.BoxGeometry(0.05 * scale, 0.6 * scale, 0.05 * scale);
      const runeStrip = new THREE.Mesh(runeStripGeo, runeMat);
      tip.add(runeStrip);

      shaft.add(tip);
      spearGroup.add(shaft);

      spearGroup.position.set(0, -0.4 * scale, 1.2 * scale);
      spearGroup.rotation.x = Math.PI / 2.2;

      this.rightArm.add(spearGroup);
      this.weaponMesh = spearGroup;

    } else if (type === 'archer') {
      // GOD OF WAR - Artemis / Norse Ranger Stalker
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xb8860b, metalness: 0.75, roughness: 0.25 });
      const runeMat = new THREE.MeshStandardMaterial({
        color: this.team.color,
        emissive: this.team.color,
        emissiveIntensity: 0.85
      });
      const darkLeatherMat = new THREE.MeshStandardMaterial({ color: 0x1a0f00, roughness: 0.85 });

      // 1. Studded Leather Armor Vest
      const vestGeo = new THREE.BoxGeometry(0.68 * scale, 0.85 * scale, 0.4 * scale);
      const vest = new THREE.Mesh(vestGeo, darkLeatherMat);
      vest.position.set(0, 0.48 * scale, 0);
      // Rivet studs across chest
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const rivetGeo = new THREE.SphereGeometry(0.025 * scale, 4, 4);
          const rivet = new THREE.Mesh(rivetGeo, metalMat);
          rivet.position.set(
            (col - 1) * 0.18 * scale,
            (row - 1) * 0.22 * scale,
            0.21 * scale
          );
          vest.add(rivet);
        }
      }
      this.bodyGroup.add(vest);

      // 2. Ranger Hood with Metal Brow Band
      const hoodGeo = new THREE.ConeGeometry(0.38 * scale, 0.55 * scale, 6);
      const hoodMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
      const hood = new THREE.Mesh(hoodGeo, hoodMat);
      hood.position.y = 1.15 * scale;

      // Metal Brow Band
      const bandGeo = new THREE.TorusGeometry(0.3 * scale, 0.03 * scale, 6, 12, Math.PI);
      const band = new THREE.Mesh(bandGeo, metalMat);
      band.position.set(0, -0.15 * scale, 0.15 * scale);
      band.rotation.x = Math.PI / 2;
      hood.add(band);

      // Glowing Eye Slit
      const eyeSlitGeo = new THREE.BoxGeometry(0.22 * scale, 0.04 * scale, 0.08 * scale);
      const eyeSlit = new THREE.Mesh(eyeSlitGeo, runeMat);
      eyeSlit.position.set(0, -0.18 * scale, 0.28 * scale);
      hood.add(eyeSlit);

      this.bodyGroup.add(hood);
      this.headMesh = hood;

      // 3. Leather Bracers with Gold Trim
      const bracerGeo = new THREE.CylinderGeometry(0.12 * scale, 0.1 * scale, 0.25 * scale, 6);
      const lBracer = new THREE.Mesh(bracerGeo, darkLeatherMat);
      lBracer.position.y = -0.52 * scale;
      const lBracerTrim = new THREE.Mesh(
        new THREE.TorusGeometry(0.12 * scale, 0.015 * scale, 4, 8),
        goldMat
      );
      lBracerTrim.rotation.x = Math.PI / 2;
      lBracerTrim.position.y = 0.1 * scale;
      lBracer.add(lBracerTrim);
      this.leftArm.add(lBracer);

      const rBracer = lBracer.clone();
      this.rightArm.add(rBracer);

      // 4. Quiver on Back
      const quiverGeo = new THREE.CylinderGeometry(0.1 * scale, 0.08 * scale, 0.8 * scale, 6);
      const quiver = new THREE.Mesh(quiverGeo, darkLeatherMat);
      quiver.position.set(0.2 * scale, 0.5 * scale, -0.28 * scale);
      quiver.rotation.x = Math.PI / 12;
      // Arrow shafts poking out
      for (let i = 0; i < 4; i++) {
        const arrowShaftGeo = new THREE.CylinderGeometry(0.012 * scale, 0.012 * scale, 0.35 * scale, 4);
        const arrowShaft = new THREE.Mesh(arrowShaftGeo, woodMat);
        arrowShaft.position.set(
          (Math.random() - 0.5) * 0.06 * scale,
          0.5 * scale,
          (Math.random() - 0.5) * 0.06 * scale
        );
        quiver.add(arrowShaft);
      }
      this.bodyGroup.add(quiver);

      // 5. Enchanted War Bow with Runic String
      const bowGroup = new THREE.Group();
      const bowArcGeo = new THREE.TorusGeometry(0.55 * scale, 0.04 * scale, 6, 14, Math.PI);
      const bowArc = new THREE.Mesh(bowArcGeo, woodMat);

      // Runic glow inlays on bow limbs
      const bowRuneGeo = new THREE.TorusGeometry(0.55 * scale, 0.015 * scale, 4, 14, Math.PI);
      const bowRune = new THREE.Mesh(bowRuneGeo, runeMat);
      bowArc.add(bowRune);

      // Gold-tipped bow ends
      const tipGeo = new THREE.SphereGeometry(0.05 * scale, 6, 6);
      const lTip = new THREE.Mesh(tipGeo, goldMat);
      lTip.position.set(-0.55 * scale, 0, 0);
      const rTip = lTip.clone();
      rTip.position.set(0.55 * scale, 0, 0);
      bowArc.add(lTip, rTip);

      // Bowstring
      const stringGeo = new THREE.CylinderGeometry(0.008 * scale, 0.008 * scale, 1.1 * scale, 4);
      const stringMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.3 });
      const bowString = new THREE.Mesh(stringGeo, stringMat);
      bowString.rotation.z = Math.PI / 2;
      bowString.position.set(0, 0, 0.05 * scale);
      bowArc.add(bowString);

      bowGroup.add(bowArc);
      bowGroup.position.set(0, -0.4 * scale, 0.3 * scale);
      bowGroup.rotation.y = Math.PI / 2;
      this.leftArm.add(bowGroup);
      this.weaponMesh = bowGroup;

      // 6. Short Hunting Cape
      const capeGeo = new THREE.PlaneGeometry(0.6 * scale, 0.85 * scale);
      const capeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, side: THREE.DoubleSide, roughness: 0.9 });
      const cape = new THREE.Mesh(capeGeo, capeMat);
      cape.position.set(0, 0.3 * scale, -0.24 * scale);
      cape.rotation.x = Math.PI / 14;
      this.bodyGroup.add(cape);

    } else if (type === 'mage') {
      // GOD OF WAR - Freya / Odin Seiðr Sorcerer
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xc8a000, metalness: 0.8, roughness: 0.2 });
      const runeMat = new THREE.MeshStandardMaterial({
        color: this.team.color,
        emissive: this.team.color,
        emissiveIntensity: 1.0
      });
      const arcaneGlowMat = new THREE.MeshStandardMaterial({
        color: 0x7c3aed,
        emissive: 0x5b21b6,
        emissiveIntensity: 0.9
      });

      // 1. Enchanted Sorcerer's Robe with Rune Bands
      const robeGeo = new THREE.CylinderGeometry(0.35 * scale, 0.48 * scale, 1.2 * scale, 8);
      const robeMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.75 });
      const robe = new THREE.Mesh(robeGeo, robeMat);
      robe.position.y = 0.2 * scale;

      // Gold trim bands
      for (let i = 0; i < 3; i++) {
        const trimGeo = new THREE.TorusGeometry(
          (0.36 + i * 0.04) * scale, 0.015 * scale, 4, 16
        );
        const trim = new THREE.Mesh(trimGeo, goldMat);
        trim.rotation.x = Math.PI / 2;
        trim.position.y = (0.3 - i * 0.35) * scale;
        robe.add(trim);
      }

      // Chest rune emblem
      const emblemGeo = new THREE.RingGeometry(0.08 * scale, 0.12 * scale, 6);
      const emblem = new THREE.Mesh(emblemGeo, runeMat);
      emblem.position.set(0, 0.35 * scale, 0.36 * scale);
      robe.add(emblem);

      this.bodyGroup.add(robe);

      // 2. Horned Crown of the Allfather
      const crownBaseGeo = new THREE.CylinderGeometry(0.32 * scale, 0.34 * scale, 0.2 * scale, 8);
      const crown = new THREE.Mesh(crownBaseGeo, goldMat);
      crown.position.y = 1.15 * scale;

      // Crown horns
      const hornGeo = new THREE.ConeGeometry(0.06 * scale, 0.45 * scale, 5);
      const lHorn = new THREE.Mesh(hornGeo, metalMat);
      lHorn.position.set(-0.25 * scale, 0.2 * scale, 0);
      lHorn.rotation.z = Math.PI / 6;
      const rHorn = lHorn.clone();
      rHorn.position.set(0.25 * scale, 0.2 * scale, 0);
      rHorn.rotation.z = -Math.PI / 6;
      crown.add(lHorn, rHorn);

      // Crown jewel
      const jewelGeo = new THREE.OctahedronGeometry(0.06 * scale);
      const jewel = new THREE.Mesh(jewelGeo, arcaneGlowMat);
      jewel.position.set(0, 0.12 * scale, 0.3 * scale);
      crown.add(jewel);

      // Glowing eyes
      const eyeGlowGeo = new THREE.BoxGeometry(0.24 * scale, 0.05 * scale, 0.06 * scale);
      const eyeGlow = new THREE.Mesh(eyeGlowGeo, runeMat);
      eyeGlow.position.set(0, -0.02 * scale, 0.3 * scale);
      crown.add(eyeGlow);

      this.bodyGroup.add(crown);
      this.headMesh = crown;

      // 3. Floating Shoulder Runes
      const shoulderRuneGeo = new THREE.RingGeometry(0.1 * scale, 0.14 * scale, 6);
      const lShoulderRune = new THREE.Mesh(shoulderRuneGeo, runeMat);
      lShoulderRune.position.set(-0.05 * scale, 0.05 * scale, 0.12 * scale);
      this.leftArm.add(lShoulderRune);

      const rShoulderRune = lShoulderRune.clone();
      rShoulderRune.position.set(0.05 * scale, 0.05 * scale, 0.12 * scale);
      this.rightArm.add(rShoulderRune);

      // 4. Seiðr Staff of the Realms
      const staffGroup = new THREE.Group();

      const shaftGeo = new THREE.CylinderGeometry(0.04 * scale, 0.05 * scale, 2.4 * scale, 6);
      const shaftMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.6, metalness: 0.3 });
      const shaft = new THREE.Mesh(shaftGeo, shaftMat);

      // Rune spiral on shaft
      const spiralGeo = new THREE.TorusGeometry(0.06 * scale, 0.01 * scale, 4, 8, Math.PI * 4);
      const spiral = new THREE.Mesh(spiralGeo, runeMat);
      spiral.rotation.y = Math.PI / 2;
      shaft.add(spiral);

      // Staff Crown - forked prongs holding an orb
      for (let i = 0; i < 3; i++) {
        const prongGeo = new THREE.CylinderGeometry(0.02 * scale, 0.015 * scale, 0.4 * scale, 4);
        const prong = new THREE.Mesh(prongGeo, metalMat);
        const ang = (i / 3) * Math.PI * 2;
        prong.position.set(
          Math.cos(ang) * 0.06 * scale,
          1.35 * scale,
          Math.sin(ang) * 0.06 * scale
        );
        prong.rotation.x = Math.cos(ang) * 0.3;
        prong.rotation.z = Math.sin(ang) * 0.3;
        shaft.add(prong);
      }

      // Arcane Orb
      const orbGeo = new THREE.SphereGeometry(0.2 * scale, 10, 10);
      const orb = new THREE.Mesh(orbGeo, arcaneGlowMat);
      orb.position.y = 1.5 * scale;
      shaft.add(orb);

      // Inner core glow
      const coreGeo = new THREE.SphereGeometry(0.1 * scale, 8, 8);
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.6
      });
      const core = new THREE.Mesh(coreGeo, coreMat);
      orb.add(core);

      staffGroup.add(shaft);
      staffGroup.position.set(0, -0.3 * scale, 0.4 * scale);
      staffGroup.rotation.x = Math.PI / 3;

      this.rightArm.add(staffGroup);
      this.weaponMesh = staffGroup;

      // 5. Mystic Flowing Cape
      const capeGeo = new THREE.PlaneGeometry(0.9 * scale, 1.4 * scale);
      const capeMat = new THREE.MeshStandardMaterial({
        color: 0x1e1b4b,
        side: THREE.DoubleSide,
        roughness: 0.85
      });
      const cape = new THREE.Mesh(capeGeo, capeMat);
      cape.position.set(0, 0.15 * scale, -0.3 * scale);
      cape.rotation.x = Math.PI / 10;
      this.bodyGroup.add(cape);

    } else if (type === 'shield_bearer') {
      // GOD OF WAR - Hoplite / Norse Shieldwall Sentinel
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4a017, metalness: 0.8, roughness: 0.2 });
      const runeMat = new THREE.MeshStandardMaterial({
        color: this.team.color,
        emissive: this.team.color,
        emissiveIntensity: 0.9
      });

      // 1. Heavy Plate Cuirass with Abs Detail
      const cuirassGeo = new THREE.BoxGeometry(0.78 * scale, 0.95 * scale, 0.46 * scale);
      const cuirass = new THREE.Mesh(cuirassGeo, metalMat);
      cuirass.position.set(0, 0.46 * scale, 0);
      // Muscle line detail
      const lineGeo = new THREE.BoxGeometry(0.02 * scale, 0.6 * scale, 0.48 * scale);
      const centerLine = new THREE.Mesh(lineGeo, new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9 }));
      cuirass.add(centerLine);
      // Gold collar
      const collarGeo = new THREE.BoxGeometry(0.8 * scale, 0.1 * scale, 0.48 * scale);
      const collar = new THREE.Mesh(collarGeo, goldMat);
      collar.position.y = 0.44 * scale;
      cuirass.add(collar);
      this.bodyGroup.add(cuirass);

      // 2. Corinthian Full-Face Helm
      const helmGeo = new THREE.CylinderGeometry(0.33 * scale, 0.36 * scale, 0.52 * scale, 8);
      const helm = new THREE.Mesh(helmGeo, metalMat);
      helm.position.y = 1.08 * scale;

      // Nose Guard
      const noseGuardGeo = new THREE.BoxGeometry(0.06 * scale, 0.35 * scale, 0.08 * scale);
      const noseGuard = new THREE.Mesh(noseGuardGeo, metalMat);
      noseGuard.position.set(0, -0.08 * scale, 0.32 * scale);
      helm.add(noseGuard);

      // T-shaped visor opening with glow
      const visorGeo = new THREE.BoxGeometry(0.24 * scale, 0.06 * scale, 0.06 * scale);
      const visor = new THREE.Mesh(visorGeo, runeMat);
      visor.position.set(0, 0.02 * scale, 0.33 * scale);
      helm.add(visor);

      // Crest - transverse red/blue team-colored horsehair
      const crestGeo = new THREE.BoxGeometry(0.5 * scale, 0.22 * scale, 0.08 * scale);
      const crestMat = new THREE.MeshStandardMaterial({ color: this.team.color, roughness: 0.5 });
      const crest = new THREE.Mesh(crestGeo, crestMat);
      crest.position.y = 0.32 * scale;
      helm.add(crest);

      this.bodyGroup.add(helm);
      this.headMesh = helm;

      // 3. Massive Pauldrons with Gold Rivets
      const pauldronGeo = new THREE.SphereGeometry(0.28 * scale, 6, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      const lPauldron = new THREE.Mesh(pauldronGeo, metalMat);
      lPauldron.position.set(0, -0.02 * scale, 0);
      lPauldron.rotation.z = Math.PI / 4;
      // Gold rivet
      const rivetGeo = new THREE.SphereGeometry(0.04 * scale, 4, 4);
      const rivet = new THREE.Mesh(rivetGeo, goldMat);
      rivet.position.y = 0.15 * scale;
      lPauldron.add(rivet);
      this.leftArm.add(lPauldron);

      const rPauldron = lPauldron.clone();
      rPauldron.rotation.z = -Math.PI / 4;
      this.rightArm.add(rPauldron);

      // 4. Runic Aspis / Tower Shield (Round with boss & rune ring)
      const shieldGroup = new THREE.Group();

      const shieldFaceGeo = new THREE.CylinderGeometry(0.65 * scale, 0.65 * scale, 0.1 * scale, 12);
      const shieldFaceMat = new THREE.MeshStandardMaterial({ color: this.team.color, metalness: 0.5, roughness: 0.35 });
      const shieldFace = new THREE.Mesh(shieldFaceGeo, shieldFaceMat);
      shieldFace.rotation.x = Math.PI / 2;

      // Central boss (shield umbo)
      const bossGeo = new THREE.SphereGeometry(0.15 * scale, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      const boss = new THREE.Mesh(bossGeo, goldMat);
      boss.rotation.x = -Math.PI / 2;
      boss.position.z = 0.06 * scale;
      shieldFace.add(boss);

      // Runic ring inscription
      const runeRingGeo = new THREE.TorusGeometry(0.48 * scale, 0.025 * scale, 4, 16);
      const runeRing = new THREE.Mesh(runeRingGeo, runeMat);
      runeRing.position.z = 0.06 * scale;
      shieldFace.add(runeRing);

      // Metal rim
      const rimGeo = new THREE.TorusGeometry(0.65 * scale, 0.04 * scale, 4, 16);
      const rim = new THREE.Mesh(rimGeo, metalMat);
      rim.position.z = 0.02 * scale;
      shieldFace.add(rim);

      shieldGroup.add(shieldFace);
      shieldGroup.position.set(0, -0.25 * scale, 0.5 * scale);
      this.leftArm.add(shieldGroup);
      this.shieldMesh = shieldGroup;

      // 5. Flanged War Mace
      const maceGroup = new THREE.Group();
      const maceShaftGeo = new THREE.CylinderGeometry(0.04 * scale, 0.04 * scale, 1.0 * scale, 6);
      const maceShaft = new THREE.Mesh(maceShaftGeo, woodMat);

      // Flanged head
      const maceHeadGeo = new THREE.SphereGeometry(0.14 * scale, 6, 6);
      const maceHead = new THREE.Mesh(maceHeadGeo, metalMat);
      maceHead.position.y = 0.55 * scale;
      maceShaft.add(maceHead);

      // Flanges / ridges
      for (let i = 0; i < 4; i++) {
        const flangeGeo = new THREE.BoxGeometry(0.04 * scale, 0.18 * scale, 0.22 * scale);
        const flange = new THREE.Mesh(flangeGeo, metalMat);
        flange.rotation.y = (i / 4) * Math.PI * 2;
        flange.position.y = 0.55 * scale;
        maceShaft.add(flange);
      }

      maceGroup.add(maceShaft);
      maceGroup.position.set(0, -0.4 * scale, 0.35 * scale);
      maceGroup.rotation.x = Math.PI / 3;
      this.rightArm.add(maceGroup);
      this.weaponMesh = maceGroup;

    } else if (type === 'cavalry') {
      // GOD OF WAR - Odin's Einherjar Mounted Champion
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4a017, metalness: 0.8, roughness: 0.2 });
      const runeMat = new THREE.MeshStandardMaterial({
        color: this.team.color,
        emissive: this.team.color,
        emissiveIntensity: 0.85
      });
      const horseFurMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });

      // 1. Armored War Horse
      const horseBodyGeo = new THREE.BoxGeometry(1.3 * scale, 1.0 * scale, 2.2 * scale);
      const horse = new THREE.Mesh(horseBodyGeo, horseFurMat);
      horse.position.set(0, -0.5 * scale, 0);
      horse.castShadow = true;

      // Horse barding (armor plates)
      const bardingGeo = new THREE.BoxGeometry(1.35 * scale, 0.3 * scale, 2.0 * scale);
      const barding = new THREE.Mesh(bardingGeo, metalMat);
      barding.position.y = 0.4 * scale;
      horse.add(barding);

      // Gold trim on barding
      const bardTrimGeo = new THREE.BoxGeometry(1.37 * scale, 0.06 * scale, 2.02 * scale);
      const bardTrim = new THREE.Mesh(bardTrimGeo, goldMat);
      bardTrim.position.y = 0.25 * scale;
      barding.add(bardTrim);

      // Horse Neck
      const neckGeo = new THREE.BoxGeometry(0.5 * scale, 0.9 * scale, 0.5 * scale);
      const horseNeck = new THREE.Mesh(neckGeo, horseFurMat);
      horseNeck.position.set(0, 0.55 * scale, 0.85 * scale);
      horseNeck.rotation.x = -Math.PI / 5;
      horse.add(horseNeck);

      // Horse Head with Chamfron (face plate armor)
      const horseHeadGeo = new THREE.BoxGeometry(0.4 * scale, 0.55 * scale, 0.65 * scale);
      const horseHead = new THREE.Mesh(horseHeadGeo, horseFurMat);
      horseHead.position.set(0, 0.6 * scale, 0.4 * scale);
      horseHead.rotation.x = Math.PI / 8;
      horseNeck.add(horseHead);

      // Chamfron (face armor)
      const chamfronGeo = new THREE.BoxGeometry(0.35 * scale, 0.5 * scale, 0.1 * scale);
      const chamfron = new THREE.Mesh(chamfronGeo, metalMat);
      chamfron.position.z = 0.35 * scale;
      horseHead.add(chamfron);

      // Horse eye glow
      const horseEyeGeo = new THREE.SphereGeometry(0.04 * scale, 4, 4);
      const lHorseEye = new THREE.Mesh(horseEyeGeo, runeMat);
      lHorseEye.position.set(-0.18 * scale, 0.1 * scale, 0.3 * scale);
      const rHorseEye = lHorseEye.clone();
      rHorseEye.position.set(0.18 * scale, 0.1 * scale, 0.3 * scale);
      horseHead.add(lHorseEye, rHorseEye);

      // Horse legs
      const horseLegGeo = new THREE.CylinderGeometry(0.1 * scale, 0.08 * scale, 1.0 * scale, 6);
      const legPositions = [
        [-0.45, -0.6, 0.7], [0.45, -0.6, 0.7],
        [-0.45, -0.6, -0.7], [0.45, -0.6, -0.7]
      ];
      legPositions.forEach(([lx, ly, lz]) => {
        const leg = new THREE.Mesh(horseLegGeo, horseFurMat);
        leg.position.set(lx * scale, ly * scale, lz * scale);
        leg.castShadow = true;
        horse.add(leg);
      });

      // Horse tail
      const tailGeo = new THREE.CylinderGeometry(0.04 * scale, 0.02 * scale, 0.8 * scale, 4);
      const tail = new THREE.Mesh(tailGeo, horseFurMat);
      tail.position.set(0, 0.2 * scale, -1.2 * scale);
      tail.rotation.x = Math.PI / 3;
      horse.add(tail);

      this.bodyGroup.add(horse);

      // 2. Rider's Knight Armor
      const riderChestGeo = new THREE.BoxGeometry(0.72 * scale, 0.8 * scale, 0.42 * scale);
      const riderChest = new THREE.Mesh(riderChestGeo, metalMat);
      riderChest.position.set(0, 0.5 * scale, 0);
      const riderTrim = new THREE.Mesh(
        new THREE.BoxGeometry(0.74 * scale, 0.08 * scale, 0.44 * scale),
        goldMat
      );
      riderTrim.position.y = 0.35 * scale;
      riderChest.add(riderTrim);
      this.bodyGroup.add(riderChest);

      // Great Helm
      const greatHelmGeo = new THREE.CylinderGeometry(0.3 * scale, 0.32 * scale, 0.5 * scale, 8);
      const greatHelm = new THREE.Mesh(greatHelmGeo, metalMat);
      greatHelm.position.y = 1.05 * scale;
      const helmVisorGeo = new THREE.BoxGeometry(0.2 * scale, 0.04 * scale, 0.08 * scale);
      const helmVisor = new THREE.Mesh(helmVisorGeo, runeMat);
      helmVisor.position.set(0, 0, 0.3 * scale);
      greatHelm.add(helmVisor);

      // Plume
      const plumeGeo = new THREE.BoxGeometry(0.06 * scale, 0.35 * scale, 0.4 * scale);
      const plume = new THREE.Mesh(plumeGeo, new THREE.MeshStandardMaterial({ color: this.team.color, roughness: 0.4 }));
      plume.position.y = 0.35 * scale;
      greatHelm.add(plume);

      this.bodyGroup.add(greatHelm);
      this.headMesh = greatHelm;

      // 3. Gungnir / Jousting Lance
      const lanceGroup = new THREE.Group();
      const lanceShaftGeo = new THREE.CylinderGeometry(0.05 * scale, 0.04 * scale, 3.5 * scale, 6);
      const lanceShaft = new THREE.Mesh(lanceShaftGeo, woodMat);

      // Lance tip
      const lanceTipGeo = new THREE.ConeGeometry(0.12 * scale, 0.6 * scale, 6);
      const lanceTip = new THREE.Mesh(lanceTipGeo, metalMat);
      lanceTip.position.y = 2.0 * scale;
      lanceShaft.add(lanceTip);

      // Runic glow on lance tip
      const lanceRuneGeo = new THREE.ConeGeometry(0.05 * scale, 0.5 * scale, 4);
      const lanceRune = new THREE.Mesh(lanceRuneGeo, runeMat);
      lanceTip.add(lanceRune);

      // Vamplate (hand guard)
      const vamplateGeo = new THREE.ConeGeometry(0.2 * scale, 0.15 * scale, 8);
      const vamplate = new THREE.Mesh(vamplateGeo, metalMat);
      vamplate.position.y = -0.3 * scale;
      vamplate.rotation.x = Math.PI;
      lanceShaft.add(vamplate);

      lanceGroup.add(lanceShaft);
      lanceGroup.rotation.x = Math.PI / 2;
      lanceGroup.position.set(0, -0.2 * scale, 1.4 * scale);
      this.rightArm.add(lanceGroup);
      this.weaponMesh = lanceGroup;

    } else if (type === 'giant') {
      // GOD OF WAR - Jörmungandr's Kin / Frost Giant Berserker
      const boneWhiteMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.7, metalness: 0.1 });
      const runeMat = new THREE.MeshStandardMaterial({
        color: this.team.color,
        emissive: this.team.color,
        emissiveIntensity: 0.8
      });
      const darkStoneMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.9, metalness: 0.2 });

      // 1. Bone & Hide Harness across Chest
      const harnessGeo = new THREE.BoxGeometry(0.8 * scale, 0.5 * scale, 0.5 * scale);
      const harness = new THREE.Mesh(harnessGeo, new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 }));
      harness.position.set(0, 0.55 * scale, 0);

      // Bone shoulder strap
      const strapGeo = new THREE.CylinderGeometry(0.06 * scale, 0.06 * scale, 1.0 * scale, 4);
      const lStrap = new THREE.Mesh(strapGeo, boneWhiteMat);
      lStrap.position.set(-0.3 * scale, 0.2 * scale, 0);
      lStrap.rotation.z = Math.PI / 4;
      const rStrap = lStrap.clone();
      rStrap.position.set(0.3 * scale, 0.2 * scale, 0);
      rStrap.rotation.z = -Math.PI / 4;
      harness.add(lStrap, rStrap);

      // Embedded rune stone
      const runeStoneGeo = new THREE.OctahedronGeometry(0.12 * scale);
      const runeStone = new THREE.Mesh(runeStoneGeo, runeMat);
      runeStone.position.set(0, 0.1 * scale, 0.26 * scale);
      harness.add(runeStone);

      this.bodyGroup.add(harness);

      // 2. Horned Skull Crown
      const skullGeo = new THREE.SphereGeometry(0.4 * scale, 8, 8);
      const skull = new THREE.Mesh(skullGeo, boneWhiteMat);
      skull.position.y = 1.15 * scale;

      // Massive Horns
      const hornGeo = new THREE.ConeGeometry(0.1 * scale, 0.8 * scale, 5);
      const lHorn = new THREE.Mesh(hornGeo, boneWhiteMat);
      lHorn.position.set(-0.35 * scale, 0.3 * scale, 0);
      lHorn.rotation.z = Math.PI / 3;
      const rHorn = lHorn.clone();
      rHorn.position.set(0.35 * scale, 0.3 * scale, 0);
      rHorn.rotation.z = -Math.PI / 3;
      skull.add(lHorn, rHorn);

      // Glowing eye sockets
      const eyeSocketGeo = new THREE.SphereGeometry(0.08 * scale, 6, 6);
      const lEye = new THREE.Mesh(eyeSocketGeo, runeMat);
      lEye.position.set(-0.12 * scale, 0.05 * scale, 0.32 * scale);
      const rEye = lEye.clone();
      rEye.position.set(0.12 * scale, 0.05 * scale, 0.32 * scale);
      skull.add(lEye, rEye);

      // Jaw
      const jawGeo = new THREE.BoxGeometry(0.3 * scale, 0.12 * scale, 0.2 * scale);
      const jaw = new THREE.Mesh(jawGeo, boneWhiteMat);
      jaw.position.set(0, -0.2 * scale, 0.2 * scale);
      skull.add(jaw);

      this.bodyGroup.add(skull);
      this.headMesh = skull;

      // 3. Stone-Bound Wrist Shackles (lore: freed prisoner)
      const shackleGeo = new THREE.TorusGeometry(0.18 * scale, 0.04 * scale, 4, 8);
      const lShackle = new THREE.Mesh(shackleGeo, darkStoneMat);
      lShackle.position.y = -0.45 * scale;
      lShackle.rotation.x = Math.PI / 2;
      this.leftArm.add(lShackle);

      const rShackle = lShackle.clone();
      this.rightArm.add(rShackle);

      // Broken chain links dangling
      for (let arm of [this.leftArm, this.rightArm]) {
        for (let i = 0; i < 3; i++) {
          const linkGeo = new THREE.TorusGeometry(0.04 * scale, 0.015 * scale, 4, 6);
          const link = new THREE.Mesh(linkGeo, metalMat);
          link.position.set(
            (Math.random() - 0.5) * 0.1 * scale,
            -0.55 * scale - i * 0.08 * scale,
            0
          );
          link.rotation.set(Math.random(), Math.random(), 0);
          arm.add(link);
        }
      }

      // 4. Massive World Serpent Bone Club
      const clubGroup = new THREE.Group();
      const clubShaftGeo = new THREE.CylinderGeometry(0.12 * scale, 0.08 * scale, 2.0 * scale, 6);
      const clubShaft = new THREE.Mesh(clubShaftGeo, woodMat);

      // Club head - massive jagged stone
      const clubHeadGeo = new THREE.DodecahedronGeometry(0.45 * scale);
      const clubHead = new THREE.Mesh(clubHeadGeo, darkStoneMat);
      clubHead.position.y = 1.2 * scale;
      clubShaft.add(clubHead);

      // Embedded bone spikes
      for (let i = 0; i < 8; i++) {
        const spikeGeo = new THREE.ConeGeometry(0.06 * scale, 0.35 * scale, 4);
        const spike = new THREE.Mesh(spikeGeo, boneWhiteMat);
        const ang = (i / 8) * Math.PI * 2;
        spike.position.set(
          Math.cos(ang) * 0.35 * scale,
          1.2 * scale + (Math.random() - 0.5) * 0.3 * scale,
          Math.sin(ang) * 0.35 * scale
        );
        spike.lookAt(new THREE.Vector3(
          Math.cos(ang) * 2,
          1.2 * scale,
          Math.sin(ang) * 2
        ));
        clubShaft.add(spike);
      }

      // Runic glow veins on the club
      const veinGeo = new THREE.CylinderGeometry(0.02 * scale, 0.02 * scale, 0.8 * scale, 4);
      const vein1 = new THREE.Mesh(veinGeo, runeMat);
      vein1.position.set(0.1 * scale, 0.8 * scale, 0);
      const vein2 = vein1.clone();
      vein2.position.set(-0.1 * scale, 0.9 * scale, 0.05 * scale);
      vein2.rotation.z = 0.3;
      clubShaft.add(vein1, vein2);

      clubGroup.add(clubShaft);
      clubGroup.position.set(0, -0.6 * scale, 0.8 * scale);
      clubGroup.rotation.x = Math.PI / 2.5;

      this.rightArm.add(clubGroup);
      this.weaponMesh = clubGroup;

      // 5. Trophy Skulls hanging from belt
      for (let i = 0; i < 3; i++) {
        const trophyGeo = new THREE.SphereGeometry(0.09 * scale, 6, 6);
        const trophy = new THREE.Mesh(trophyGeo, boneWhiteMat);
        trophy.position.set(
          (i - 1) * 0.25 * scale,
          -0.2 * scale,
          0.3 * scale
        );
        this.bodyGroup.add(trophy);
      }

    } else if (type === 'catapult') {
      // GOD OF WAR - Dwarven Siege Onager Engine
      const brassMetalMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, metalness: 0.8, roughness: 0.3 });
      const runeMat = new THREE.MeshStandardMaterial({
        color: this.team.color,
        emissive: this.team.color,
        emissiveIntensity: 0.7
      });
      const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x3e1c00, roughness: 0.85 });

      // 1. Heavy Timber Frame with Metal Reinforcements
      const frameGeo = new THREE.BoxGeometry(2.0 * scale, 0.7 * scale, 2.6 * scale);
      const frame = new THREE.Mesh(frameGeo, darkWoodMat);
      frame.position.set(0, -0.35 * scale, 0);
      frame.castShadow = true;

      // Metal corner reinforcements
      const cornerGeo = new THREE.BoxGeometry(0.15 * scale, 0.75 * scale, 0.15 * scale);
      const corners = [
        [-0.95, 0, 1.25], [0.95, 0, 1.25],
        [-0.95, 0, -1.25], [0.95, 0, -1.25]
      ];
      corners.forEach(([cx, cy, cz]) => {
        const corner = new THREE.Mesh(cornerGeo, metalMat);
        corner.position.set(cx * scale, cy * scale, cz * scale);
        frame.add(corner);
      });

      // Metal banding straps across frame
      for (let i = 0; i < 3; i++) {
        const bandGeo = new THREE.BoxGeometry(2.05 * scale, 0.05 * scale, 0.12 * scale);
        const bandMesh = new THREE.Mesh(bandGeo, brassMetalMat);
        bandMesh.position.set(0, 0.1 * scale, (i - 1) * 0.9 * scale);
        frame.add(bandMesh);
      }

      // 2. Iron-Bound Wheels with Spokes
      const wheelGeo = new THREE.CylinderGeometry(0.45 * scale, 0.45 * scale, 0.18 * scale, 10);
      const wheelPositions = [
        [-1.1, -0.35, 0.9], [1.1, -0.35, 0.9],
        [-1.1, -0.35, -0.9], [1.1, -0.35, -0.9]
      ];
      wheelPositions.forEach(([wx, wy, wz]) => {
        const wheel = new THREE.Mesh(wheelGeo, darkWoodMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx * scale, wy * scale, wz * scale);

        // Iron tire rim
        const tireGeo = new THREE.TorusGeometry(0.45 * scale, 0.03 * scale, 4, 12);
        const tire = new THREE.Mesh(tireGeo, metalMat);
        tire.rotation.y = Math.PI / 2;
        wheel.add(tire);

        // Spokes
        for (let s = 0; s < 5; s++) {
          const spokeGeo = new THREE.CylinderGeometry(0.02 * scale, 0.02 * scale, 0.85 * scale, 4);
          const spoke = new THREE.Mesh(spokeGeo, darkWoodMat);
          spoke.rotation.z = (s / 5) * Math.PI;
          wheel.add(spoke);
        }

        // Hub cap
        const hubGeo = new THREE.CylinderGeometry(0.08 * scale, 0.08 * scale, 0.22 * scale, 6);
        const hub = new THREE.Mesh(hubGeo, brassMetalMat);
        wheel.add(hub);

        frame.add(wheel);
      });

      // 3. Throwing Arm Assembly
      const armBaseGeo = new THREE.BoxGeometry(0.3 * scale, 1.2 * scale, 0.2 * scale);
      const armBase = new THREE.Mesh(armBaseGeo, darkWoodMat);
      armBase.position.set(0, 0.9 * scale, 0);

      // Throwing arm
      const throwArmGeo = new THREE.CylinderGeometry(0.08 * scale, 0.06 * scale, 2.8 * scale, 6);
      const throwArm = new THREE.Mesh(throwArmGeo, darkWoodMat);
      throwArm.position.y = 0.6 * scale;
      throwArm.rotation.z = Math.PI / 6;
      armBase.add(throwArm);

      // Sling basket
      const basketGeo = new THREE.SphereGeometry(0.25 * scale, 6, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      const basket = new THREE.Mesh(basketGeo, new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.9 }));
      basket.position.y = 1.5 * scale;
      basket.rotation.x = Math.PI;
      throwArm.add(basket);

      // Boulder projectile sitting in basket
      const boulderGeo = new THREE.DodecahedronGeometry(0.2 * scale);
      const boulder = new THREE.Mesh(boulderGeo, new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.9 }));
      boulder.position.y = 1.35 * scale;
      throwArm.add(boulder);

      frame.add(armBase);

      // 4. Dwarven Rune Plates on the sides
      const runePlateGeo = new THREE.BoxGeometry(0.3 * scale, 0.3 * scale, 0.05 * scale);
      const lRunePlate = new THREE.Mesh(runePlateGeo, runeMat);
      lRunePlate.position.set(-1.02 * scale, 0.15 * scale, 0);
      const rRunePlate = lRunePlate.clone();
      rRunePlate.position.set(1.02 * scale, 0.15 * scale, 0);
      frame.add(lRunePlate, rRunePlate);

      // 5. Team-colored banner
      const bannerGeo = new THREE.PlaneGeometry(0.4 * scale, 0.6 * scale);
      const bannerMat = new THREE.MeshStandardMaterial({ color: this.team.color, side: THREE.DoubleSide });
      const banner = new THREE.Mesh(bannerGeo, bannerMat);
      banner.position.set(0, 1.8 * scale, 0);
      const bannerPoleGeo = new THREE.CylinderGeometry(0.02 * scale, 0.02 * scale, 0.8 * scale, 4);
      const bannerPole = new THREE.Mesh(bannerPoleGeo, metalMat);
      bannerPole.position.y = -0.1 * scale;
      banner.add(bannerPole);
      frame.add(banner);

      this.bodyGroup.add(frame);

    // ═══ 9. BERSERKER: Dual Bearded Battleaxes & Horned Viking Raider ═══
    } else if (type === 'berserker') {
      const runeMat = new THREE.MeshStandardMaterial({
        color: this.team.color,
        emissive: this.team.color,
        emissiveIntensity: 0.9
      });
      const furMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.95 });

      // Horned Viking Helmet
      const helmGeo = new THREE.SphereGeometry(0.35 * scale, 8, 8);
      const helm = new THREE.Mesh(helmGeo, metalMat);
      helm.position.y = 1.12 * scale;

      const hornGeo = new THREE.ConeGeometry(0.08 * scale, 0.45 * scale, 5);
      const lHorn = new THREE.Mesh(hornGeo, new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.7 }));
      lHorn.position.set(-0.3 * scale, 0.25 * scale, 0);
      lHorn.rotation.z = Math.PI / 3;
      const rHorn = lHorn.clone();
      rHorn.position.set(0.3 * scale, 0.25 * scale, 0);
      rHorn.rotation.z = -Math.PI / 3;
      helm.add(lHorn, rHorn);

      // Glowing Visor Eyes
      const eyeGeo = new THREE.BoxGeometry(0.24 * scale, 0.05 * scale, 0.08 * scale);
      const eyes = new THREE.Mesh(eyeGeo, runeMat);
      eyes.position.set(0, 0.02 * scale, 0.32 * scale);
      helm.add(eyes);

      this.bodyGroup.add(helm);
      this.headMesh = helm;

      // Fur Shoulder Wrap
      const furMantleGeo = new THREE.TorusGeometry(0.38 * scale, 0.12 * scale, 6, 12);
      const furMantle = new THREE.Mesh(furMantleGeo, furMat);
      furMantle.rotation.x = Math.PI / 2;
      furMantle.position.y = 0.72 * scale;
      this.bodyGroup.add(furMantle);

      // Function to create a Norse Bearded Battleaxe
      const createAxe = () => {
        const axeGroup = new THREE.Group();
        const haftGeo = new THREE.CylinderGeometry(0.035 * scale, 0.03 * scale, 1.2 * scale, 6);
        const haft = new THREE.Mesh(haftGeo, woodMat);

        const headGeo = new THREE.BoxGeometry(0.04 * scale, 0.45 * scale, 0.35 * scale);
        const head = new THREE.Mesh(headGeo, metalMat);
        head.position.set(0, 0.45 * scale, 0.15 * scale);

        const edgeGeo = new THREE.BoxGeometry(0.02 * scale, 0.48 * scale, 0.04 * scale);
        const edge = new THREE.Mesh(edgeGeo, runeMat);
        edge.position.set(0, 0.45 * scale, 0.32 * scale);

        axeGroup.add(haft, head, edge);
        return axeGroup;
      };

      // Right Hand Axe
      const rAxe = createAxe();
      rAxe.position.set(0, -0.4 * scale, 0.35 * scale);
      rAxe.rotation.x = Math.PI / 3;
      this.rightArm.add(rAxe);
      this.weaponMesh = rAxe;

      // Left Hand Axe (Dual Wield!)
      const lAxe = createAxe();
      lAxe.position.set(0, -0.4 * scale, 0.35 * scale);
      lAxe.rotation.x = Math.PI / 3;
      this.leftArm.add(lAxe);

    // ═══ 10. SAMURAI: Iaido Katana & Kabuto Crescent Armor ═══
    } else if (type === 'samurai') {
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.2 });
      const runeMat = new THREE.MeshStandardMaterial({
        color: this.team.color,
        emissive: this.team.color,
        emissiveIntensity: 0.95
      });
      const lacquerMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.3 });

      // 1. Samurai Kabuto Helmet
      const kabutoGeo = new THREE.SphereGeometry(0.34 * scale, 8, 8);
      const kabuto = new THREE.Mesh(kabutoGeo, lacquerMat);
      kabuto.position.y = 1.1 * scale;

      // Golden Maedate (Crescent Horn Crest)
      const crestGeo = new THREE.TorusGeometry(0.35 * scale, 0.03 * scale, 4, 12, Math.PI);
      const crest = new THREE.Mesh(crestGeo, goldMat);
      crest.position.set(0, 0.25 * scale, 0.28 * scale);
      crest.rotation.z = Math.PI;
      kabuto.add(crest);

      // Glowing Menpo Visor
      const visorGeo = new THREE.BoxGeometry(0.24 * scale, 0.05 * scale, 0.08 * scale);
      const visor = new THREE.Mesh(visorGeo, runeMat);
      visor.position.set(0, 0, 0.32 * scale);
      kabuto.add(visor);

      this.bodyGroup.add(kabuto);
      this.headMesh = kabuto;

      // 2. Layered Sode Shoulder Plates
      const sodeGeo = new THREE.BoxGeometry(0.08 * scale, 0.45 * scale, 0.35 * scale);
      const lSode = new THREE.Mesh(sodeGeo, lacquerMat);
      lSode.position.set(-0.12 * scale, 0.05 * scale, 0);
      this.leftArm.add(lSode);

      const rSode = lSode.clone();
      rSode.position.set(0.12 * scale, 0.05 * scale, 0);
      this.rightArm.add(rSode);

      // 3. Iaido Katana (Slender Curved Blade & Tsuba)
      const katanaGroup = new THREE.Group();
      const gripGeo = new THREE.CylinderGeometry(0.03 * scale, 0.03 * scale, 0.4 * scale, 6);
      const grip = new THREE.Mesh(gripGeo, lacquerMat);

      const tsubaGeo = new THREE.CylinderGeometry(0.12 * scale, 0.12 * scale, 0.02 * scale, 8);
      const tsuba = new THREE.Mesh(tsubaGeo, goldMat);
      tsuba.position.y = 0.2 * scale;
      katanaGroup.add(grip, tsuba);

      const bladeGeo = new THREE.BoxGeometry(0.03 * scale, 1.4 * scale, 0.08 * scale);
      const blade = new THREE.Mesh(bladeGeo, metalMat);
      blade.position.set(0, 0.9 * scale, 0.03 * scale);

      const hamonGeo = new THREE.BoxGeometry(0.01 * scale, 1.35 * scale, 0.02 * scale);
      const hamon = new THREE.Mesh(hamonGeo, runeMat);
      hamon.position.set(0, 0.9 * scale, 0.07 * scale);
      katanaGroup.add(blade, hamon);

      katanaGroup.position.set(0, -0.4 * scale, 0.4 * scale);
      katanaGroup.rotation.x = Math.PI / 3;
      this.rightArm.add(katanaGroup);
      this.weaponMesh = katanaGroup;

    // ═══ 11. GLADIATOR: Retiarius Trident & Murmillo Armor ═══
    } else if (type === 'gladiator') {
      const bronzeMat = new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.85, roughness: 0.25 });
      const runeMat = new THREE.MeshStandardMaterial({
        color: this.team.color,
        emissive: this.team.color,
        emissiveIntensity: 0.9
      });

      // Murmillo Helmet with Grille
      const helmGeo = new THREE.CylinderGeometry(0.33 * scale, 0.36 * scale, 0.5 * scale, 8);
      const helm = new THREE.Mesh(helmGeo, bronzeMat);
      helm.position.y = 1.08 * scale;

      const grilleGeo = new THREE.BoxGeometry(0.26 * scale, 0.2 * scale, 0.08 * scale);
      const grille = new THREE.Mesh(grilleGeo, new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 }));
      grille.position.set(0, -0.05 * scale, 0.32 * scale);
      helm.add(grille);

      const eyeGlowGeo = new THREE.BoxGeometry(0.2 * scale, 0.04 * scale, 0.04 * scale);
      const eyeGlow = new THREE.Mesh(eyeGlowGeo, runeMat);
      eyeGlow.position.set(0, 0.02 * scale, 0.34 * scale);
      helm.add(eyeGlow);

      this.bodyGroup.add(helm);
      this.headMesh = helm;

      // Three-Pronged Steel Trident
      const tridentGroup = new THREE.Group();
      const shaftGeo = new THREE.CylinderGeometry(0.04 * scale, 0.04 * scale, 2.6 * scale, 6);
      const shaft = new THREE.Mesh(shaftGeo, woodMat);
      tridentGroup.add(shaft);

      // Crossbar
      const crossbarGeo = new THREE.BoxGeometry(0.42 * scale, 0.06 * scale, 0.06 * scale);
      const crossbar = new THREE.Mesh(crossbarGeo, bronzeMat);
      crossbar.position.y = 1.2 * scale;
      shaft.add(crossbar);

      // 3 Prongs
      for (let p = -1; p <= 1; p++) {
        const prongGeo = new THREE.ConeGeometry(0.04 * scale, 0.6 * scale, 4);
        const prong = new THREE.Mesh(prongGeo, metalMat);
        prong.position.set(p * 0.16 * scale, 1.5 * scale, 0);
        shaft.add(prong);
      }

      tridentGroup.position.set(0, -0.4 * scale, 0.8 * scale);
      tridentGroup.rotation.x = Math.PI / 2.3;
      this.rightArm.add(tridentGroup);
      this.weaponMesh = tridentGroup;

    // ═══ 12. ASSASSIN: Shadow Shinobi with Dual Poison Daggers ═══
    } else if (type === 'assassin') {
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.9 });
      const poisonMat = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x059669,
        emissiveIntensity: 1.1
      });

      // Shadow Cowl Hood
      const hoodGeo = new THREE.ConeGeometry(0.35 * scale, 0.5 * scale, 6);
      const hood = new THREE.Mesh(hoodGeo, darkMat);
      hood.position.y = 1.15 * scale;

      const eyeSlitGeo = new THREE.BoxGeometry(0.24 * scale, 0.04 * scale, 0.08 * scale);
      const eyeSlit = new THREE.Mesh(eyeSlitGeo, poisonMat);
      eyeSlit.position.set(0, -0.15 * scale, 0.28 * scale);
      hood.add(eyeSlit);

      this.bodyGroup.add(hood);
      this.headMesh = hood;

      // Function to create curved poison dagger
      const createDagger = () => {
        const daggerGroup = new THREE.Group();
        const dGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * scale, 0.03 * scale, 0.25 * scale, 6), darkMat);
        const dBlade = new THREE.Mesh(new THREE.BoxGeometry(0.03 * scale, 0.7 * scale, 0.08 * scale), metalMat);
        dBlade.position.y = 0.45 * scale;

        const dPoison = new THREE.Mesh(new THREE.BoxGeometry(0.01 * scale, 0.65 * scale, 0.02 * scale), poisonMat);
        dPoison.position.set(0, 0.45 * scale, 0.04 * scale);

        daggerGroup.add(dGrip, dBlade, dPoison);
        daggerGroup.position.set(0, -0.4 * scale, 0.25 * scale);
        daggerGroup.rotation.x = Math.PI / 2.5;
        return daggerGroup;
      };

      const rDagger = createDagger();
      this.rightArm.add(rDagger);
      this.weaponMesh = rDagger;

      const lDagger = createDagger();
      this.leftArm.add(lDagger);

    // ═══ 13. MONK: Shaolin Chi Master with Glowing Fists ═══
    } else if (type === 'monk') {
      const chiMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xeab308,
        emissiveIntensity: 1.4,
        transparent: true,
        opacity: 0.85
      });
      const robeMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 });

      // Shaolin Headband
      const headbandGeo = new THREE.TorusGeometry(0.29 * scale, 0.03 * scale, 4, 12);
      const headband = new THREE.Mesh(headbandGeo, robeMat);
      headband.position.y = 1.15 * scale;
      headband.rotation.x = Math.PI / 2;
      this.bodyGroup.add(headband);

      // Large Prayer Beads Necklace
      for (let b = 0; b < 10; b++) {
        const beadGeo = new THREE.SphereGeometry(0.05 * scale, 6, 6);
        const bead = new THREE.Mesh(beadGeo, woodMat);
        const angle = (b / 10) * Math.PI * 2;
        bead.position.set(Math.cos(angle) * 0.28 * scale, 0.75 * scale, Math.sin(angle) * 0.28 * scale);
        this.bodyGroup.add(bead);
      }

      // Glowing Chi Fists (Left & Right)
      const lChiFist = new THREE.Mesh(new THREE.SphereGeometry(0.18 * scale, 8, 8), chiMat);
      lChiFist.position.y = -0.6 * scale;
      this.leftArm.add(lChiFist);

      const rChiFist = new THREE.Mesh(new THREE.SphereGeometry(0.18 * scale, 8, 8), chiMat);
      rChiFist.position.y = -0.6 * scale;
      this.rightArm.add(rChiFist);
      this.weaponMesh = rChiFist;

    // ═══ 14. DUELIST: Master Fencer with Elegant Rapier ═══
    } else if (type === 'duelist') {
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.2 });
      const feltMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.85 });

      // Cavalier Hat with Feather
      const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.48 * scale, 0.48 * scale, 0.04 * scale, 12), feltMat);
      hatBrim.position.y = 1.25 * scale;
      const hatCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * scale, 0.3 * scale, 0.25 * scale, 8), feltMat);
      hatCrown.position.y = 1.35 * scale;

      const featherGeo = new THREE.ConeGeometry(0.06 * scale, 0.6 * scale, 4);
      const feather = new THREE.Mesh(featherGeo, new THREE.MeshStandardMaterial({ color: this.team.color }));
      feather.position.set(-0.25 * scale, 1.45 * scale, 0);
      feather.rotation.z = Math.PI / 4;

      this.bodyGroup.add(hatBrim, hatCrown, feather);

      // Slender Needle Rapier with Cup Hilt
      const rapierGroup = new THREE.Group();
      const rapierBlade = new THREE.Mesh(new THREE.CylinderGeometry(0.015 * scale, 0.02 * scale, 1.6 * scale, 5), metalMat);
      rapierBlade.position.y = 0.9 * scale;

      const cupHilt = new THREE.Mesh(new THREE.SphereGeometry(0.14 * scale, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), goldMat);
      cupHilt.rotation.x = Math.PI;
      cupHilt.position.y = 0.15 * scale;

      rapierGroup.add(rapierBlade, cupHilt);
      rapierGroup.position.set(0, -0.4 * scale, 0.5 * scale);
      rapierGroup.rotation.x = Math.PI / 2.2;
      this.rightArm.add(rapierGroup);
      this.weaponMesh = rapierGroup;

    // ═══ 15. NINJA: Shinobi Skirmisher with Shurikens & Ninjato ═══
    } else if (type === 'ninja') {
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.85 });
      const runeMat = new THREE.MeshStandardMaterial({
        color: this.team.color,
        emissive: this.team.color,
        emissiveIntensity: 0.9
      });

      // Shinobi Mask with Forehead Protector
      const maskGeo = new THREE.SphereGeometry(0.3 * scale, 8, 8);
      const mask = new THREE.Mesh(maskGeo, darkMat);
      mask.position.y = 1.1 * scale;

      const plateGeo = new THREE.BoxGeometry(0.24 * scale, 0.08 * scale, 0.04 * scale);
      const plate = new THREE.Mesh(plateGeo, metalMat);
      plate.position.set(0, 0.1 * scale, 0.28 * scale);
      mask.add(plate);

      const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.2 * scale, 0.04 * scale, 0.04 * scale), runeMat);
      eyes.position.set(0, 0, 0.3 * scale);
      mask.add(eyes);

      this.bodyGroup.add(mask);
      this.headMesh = mask;

      // Ninjato sheathed on back
      const ninjato = new THREE.Mesh(new THREE.BoxGeometry(0.04 * scale, 1.2 * scale, 0.06 * scale), metalMat);
      ninjato.position.set(-0.15 * scale, 0.6 * scale, -0.25 * scale);
      ninjato.rotation.z = Math.PI / 4;
      this.bodyGroup.add(ninjato);

      // Shuriken in hand ready to throw
      const shuriken = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.12 * scale, 0.02 * scale, 4), metalMat);
      shuriken.position.set(0, -0.5 * scale, 0.2 * scale);
      this.rightArm.add(shuriken);
      this.weaponMesh = shuriken;

    // ═══ 16. PALADIN: Divine Crusader with Colossal Holy Warhammer ═══
    } else if (type === 'paladin') {
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.2 });
      const holyGlowMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfacc15,
        emissiveIntensity: 1.2
      });

      // Winged Knight Helm
      const helmGeo = new THREE.CylinderGeometry(0.34 * scale, 0.36 * scale, 0.52 * scale, 8);
      const helm = new THREE.Mesh(helmGeo, metalMat);
      helm.position.y = 1.1 * scale;

      const crownTrim = new THREE.Mesh(new THREE.TorusGeometry(0.35 * scale, 0.03 * scale, 4, 12), goldMat);
      crownTrim.position.y = 0.2 * scale;
      crownTrim.rotation.x = Math.PI / 2;
      helm.add(crownTrim);

      const holyVisor = new THREE.Mesh(new THREE.BoxGeometry(0.24 * scale, 0.06 * scale, 0.06 * scale), holyGlowMat);
      holyVisor.position.set(0, 0.02 * scale, 0.33 * scale);
      helm.add(holyVisor);

      this.bodyGroup.add(helm);
      this.headMesh = helm;

      // Heavy Pauldrons
      const lPauldron = new THREE.Mesh(new THREE.SphereGeometry(0.26 * scale, 6, 6, 0, Math.PI * 2, 0, Math.PI / 2), goldMat);
      lPauldron.position.set(-0.05 * scale, 0.05 * scale, 0);
      this.leftArm.add(lPauldron);
      const rPauldron = lPauldron.clone();
      rPauldron.position.set(0.05 * scale, 0.05 * scale, 0);
      this.rightArm.add(rPauldron);

      // Colossal Divine Warhammer
      const hammerGroup = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * scale, 0.045 * scale, 2.0 * scale, 6), metalMat);
      hammerGroup.add(shaft);

      const hammerHead = new THREE.Mesh(new THREE.BoxGeometry(0.35 * scale, 0.45 * scale, 0.65 * scale), metalMat);
      hammerHead.position.y = 0.9 * scale;

      const crossTrim = new THREE.Mesh(new THREE.BoxGeometry(0.37 * scale, 0.25 * scale, 0.25 * scale), holyGlowMat);
      crossTrim.position.y = 0.9 * scale;
      hammerGroup.add(hammerHead, crossTrim);

      hammerGroup.position.set(0, -0.4 * scale, 0.5 * scale);
      hammerGroup.rotation.x = Math.PI / 3;
      this.rightArm.add(hammerGroup);
      this.weaponMesh = hammerGroup;

    // ═══ 17. NECROMANCER: Soul Reaper with Death Scythe ═══
    } else if (type === 'necromancer') {
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.95 });
      const soulGlowMat = new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0x9333ea,
        emissiveIntensity: 1.2
      });

      // Grim Reaper Cowl & Skull
      const hood = new THREE.Mesh(new THREE.ConeGeometry(0.38 * scale, 0.6 * scale, 6), darkMat);
      hood.position.y = 1.15 * scale;

      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.24 * scale, 6, 6), new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }));
      skull.position.set(0, -0.1 * scale, 0.15 * scale);
      hood.add(skull);

      const soulEyes = new THREE.Mesh(new THREE.BoxGeometry(0.2 * scale, 0.05 * scale, 0.05 * scale), soulGlowMat);
      soulEyes.position.set(0, -0.05 * scale, 0.32 * scale);
      hood.add(soulEyes);

      this.bodyGroup.add(hood);
      this.headMesh = hood;

      // Curved Death Scythe
      const scytheGroup = new THREE.Group();
      const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * scale, 0.04 * scale, 2.8 * scale, 6), darkMat);
      scytheGroup.add(staff);

      const scytheBlade = new THREE.Mesh(new THREE.BoxGeometry(0.04 * scale, 0.18 * scale, 1.2 * scale), metalMat);
      scytheBlade.position.set(0, 1.35 * scale, 0.55 * scale);
      scytheBlade.rotation.x = -Math.PI / 6;

      const scytheRune = new THREE.Mesh(new THREE.BoxGeometry(0.02 * scale, 0.06 * scale, 1.1 * scale), soulGlowMat);
      scytheRune.position.set(0, 1.35 * scale, 0.55 * scale);
      scytheRune.rotation.x = -Math.PI / 6;
      scytheGroup.add(scytheBlade, scytheRune);

      scytheGroup.position.set(0, -0.4 * scale, 0.6 * scale);
      scytheGroup.rotation.x = Math.PI / 3;
      this.rightArm.add(scytheGroup);
      this.weaponMesh = scytheGroup;

    // ═══ 18. PYROMANCER: Flame Adept with Volcanic Gauntlets ═══
    } else if (type === 'pyromancer') {
      const magmaMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xf97316,
        emissiveIntensity: 1.5
      });
      const robeMat = new THREE.MeshStandardMaterial({ color: 0x450a0a, roughness: 0.8 });

      // Blazing Magma Crown
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.32 * scale, 0.35 * scale, 0.2 * scale, 6), magmaMat);
      crown.position.y = 1.15 * scale;
      this.bodyGroup.add(crown);
      this.headMesh = crown;

      // Volcanic Robe
      const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.38 * scale, 0.5 * scale, 1.1 * scale, 8), robeMat);
      robe.position.y = 0.25 * scale;
      this.bodyGroup.add(robe);

      // Blazing Flame Gauntlets on both hands
      const lGauntlet = new THREE.Mesh(new THREE.SphereGeometry(0.18 * scale, 8, 8), magmaMat);
      lGauntlet.position.y = -0.55 * scale;
      this.leftArm.add(lGauntlet);

      const rGauntlet = new THREE.Mesh(new THREE.SphereGeometry(0.18 * scale, 8, 8), magmaMat);
      rGauntlet.position.y = -0.55 * scale;
      this.rightArm.add(rGauntlet);
      this.weaponMesh = rGauntlet;

    // ═══ 19. FROST WITCH: Glacial Sorceress with Icicle Staff ═══
    } else if (type === 'frost_witch') {
      const iceMat = new THREE.MeshStandardMaterial({
        color: 0xbae6fd,
        emissive: 0x38bdf8,
        emissiveIntensity: 1.1,
        roughness: 0.1,
        metalness: 0.3
      });
      const witchRobeMat = new THREE.MeshStandardMaterial({ color: 0x0c4a6e, roughness: 0.7 });

      // Witch Hat
      const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.55 * scale, 0.55 * scale, 0.04 * scale, 12), witchRobeMat);
      hatBrim.position.y = 1.25 * scale;
      const hatCone = new THREE.Mesh(new THREE.ConeGeometry(0.3 * scale, 0.7 * scale, 8), witchRobeMat);
      hatCone.position.y = 1.6 * scale;
      this.bodyGroup.add(hatBrim, hatCone);
      this.headMesh = hatCone;

      // Crystalline Icicle Staff
      const staffGroup = new THREE.Group();
      const staffPole = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * scale, 0.04 * scale, 2.2 * scale, 6), metalMat);
      staffGroup.add(staffPole);

      const iceCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.22 * scale), iceMat);
      iceCrystal.position.y = 1.25 * scale;
      staffGroup.add(iceCrystal);

      staffGroup.position.set(0, -0.3 * scale, 0.4 * scale);
      staffGroup.rotation.x = Math.PI / 3;
      this.rightArm.add(staffGroup);
      this.weaponMesh = staffGroup;

    // ═══ 20. DRAGON KNIGHT: Dragon-Scale Zweihänder Juggernaut ═══
    } else if (type === 'dragon_knight') {
      const scaleMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.6, metalness: 0.7 });
      const flameMat = new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xef4444,
        emissiveIntensity: 1.3
      });

      // Dragon-Horned Helm
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.36 * scale, 8, 8), scaleMat);
      helm.position.y = 1.12 * scale;

      const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.08 * scale, 0.55 * scale, 4), scaleMat);
      hornL.position.set(-0.35 * scale, 0.25 * scale, -0.1 * scale);
      hornL.rotation.z = Math.PI / 3;
      hornL.rotation.x = -Math.PI / 6;
      const hornR = hornL.clone();
      hornR.position.set(0.35 * scale, 0.25 * scale, -0.1 * scale);
      hornR.rotation.z = -Math.PI / 3;
      helm.add(hornL, hornR);

      // Slit Reptilian Eyes
      const eyeSlits = new THREE.Mesh(new THREE.BoxGeometry(0.24 * scale, 0.04 * scale, 0.08 * scale), flameMat);
      eyeSlits.position.set(0, 0, 0.34 * scale);
      helm.add(eyeSlits);

      this.bodyGroup.add(helm);
      this.headMesh = helm;

      // Flaming Zweihänder Greatsword
      const swordGroup = new THREE.Group();
      const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * scale, 0.04 * scale, 0.6 * scale, 6), scaleMat);
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.65 * scale, 0.08 * scale, 0.12 * scale), scaleMat);
      guard.position.y = 0.3 * scale;
      swordGroup.add(hilt, guard);

      const greatBlade = new THREE.Mesh(new THREE.BoxGeometry(0.18 * scale, 2.0 * scale, 0.04 * scale), metalMat);
      greatBlade.position.y = 1.3 * scale;

      const flameVein = new THREE.Mesh(new THREE.BoxGeometry(0.05 * scale, 1.8 * scale, 0.05 * scale), flameMat);
      flameVein.position.y = 1.3 * scale;
      swordGroup.add(greatBlade, flameVein);

      swordGroup.position.set(0, -0.4 * scale, 0.5 * scale);
      swordGroup.rotation.x = Math.PI / 3;
      this.rightArm.add(swordGroup);
      this.weaponMesh = swordGroup;

    // ═══ 21. RUNIC GOLEM: Ancient Carved Stone Titan Automaton ═══
    } else if (type === 'golem') {
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9, flatShading: true });
      const runeCoreMat = new THREE.MeshStandardMaterial({
        color: this.team.color,
        emissive: this.team.color,
        emissiveIntensity: 1.5
      });

      // Heavy Carved Stone Block Torso Armor
      const stoneChest = new THREE.Mesh(new THREE.BoxGeometry(0.9 * scale, 1.1 * scale, 0.6 * scale), stoneMat);
      stoneChest.position.y = 0.5 * scale;

      // Glowing Runic Heart / Core in Center
      const runeCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.22 * scale), runeCoreMat);
      runeCore.position.set(0, 0.1 * scale, 0.32 * scale);
      stoneChest.add(runeCore);
      this.bodyGroup.add(stoneChest);

      // Heavy Stone Head
      const stoneHead = new THREE.Mesh(new THREE.BoxGeometry(0.55 * scale, 0.5 * scale, 0.5 * scale), stoneMat);
      stoneHead.position.y = 1.25 * scale;

      const golemEyes = new THREE.Mesh(new THREE.BoxGeometry(0.3 * scale, 0.08 * scale, 0.1 * scale), runeCoreMat);
      golemEyes.position.set(0, 0.05 * scale, 0.25 * scale);
      stoneHead.add(golemEyes);

      this.bodyGroup.add(stoneHead);
      this.headMesh = stoneHead;

      // Heavy Stone Fists
      const lFist = new THREE.Mesh(new THREE.BoxGeometry(0.35 * scale, 0.45 * scale, 0.35 * scale), stoneMat);
      lFist.position.y = -0.6 * scale;
      this.leftArm.add(lFist);

      const rFist = new THREE.Mesh(new THREE.BoxGeometry(0.35 * scale, 0.45 * scale, 0.35 * scale), stoneMat);
      rFist.position.y = -0.6 * scale;
      this.rightArm.add(rFist);
      this.weaponMesh = rFist;
    } else if (type === 'battering_ram') {
      // ══════════════════════════════════════════════════
      // BATTERING RAM: Heavy Timber Shed & Iron Ram Head
      // ══════════════════════════════════════════════════
      const shedMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
      const ironRoofMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3 });

      const shedGroup = new THREE.Group();
      shedGroup.position.set(0, 0.4 * scale, 0);

      // Wooden A-Frame Roof
      const roofLeftGeo = new THREE.BoxGeometry(0.12 * scale, 1.3 * scale, 2.4 * scale);
      const roofLeft = new THREE.Mesh(roofLeftGeo, ironRoofMat);
      roofLeft.position.set(-0.6 * scale, 0.8 * scale, 0);
      roofLeft.rotation.z = Math.PI / 6;
      roofLeft.castShadow = true;

      const roofRight = new THREE.Mesh(roofLeftGeo, ironRoofMat);
      roofRight.position.set(0.6 * scale, 0.8 * scale, 0);
      roofRight.rotation.z = -Math.PI / 6;
      roofRight.castShadow = true;
      shedGroup.add(roofLeft, roofRight);

      // 4 Heavy Spiked Wheels
      const wheelGeo = new THREE.CylinderGeometry(0.35 * scale, 0.35 * scale, 0.18 * scale, 8);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x27170a, roughness: 0.85 });
      const wheelPositions = [
        [-0.85 * scale, -0.2 * scale, 0.8 * scale],
        [0.85 * scale, -0.2 * scale, 0.8 * scale],
        [-0.85 * scale, -0.2 * scale, -0.8 * scale],
        [0.85 * scale, -0.2 * scale, -0.8 * scale]
      ];
      wheelPositions.forEach(wp => {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.position.set(wp[0], wp[1], wp[2]);
        w.rotation.z = Math.PI / 2;
        w.castShadow = true;
        shedGroup.add(w);
      });

      // Suspended Tree-Trunk Ram with Iron Cast Horned Head
      const ramTrunkGeo = new THREE.CylinderGeometry(0.24 * scale, 0.28 * scale, 2.8 * scale, 8);
      const ramTrunk = new THREE.Mesh(ramTrunkGeo, shedMat);
      ramTrunk.rotation.x = Math.PI / 2;
      ramTrunk.position.set(0, 0.45 * scale, 0.3 * scale);
      ramTrunk.castShadow = true;

      const ramHeadGeo = new THREE.ConeGeometry(0.38 * scale, 0.8 * scale, 8);
      const ramHead = new THREE.Mesh(ramHeadGeo, metalMat);
      ramHead.rotation.x = -Math.PI / 2;
      ramHead.position.set(0, 0, 1.4 * scale);
      ramHead.castShadow = true;
      ramTrunk.add(ramHead);

      shedGroup.add(ramTrunk);
      this.weaponMesh = ramTrunk;
      this.bodyGroup.add(shedGroup);

    // ══════════════════════════════════════════════════
    // 23. ZEUS: LORD OF THE HEAVENS (SKY GOD & BOSS)
    // ══════════════════════════════════════════════════
    } else if (type === 'zeus') {
      const divineGoldMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        metalness: 0.9,
        roughness: 0.18,
        emissive: 0xb45309,
        emissiveIntensity: 0.25
      });
      const lightningMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const whiteClothMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.8 });

      // 1. Olympian Golden Cuirass
      const chestPlate = new THREE.Mesh(
        new THREE.BoxGeometry(0.85 * scale, 0.95 * scale, 0.5 * scale),
        divineGoldMat
      );
      chestPlate.position.set(0, 0.45 * scale, 0);
      chestPlate.castShadow = true;

      // Embossed Thunderbolt on chest
      const boltEmblem = new THREE.Mesh(
        new THREE.BoxGeometry(0.18 * scale, 0.65 * scale, 0.54 * scale),
        lightningMat
      );
      boltEmblem.position.set(0, 0.05 * scale, 0);
      boltEmblem.rotation.z = Math.PI / 8;
      chestPlate.add(boltEmblem);
      this.bodyGroup.add(chestPlate);

      // 2. Divine Laureled Crown & Flowing Beard
      const crownGeo = new THREE.CylinderGeometry(0.35 * scale, 0.38 * scale, 0.15 * scale, 12);
      const crown = new THREE.Mesh(crownGeo, divineGoldMat);
      crown.position.set(0, 1.25 * scale, 0);

      // 8 Radiant Golden Crown Spikes / Rays
      for (let i = 0; i < 8; i++) {
        const ray = new THREE.Mesh(
          new THREE.ConeGeometry(0.06 * scale, 0.35 * scale, 4),
          divineGoldMat
        );
        const theta = (i / 8) * Math.PI * 2;
        ray.position.set(Math.cos(theta) * 0.35 * scale, 0.18 * scale, Math.sin(theta) * 0.35 * scale);
        ray.rotation.z = -Math.cos(theta) * 0.35;
        crown.add(ray);
      }
      this.bodyGroup.add(crown);

      // Glowing Lightning Eyes
      const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.08 * scale, 0.04 * scale, 0.06 * scale), lightningMat);
      const eyeR = eyeL.clone();
      eyeL.position.set(-0.1 * scale, 1.12 * scale, 0.28 * scale);
      eyeR.position.set(0.1 * scale, 1.12 * scale, 0.28 * scale);
      this.bodyGroup.add(eyeL, eyeR);

      // 3. Golden Aegis Round Shield on Left Arm
      const shieldGroup = new THREE.Group();
      const aegisPlate = new THREE.Mesh(
        new THREE.CylinderGeometry(0.65 * scale, 0.65 * scale, 0.08 * scale, 16),
        divineGoldMat
      );
      aegisPlate.rotation.x = Math.PI / 2;
      shieldGroup.add(aegisPlate);

      const gorgonCenter = new THREE.Mesh(
        new THREE.SphereGeometry(0.24 * scale, 8, 8),
        lightningMat
      );
      gorgonCenter.position.z = 0.05 * scale;
      shieldGroup.add(gorgonCenter);

      shieldGroup.position.set(-0.2 * scale, -0.3 * scale, 0.2 * scale);
      this.leftArm.add(shieldGroup);
      this.shieldMesh = shieldGroup;

      // 4. Master Thunderbolt in Right Hand
      const boltWeapon = new THREE.Group();
      // Central golden grip
      const grip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06 * scale, 0.06 * scale, 0.8 * scale, 6),
        divineGoldMat
      );
      boltWeapon.add(grip);

      // Twin-pronged jagged lightning blades
      const upperBlade = new THREE.Mesh(
        new THREE.ConeGeometry(0.12 * scale, 1.8 * scale, 4),
        lightningMat
      );
      upperBlade.position.y = 1.0 * scale;
      const lowerBlade = new THREE.Mesh(
        new THREE.ConeGeometry(0.12 * scale, 1.2 * scale, 4),
        lightningMat
      );
      lowerBlade.position.y = -0.8 * scale;
      lowerBlade.rotation.x = Math.PI;
      boltWeapon.add(upperBlade, lowerBlade);

      boltWeapon.position.set(0, -0.4 * scale, 0.3 * scale);
      boltWeapon.rotation.x = Math.PI / 3;
      this.rightArm.add(boltWeapon);
      this.weaponMesh = boltWeapon;

      // 5. Flowing Celestial Cape
      const cape = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2 * scale, 2.0 * scale),
        whiteClothMat
      );
      cape.position.set(0, 0.2 * scale, -0.35 * scale);
      cape.rotation.x = Math.PI / 14;
      this.bodyGroup.add(cape);

    // ══════════════════════════════════════════════════
    // 24. ARES: GOD OF SAVAGE WAR & SLAUGHTER (BOSS)
    // ══════════════════════════════════════════════════
    } else if (type === 'ares') {
      const bloodIronMat = new THREE.MeshStandardMaterial({
        color: 0x1c1917,
        metalness: 0.85,
        roughness: 0.3
      });
      const bloodRuneMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xdc2626,
        emissiveIntensity: 1.2,
        roughness: 0.2
      });
      const crimsonClothMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.85 });

      // 1. Spiked Demonic Horned Greathelm
      const aresHelm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.38 * scale, 0.42 * scale, 0.5 * scale, 8),
        bloodIronMat
      );
      aresHelm.position.y = 1.1 * scale;

      // Two sweeping curved bull war horns
      const lHorn = new THREE.Mesh(
        new THREE.ConeGeometry(0.12 * scale, 0.7 * scale, 6),
        bloodIronMat
      );
      lHorn.position.set(-0.35 * scale, 0.35 * scale, 0);
      lHorn.rotation.z = Math.PI / 3;
      const rHorn = new THREE.Mesh(
        new THREE.ConeGeometry(0.12 * scale, 0.7 * scale, 6),
        bloodIronMat
      );
      rHorn.position.set(0.35 * scale, 0.35 * scale, 0);
      rHorn.rotation.z = -Math.PI / 3;
      aresHelm.add(lHorn, rHorn);

      // Blazing Crimson Visor Slit
      const aresVisor = new THREE.Mesh(
        new THREE.BoxGeometry(0.35 * scale, 0.08 * scale, 0.1 * scale),
        bloodRuneMat
      );
      aresVisor.position.set(0, 0.02 * scale, 0.35 * scale);
      aresHelm.add(aresVisor);
      this.bodyGroup.add(aresHelm);
      this.headMesh = aresHelm;

      // 2. Colossal Spiked Skull Pauldrons
      const lPaul = new THREE.Mesh(new THREE.BoxGeometry(0.55 * scale, 0.4 * scale, 0.55 * scale), bloodIronMat);
      lPaul.position.set(-0.05 * scale, 0.05 * scale, 0);
      // Spikes on pauldron
      const spike1 = new THREE.Mesh(new THREE.ConeGeometry(0.08 * scale, 0.35 * scale, 4), bloodRuneMat);
      spike1.position.y = 0.25 * scale;
      lPaul.add(spike1);
      this.leftArm.add(lPaul);

      const rPaul = lPaul.clone();
      this.rightArm.add(rPaul);

      // 3. Heavy Segmented Blood-Iron Cuirass
      const chestPlate = new THREE.Mesh(
        new THREE.BoxGeometry(0.95 * scale, 1.0 * scale, 0.55 * scale),
        bloodIronMat
      );
      chestPlate.position.set(0, 0.5 * scale, 0);
      const chestRune = new THREE.Mesh(
        new THREE.BoxGeometry(0.6 * scale, 0.6 * scale, 0.58 * scale),
        bloodRuneMat
      );
      chestPlate.add(chestRune);
      this.bodyGroup.add(chestPlate);

      // 4. Executioner's Hellfire Greatblade (3.5m Immense Weapon)
      const greatbladeGroup = new THREE.Group();
      const bladeHilt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07 * scale, 0.07 * scale, 0.9 * scale, 6),
        bloodIronMat
      );
      const bladeGuard = new THREE.Mesh(
        new THREE.BoxGeometry(0.7 * scale, 0.12 * scale, 0.2 * scale),
        bloodIronMat
      );
      bladeGuard.position.y = 0.45 * scale;
      greatbladeGroup.add(bladeHilt, bladeGuard);

      const massiveBlade = new THREE.Mesh(
        new THREE.BoxGeometry(0.28 * scale, 2.6 * scale, 0.06 * scale),
        bloodIronMat
      );
      massiveBlade.position.y = 1.7 * scale;

      const moltenCore = new THREE.Mesh(
        new THREE.BoxGeometry(0.12 * scale, 2.3 * scale, 0.08 * scale),
        bloodRuneMat
      );
      massiveBlade.add(moltenCore);
      greatbladeGroup.add(massiveBlade);

      greatbladeGroup.position.set(0, -0.4 * scale, 0.4 * scale);
      greatbladeGroup.rotation.x = Math.PI / 3;
      this.rightArm.add(greatbladeGroup);
      this.weaponMesh = greatbladeGroup;

      // 5. Tattered Crimson War Banner Cape
      const warCape = new THREE.Mesh(
        new THREE.PlaneGeometry(1.3 * scale, 2.3 * scale),
        crimsonClothMat
      );
      warCape.position.set(0, 0.2 * scale, -0.38 * scale);
      warCape.rotation.x = Math.PI / 12;
      this.bodyGroup.add(warCape);

    // ══════════════════════════════════════════════════
    // 25. HADES: LORD OF THE UNDERWORLD (SHADOW BOSS)
    // ══════════════════════════════════════════════════
    } else if (type === 'hades') {
      const obsidianMat = new THREE.MeshStandardMaterial({
        color: 0x09090b,
        roughness: 0.2,
        metalness: 0.95
      });
      const soulfireMat = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x059669,
        emissiveIntensity: 1.4
      });
      const shadowRobeMat = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.9 });

      // 1. Crown of the Dead (Twin Obsidian Crests)
      const crown = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35 * scale, 0.38 * scale, 0.35 * scale, 8),
        obsidianMat
      );
      crown.position.y = 1.15 * scale;

      const crestL = new THREE.Mesh(new THREE.ConeGeometry(0.08 * scale, 0.6 * scale, 4), obsidianMat);
      crestL.position.set(-0.25 * scale, 0.3 * scale, 0);
      crestL.rotation.z = Math.PI / 6;
      const crestR = crestL.clone();
      crestR.position.x = 0.25 * scale;
      crestR.rotation.z = -Math.PI / 6;
      crown.add(crestL, crestR);

      // Glowing Green Soul Eyes
      const sEyeL = new THREE.Mesh(new THREE.BoxGeometry(0.08 * scale, 0.04 * scale, 0.06 * scale), soulfireMat);
      const sEyeR = sEyeL.clone();
      sEyeL.position.set(-0.1 * scale, -0.05 * scale, 0.35 * scale);
      sEyeR.position.set(0.1 * scale, -0.05 * scale, 0.35 * scale);
      crown.add(sEyeL, sEyeR);

      this.bodyGroup.add(crown);
      this.headMesh = crown;

      // 2. Bone-Plate Cuirass
      const boneChest = new THREE.Mesh(
        new THREE.BoxGeometry(0.85 * scale, 0.95 * scale, 0.5 * scale),
        obsidianMat
      );
      boneChest.position.set(0, 0.45 * scale, 0);
      const ribL = new THREE.Mesh(new THREE.BoxGeometry(0.35 * scale, 0.08 * scale, 0.53 * scale), soulfireMat);
      ribL.position.set(-0.2 * scale, 0.1 * scale, 0);
      const ribR = ribL.clone();
      ribR.position.x = 0.2 * scale;
      boneChest.add(ribL, ribR);
      this.bodyGroup.add(boneChest);

      // 3. Soulreaper Bident (Twin-Pronged Scythe Spear)
      const bidentGroup = new THREE.Group();
      const bidentPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05 * scale, 0.05 * scale, 2.8 * scale, 6),
        obsidianMat
      );
      bidentGroup.add(bidentPole);

      // Soul Gem Core
      const soulGem = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.2 * scale),
        soulfireMat
      );
      soulGem.position.y = 1.35 * scale;
      bidentGroup.add(soulGem);

      // Twin Curved Prongs
      const prongL = new THREE.Mesh(
        new THREE.ConeGeometry(0.08 * scale, 1.2 * scale, 4),
        obsidianMat
      );
      prongL.position.set(-0.25 * scale, 1.9 * scale, 0);
      prongL.rotation.z = -Math.PI / 14;

      const prongR = new THREE.Mesh(
        new THREE.ConeGeometry(0.08 * scale, 1.2 * scale, 4),
        obsidianMat
      );
      prongR.position.set(0.25 * scale, 1.9 * scale, 0);
      prongR.rotation.z = Math.PI / 14;
      bidentGroup.add(prongL, prongR);

      bidentGroup.position.set(0, -0.2 * scale, 0.3 * scale);
      bidentGroup.rotation.x = Math.PI / 3;
      this.rightArm.add(bidentGroup);
      this.weaponMesh = bidentGroup;

      // 4. Shadow Shroud Cape
      const shadowCape = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2 * scale, 2.1 * scale),
        shadowRobeMat
      );
      shadowCape.position.set(0, 0.2 * scale, -0.32 * scale);
      shadowCape.rotation.x = Math.PI / 12;
      this.bodyGroup.add(shadowCape);

    // ══════════════════════════════════════════════════
    // 26. POSEIDON: EARTHSHAKER & OCEAN LORD (BOSS)
    // ══════════════════════════════════════════════════
    } else if (type === 'poseidon') {
      const seaBrassMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        metalness: 0.85,
        roughness: 0.25,
        emissive: 0x0369a1,
        emissiveIntensity: 0.3
      });
      const tidalCyanMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const seaCapeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.75 });

      // 1. Coral Diadem Crown
      const seaCrown = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36 * scale, 0.4 * scale, 0.25 * scale, 10),
        seaBrassMat
      );
      seaCrown.position.y = 1.2 * scale;
      for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06 * scale, 0.35 * scale, 4), tidalCyanMat);
        spike.position.set((i - 2) * 0.15 * scale, 0.2 * scale, 0.3 * scale);
        seaCrown.add(spike);
      }
      this.bodyGroup.add(seaCrown);
      this.headMesh = seaCrown;

      // 2. Scaled Carapace Cuirass
      const seaChest = new THREE.Mesh(
        new THREE.BoxGeometry(0.88 * scale, 0.95 * scale, 0.52 * scale),
        seaBrassMat
      );
      seaChest.position.set(0, 0.45 * scale, 0);
      this.bodyGroup.add(seaChest);

      // Shell Pauldrons
      const lShell = new THREE.Mesh(new THREE.SphereGeometry(0.32 * scale, 8, 8), seaBrassMat);
      lShell.position.set(0, 0, 0);
      this.leftArm.add(lShell);
      const rShell = lShell.clone();
      this.rightArm.add(rShell);

      // 3. Colossal Titan Trident (3-Pronged Gold & Cyan Spear)
      const tridentGroup = new THREE.Group();
      const tridentStaff = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06 * scale, 0.06 * scale, 3.0 * scale, 6),
        seaBrassMat
      );
      tridentGroup.add(tridentStaff);

      const crossBar = new THREE.Mesh(
        new THREE.BoxGeometry(0.7 * scale, 0.1 * scale, 0.12 * scale),
        seaBrassMat
      );
      crossBar.position.y = 1.45 * scale;
      tridentGroup.add(crossBar);

      // 3 Prongs
      const centerProng = new THREE.Mesh(new THREE.ConeGeometry(0.1 * scale, 1.4 * scale, 4), tidalCyanMat);
      centerProng.position.y = 2.1 * scale;
      const leftProng = new THREE.Mesh(new THREE.ConeGeometry(0.08 * scale, 1.1 * scale, 4), tidalCyanMat);
      leftProng.position.set(-0.3 * scale, 1.95 * scale, 0);
      const rightProng = leftProng.clone();
      rightProng.position.x = 0.3 * scale;
      tridentGroup.add(centerProng, leftProng, rightProng);

      tridentGroup.position.set(0, -0.3 * scale, 0.35 * scale);
      tridentGroup.rotation.x = Math.PI / 3;
      this.rightArm.add(tridentGroup);
      this.weaponMesh = tridentGroup;

      // 4. Wave Cape
      const waveCape = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2 * scale, 2.1 * scale),
        seaCapeMat
      );
      waveCape.position.set(0, 0.2 * scale, -0.35 * scale);
      waveCape.rotation.x = Math.PI / 12;
      this.bodyGroup.add(waveCape);
    }
  }

  // ----------------------------------------------------
  // ACTIVE RAGDOLL LOCOMOTION & PHYSICS UPDATE
  // ----------------------------------------------------
  update(dt, allUnits, projectileSystem, vfxManager = null, bloodGoreSystem = null, terrainSystem = null, structureSystem = null, waypointNavSystem = null) {
    if (!this.body) return;

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.ultimateCooldown = Math.max(0, this.ultimateCooldown - dt);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboStep = 1;
      }
    }

    if (this.isDead) {
      this.updateMeshFromPhysics();
      return;
    }

    // Terrain Physical Interactions: Fall Damage & Deep Water
    if (terrainSystem) {
      terrainSystem.evaluateFallDamage(this, dt);
      terrainSystem.evaluateWaterInteraction(this, dt, this.vfxManager);
    }

    // Handle Knockdown recovery timer
    if (this.isKnockedDown) {
      this.knockdownTimer -= dt;
      if (this.knockdownTimer <= 0) {
        this.isKnockedDown = false;
        this.body.setEnabledRotations(false, true, false, true); // Re-lock upright orientation
      }
      this.updateMeshFromPhysics();
      return;
    }

    // Check if unit is currently possessed by player
    const { possessedUnit } = useSandboxStore.getState();
    if (this.isPossessed || (possessedUnit && possessedUnit.id === this.id)) {
      this.updateMeshFromPhysics();
      return;
    }

    const pos = this.body.translation();
    const type = this.typeConfig.id;

    // ═══ GARRISON BEHAVIOR (Archers / Mages on Tower or Wall Tops) ═══
    if (this.isGarrisoned) {
      // Garrisoned ranged units hold position atop the parapet
      const attackRange = this.typeConfig.attackRange * 1.5; // +50% range bonus!

      if (this.targetUnit && !this.targetUnit.isDead) {
        const targetPos = this.targetUnit.body.translation();
        const dx = targetPos.x - pos.x;
        const dz = targetPos.z - pos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Turn to face target
        const angle = Math.atan2(dx, dz);
        const halfAngle = angle * 0.5;
        this.body.setRotation({ x: 0, y: Math.sin(halfAngle), z: 0, w: Math.cos(halfAngle) }, true);

        if (dist <= attackRange && this.attackCooldown <= 0) {
          this.executeAttack(this.targetUnit, dist, projectileSystem);
          this.attackCooldown = this.typeConfig.attackCooldown;
        }
      }
      this.updateMeshFromPhysics();
      return;
    }

    // ═══ STRUCTURE ATTACK BEHAVIOR (Siege units or blocked units) ═══
    let activeTarget = this.targetUnit && !this.targetUnit.isDead ? this.targetUnit : null;
    let isAttackingStructure = false;

    // Check if unit should target an opposing structure (gate, wall, keep)
    if (structureSystem && (!activeTarget || type === 'battering_ram' || type === 'catapult')) {
      const nearestStruct = structureSystem.findTargetStructure(pos, this.teamId, type === 'catapult' ? 40 : 18);
      if (nearestStruct) {
        this.targetStructure = nearestStruct;
        if (!activeTarget || type === 'battering_ram') {
          isAttackingStructure = true;
        }
      }
    }

    // ACTIVE LOCOMOTION (If Alive & Not Knocked Down)
    let destPos = null;
    let targetDist = 999;

    if (isAttackingStructure && this.targetStructure && !this.targetStructure.isDestroyed) {
      destPos = this.targetStructure.position;
      const dx = destPos.x - pos.x;
      const dz = destPos.z - pos.z;
      targetDist = Math.sqrt(dx * dx + dz * dz);
    } else if (activeTarget && activeTarget.body) {
      destPos = activeTarget.body.translation();
      const dx = destPos.x - pos.x;
      const dz = destPos.z - pos.z;
      targetDist = Math.sqrt(dx * dx + dz * dz);
    }

    if (destPos) {
      // Waypoint Navigation Steering with Staggered Caching (Massive performance boost)
      let steerPos = destPos;
      if (waypointNavSystem) {
        this.navTimer = (this.navTimer || 0) - dt;
        const distToWp = this.cachedWaypoint ? Math.hypot(this.cachedWaypoint.x - pos.x, this.cachedWaypoint.z - pos.z) : 0;
        if (!this.cachedWaypoint || this.navTimer <= 0 || distToWp < 3.0) {
          this.cachedWaypoint = waypointNavSystem.getNextWaypoint(pos, destPos) || destPos;
          this.navTimer = 0.3 + Math.random() * 0.15; // Stagger across units
        }
        steerPos = this.cachedWaypoint || destPos;
      }

      const dx = steerPos.x - pos.x;
      const dz = steerPos.z - pos.z;
      const angle = Math.atan2(dx, dz);
      const halfAngle = angle * 0.5;
      this.body.setRotation({ x: 0, y: Math.sin(halfAngle), z: 0, w: Math.cos(halfAngle) }, true);

      let speed = this.typeConfig.moveSpeed;
      const attackRange = this.typeConfig.attackRange;
      const preferredRange = this.typeConfig.preferredRange || attackRange * 0.7;

      let moveDirection = 0;
      if (this.typeConfig.category === 'ARCANE' || (this.typeConfig.category === 'MARTIAL' && this.typeConfig.attackRange > 8.0)) {
        if (targetDist < preferredRange * 0.6) {
          moveDirection = -1; // Kite backwards
        } else if (targetDist > attackRange * 0.9) {
          moveDirection = 1;
        }
      } else {
        if (targetDist > attackRange * 0.85) {
          moveDirection = 1; // Rush target
        }
      }

      // Apply Forward Walk Motor Impulse with Slope Speed Modifier
      if (moveDirection !== 0 && speed > 0) {
        const moveDir = { x: Math.sin(angle) * moveDirection, z: Math.cos(angle) * moveDirection };

        // 3D Slope Physics: Slower uphill (0.6x), faster downhill (1.35x)
        let slopeFactor = 1.0;
        if (terrainSystem) {
          slopeFactor = terrainSystem.getSlopeSpeedModifier(pos, moveDir);
          speed *= slopeFactor;
        }

        const dirX = moveDir.x * speed;
        const dirZ = moveDir.z * speed;
        const linvel = this.body.linvel();
        this.body.setLinvel({ x: dirX, y: linvel.y, z: dirZ }, true);

        // Cavalry charging downhill gets massive bonus momentum
        if (type === 'cavalry' && slopeFactor > 1.1) {
          this.body.applyImpulse({ x: dirX * 18, y: 0, z: dirZ * 18 }, true);
        }

        // Procedural Leg & Arm Walk Swing
        this.walkCyclePhase += dt * speed * 2.2;
        const legSwing = Math.sin(this.walkCyclePhase) * 0.6;
        if (this.leftLeg) this.leftLeg.rotation.x = legSwing;
        if (this.rightLeg) this.rightLeg.rotation.x = -legSwing;
        if (this.leftArm) this.leftArm.rotation.x = -legSwing * 0.5;
        if (this.rightArm) this.rightArm.rotation.x = legSwing * 0.5;
        this.bodyGroup.rotation.z = Math.sin(this.walkCyclePhase * 0.5) * 0.08;
      }

      // COMBAT EXECUTION (AI Ultimate or Progressive Attack)
      if (isAttackingStructure && this.targetStructure && !this.targetStructure.isDestroyed) {
        if (targetDist <= attackRange + 2.0 && this.attackCooldown <= 0) {
          this.executeAttack(this.targetStructure, targetDist, projectileSystem);
          this.attackCooldown = this.typeConfig.attackCooldown;
        }
      } else if (activeTarget) {
        const isBoss = !!this.typeConfig?.isBoss;
        const ultRange = isBoss ? attackRange * 2.2 : attackRange * 1.5;
        const ultChance = isBoss ? 0.7 : 0.25;
        if (this.ultimateCooldown <= 0 && targetDist <= ultRange && Math.random() < ultChance) {
          this.executeUltimate(activeTarget, projectileSystem);
        } else if (targetDist <= attackRange && this.attackCooldown <= 0) {
          this.executeAttack(activeTarget, targetDist, projectileSystem);
          this.attackCooldown = this.typeConfig.attackCooldown;
        }
      }
    } else {
      if (this.leftLeg) this.leftLeg.rotation.x = 0;
      if (this.rightLeg) this.rightLeg.rotation.x = 0;
      this.bodyGroup.rotation.z = 0;
    }

    this.updateMeshFromPhysics();
  }

  // ----------------------------------------------------
  // FIGHTING GAME 3-HIT COMBO ATTACK SYSTEM
  // ----------------------------------------------------
  executeAttack(target, dist, projectileSystem) {
    const type = this.typeConfig.id;
    const targetPos = target.body ? target.body.translation() : null;
    const myPos = this.body.translation();
    const teamColor = this.teamId === 'blue' ? 0x60a5fa : 0xf87171;

    // ═══ 3-Hit Progressive Attack Chain ═══
    const currentStep = this.comboStep;
    this.comboTimer = 1.35;
    this.comboStep = (this.comboStep % 3) + 1;
    const isFinisher = currentStep === 3;
    const comboMult = isFinisher ? 1.85 : (currentStep === 2 ? 1.35 : 1.0);
    const damage = Math.round(this.typeConfig.damage * comboMult);
    const impactForce = isFinisher ? 520 : (currentStep === 2 ? 320 : 200);

    // Finisher Screen Shake & Resonant Audio
    if (isFinisher) {
      soundSystem.playComboFinisher();
      if (this.vfxManager && targetPos) {
        this.vfxManager.spawnComboFinisherVFX(new THREE.Vector3(targetPos.x, targetPos.y + 0.9, targetPos.z), teamColor, 3);
      }
    }

    // Direction vector facing target
    const forwardDir = new THREE.Vector3(
      targetPos ? targetPos.x - myPos.x : 1,
      0,
      targetPos ? targetPos.z - myPos.z : 0
    ).normalize();

    // ═══ 1. SWORDSMAN: Crescent Slash -> Reverse Cut -> Overhead Cleave ═══
    if (type === 'swordsman') {
      soundSystem.playSwordSlash();
      if (currentStep === 1) {
        this.rightArm.rotation.x = -Math.PI / 1.7;
        this.rightArm.rotation.z = Math.PI / 6;
      } else if (currentStep === 2) {
        this.rightArm.rotation.x = -Math.PI / 2.0;
        this.rightArm.rotation.z = -Math.PI / 4;
      } else {
        // Step 3 Finisher: Overhead leap slam
        this.rightArm.rotation.x = -Math.PI / 1.1;
        this.leftArm.rotation.x = -Math.PI / 1.3;
      }

      if (this.vfxManager) {
        this.vfxManager.spawnSlashArc(myPos, forwardDir, teamColor, isFinisher ? 2.4 : 1.8);
      }

      setTimeout(() => {
        if (this.rightArm) {
          this.rightArm.rotation.x = Math.PI / 3;
          this.rightArm.rotation.z = 0;
        }
        if (this.leftArm) this.leftArm.rotation.x = 0;
      }, 130);

      target.takeDamage(damage, myPos, impactForce, this);
      if (isFinisher) target.triggerKnockdown(1.2);
      if (this.vfxManager && targetPos) {
        this.vfxManager.spawnHitSparks(new THREE.Vector3(targetPos.x, targetPos.y + 0.9, targetPos.z), 0xfacc15, isFinisher ? 16 : 8);
      }

    // ═══ 2. SPEARMAN: High-Velocity Linear Thrust -> Impale ═══
    } else if (type === 'spearman') {
      soundSystem.playSwordSlash();
      this.rightArm.rotation.x = isFinisher ? -Math.PI / 1.0 : -Math.PI / 1.2;
      this.rightArm.rotation.y = -0.15;

      if (this.vfxManager && targetPos) {
        this.vfxManager.spawnPiercingStreak(myPos, targetPos, teamColor);
      }

      setTimeout(() => {
        if (this.rightArm) {
          this.rightArm.rotation.x = Math.PI / 6;
          this.rightArm.rotation.y = 0;
        }
      }, 140);

      target.takeDamage(damage, myPos, impactForce * 1.2, this);
      if (isFinisher) target.triggerKnockdown(1.4);
      if (this.vfxManager && targetPos) {
        this.vfxManager.spawnHitSparks(new THREE.Vector3(targetPos.x, targetPos.y + 1.0, targetPos.z), 0x38bdf8, isFinisher ? 16 : 10);
      }

    // ═══ 3. BERSERKER: Dual-Axe Flurry (Right Axe -> Left Axe -> Dual Cleave) ═══
    } else if (type === 'berserker') {
      soundSystem.playSwordSlash();
      if (currentStep === 1) {
        this.rightArm.rotation.x = -Math.PI / 1.5;
        this.rightArm.rotation.z = Math.PI / 4;
      } else if (currentStep === 2) {
        this.leftArm.rotation.x = -Math.PI / 1.5;
        this.leftArm.rotation.z = -Math.PI / 4;
      } else {
        // Dual Scissor Chop
        this.rightArm.rotation.x = -Math.PI / 1.3;
        this.leftArm.rotation.x = -Math.PI / 1.3;
        if (this.vfxManager) this.vfxManager.spawnWhirlwindArc(myPos, teamColor);
      }

      setTimeout(() => {
        if (this.rightArm) { this.rightArm.rotation.x = Math.PI / 4; this.rightArm.rotation.z = 0; }
        if (this.leftArm) { this.leftArm.rotation.x = Math.PI / 4; this.leftArm.rotation.z = 0; }
      }, 110);

      target.takeDamage(damage, myPos, impactForce, this);
      if (isFinisher) target.triggerKnockdown(1.5);
      if (this.vfxManager && targetPos) {
        this.vfxManager.spawnHitSparks(new THREE.Vector3(targetPos.x, targetPos.y + 0.9, targetPos.z), 0xef4444, isFinisher ? 18 : 8);
      }

    // ═══ 4. SAMURAI: Iaido Quick-Draw Razor Flash ═══
    } else if (type === 'samurai') {
      soundSystem.playSwordSlash();
      this.rightArm.rotation.x = -Math.PI / 1.6;
      this.rightArm.rotation.z = isFinisher ? Math.PI / 3 : Math.PI / 6;

      if (this.vfxManager) {
        this.vfxManager.spawnIaidoSlash(myPos, forwardDir, teamColor);
      }

      setTimeout(() => {
        if (this.rightArm) {
          this.rightArm.rotation.x = Math.PI / 4;
          this.rightArm.rotation.z = -Math.PI / 8;
        }
      }, 100);

      target.takeDamage(damage, myPos, impactForce * 1.1, this);
      if (isFinisher) target.triggerKnockdown(1.6);
      if (this.vfxManager && targetPos) {
        this.vfxManager.spawnHitSparks(new THREE.Vector3(targetPos.x, targetPos.y + 1.0, targetPos.z), 0xffffff, 14);
      }

    // ═══ 5. GLADIATOR: Trident Thrust & Entangling Sweep ═══
    } else if (type === 'gladiator') {
      soundSystem.playSwordSlash();
      this.rightArm.rotation.x = -Math.PI / 1.2;

      if (this.vfxManager && targetPos) {
        this.vfxManager.spawnPiercingStreak(myPos, targetPos, 0xd97706);
      }

      setTimeout(() => {
        if (this.rightArm) this.rightArm.rotation.x = Math.PI / 6;
      }, 130);

      target.takeDamage(damage, myPos, impactForce, this);
      if (isFinisher) target.triggerKnockdown(1.8);

    // ═══ 6. ASSASSIN: Twin Dagger Poison Flurry ═══
    } else if (type === 'assassin') {
      soundSystem.playSwordSlash();
      if (currentStep === 1) {
        this.rightArm.rotation.x = -Math.PI / 1.4;
      } else if (currentStep === 2) {
        this.leftArm.rotation.x = -Math.PI / 1.4;
      } else {
        this.rightArm.rotation.x = -Math.PI / 1.2;
        this.leftArm.rotation.x = -Math.PI / 1.2;
      }

      setTimeout(() => {
        if (this.rightArm) this.rightArm.rotation.x = 0;
        if (this.leftArm) this.leftArm.rotation.x = 0;
      }, 90);

      target.takeDamage(damage, myPos, impactForce * 0.8, this);
      if (isFinisher) target.triggerKnockdown(1.2);
      if (this.vfxManager && targetPos) {
        this.vfxManager.spawnHitSparks(new THREE.Vector3(targetPos.x, targetPos.y + 0.8, targetPos.z), 0x10b981, 12);
      }

    // ═══ 7. MONK: Shaolin Chi Fist & Dragon Palm Shockwave ═══
    } else if (type === 'monk') {
      soundSystem.playBluntHit();
      if (currentStep === 1) {
        this.rightArm.rotation.x = -Math.PI / 1.4;
      } else if (currentStep === 2) {
        this.leftArm.rotation.x = -Math.PI / 1.4;
      } else {
        // Step 3 Dragon Palm
        this.rightArm.rotation.x = -Math.PI / 1.2;
        this.leftArm.rotation.x = -Math.PI / 1.2;
        if (this.vfxManager) this.vfxManager.spawnChiBurst(myPos, forwardDir);
      }

      setTimeout(() => {
        if (this.rightArm) this.rightArm.rotation.x = 0;
        if (this.leftArm) this.leftArm.rotation.x = 0;
      }, 100);

      target.takeDamage(damage, myPos, isFinisher ? 700 : impactForce, this);
      if (isFinisher) target.triggerKnockdown(2.0);
      if (this.vfxManager && targetPos) {
        this.vfxManager.spawnHitSparks(new THREE.Vector3(targetPos.x, targetPos.y + 0.9, targetPos.z), 0xfacc15, 14);
      }

    // ═══ 8. DUELIST: Rapid Staccato Rapier Thrusts ═══
    } else if (type === 'duelist') {
      soundSystem.playSwordSlash();
      this.rightArm.rotation.x = -Math.PI / 1.1;
      this.rightArm.rotation.y = (Math.random() - 0.5) * 0.2;

      if (this.vfxManager && targetPos) {
        this.vfxManager.spawnPiercingStreak(myPos, targetPos, 0xf59e0b);
      }

      setTimeout(() => {
        if (this.rightArm) { this.rightArm.rotation.x = Math.PI / 6; this.rightArm.rotation.y = 0; }
      }, 100);

      target.takeDamage(damage, myPos, impactForce, this);
      if (isFinisher) target.triggerKnockdown(1.2);

    // ═══ 9. NINJA: Shuriken Hurl or Ninjato Close Strike ═══
    } else if (type === 'ninja') {
      if (dist > 3.0) {
        soundSystem.playArrowRelease();
        this.rightArm.rotation.x = -Math.PI / 1.8;
        projectileSystem.spawnShuriken(
          { x: myPos.x, y: myPos.y + 1.0, z: myPos.z },
          targetPos,
          damage,
          this.teamId
        );
        setTimeout(() => { if (this.rightArm) this.rightArm.rotation.x = 0; }, 120);
      } else {
        soundSystem.playSwordSlash();
        this.rightArm.rotation.x = -Math.PI / 1.4;
        setTimeout(() => { if (this.rightArm) this.rightArm.rotation.x = Math.PI / 4; }, 100);
        target.takeDamage(damage, myPos, impactForce, this);
        if (isFinisher) target.triggerKnockdown(1.3);
      }

    // ═══ 10. PALADIN: Divine Warhammer Heavy Smashing ═══
    } else if (type === 'paladin') {
      soundSystem.playBluntHit();
      this.rightArm.rotation.x = isFinisher ? -Math.PI / 1.0 : -Math.PI / 1.4;
      this.leftArm.rotation.x = isFinisher ? -Math.PI / 1.1 : -Math.PI / 1.6;

      if (isFinisher && this.vfxManager && targetPos) {
        this.vfxManager.spawnHolySmite(targetPos);
      }

      setTimeout(() => {
        if (this.rightArm) this.rightArm.rotation.x = Math.PI / 3;
        if (this.leftArm) this.leftArm.rotation.x = 0;
      }, 180);

      target.takeDamage(damage, myPos, impactForce * 1.5, this);
      if (isFinisher) target.triggerKnockdown(2.2);

    // ═══ 11. NECROMANCER: Death Scythe & Life Drain Siphon ═══
    } else if (type === 'necromancer') {
      soundSystem.playSwordSlash();
      this.rightArm.rotation.x = -Math.PI / 1.3;

      if (isFinisher && this.vfxManager) {
        this.vfxManager.spawnSoulHarvest(myPos, 4.0);
      }

      setTimeout(() => {
        if (this.rightArm) this.rightArm.rotation.x = Math.PI / 4;
      }, 160);

      target.takeDamage(damage, myPos, impactForce, this);
      // Life drain healing to Necromancer
      this.heal(damage * 0.35);

    // ═══ 12. PYROMANCER: Fire Blast & Magma Eruption ═══
    } else if (type === 'pyromancer') {
      soundSystem.playFireballExplosion();
      this.rightArm.rotation.x = -Math.PI / 1.5;
      this.leftArm.rotation.x = -Math.PI / 1.5;

      if (isFinisher && this.vfxManager) {
        this.vfxManager.spawnFireBreath(myPos, forwardDir);
      }

      projectileSystem.spawnFireball(
        { x: myPos.x, y: myPos.y + 1.2, z: myPos.z },
        targetPos,
        damage,
        this.typeConfig.aoeRadius || 3.2,
        this.teamId
      );

      setTimeout(() => {
        if (this.rightArm) this.rightArm.rotation.x = 0;
        if (this.leftArm) this.leftArm.rotation.x = 0;
      }, 200);

    // ═══ 13. FROST WITCH: Glacial Ice Shards & Freeze Spikes ═══
    } else if (type === 'frost_witch') {
      soundSystem.playBluntHit();
      this.rightArm.rotation.x = -Math.PI / 1.5;

      if (isFinisher && this.vfxManager && targetPos) {
        this.vfxManager.spawnGlacialSpikes(targetPos, 3.5);
      }

      projectileSystem.spawnIceShard(
        { x: myPos.x, y: myPos.y + 1.3, z: myPos.z },
        targetPos,
        damage,
        this.teamId
      );

      setTimeout(() => {
        if (this.rightArm) this.rightArm.rotation.x = 0;
      }, 180);

    // ═══ 14. DRAGON KNIGHT: Zweihänder Heavy Fire Cleave ═══
    } else if (type === 'dragon_knight') {
      soundSystem.playSwordSlash();
      this.rightArm.rotation.x = -Math.PI / 1.2;
      this.leftArm.rotation.x = -Math.PI / 1.4;

      if (isFinisher && this.vfxManager) {
        this.vfxManager.spawnFireBreath(myPos, forwardDir);
      }

      setTimeout(() => {
        if (this.rightArm) this.rightArm.rotation.x = Math.PI / 3;
        if (this.leftArm) this.leftArm.rotation.x = 0;
      }, 160);

      target.takeDamage(damage, myPos, impactForce * 1.4, this);
      if (isFinisher) target.triggerKnockdown(2.0);

    // ═══ 15. RUNIC GOLEM: Stone Fists & Seismic Quake ═══
    } else if (type === 'golem') {
      soundSystem.playBluntHit();
      if (currentStep === 1) {
        this.rightArm.rotation.x = -Math.PI / 1.3;
      } else if (currentStep === 2) {
        this.leftArm.rotation.x = -Math.PI / 1.3;
      } else {
        // Step 3 Double Overhead Smash
        this.rightArm.rotation.x = -Math.PI / 1.0;
        this.leftArm.rotation.x = -Math.PI / 1.0;
        if (this.vfxManager && targetPos) {
          this.vfxManager.spawnSeismicStomp(new THREE.Vector3(targetPos.x, 0.05, targetPos.z), 4.5);
        }
      }

      setTimeout(() => {
        if (this.rightArm) this.rightArm.rotation.x = 0;
        if (this.leftArm) this.leftArm.rotation.x = 0;
      }, 220);

      target.takeDamage(damage, myPos, impactForce * 1.6, this);
      if (isFinisher) target.triggerKnockdown(2.8);

    // ═══ 16. SHIELD BEARER: Heavy Shield Bash & Defensive Aegis Pulse ═══
    } else if (type === 'shield_bearer') {
      this.leftArm.rotation.x = -Math.PI / 1.6;
      this.rightArm.rotation.x = -Math.PI / 3;
      soundSystem.playBluntHit();

      if (this.vfxManager) {
        this.vfxManager.spawnShieldPulse(myPos, teamColor);
      }

      setTimeout(() => {
        if (this.leftArm) this.leftArm.rotation.x = 0;
        if (this.rightArm) this.rightArm.rotation.x = 0;
      }, 200);

      target.takeDamage(damage, myPos, 420, this);
      target.triggerKnockdown(1.2);
      if (this.vfxManager && targetPos) {
        this.vfxManager.spawnHitSparks(new THREE.Vector3(targetPos.x, targetPos.y + 0.8, targetPos.z), 0x93c5fd, 10);
      }

    // ═══ 17. CAVALRY: Galloping Charge, Hoof Dust & Impaling Lance ═══
    } else if (type === 'cavalry') {
      this.rightArm.rotation.x = -Math.PI / 2.0;
      soundSystem.playBluntHit();

      if (this.vfxManager) {
        this.vfxManager.spawnCavalryHoofDust(myPos);
        if (targetPos) {
          this.vfxManager.spawnPiercingStreak(myPos, targetPos, 0xfacc15);
        }
      }

      const chargeForce = (this.typeConfig.chargeForce || 1200) * (isFinisher ? 1.5 : 1.0);
      target.takeDamage(damage, myPos, chargeForce, this);
      target.triggerKnockdown(2.5);

      if (this.vfxManager && targetPos) {
        this.vfxManager.spawnHitSparks(new THREE.Vector3(targetPos.x, targetPos.y + 1.0, targetPos.z), 0xef4444, 14);
      }

    // ═══ 18. GIANT: Seismic Ground Smash, Flying Earth Debris & Screen Shake ═══
    } else if (type === 'giant') {
      this.rightArm.rotation.x = -Math.PI / 1.1;
      this.leftArm.rotation.x = -Math.PI / 1.3;
      soundSystem.playBluntHit();

      setTimeout(() => {
        if (this.rightArm) this.rightArm.rotation.x = Math.PI / 3;
        if (this.leftArm) this.leftArm.rotation.x = Math.PI / 4;

        if (this.vfxManager && targetPos) {
          this.vfxManager.spawnSeismicStomp(new THREE.Vector3(targetPos.x, 0.05, targetPos.z), 5.5);
        }
      }, 200);

      target.takeDamage(damage, myPos, 1600, this);
      target.triggerKnockdown(3.2);

    // ═══ 19. ARCHER: Bow Release, Aerodynamic Wind Wake & Kite Retreat ═══
    } else if (type === 'archer') {
      this.rightArm.rotation.x = -Math.PI / 2.2;
      soundSystem.playArrowRelease();

      const startPos = this.body.translation();
      const tPos = target.body.translation();

      if (this.vfxManager) {
        this.vfxManager.spawnArrowWindWake(startPos, tPos);
      }

      projectileSystem.spawnArrow(
        { x: startPos.x, y: startPos.y + 1.2, z: startPos.z },
        tPos,
        damage,
        this.teamId
      );

      // Tactical step back if enemy gets too close (< 5.0m)
      if (dist < 5.0 && this.body) {
        const fleeImpulse = new THREE.Vector3().subVectors(myPos, targetPos).normalize().multiplyScalar(40);
        this.body.applyImpulse({ x: fleeImpulse.x, y: 15, z: fleeImpulse.z }, true);
      }

    // ═══ 20. MAGE: Arcane Rune Seal Cast & Blazing Fireball ═══
    } else if (type === 'mage') {
      this.leftArm.rotation.x = -Math.PI / 1.5;
      this.rightArm.rotation.x = -Math.PI / 1.5;
      soundSystem.playFireballExplosion();

      const startPos = this.body.translation();
      const tPos = target.body.translation();

      if (this.vfxManager) {
        this.vfxManager.spawnMagicGlyph(startPos, this.teamId === 'blue' ? 0x38bdf8 : 0xf97316);
      }

      projectileSystem.spawnFireball(
        { x: startPos.x, y: startPos.y + 1.4, z: startPos.z },
        tPos,
        damage,
        this.typeConfig.aoeRadius,
        this.teamId
      );

      setTimeout(() => {
        if (this.leftArm) this.leftArm.rotation.x = 0;
        if (this.rightArm) this.rightArm.rotation.x = 0;
      }, 350);

    // ═══ 21. CATAPULT: Siege Lever Launch & Giant Flaming Boulder ═══
    } else if (type === 'catapult') {
      soundSystem.playFireballExplosion();
      const startPos = this.body.translation();
      const tPos = target.body ? target.body.translation() : (target.position || null);

      if (tPos) {
        projectileSystem.spawnCatapultBoulder(
          { x: startPos.x, y: startPos.y + 2.0, z: startPos.z },
          tPos,
          damage,
          this.typeConfig.aoeRadius,
          this.teamId
        );
      }

    // ═══ 22. BATTERING RAM: Heavy Timber Ram Surge ═══
    } else if (type === 'battering_ram') {
      soundSystem.playHeavyWoodBreak?.();
      if (this.weaponMesh) {
        this.weaponMesh.position.z += 1.2;
        setTimeout(() => {
          if (this.weaponMesh) this.weaponMesh.position.z -= 1.2;
        }, 220);
      }
      const structMult = this.typeConfig.structureDamageMultiplier || 5.0;
      if (target && target.takeDamage) {
        if (target.typeConfig && target.typeConfig.maxHealth) {
          target.takeDamage(damage * structMult, myPos, this);
        } else {
          target.takeDamage(damage, myPos, impactForce * 2.2, this);
          if (isFinisher) target.triggerKnockdown(3.2);
        }
      }
      if (this.vfxManager && targetPos) {
        this.vfxManager.spawnHitSparks(new THREE.Vector3(targetPos.x, targetPos.y + 0.6, targetPos.z), 0xd97706, 16);
      }

    // ═══ 23. ZEUS: Olympian Thunder & Aegis Smite ═══
    } else if (type === 'zeus') {
      soundSystem.playDivineThunder();
      if (this.rightArm) {
        this.rightArm.rotation.x = isFinisher ? -Math.PI / 1.0 : -Math.PI / 1.3;
        this.rightArm.rotation.z = Math.PI / 6;
      }
      const strikePos = targetPos ? new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z) : new THREE.Vector3(myPos.x + forwardDir.x * 6, myPos.y, myPos.z + forwardDir.z * 6);
      if (this.vfxManager) {
        this.vfxManager.spawnDivineLightningStrike(
          strikePos,
          0x38bdf8,
          isFinisher
        );
      }
      setTimeout(() => {
        if (this.rightArm) {
          this.rightArm.rotation.x = Math.PI / 4;
          this.rightArm.rotation.z = 0;
        }
      }, 150);

      if (target && target.takeDamage) {
        target.takeDamage(damage, myPos, impactForce * 1.6, this);
        if (isFinisher && target.triggerKnockdown) target.triggerKnockdown(2.2);
      }

    // ═══ 24. ARES: Colossal Executioner Greatblade Cleave ═══
    } else if (type === 'ares') {
      soundSystem.playWarGodRoar();
      if (this.rightArm && this.leftArm) {
        this.rightArm.rotation.x = -Math.PI / 1.2;
        this.rightArm.rotation.z = isFinisher ? Math.PI / 2 : Math.PI / 3;
        this.leftArm.rotation.x = -Math.PI / 1.4;
      }
      if (this.vfxManager) {
        this.vfxManager.spawnSlashArc(myPos, forwardDir, 0xef4444, isFinisher ? 3.8 : 2.8);
      }
      setTimeout(() => {
        if (this.rightArm) {
          this.rightArm.rotation.x = Math.PI / 3;
          this.rightArm.rotation.z = -Math.PI / 6;
        }
        if (this.leftArm) this.leftArm.rotation.x = 0;
      }, 160);

      if (target && target.takeDamage) {
        target.takeDamage(Math.round(damage * 1.25), myPos, impactForce * 2.8, this);
        if (target.triggerKnockdown) target.triggerKnockdown(isFinisher ? 3.0 : 1.5);
      }
      if (this.vfxManager && targetPos) {
        this.vfxManager.spawnHitSparks(new THREE.Vector3(targetPos.x, targetPos.y + 1.0, targetPos.z), 0xff2200, 20);
        if (isFinisher) {
          this.vfxManager.spawnScorchDecal(new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z), 3.0, true);
        }
      }

    // ═══ 25. HADES: Soulreaper Bident Impale & Life Siphon ═══
    } else if (type === 'hades') {
      soundSystem.playSoulSiphon();
      if (this.rightArm) {
        this.rightArm.rotation.x = -Math.PI / 1.1;
        this.rightArm.rotation.y = -0.2;
      }
      if (this.vfxManager && targetPos) {
        this.vfxManager.spawnPiercingStreak(myPos, targetPos, 0x10b981);
        this.vfxManager.spawnHitSparks(new THREE.Vector3(targetPos.x, targetPos.y + 1.0, targetPos.z), 0x34d399, 14);
      }
      setTimeout(() => {
        if (this.rightArm) {
          this.rightArm.rotation.x = Math.PI / 5;
          this.rightArm.rotation.y = 0;
        }
      }, 140);

      if (target && target.takeDamage) {
        target.takeDamage(damage, myPos, impactForce * 1.3, this);
        this.heal(damage * 0.35); // Soul siphon lifesteal
        if (isFinisher && target.triggerKnockdown) target.triggerKnockdown(2.2);
      }

    // ═══ 26. POSEIDON: Titan Trident Tidal Thrust ═══
    } else if (type === 'poseidon') {
      soundSystem.playTidalCrash();
      if (this.rightArm) {
        this.rightArm.rotation.x = isFinisher ? -Math.PI / 1.0 : -Math.PI / 1.3;
      }
      if (this.vfxManager) {
        this.vfxManager.spawnSlashArc(myPos, forwardDir, 0x06b6d4, isFinisher ? 3.5 : 2.5);
      }
      setTimeout(() => {
        if (this.rightArm) this.rightArm.rotation.x = Math.PI / 6;
      }, 150);

      if (target && target.takeDamage) {
        target.takeDamage(damage, myPos, impactForce * 2.2, this);
        if (isFinisher && target.triggerKnockdown) target.triggerKnockdown(2.8);
      }
      if (this.vfxManager && targetPos) {
        this.vfxManager.spawnHitSparks(new THREE.Vector3(targetPos.x, targetPos.y + 1.0, targetPos.z), 0x38bdf8, 16);
      }
    }
  }

  // ----------------------------------------------------
  // SIGNATURE ULTIMATE ABILITIES ([Q] / RMB or AI)
  // ----------------------------------------------------
  executeUltimate(target, projectileSystem) {
    if (this.isDead || !this.body) return;

    this.ultimateCooldown = this.maxUltimateCooldown;
    soundSystem.playUltimate();

    const type = this.typeConfig.id;
    const myPos = this.body.translation();
    const targetPos = target && target.body ? target.body.translation() : null;
    const teamColor = this.teamId === 'blue' ? 0x60a5fa : 0xf87171;

    const forwardDir = new THREE.Vector3(
      targetPos ? targetPos.x - myPos.x : 1,
      0,
      targetPos ? targetPos.z - myPos.z : 0
    ).normalize();

    // ═══ Berserker Ultimate: Blood Whirlwind ═══
    if (type === 'berserker') {
      if (this.vfxManager) this.vfxManager.spawnWhirlwindArc(myPos, 0xef4444);
      if (target) {
        target.takeDamage(this.typeConfig.damage * 2.8, myPos, 700, this);
        target.triggerKnockdown(2.5);
      }

    // ═══ Samurai Ultimate: Iaido Flash Strike ═══
    } else if (type === 'samurai') {
      if (this.vfxManager) this.vfxManager.spawnIaidoSlash(myPos, forwardDir, teamColor);
      // Flash dash forward
      if (this.body) {
        this.body.applyImpulse({ x: forwardDir.x * 250, y: 15, z: forwardDir.z * 250 }, true);
      }
      if (target) {
        target.takeDamage(this.typeConfig.damage * 3.2, myPos, 600, this);
        target.triggerKnockdown(2.0);
      }

    // ═══ Monk Ultimate: Dragon Palm Chi Burst ═══
    } else if (type === 'monk') {
      if (this.vfxManager) this.vfxManager.spawnChiBurst(myPos, forwardDir);
      if (target) {
        target.takeDamage(this.typeConfig.damage * 3.0, myPos, 1200, this);
        target.triggerKnockdown(3.0);
      }

    // ═══ Assassin Ultimate: Shadow Blink Backstab ═══
    } else if (type === 'assassin') {
      if (targetPos && this.body) {
        // Teleport behind target!
        const backX = targetPos.x - forwardDir.x * 1.5;
        const backZ = targetPos.z - forwardDir.z * 1.5;
        this.body.setTranslation({ x: backX, y: targetPos.y + 0.5, z: backZ }, true);
        if (this.vfxManager) {
          this.vfxManager.spawnHitSparks(new THREE.Vector3(backX, targetPos.y + 1.0, backZ), 0x10b981, 20);
        }
      }
      if (target) {
        target.takeDamage(this.typeConfig.damage * 3.5, myPos, 500, this);
        target.triggerKnockdown(1.8);
      }

    // ═══ Paladin Ultimate: Heavenly Smite ═══
    } else if (type === 'paladin') {
      const strikePos = targetPos || myPos;
      if (this.vfxManager) this.vfxManager.spawnHolySmite(strikePos);
      if (target) {
        target.takeDamage(this.typeConfig.damage * 3.2, strikePos, 900, this);
        target.triggerKnockdown(2.8);
      }

    // ═══ Necromancer Ultimate: Soul Harvest ═══
    } else if (type === 'necromancer') {
      if (this.vfxManager) this.vfxManager.spawnSoulHarvest(myPos, 5.0);
      if (target) {
        const ultDmg = this.typeConfig.damage * 2.8;
        target.takeDamage(ultDmg, myPos, 500, this);
        this.heal(ultDmg * 0.7); // Massive soul heal
      }

    // ═══ Frost Witch Ultimate: Glacial Spikes Blizzard ═══
    } else if (type === 'frost_witch') {
      const strikePos = targetPos || myPos;
      if (this.vfxManager) this.vfxManager.spawnGlacialSpikes(strikePos, 4.5);
      if (target) {
        target.takeDamage(this.typeConfig.damage * 2.6, strikePos, 600, this);
        target.triggerKnockdown(3.0); // Frozen solid
      }

    // ═══ Dragon Knight Ultimate: Dragon Flame Breath ═══
    } else if (type === 'dragon_knight') {
      if (this.vfxManager) this.vfxManager.spawnFireBreath(myPos, forwardDir);
      if (target) {
        target.takeDamage(this.typeConfig.damage * 3.0, myPos, 700, this);
        target.triggerKnockdown(2.0);
      }

    // ═══ Golem Ultimate: Seismic Boulder Hurl ═══
    } else if (type === 'golem') {
      if (targetPos && projectileSystem) {
        projectileSystem.spawnCatapultBoulder(
          { x: myPos.x, y: myPos.y + 2.0, z: myPos.z },
          targetPos,
          this.typeConfig.damage * 2.5,
          6.0,
          this.teamId
        );
      }

    // ═══ Swordsman Ultimate: Blade Tempest ═══
    } else if (type === 'swordsman') {
      if (this.vfxManager) {
        this.vfxManager.spawnSlashArc(myPos, forwardDir, teamColor, 2.6);
      }
      if (target) {
        target.takeDamage(this.typeConfig.damage * 2.6, myPos, 650, this);
        target.triggerKnockdown(2.2);
      }

    // ═══ Spearman Ultimate: Gungnir Piercing Blitz ═══
    } else if (type === 'spearman') {
      if (this.vfxManager && targetPos) {
        this.vfxManager.spawnPiercingStreak(myPos, targetPos, teamColor);
      }
      if (target) {
        target.takeDamage(this.typeConfig.damage * 2.8, myPos, 800, this);
        target.triggerKnockdown(2.4);
      }

    // ═══ Archer Ultimate: Hail of Arrows ═══
    } else if (type === 'archer') {
      if (targetPos && projectileSystem) {
        for (let i = 0; i < 5; i++) {
          const spreadPos = {
            x: targetPos.x + (Math.random() - 0.5) * 4.0,
            y: targetPos.y,
            z: targetPos.z + (Math.random() - 0.5) * 4.0
          };
          projectileSystem.spawnArrow(
            { x: myPos.x, y: myPos.y + 1.5, z: myPos.z },
            spreadPos,
            this.typeConfig.damage * 0.9,
            this.teamId
          );
        }
      }

    // ═══ Mage Ultimate: Meteor Cataclysm ═══
    } else if (type === 'mage') {
      if (targetPos && projectileSystem) {
        projectileSystem.spawnFireball(
          { x: myPos.x, y: myPos.y + 2.0, z: myPos.z },
          targetPos,
          this.typeConfig.damage * 2.2,
          7.0,
          this.teamId
        );
      }

    // ═══ Shield Bearer Ultimate: Aegis Fortress Shockwave ═══
    } else if (type === 'shield_bearer') {
      if (this.vfxManager) {
        this.vfxManager.spawnShieldPulse(myPos, teamColor);
        setTimeout(() => {
          if (this.vfxManager) this.vfxManager.spawnShieldPulse(myPos, 0xfacc15);
        }, 150);
      }
      if (target) {
        target.takeDamage(this.typeConfig.damage * 2.5, myPos, 900, this);
        target.triggerKnockdown(2.6);
      }

    // ═══ Cavalry Ultimate: Valkyrie Trample Charge ═══
    } else if (type === 'cavalry') {
      if (this.body) {
        this.body.applyImpulse({ x: forwardDir.x * 2500, y: 30, z: forwardDir.z * 2500 }, true);
      }
      if (target) {
        target.takeDamage(this.typeConfig.damage * 2.5, myPos, 2200, this);
        target.triggerKnockdown(3.5);
      }

    // ═══ Giant Ultimate: Colossal Earth Shatter ═══
    } else if (type === 'giant') {
      if (this.vfxManager && targetPos) {
        this.vfxManager.spawnSeismicStomp(new THREE.Vector3(targetPos.x, 0.05, targetPos.z), 7.0);
      }
      if (target) {
        target.takeDamage(this.typeConfig.damage * 2.2, myPos, 2500, this);
        target.triggerKnockdown(4.0);
      }

    // ═══ Battering Ram Ultimate: Colossal Siege Breaker ═══
    } else if (type === 'battering_ram') {
      soundSystem.playHeavyWoodBreak?.();
      if (this.body) {
        this.body.applyImpulse({ x: forwardDir.x * 3200, y: 40, z: forwardDir.z * 3200 }, true);
      }
      if (this.vfxManager) {
        this.vfxManager.spawnExplosionWave?.(new THREE.Vector3(myPos.x, myPos.y + 0.5, myPos.z), 0x78350f, 6.0);
      }
      if (target && target.takeDamage) {
        const mult = (target.typeConfig && target.typeConfig.maxHealth) ? 6.0 : 2.5;
        target.takeDamage(this.typeConfig.damage * mult, myPos, 3500, this);
        if (target.triggerKnockdown) target.triggerKnockdown(4.0);
      }

    // ═══ Zeus Ultimate: Wrath of Olympus ═══
    } else if (type === 'zeus') {
      soundSystem.playDivineThunder();
      const center = targetPos ? new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z) : new THREE.Vector3(myPos.x + forwardDir.x * 6, myPos.y, myPos.z + forwardDir.z * 6);
      
      // Cascading celestial thunderbolts in cluster
      for (let i = 0; i < 4; i++) {
        setTimeout(() => {
          if (this.vfxManager) {
            const offset = new THREE.Vector3(
              (Math.random() - 0.5) * 6,
              0,
              (Math.random() - 0.5) * 6
            );
            this.vfxManager.spawnDivineLightningStrike(
              new THREE.Vector3(center.x + offset.x, center.y, center.z + offset.z),
              0x38bdf8,
              true
            );
          }
        }, i * 140);
      }

      if (target && target.takeDamage) {
        target.takeDamage(this.typeConfig.damage * 3.8, center, 1400, this);
        if (target.triggerKnockdown) target.triggerKnockdown(3.5);
      }

    // ═══ Ares Ultimate: Blood God's Rampage ═══
    } else if (type === 'ares') {
      soundSystem.playWarGodRoar();
      // Colossal forward leap & earth rupture
      if (this.body) {
        this.body.applyImpulse({ x: forwardDir.x * 3200, y: 380, z: forwardDir.z * 3200 }, true);
      }
      if (this.vfxManager) {
        this.vfxManager.spawnBloodGodFissure(new THREE.Vector3(myPos.x, myPos.y, myPos.z), forwardDir, 18.0);
      }
      if (target && target.takeDamage) {
        target.takeDamage(this.typeConfig.damage * 4.2, myPos, 2600, this);
        if (target.triggerKnockdown) target.triggerKnockdown(4.0);
      }

    // ═══ Hades Ultimate: Underworld Soul Eruption ═══
    } else if (type === 'hades') {
      soundSystem.playSoulSiphon();
      const vortexPos = targetPos ? new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z) : new THREE.Vector3(myPos.x, myPos.y, myPos.z);
      if (this.vfxManager) {
        this.vfxManager.spawnSoulTormentVortex(vortexPos, 9.0);
      }
      if (target && target.takeDamage) {
        const ultDmg = this.typeConfig.damage * 3.5;
        target.takeDamage(ultDmg, vortexPos, 800, this);
        this.heal(ultDmg * 0.55); // Massive soul harvest heal
        if (target.triggerKnockdown) target.triggerKnockdown(3.2);
      }

    // ═══ Poseidon Ultimate: Abyssal Tsunami & Earthshaker ═══
    } else if (type === 'poseidon') {
      soundSystem.playTidalCrash();
      if (this.vfxManager) {
        this.vfxManager.spawnAbyssalTsunamiGeysers(new THREE.Vector3(myPos.x, myPos.y, myPos.z), forwardDir, 22.0);
      }
      if (target && target.takeDamage) {
        target.takeDamage(this.typeConfig.damage * 3.6, myPos, 2200, this);
        if (target.triggerKnockdown) target.triggerKnockdown(3.5);
        if (target.body) {
          // Launch target skyward
          target.body.applyImpulse({ x: forwardDir.x * 600, y: 1800, z: forwardDir.z * 600 }, true);
        }
      }

    // ═══ Default Fallback Ultimate ═══
    } else {
      if (this.vfxManager) this.vfxManager.spawnSlashArc(myPos, forwardDir, teamColor, 2.5);
      if (target) {
        target.takeDamage(this.typeConfig.damage * 2.5, myPos, 600, this);
        target.triggerKnockdown(2.0);
      }
    }
  }

  takeDamage(amount, attackerPos, impactForce = 200, attackerUnit = null) {
    if (this.isDead) return;

    // Iron Armor 25% damage reduction
    let actualDamage = amount;
    if (this.traitId === 'iron') {
      actualDamage *= 0.75;
    }

    // Bosses have heavy poise & knockback dampening
    if (this.typeConfig && this.typeConfig.isBoss) {
      impactForce *= 0.15;
    }

    this.health -= actualDamage;

    // Boss Enraged Phase Trigger (<35% HP)
    if (this.typeConfig && this.typeConfig.isBoss && !this.isEnraged && this.health > 0 && this.health <= this.maxHealth * 0.35) {
      this.isEnraged = true;
      this.typeConfig.moveSpeed = (this.typeConfig.moveSpeed || 3.5) * 1.35;
      this.typeConfig.damage = Math.round((this.typeConfig.damage || 130) * 1.35);
      soundSystem.playBossEnrage();
      if (this.vfxManager && this.body) {
        const p = this.body.translation();
        this.vfxManager.spawnFloatingDamageText(
          new THREE.Vector3(p.x, p.y + 3.2, p.z),
          "⚡ ENRAGED! ⚡",
          true
        );
        if (this.vfxManager.spawnComboFinisherVFX) {
          this.vfxManager.spawnComboFinisherVFX(new THREE.Vector3(p.x, p.y + 1.8, p.z), 0xff2200, 4);
        }
      }
    }

    // Vampiric Lifesteal to attacker
    if (attackerUnit && attackerUnit.traitId === 'vampire' && !attackerUnit.isDead) {
      attackerUnit.heal(actualDamage * 0.35);
    }

    if (this.vfxManager && this.body) {
      const pos = this.body.translation();
      this.vfxManager.spawnFloatingDamageText(
        new THREE.Vector3(pos.x, pos.y, pos.z),
        actualDamage,
        actualDamage > 60
      );
    }

    // Trigger 3D Blood Spurt
    if (this.bloodGoreSystem && this.body) {
      const pos = this.body.translation();
      const impactDir = attackerPos ? { x: pos.x - attackerPos.x, z: pos.z - attackerPos.z } : null;
      this.bloodGoreSystem.spawnBloodSpurt(pos, impactDir, actualDamage);
    }

    // Apply Physical Impact Impulse from Blow
    if (attackerPos && this.body) {
      const pos = this.body.translation();
      const dx = pos.x - attackerPos.x;
      const dz = pos.z - attackerPos.z;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      
      const impulseX = (dx / len) * impactForce;
      const impulseZ = (dz / len) * impactForce;
      const impulseY = impactForce * 0.4;

      this.body.applyImpulse({ x: impulseX, y: impulseY, z: impulseZ }, true);
    }

    if (this.health <= 0) {
      if (this.bloodGoreSystem && (actualDamage > 75 || impactForce > 600)) {
        this.bloodGoreSystem.dismemberUnit(this, attackerPos);
      }
      this.die();
    }
  }

  heal(amount) {
    if (this.isDead) return;
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  triggerKnockdown(duration = 1.5) {
    if (this.isDead) return;
    if (this.typeConfig && this.typeConfig.isBoss) return; // Bosses are immune to knockdown!
    this.isKnockedDown = true;
    this.knockdownTimer = duration;
    this.body.setEnabledRotations(true, true, true, true);
  }

  die() {
    this.isDead = true;
    this.health = 0;
    soundSystem.playRagdollSqueak();

    // FULL RAGDOLL TRANSITION (Motors off, unlock all axes)
    this.body.setEnabledRotations(true, true, true, true);
    this.body.setLinearDamping(0.3);
    this.body.setAngularDamping(0.3);

    // Flop head & arms
    if (this.headMesh) this.headMesh.position.z = 0.1;
    if (this.leftArm) this.leftArm.rotation.z = Math.PI / 2;
    if (this.rightArm) this.rightArm.rotation.z = -Math.PI / 2;
  }

  updateMeshFromPhysics() {
    if (!this.body || !this.bodyGroup) return;
    const pos = this.body.translation();
    const rot = this.body.rotation();

    this.bodyGroup.position.set(pos.x, pos.y, pos.z);
    this.bodyGroup.quaternion.set(rot.x, rot.y, rot.z, rot.w);
  }

  destroy() {
    if (this.bodyGroup && this.scene) {
      this.scene.remove(this.bodyGroup);
    }
    if (this.body && this.world) {
      this.world.removeRigidBody(this.body);
    }
    this.body = null;
    this.collider = null;
  }
}
