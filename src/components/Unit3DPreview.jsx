import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ActiveRagdollUnit } from '../sandbox/ActiveRagdollUnit';
import { TEAMS } from '../sandbox/UnitConfig';

export const Unit3DPreview = ({ unitTypeId, teamId, traitId = 'none' }) => {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 240;
    const height = container.clientHeight || 180;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0.4, 3.6);
    camera.lookAt(0, 0.2, 0);

    // 2. WebGL Renderer with transparency
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // 3. Studio Lighting
    const ambLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambLight);

    const keyLight = new THREE.DirectionalLight(0xfff3db, 2.0);
    keyLight.position.set(2, 3, 3);
    scene.add(keyLight);

    const teamHex = teamId === 'blue' ? 0x3b82f6 : 0xef4444;
    const rimLight = new THREE.DirectionalLight(teamHex, 2.2);
    rimLight.position.set(-2.5, 2, -2);
    scene.add(rimLight);

    // 4. Glowing Pedestal Ring under unit
    const pedestalGroup = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(0.7, 0.85, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: teamHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = -0.98;
    pedestalGroup.add(ringMesh);

    const innerDiscGeo = new THREE.CircleGeometry(0.7, 32);
    const innerDiscMat = new THREE.MeshBasicMaterial({
      color: 0x06050a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6
    });
    const innerDisc = new THREE.Mesh(innerDiscGeo, innerDiscMat);
    innerDisc.rotation.x = -Math.PI / 2;
    innerDisc.position.y = -0.985;
    pedestalGroup.add(innerDisc);
    scene.add(pedestalGroup);

    // 5. Instantiate Visual Unit Mesh via ActiveRagdollUnit
    let previewUnit = null;
    try {
      previewUnit = new ActiveRagdollUnit(
        scene,
        null,
        unitTypeId,
        teamId,
        new THREE.Vector3(0, -0.95, 0),
        null,
        traitId
      );
    } catch (err) {
      console.warn('Preview unit mesh generation warning:', err);
    }

    // 6. Manual Drag Rotation & Automatic Idle Turntable
    let isDragging = false;
    let prevX = 0;
    let rotationVelocity = 0;

    const onPointerDown = (e) => {
      isDragging = true;
      prevX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      rotationVelocity = 0;
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      const deltaX = clientX - prevX;
      if (previewUnit && previewUnit.bodyGroup) {
        previewUnit.bodyGroup.rotation.y += deltaX * 0.02;
        rotationVelocity = deltaX * 0.02;
      }
      prevX = clientX;
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    const canvas = renderer.domElement;
    canvas.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    canvas.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    // 7. Animation Loop
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (previewUnit && previewUnit.bodyGroup) {
        if (!isDragging) {
          // Slow constant turntable spin
          previewUnit.bodyGroup.rotation.y += 0.012;
        }
      }

      pedestalGroup.rotation.y += 0.005;
      renderer.render(scene, camera);
    };
    animate();

    // 8. Handle Resizing
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 240;
      const h = container.clientHeight || 180;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 9. Cleanup
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      canvas.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);

      if (container.contains(canvas)) {
        container.removeChild(canvas);
      }
      renderer.dispose();
    };
  }, [unitTypeId, teamId, traitId]);

  return (
    <div
      ref={mountRef}
      className="w-full h-44 sm:h-48 relative flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
      title="Click and drag to spin 3D preview"
    >
      <div className="absolute bottom-1 right-2 pointer-events-none text-[8px] font-mono text-parchment-500 uppercase tracking-widest bg-obsidian-950/60 px-1.5 py-0.5 rounded">
        Drag to 360° spin
      </div>
    </div>
  );
};
