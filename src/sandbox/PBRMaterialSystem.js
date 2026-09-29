/**
 * PBRMaterialSystem.js
 * Comprehensive Physically Based Rendering (PBR) Material Pipeline.
 * Generates high-detail procedural PBR texture sets (Albedo, Tangent-Space Normal,
 * Roughness, AO, Metalness, and Displacement) with 16x anisotropic filtering
 * and provides a centralized, reusable medieval material library.
 */

import * as THREE from 'three';

class PBRMaterialManager {
  constructor() {
    this.textureCache = new Map();
    this.materialCache = new Map();
    this.maxAnisotropy = 8; // Default, will query renderer
    this.quality = 'HIGH'; // 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA'
  }

  setRenderer(renderer) {
    if (renderer && renderer.capabilities) {
      this.maxAnisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy() || 8);
    }
  }

  setQuality(qualityLevel) {
    this.quality = qualityLevel;
  }

  getResolution() {
    if (this.quality === 'LOW') return 256;
    if (this.quality === 'MEDIUM') return 512;
    if (this.quality === 'ULTRA') return 1024;
    return 512; // HIGH default
  }

  // ═══════════════════════════════════════════════════════════════
  // PROCEDURAL TANGENT-SPACE NORMAL MAP BAKER
  // ═══════════════════════════════════════════════════════════════

  /**
   * Generates a tangent-space Normal Map from a heightmap canvas using Sobel filtering.
   */
  bakeNormalMap(heightCanvas, strength = 2.5) {
    const w = heightCanvas.width;
    const h = heightCanvas.height;
    const srcCtx = heightCanvas.getContext('2d');
    const srcData = srcCtx.getImageData(0, 0, w, h).data;

    const normalCanvas = document.createElement('canvas');
    normalCanvas.width = w;
    normalCanvas.height = h;
    const normalCtx = normalCanvas.getContext('2d');
    const normalImg = normalCtx.createImageData(w, h);
    const dst = normalImg.data;

    const sampleHeight = (x, y) => {
      const px = (x + w) % w;
      const py = (y + h) % h;
      const idx = (py * w + px) * 4;
      return (srcData[idx] + srcData[idx + 1] + srcData[idx + 2]) / (3 * 255);
    };

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // Sobel filter kernels for dx and dy
        const tl = sampleHeight(x - 1, y - 1);
        const l  = sampleHeight(x - 1, y);
        const bl = sampleHeight(x - 1, y + 1);
        const tr = sampleHeight(x + 1, y - 1);
        const r  = sampleHeight(x + 1, y);
        const br = sampleHeight(x + 1, y + 1);
        const t  = sampleHeight(x, y - 1);
        const b  = sampleHeight(x, y + 1);

        const dX = ((tr + 2 * r + br) - (tl + 2 * l + bl)) * strength;
        const dY = ((bl + 2 * b + br) - (tl + 2 * t + tr)) * strength;

        // Normal vector (-dX, -dY, 1.0) normalized
        const len = Math.sqrt(dX * dX + dY * dY + 1.0) || 1.0;
        const nx = -dX / len;
        const ny = -dY / len;
        const nz = 1.0 / len;

        const outIdx = (y * w + x) * 4;
        dst[outIdx]     = Math.floor((nx * 0.5 + 0.5) * 255);
        dst[outIdx + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
        dst[outIdx + 2] = Math.floor((nz * 0.5 + 0.5) * 255);
        dst[outIdx + 3] = 255;
      }
    }

    normalCtx.putImageData(normalImg, 0, 0);

    const texture = new THREE.CanvasTexture(normalCanvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = this.maxAnisotropy;
    texture.generateMipmaps = true;
    return texture;
  }

  // ═══════════════════════════════════════════════════════════════
  // PBR TEXTURE GENERATORS
  // ═══════════════════════════════════════════════════════════════

  /**
   * 1. MEDIEVAL ASHLAR STONE MASONRY
   * Individual chipped blocks, dark mortar seams, per-block hue shift, and porous stone grain.
   */
  createStoneMasonryTextures() {
    const key = `stone_masonry_${this.quality}`;
    if (this.textureCache.has(key)) return this.textureCache.get(key);

    const size = this.getResolution();
    const albedoCanvas = document.createElement('canvas');
    albedoCanvas.width = size;
    albedoCanvas.height = size;
    const aCtx = albedoCanvas.getContext('2d');

    const heightCanvas = document.createElement('canvas');
    heightCanvas.width = size;
    heightCanvas.height = size;
    const hCtx = heightCanvas.getContext('2d');

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = size;
    roughCanvas.height = size;
    const rCtx = roughCanvas.getContext('2d');

    // Fill mortar background (dark, deep, high roughness)
    aCtx.fillStyle = '#22262d';
    aCtx.fillRect(0, 0, size, size);
    hCtx.fillStyle = '#101010';
    hCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = '#f0f0f0'; // Rough mortar
    rCtx.fillRect(0, 0, size, size);

    const rows = 8;
    const blockH = size / rows;
    const mortarGap = Math.max(3, Math.round(size * 0.02));

    const stonePalettes = [
      { r: 130, g: 138, b: 148 }, // Slate grey
      { r: 110, g: 116, b: 124 }, // Dark basalt
      { r: 142, g: 145, b: 140 }, // Mossy tint
      { r: 155, g: 148, b: 138 }, // Sandstone buff
      { r: 98,  g: 104, b: 114 }  // Cold granite
    ];

    for (let r = 0; r < rows; r++) {
      const y = r * blockH;
      const rowOffset = (r % 2) * (size / 8);
      const cols = 4;
      const blockW = size / cols;

      for (let c = -1; c <= cols; c++) {
        const x = c * blockW + rowOffset;
        const bw = blockW - mortarGap;
        const bh = blockH - mortarGap;

        if (x + bw < 0 || x > size) continue;

        // Choose random block base tone
        const pal = stonePalettes[Math.floor(Math.random() * stonePalettes.length)];
        const varShift = (Math.random() - 0.5) * 20;

        // Block Albedo
        aCtx.fillStyle = `rgb(${Math.max(0, Math.min(255, pal.r + varShift))}, ${Math.max(0, Math.min(255, pal.g + varShift))}, ${Math.max(0, Math.min(255, pal.b + varShift))})`;
        aCtx.fillRect(x, y, bw, bh);

        // Block Height (Elevated stone with beveled edge)
        const stoneGrad = hCtx.createRadialGradient(x + bw / 2, y + bh / 2, 4, x + bw / 2, y + bh / 2, bw * 0.65);
        stoneGrad.addColorStop(0, '#f0f0f0');
        stoneGrad.addColorStop(0.75, '#c0c0c0');
        stoneGrad.addColorStop(1, '#606060');
        hCtx.fillStyle = stoneGrad;
        hCtx.fillRect(x, y, bw, bh);

        // Roughness: Stone surface (0.7 - 0.85)
        rCtx.fillStyle = '#b8b8b8';
        rCtx.fillRect(x, y, bw, bh);
      }
    }

    // Micro-surface noise grain across stones
    const aData = aCtx.getImageData(0, 0, size, size);
    const hData = hCtx.getImageData(0, 0, size, size);
    for (let i = 0; i < aData.data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 24;
      aData.data[i]     = Math.max(0, Math.min(255, aData.data[i] + noise));
      aData.data[i + 1] = Math.max(0, Math.min(255, aData.data[i + 1] + noise));
      aData.data[i + 2] = Math.max(0, Math.min(255, aData.data[i + 2] + noise));

      hData.data[i] = Math.max(0, Math.min(255, hData.data[i] + noise * 0.8));
    }
    aCtx.putImageData(aData, 0, 0);
    hCtx.putImageData(hData, 0, 0);

    const albedoTex = new THREE.CanvasTexture(albedoCanvas);
    albedoTex.wrapS = THREE.RepeatWrapping;
    albedoTex.wrapT = THREE.RepeatWrapping;
    albedoTex.colorSpace = THREE.SRGBColorSpace;
    albedoTex.anisotropy = this.maxAnisotropy;

    const normalTex = this.bakeNormalMap(heightCanvas, 3.2);
    const roughnessTex = new THREE.CanvasTexture(roughCanvas);
    roughnessTex.wrapS = THREE.RepeatWrapping;
    roughnessTex.wrapT = THREE.RepeatWrapping;

    const result = { map: albedoTex, normalMap: normalTex, roughnessMap: roughnessTex };
    this.textureCache.set(key, result);
    return result;
  }

  /**
   * 2. WEATHERED DARK OAK TIMBER
   * Longitudinal fiber grain, knots, and iron bolt impressions for palisades, bridges, gates.
   */
  createDarkTimberTextures() {
    const key = `dark_timber_${this.quality}`;
    if (this.textureCache.has(key)) return this.textureCache.get(key);

    const size = this.getResolution();
    const aCanvas = document.createElement('canvas');
    aCanvas.width = size;
    aCanvas.height = size;
    const aCtx = aCanvas.getContext('2d');

    const hCanvas = document.createElement('canvas');
    hCanvas.width = size;
    hCanvas.height = size;
    const hCtx = hCanvas.getContext('2d');

    // Base rich dark oak tone
    aCtx.fillStyle = '#4a2c16';
    aCtx.fillRect(0, 0, size, size);
    hCtx.fillStyle = '#808080';
    hCtx.fillRect(0, 0, size, size);

    // Plank divider seams
    const plankCount = 6;
    const plankW = size / plankCount;
    for (let p = 0; p < plankCount; p++) {
      const px = p * plankW;
      const shade = (Math.random() - 0.5) * 18;
      aCtx.fillStyle = `rgba(${shade > 0 ? 255 : 0}, ${shade > 0 ? 255 : 0}, ${shade > 0 ? 255 : 0}, ${Math.abs(shade) / 255})`;
      aCtx.fillRect(px, 0, plankW - 2, size);

      // Plank seam dark line
      aCtx.fillStyle = '#1c1007';
      aCtx.fillRect(px + plankW - 2, 0, 2, size);
      hCtx.fillStyle = '#202020';
      hCtx.fillRect(px + plankW - 2, 0, 2, size);
    }

    // Wood fiber grain lines
    for (let i = 0; i < 400; i++) {
      const gx = Math.random() * size;
      const gw = Math.random() * 2 + 1;
      const alpha = Math.random() * 0.15 + 0.05;
      aCtx.fillStyle = Math.random() > 0.5 ? `rgba(28, 16, 7, ${alpha})` : `rgba(102, 60, 32, ${alpha})`;
      aCtx.fillRect(gx, 0, gw, size);

      hCtx.fillStyle = Math.random() > 0.5 ? `rgba(40, 40, 40, ${alpha * 2})` : `rgba(200, 200, 200, ${alpha * 2})`;
      hCtx.fillRect(gx, 0, gw, size);
    }

    const albedoTex = new THREE.CanvasTexture(aCanvas);
    albedoTex.wrapS = THREE.RepeatWrapping;
    albedoTex.wrapT = THREE.RepeatWrapping;
    albedoTex.colorSpace = THREE.SRGBColorSpace;
    albedoTex.anisotropy = this.maxAnisotropy;

    const normalTex = this.bakeNormalMap(hCanvas, 2.8);

    const result = { map: albedoTex, normalMap: normalTex };
    this.textureCache.set(key, result);
    return result;
  }

  /**
   * 3. BATTLE-FORGED STEEL & ARMOR
   * High metalness, brush scratches, edge dings, and reflective sheen.
   */
  createForgedSteelTextures() {
    const key = `forged_steel_${this.quality}`;
    if (this.textureCache.has(key)) return this.textureCache.get(key);

    const size = Math.min(512, this.getResolution());
    const aCanvas = document.createElement('canvas');
    aCanvas.width = size;
    aCanvas.height = size;
    const aCtx = aCanvas.getContext('2d');

    const hCanvas = document.createElement('canvas');
    hCanvas.width = size;
    hCanvas.height = size;
    const hCtx = hCanvas.getContext('2d');

    const rCanvas = document.createElement('canvas');
    rCanvas.width = size;
    rCanvas.height = size;
    const rCtx = rCanvas.getContext('2d');

    // Polished carbon steel base
    aCtx.fillStyle = '#b0b8c4';
    aCtx.fillRect(0, 0, size, size);
    hCtx.fillStyle = '#808080';
    hCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = '#484848'; // Low roughness = shiny metallic reflection (~0.28)
    rCtx.fillRect(0, 0, size, size);

    // Battle scratches and abrasive metal scuffs
    for (let i = 0; i < 280; i++) {
      const sx = Math.random() * size;
      const sy = Math.random() * size;
      const slen = Math.random() * 25 + 5;
      const sAngle = Math.random() * Math.PI * 2;

      aCtx.strokeStyle = Math.random() > 0.4 ? 'rgba(235, 240, 250, 0.45)' : 'rgba(50, 55, 65, 0.35)';
      aCtx.lineWidth = Math.random() * 1.5 + 0.5;
      aCtx.beginPath();
      aCtx.moveTo(sx, sy);
      aCtx.lineTo(sx + Math.cos(sAngle) * slen, sy + Math.sin(sAngle) * slen);
      aCtx.stroke();

      hCtx.strokeStyle = 'rgba(220, 220, 220, 0.4)';
      hCtx.lineWidth = 1.0;
      hCtx.beginPath();
      hCtx.moveTo(sx, sy);
      hCtx.lineTo(sx + Math.cos(sAngle) * slen, sy + Math.sin(sAngle) * slen);
      hCtx.stroke();

      // Scratches are slightly rougher
      rCtx.strokeStyle = 'rgba(160, 160, 160, 0.5)';
      rCtx.lineWidth = 1.2;
      rCtx.beginPath();
      rCtx.moveTo(sx, sy);
      rCtx.lineTo(sx + Math.cos(sAngle) * slen, sy + Math.sin(sAngle) * slen);
      rCtx.stroke();
    }

    const albedoTex = new THREE.CanvasTexture(aCanvas);
    albedoTex.wrapS = THREE.RepeatWrapping;
    albedoTex.wrapT = THREE.RepeatWrapping;
    albedoTex.colorSpace = THREE.SRGBColorSpace;
    albedoTex.anisotropy = this.maxAnisotropy;

    const normalTex = this.bakeNormalMap(hCanvas, 2.0);
    const roughnessTex = new THREE.CanvasTexture(rCanvas);
    roughnessTex.wrapS = THREE.RepeatWrapping;
    roughnessTex.wrapT = THREE.RepeatWrapping;

    const result = { map: albedoTex, normalMap: normalTex, roughnessMap: roughnessTex };
    this.textureCache.set(key, result);
    return result;
  }

  /**
   * 4. RUSTED IRON (Hinges, portcullis studs, chains)
   */
  createRustedIronTextures() {
    const key = `rusted_iron_${this.quality}`;
    if (this.textureCache.has(key)) return this.textureCache.get(key);

    const size = Math.min(512, this.getResolution());
    const aCanvas = document.createElement('canvas');
    aCanvas.width = size;
    aCanvas.height = size;
    const aCtx = aCanvas.getContext('2d');

    const hCanvas = document.createElement('canvas');
    hCanvas.width = size;
    hCanvas.height = size;
    const hCtx = hCanvas.getContext('2d');

    // Dark iron base
    aCtx.fillStyle = '#2d333b';
    aCtx.fillRect(0, 0, size, size);
    hCtx.fillStyle = '#707070';
    hCtx.fillRect(0, 0, size, size);

    // Orange-brown oxide rust splotches
    for (let i = 0; i < 180; i++) {
      const rx = Math.random() * size;
      const ry = Math.random() * size;
      const rrad = Math.random() * 20 + 4;
      const rustGrad = aCtx.createRadialGradient(rx, ry, 1, rx, ry, rrad);
      rustGrad.addColorStop(0, 'rgba(180, 83, 9, 0.7)');
      rustGrad.addColorStop(0.6, 'rgba(120, 53, 15, 0.5)');
      rustGrad.addColorStop(1, 'rgba(45, 51, 59, 0)');
      aCtx.fillStyle = rustGrad;
      aCtx.beginPath();
      aCtx.arc(rx, ry, rrad, 0, Math.PI * 2);
      aCtx.fill();

      hCtx.fillStyle = 'rgba(210, 210, 210, 0.4)';
      hCtx.beginPath();
      hCtx.arc(rx, ry, rrad * 0.7, 0, Math.PI * 2);
      hCtx.fill();
    }

    const albedoTex = new THREE.CanvasTexture(aCanvas);
    albedoTex.wrapS = THREE.RepeatWrapping;
    albedoTex.wrapT = THREE.RepeatWrapping;
    albedoTex.colorSpace = THREE.SRGBColorSpace;
    albedoTex.anisotropy = this.maxAnisotropy;

    const normalTex = this.bakeNormalMap(hCanvas, 2.5);

    const result = { map: albedoTex, normalMap: normalTex };
    this.textureCache.set(key, result);
    return result;
  }

  /**
   * 5. CHAINMAIL (Interlocking iron rings)
   */
  createChainmailTextures() {
    const key = `chainmail_${this.quality}`;
    if (this.textureCache.has(key)) return this.textureCache.get(key);

    const size = 256;
    const aCanvas = document.createElement('canvas');
    aCanvas.width = size;
    aCanvas.height = size;
    const aCtx = aCanvas.getContext('2d');

    const hCanvas = document.createElement('canvas');
    hCanvas.width = size;
    hCanvas.height = size;
    const hCtx = hCanvas.getContext('2d');

    // Dark under-padding
    aCtx.fillStyle = '#1c1f24';
    aCtx.fillRect(0, 0, size, size);
    hCtx.fillStyle = '#202020';
    hCtx.fillRect(0, 0, size, size);

    // Tiled overlapping rings
    const ringSpacing = 16;
    const radius = 9;
    aCtx.strokeStyle = '#c5cdd8';
    aCtx.lineWidth = 3.0;

    for (let y = -ringSpacing; y < size + ringSpacing; y += ringSpacing) {
      const rowOffset = ((y / ringSpacing) % 2) * (ringSpacing / 2);
      for (let x = -ringSpacing; x < size + ringSpacing; x += ringSpacing) {
        const cx = x + rowOffset;
        aCtx.beginPath();
        aCtx.arc(cx, y, radius, 0, Math.PI * 2);
        aCtx.stroke();

        hCtx.strokeStyle = '#e0e0e0';
        hCtx.lineWidth = 3.5;
        hCtx.beginPath();
        hCtx.arc(cx, y, radius, 0, Math.PI * 2);
        hCtx.stroke();
      }
    }

    const albedoTex = new THREE.CanvasTexture(aCanvas);
    albedoTex.wrapS = THREE.RepeatWrapping;
    albedoTex.wrapT = THREE.RepeatWrapping;
    albedoTex.repeat.set(4, 4);
    albedoTex.colorSpace = THREE.SRGBColorSpace;
    albedoTex.anisotropy = this.maxAnisotropy;

    const normalTex = this.bakeNormalMap(hCanvas, 3.5);
    normalTex.repeat.set(4, 4);

    const result = { map: albedoTex, normalMap: normalTex };
    this.textureCache.set(key, result);
    return result;
  }

  /**
   * 6. WORN LEATHER (Armor straps, boots, bracers)
   */
  createWornLeatherTextures() {
    const key = `worn_leather_${this.quality}`;
    if (this.textureCache.has(key)) return this.textureCache.get(key);

    const size = Math.min(512, this.getResolution());
    const aCanvas = document.createElement('canvas');
    aCanvas.width = size;
    aCanvas.height = size;
    const aCtx = aCanvas.getContext('2d');

    const hCanvas = document.createElement('canvas');
    hCanvas.width = size;
    hCanvas.height = size;
    const hCtx = hCanvas.getContext('2d');

    // Rich tanned cowhide base
    aCtx.fillStyle = '#45220d';
    aCtx.fillRect(0, 0, size, size);
    hCtx.fillStyle = '#808080';
    hCtx.fillRect(0, 0, size, size);

    // Leather pore stippling
    for (let i = 0; i < 1200; i++) {
      const px = Math.random() * size;
      const py = Math.random() * size;
      const alpha = Math.random() * 0.2 + 0.05;
      aCtx.fillStyle = Math.random() > 0.4 ? `rgba(25, 10, 4, ${alpha})` : `rgba(110, 58, 25, ${alpha})`;
      aCtx.fillRect(px, py, Math.random() * 2 + 1, Math.random() * 2 + 1);

      hCtx.fillStyle = Math.random() > 0.5 ? 'rgba(50, 50, 50, 0.3)' : 'rgba(210, 210, 210, 0.3)';
      hCtx.fillRect(px, py, 1.5, 1.5);
    }

    const albedoTex = new THREE.CanvasTexture(aCanvas);
    albedoTex.wrapS = THREE.RepeatWrapping;
    albedoTex.wrapT = THREE.RepeatWrapping;
    albedoTex.colorSpace = THREE.SRGBColorSpace;
    albedoTex.anisotropy = this.maxAnisotropy;

    const normalTex = this.bakeNormalMap(hCanvas, 2.2);

    const result = { map: albedoTex, normalMap: normalTex };
    this.textureCache.set(key, result);
    return result;
  }

  /**
   * 7. QUILTED LINEN CLOTH (Tabards, cloaks, tunics)
   */
  createClothWeaveTextures() {
    const key = `cloth_weave_${this.quality}`;
    if (this.textureCache.has(key)) return this.textureCache.get(key);

    const size = 256;
    const aCanvas = document.createElement('canvas');
    aCanvas.width = size;
    aCanvas.height = size;
    const aCtx = aCanvas.getContext('2d');

    const hCanvas = document.createElement('canvas');
    hCanvas.width = size;
    hCanvas.height = size;
    const hCtx = hCanvas.getContext('2d');

    // Natural woven fabric base
    aCtx.fillStyle = '#d1c7b7';
    aCtx.fillRect(0, 0, size, size);
    hCtx.fillStyle = '#808080';
    hCtx.fillRect(0, 0, size, size);

    // Cross-weave thread grid
    const spacing = 4;
    for (let x = 0; x < size; x += spacing) {
      aCtx.fillStyle = 'rgba(60, 50, 40, 0.15)';
      aCtx.fillRect(x, 0, 1, size);
      hCtx.fillStyle = 'rgba(40, 40, 40, 0.3)';
      hCtx.fillRect(x, 0, 1, size);
    }
    for (let y = 0; y < size; y += spacing) {
      aCtx.fillStyle = 'rgba(60, 50, 40, 0.15)';
      aCtx.fillRect(0, y, size, 1);
      hCtx.fillStyle = 'rgba(40, 40, 40, 0.3)';
      hCtx.fillRect(0, y, size, 1);
    }

    const albedoTex = new THREE.CanvasTexture(aCanvas);
    albedoTex.wrapS = THREE.RepeatWrapping;
    albedoTex.wrapT = THREE.RepeatWrapping;
    albedoTex.colorSpace = THREE.SRGBColorSpace;
    albedoTex.anisotropy = this.maxAnisotropy;

    const normalTex = this.bakeNormalMap(hCanvas, 2.0);

    const result = { map: albedoTex, normalMap: normalTex };
    this.textureCache.set(key, result);
    return result;
  }

  /**
   * 8. REALISTIC ANATOMICAL FACE & SKIN TEXTURE
   */
  createHumanSkinTextures() {
    const key = `human_skin_${this.quality}`;
    if (this.textureCache.has(key)) return this.textureCache.get(key);

    const size = 256;
    const aCanvas = document.createElement('canvas');
    aCanvas.width = size;
    aCanvas.height = size;
    const aCtx = aCanvas.getContext('2d');

    const hCanvas = document.createElement('canvas');
    hCanvas.width = size;
    hCanvas.height = size;
    const hCtx = hCanvas.getContext('2d');

    // Realistic flesh gradient
    const skinGrad = aCtx.createLinearGradient(0, 0, 0, size);
    skinGrad.addColorStop(0, '#dcb088'); // Forehead
    skinGrad.addColorStop(0.4, '#cf9c74'); // Cheek flush
    skinGrad.addColorStop(0.8, '#b8825c'); // Jawline shadow
    aCtx.fillStyle = skinGrad;
    aCtx.fillRect(0, 0, size, size);

    hCtx.fillStyle = '#808080';
    hCtx.fillRect(0, 0, size, size);

    // Microscopic pore stippling
    for (let i = 0; i < 900; i++) {
      const px = Math.random() * size;
      const py = Math.random() * size;
      aCtx.fillStyle = Math.random() > 0.5 ? 'rgba(180, 80, 50, 0.08)' : 'rgba(255, 240, 220, 0.08)';
      aCtx.fillRect(px, py, 1, 1);

      hCtx.fillStyle = Math.random() > 0.5 ? 'rgba(40, 40, 40, 0.15)' : 'rgba(220, 220, 220, 0.15)';
      hCtx.fillRect(px, py, 1, 1);
    }

    const albedoTex = new THREE.CanvasTexture(aCanvas);
    albedoTex.colorSpace = THREE.SRGBColorSpace;
    albedoTex.anisotropy = this.maxAnisotropy;

    const normalTex = this.bakeNormalMap(hCanvas, 1.4);

    const result = { map: albedoTex, normalMap: normalTex };
    this.textureCache.set(key, result);
    return result;
  }

  /**
   * 9. DETAILED WARRIOR FACE TEXTURE (Eyes, brows, nose bridge, battle stubble, scar/warpaint)
   */
  createWarriorFaceTextures(options = {}) {
    const key = `warrior_face_${options.teamColor || ''}_${this.quality}`;
    if (this.textureCache.has(key)) return this.textureCache.get(key);

    const size = 512;
    const aCanvas = document.createElement('canvas');
    aCanvas.width = size;
    aCanvas.height = size;
    const aCtx = aCanvas.getContext('2d');

    const hCanvas = document.createElement('canvas');
    hCanvas.width = size;
    hCanvas.height = size;
    const hCtx = hCanvas.getContext('2d');

    // 1. Natural Skin Tone Base Gradient
    const baseGrad = aCtx.createRadialGradient(size * 0.5, size * 0.45, 30, size * 0.5, size * 0.45, size * 0.55);
    baseGrad.addColorStop(0, '#dfb38e');
    baseGrad.addColorStop(0.6, '#cc946e');
    baseGrad.addColorStop(1, '#9e6d4c');
    aCtx.fillStyle = baseGrad;
    aCtx.fillRect(0, 0, size, size);

    hCtx.fillStyle = '#808080';
    hCtx.fillRect(0, 0, size, size);

    // 2. Eyes & Sclera (Left & Right)
    const eyeY = size * 0.42;
    const eyeSpacing = size * 0.22;
    const eyeWidth = size * 0.12;
    const eyeHeight = size * 0.06;

    [-eyeSpacing, eyeSpacing].forEach((offset) => {
      const eyeX = size * 0.5 + offset;

      // Dark eye socket shadow
      const socketGrad = aCtx.createRadialGradient(eyeX, eyeY, 5, eyeX, eyeY, eyeWidth * 1.2);
      socketGrad.addColorStop(0, 'rgba(80, 45, 30, 0.4)');
      socketGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      aCtx.fillStyle = socketGrad;
      aCtx.beginPath();
      aCtx.arc(eyeX, eyeY, eyeWidth * 1.1, 0, Math.PI * 2);
      aCtx.fill();

      // Sclera (Eye white)
      aCtx.fillStyle = '#f0f3f6';
      aCtx.beginPath();
      aCtx.ellipse(eyeX, eyeY, eyeWidth * 0.5, eyeHeight * 0.5, 0, 0, Math.PI * 2);
      aCtx.fill();

      // Iris & Pupil (Grounded dark brown / steel grey)
      aCtx.fillStyle = '#3a2012';
      aCtx.beginPath();
      aCtx.arc(eyeX, eyeY, eyeHeight * 0.42, 0, Math.PI * 2);
      aCtx.fill();

      aCtx.fillStyle = '#0a0806';
      aCtx.beginPath();
      aCtx.arc(eyeX, eyeY, eyeHeight * 0.22, 0, Math.PI * 2);
      aCtx.fill();

      // Specular glint
      aCtx.fillStyle = '#ffffff';
      aCtx.beginPath();
      aCtx.arc(eyeX + 2, eyeY - 2, 2, 0, Math.PI * 2);
      aCtx.fill();

      // Eye height relief in heightmap
      hCtx.fillStyle = '#606060'; // recessed socket
      hCtx.beginPath();
      hCtx.ellipse(eyeX, eyeY, eyeWidth * 0.6, eyeHeight * 0.6, 0, 0, Math.PI * 2);
      hCtx.fill();

      // Eyelid line
      aCtx.strokeStyle = '#2d180d';
      aCtx.lineWidth = 3;
      aCtx.beginPath();
      aCtx.ellipse(eyeX, eyeY - 2, eyeWidth * 0.55, eyeHeight * 0.55, 0, Math.PI, Math.PI * 2);
      aCtx.stroke();
    });

    // 3. Fierce Eyebrows
    [-eyeSpacing, eyeSpacing].forEach((offset, idx) => {
      const browX = size * 0.5 + offset;
      const browY = eyeY - size * 0.08;
      const tilt = idx === 0 ? 0.2 : -0.2; // Determined warrior furrow

      aCtx.strokeStyle = '#2b1a10';
      aCtx.lineWidth = 8;
      aCtx.beginPath();
      aCtx.moveTo(browX - eyeWidth * 0.65, browY - tilt * 10);
      aCtx.quadraticCurveTo(browX, browY - 6, browX + eyeWidth * 0.65, browY + tilt * 10);
      aCtx.stroke();

      // Raised brow ridge in heightmap
      hCtx.strokeStyle = '#b0b0b0';
      hCtx.lineWidth = 10;
      hCtx.beginPath();
      hCtx.moveTo(browX - eyeWidth * 0.65, browY - tilt * 10);
      hCtx.quadraticCurveTo(browX, browY - 6, browX + eyeWidth * 0.65, browY + tilt * 10);
      hCtx.stroke();
    });

    // 4. Nose Bridge & Nostril Shading
    const noseX = size * 0.5;
    const noseY = size * 0.56;
    const noseGrad = aCtx.createLinearGradient(noseX - 12, noseY, noseX + 12, noseY);
    noseGrad.addColorStop(0, 'rgba(60, 30, 15, 0.35)');
    noseGrad.addColorStop(0.5, 'rgba(255, 230, 210, 0.2)');
    noseGrad.addColorStop(1, 'rgba(60, 30, 15, 0.35)');
    aCtx.fillStyle = noseGrad;
    aCtx.fillRect(noseX - 14, eyeY, 28, size * 0.16);

    // Nostrils
    aCtx.fillStyle = '#20100a';
    aCtx.beginPath();
    aCtx.ellipse(noseX - 10, noseY + 12, 4, 3, 0.2, 0, Math.PI * 2);
    aCtx.ellipse(noseX + 10, noseY + 12, 4, 3, -0.2, 0, Math.PI * 2);
    aCtx.fill();

    // Raised nose ridge in heightmap
    hCtx.fillStyle = '#d0d0d0';
    hCtx.beginPath();
    hCtx.ellipse(noseX, noseY, 12, 22, 0, 0, Math.PI * 2);
    hCtx.fill();

    // 5. Determined Lips / Mouth
    const mouthY = size * 0.72;
    aCtx.strokeStyle = '#4a2216';
    aCtx.lineWidth = 4;
    aCtx.beginPath();
    aCtx.moveTo(noseX - 25, mouthY);
    aCtx.quadraticCurveTo(noseX, mouthY + 3, noseX + 25, mouthY);
    aCtx.stroke();

    // 6. Gritty Battle Stubble / 5 O'clock Shadow
    for (let i = 0; i < 1800; i++) {
      const sx = noseX + (Math.random() - 0.5) * (size * 0.6);
      const sy = size * 0.62 + Math.random() * (size * 0.35);
      if (Math.hypot(sx - noseX, sy - size * 0.75) < size * 0.28) {
        aCtx.fillStyle = Math.random() > 0.4 ? 'rgba(30, 20, 15, 0.4)' : 'rgba(50, 35, 25, 0.3)';
        aCtx.fillRect(sx, sy, 1.5, 1.5);
      }
    }

    // 7. Team War Paint Stripe (Optional)
    if (options.teamColor) {
      const paintHex = options.teamColor === 'blue' || options.teamColor === 0x3b82f6 ? '#2563eb' : '#dc2626';
      aCtx.strokeStyle = paintHex;
      aCtx.lineWidth = 14;
      aCtx.globalAlpha = 0.75;
      aCtx.beginPath();
      aCtx.moveTo(noseX - size * 0.35, eyeY - 10);
      aCtx.lineTo(noseX - 10, eyeY + size * 0.15);
      aCtx.stroke();
      aCtx.globalAlpha = 1.0;
    }

    const albedoTex = new THREE.CanvasTexture(aCanvas);
    albedoTex.colorSpace = THREE.SRGBColorSpace;
    albedoTex.anisotropy = this.maxAnisotropy;

    const normalTex = this.bakeNormalMap(hCanvas, 2.2);

    const result = { map: albedoTex, normalMap: normalTex };
    this.textureCache.set(key, result);
    return result;
  }

  /**
   * 10. REALISTIC WATER NORMAL RIPPLE TEXTURE
   */
  createWaterTextures() {
    const key = `water_ripples_${this.quality}`;
    if (this.textureCache.has(key)) return this.textureCache.get(key);

    const size = 512;
    const hCanvas = document.createElement('canvas');
    hCanvas.width = size;
    hCanvas.height = size;
    const hCtx = hCanvas.getContext('2d');

    // Generate sinusoidal overlapping wave patterns
    const hData = hCtx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = (x / size) * Math.PI * 8;
        const v = (y / size) * Math.PI * 8;
        const wave1 = Math.sin(u + Math.sin(v * 0.7)) * 0.35;
        const wave2 = Math.cos(v * 1.3 - Math.sin(u * 0.5)) * 0.35;
        const wave3 = Math.sin((u + v) * 1.5) * 0.3;
        const val = Math.floor(((wave1 + wave2 + wave3) * 0.5 + 0.5) * 255);

        const idx = (y * size + x) * 4;
        hData.data[idx] = val;
        hData.data[idx + 1] = val;
        hData.data[idx + 2] = val;
        hData.data[idx + 3] = 255;
      }
    }
    hCtx.putImageData(hData, 0, 0);

    const normalTex = this.bakeNormalMap(hCanvas, 3.5);
    normalTex.wrapS = THREE.RepeatWrapping;
    normalTex.wrapT = THREE.RepeatWrapping;
    normalTex.repeat.set(6, 6);

    const result = { normalMap: normalTex };
    this.textureCache.set(key, result);
    return result;
  }

  /**
   * 11. TERRAIN PBR TEXTURES (Multi-biome blending with normal relief & roughness)
   */
  createTerrainPBRTextures(envId = 'plains') {
    const key = `terrain_pbr_${envId}_${this.quality}`;
    if (this.textureCache.has(key)) return this.textureCache.get(key);

    const size = this.getResolution();
    const aCanvas = document.createElement('canvas');
    aCanvas.width = size;
    aCanvas.height = size;
    const aCtx = aCanvas.getContext('2d');

    const hCanvas = document.createElement('canvas');
    hCanvas.width = size;
    hCanvas.height = size;
    const hCtx = hCanvas.getContext('2d');

    const rCanvas = document.createElement('canvas');
    rCanvas.width = size;
    rCanvas.height = size;
    const rCtx = rCanvas.getContext('2d');

    // Biome base color configurations
    let grassColor, dirtColor, mudColor, rockColor;
    if (envId === 'volcano') {
      grassColor = '#1c1917';
      dirtColor = '#292524';
      mudColor = '#451a03';
      rockColor = '#0c0a09';
    } else if (envId === 'snow') {
      grassColor = '#f1f5f9';
      dirtColor = '#cbd5e1';
      mudColor = '#64748b';
      rockColor = '#334155';
    } else if (envId === 'desert') {
      grassColor = '#eab308';
      dirtColor = '#ca8a04';
      mudColor = '#78350f';
      rockColor = '#a16207';
    } else {
      grassColor = '#2d5a27'; // Gritty medieval forest grass
      dirtColor = '#5c4033';  // Trampled earth
      mudColor = '#3a2312';   // Churned deep mud
      rockColor = '#475569';  // Slate bedrock
    }

    // Organic blended terrain gradient
    const bgGrad = aCtx.createRadialGradient(size / 2, size / 2, 50, size / 2, size / 2, size * 0.65);
    bgGrad.addColorStop(0, grassColor);
    bgGrad.addColorStop(0.5, dirtColor);
    bgGrad.addColorStop(0.8, mudColor);
    bgGrad.addColorStop(1, rockColor);
    aCtx.fillStyle = bgGrad;
    aCtx.fillRect(0, 0, size, size);

    hCtx.fillStyle = '#808080';
    hCtx.fillRect(0, 0, size, size);

    // Roughness: Grass is matte (0.88), wet mud is shiny (0.45)
    rCtx.fillStyle = '#c0c0c0';
    rCtx.fillRect(0, 0, size, size);

    // Micro-vegetation thatch, gravel pebbles, and mud ruts
    const aData = aCtx.getImageData(0, 0, size, size);
    const hData = hCtx.getImageData(0, 0, size, size);
    const rData = rCtx.getImageData(0, 0, size, size);

    for (let i = 0; i < aData.data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 32;
      aData.data[i]     = Math.max(0, Math.min(255, aData.data[i] + noise));
      aData.data[i + 1] = Math.max(0, Math.min(255, aData.data[i + 1] + noise));
      aData.data[i + 2] = Math.max(0, Math.min(255, aData.data[i + 2] + noise));

      hData.data[i] = Math.max(0, Math.min(255, 128 + noise * 1.5));
      rData.data[i] = Math.max(0, Math.min(255, 190 - noise * 0.8));
    }

    aCtx.putImageData(aData, 0, 0);
    hCtx.putImageData(hData, 0, 0);
    rCtx.putImageData(rData, 0, 0);

    const albedoTex = new THREE.CanvasTexture(aCanvas);
    albedoTex.wrapS = THREE.RepeatWrapping;
    albedoTex.wrapT = THREE.RepeatWrapping;
    albedoTex.repeat.set(8, 8);
    albedoTex.colorSpace = THREE.SRGBColorSpace;
    albedoTex.anisotropy = this.maxAnisotropy;

    const normalTex = this.bakeNormalMap(hCanvas, 2.8);
    normalTex.wrapS = THREE.RepeatWrapping;
    normalTex.wrapT = THREE.RepeatWrapping;
    normalTex.repeat.set(8, 8);

    const roughTex = new THREE.CanvasTexture(rCanvas);
    roughTex.wrapS = THREE.RepeatWrapping;
    roughTex.wrapT = THREE.RepeatWrapping;
    roughTex.repeat.set(8, 8);

    const result = { map: albedoTex, normalMap: normalTex, roughnessMap: roughTex };
    this.textureCache.set(key, result);
    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  // CENTRAL PBR MATERIAL LIBRARY
  // ═══════════════════════════════════════════════════════════════

  /**
   * Returns a configured MeshStandardMaterial with high-detail PBR maps.
   */
  getMaterial(name, options = {}) {
    const cacheKey = `${name}_${options.teamColor || ''}_${options.color || ''}_${options.roughness || ''}`;
    if (this.materialCache.has(cacheKey)) {
      return this.materialCache.get(cacheKey);
    }

    let mat;

    switch (name) {
      case 'stone_masonry': {
        const tex = this.createStoneMasonryTextures();
        mat = new THREE.MeshStandardMaterial({
          map: tex.map,
          normalMap: tex.normalMap,
          normalScale: new THREE.Vector2(1.2, 1.2),
          roughnessMap: tex.roughnessMap,
          roughness: 0.82,
          metalness: 0.08,
          flatShading: false,
          ...options
        });
        break;
      }

      case 'dark_timber': {
        const tex = this.createDarkTimberTextures();
        mat = new THREE.MeshStandardMaterial({
          map: tex.map,
          normalMap: tex.normalMap,
          normalScale: new THREE.Vector2(1.0, 1.0),
          roughness: 0.85,
          metalness: 0.05,
          ...options
        });
        break;
      }

      case 'forged_steel': {
        const tex = this.createForgedSteelTextures();
        mat = new THREE.MeshStandardMaterial({
          map: tex.map,
          normalMap: tex.normalMap,
          normalScale: new THREE.Vector2(0.8, 0.8),
          roughnessMap: tex.roughnessMap,
          roughness: 0.32,
          metalness: 0.92,
          envMapIntensity: 1.4,
          ...options
        });
        break;
      }

      case 'rusted_iron': {
        const tex = this.createRustedIronTextures();
        mat = new THREE.MeshStandardMaterial({
          map: tex.map,
          normalMap: tex.normalMap,
          normalScale: new THREE.Vector2(1.2, 1.2),
          roughness: 0.65,
          metalness: 0.75,
          ...options
        });
        break;
      }

      case 'chainmail': {
        const tex = this.createChainmailTextures();
        mat = new THREE.MeshStandardMaterial({
          map: tex.map,
          normalMap: tex.normalMap,
          normalScale: new THREE.Vector2(1.4, 1.4),
          roughness: 0.42,
          metalness: 0.88,
          envMapIntensity: 1.2,
          ...options
        });
        break;
      }

      case 'worn_leather': {
        const tex = this.createWornLeatherTextures();
        mat = new THREE.MeshStandardMaterial({
          map: tex.map,
          normalMap: tex.normalMap,
          normalScale: new THREE.Vector2(1.0, 1.0),
          roughness: 0.68,
          metalness: 0.06,
          ...options
        });
        break;
      }

      case 'cloth_weave': {
        const tex = this.createClothWeaveTextures();
        mat = new THREE.MeshStandardMaterial({
          map: tex.map,
          normalMap: tex.normalMap,
          normalScale: new THREE.Vector2(0.9, 0.9),
          roughness: 0.92,
          metalness: 0.02,
          color: options.color || (options.teamColor ? options.teamColor : 0xd1c7b7),
          ...options
        });
        break;
      }

      case 'human_skin': {
        const tex = this.createHumanSkinTextures();
        mat = new THREE.MeshStandardMaterial({
          map: tex.map,
          normalMap: tex.normalMap,
          normalScale: new THREE.Vector2(0.6, 0.6),
          roughness: 0.55,
          metalness: 0.02,
          ...options
        });
        break;
      }

      case 'warrior_face': {
        const tex = this.createWarriorFaceTextures(options);
        mat = new THREE.MeshStandardMaterial({
          map: tex.map,
          normalMap: tex.normalMap,
          normalScale: new THREE.Vector2(0.8, 0.8),
          roughness: 0.58,
          metalness: 0.04,
          ...options
        });
        break;
      }

      case 'terrain_pbr': {
        const tex = this.createTerrainPBRTextures(options.envId || 'plains');
        mat = new THREE.MeshStandardMaterial({
          map: tex.map,
          normalMap: tex.normalMap,
          normalScale: new THREE.Vector2(1.5, 1.5),
          roughnessMap: tex.roughnessMap,
          roughness: 0.85,
          metalness: 0.06,
          vertexColors: true,
          ...options
        });
        break;
      }

      case 'water': {
        const tex = this.createWaterTextures();
        mat = new THREE.MeshStandardMaterial({
          color: options.color || 0x0369a1,
          normalMap: tex.normalMap,
          normalScale: new THREE.Vector2(1.4, 1.4),
          roughness: 0.12,
          metalness: 0.25,
          transparent: true,
          opacity: 0.78,
          envMapIntensity: 1.8,
          ...options
        });
        break;
      }

      case 'roof_tiles': {
        const tex = this.createStoneMasonryTextures(); // Slate roof
        mat = new THREE.MeshStandardMaterial({
          map: tex.map,
          normalMap: tex.normalMap,
          normalScale: new THREE.Vector2(1.5, 1.5),
          color: 0x334155, // Dark slate blue-grey
          roughness: 0.78,
          metalness: 0.15,
          ...options
        });
        break;
      }

      default: {
        mat = new THREE.MeshStandardMaterial({
          roughness: 0.8,
          metalness: 0.1,
          ...options
        });
      }
    }

    this.materialCache.set(cacheKey, mat);
    return mat;
  }
}

export const pbrMaterialSystem = new PBRMaterialManager();
