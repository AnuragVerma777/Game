/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * CARROM CLASH — Tournament Model Assets & Realistic Materials
 * Procedural competition-grade Carrom Board, authentic Carrom Men,
 * and high-gloss Striker with realistic PBR physical materials.
 */

import {
  BoxGeometry,
  CylinderGeometry,
  DataTexture,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RGBAFormat,
  RingGeometry,
  SRGBColorSpace,
  TorusGeometry,
  UnsignedByteType,
} from '@iwsdk/core';

/**
 * Procedural texture generator for the authentic competition Carrom Board.
 * Features:
 * - Natural polished Canadian maple/birch wood grain with multi-octave fibers
 * - Traditional tournament layout with central Queen circle and 8-petal lotus mandala
 * - 4 baseline pairs with red circle targets on all sides
 * - 4 diagonal foul lines with chevron tips pointing toward the corner pockets
 * - 4 corner pocket apertures with circular brass trims
 */
function createCarromSurfaceTexture(size = 1024): DataTexture {
  const data = new Uint8Array(size * size * 4);
  const half = size / 2;
  const boardMeters = 0.74; // Standard internal carrom playing area
  const scale = boardMeters / size;

  const pocketDist = 0.332;
  const pocketRadius = 0.0225; // 4.5cm pocket diameter

  for (let py = 0; py < size; py++) {
    const ym = (py - half) * scale;
    const rowOffset = py * size * 4;

    for (let px = 0; px < size; px++) {
      const xm = (px - half) * scale;
      const idx = rowOffset + px * 4;

      const r = Math.sqrt(xm * xm + ym * ym);
      const absX = Math.abs(xm);
      const absY = Math.abs(ym);

      // 1. Natural multi-frequency maple wood grain
      const grainMajor = Math.sin(xm * 260.0 + Math.sin(ym * 35.0) * 2.2) * 0.5 + 0.5;
      const grainFine = Math.sin(xm * 750.0 + Math.cos(ym * 120.0) * 0.8) * 0.5 + 0.5;
      const rayFibers = Math.sin(ym * 1400.0) * 0.5 + 0.5;
      const noise = ((px * 19 + py * 41) % 37) / 37.0 - 0.5;

      // Warm silky birch/maple tone: [238, 218, 184]
      let rCol = 236 + grainMajor * 7 + grainFine * 4 + rayFibers * 3 + noise * 3;
      let gCol = 214 + grainMajor * 7 + grainFine * 3 + rayFibers * 2 + noise * 3;
      let bCol = 176 + grainMajor * 5 + grainFine * 2 + rayFibers * 2 + noise * 2;

      // Soft perimeter shading towards borders
      const borderDist = Math.max(absX, absY) / 0.37;
      if (borderDist > 0.82) {
        const falloff = 1.0 - (borderDist - 0.82) * 0.22;
        rCol *= falloff;
        gCol *= falloff;
        bCol *= falloff;
      }

      // 2. Corner Pockets Check
      const inPocket = Math.hypot(absX - pocketDist, absY - pocketDist) < pocketRadius;
      if (inPocket) {
        // Deep pocket opening
        rCol = 14;
        gCol = 14;
        bCol = 18;
        data[idx] = rCol;
        data[idx + 1] = gCol;
        data[idx + 2] = bCol;
        data[idx + 3] = 255;
        continue;
      }

      // Pocket brass trim ring
      const distToPocket = Math.hypot(absX - pocketDist, absY - pocketDist);
      if (distToPocket >= pocketRadius && distToPocket < pocketRadius + 0.0035) {
        rCol = 195;
        gCol = 158;
        bCol = 75;
      }

      // 3. Center Circle & Lotus Queen Mandala
      // Queen circle: radius 0.0159m (3.18cm diameter)
      if (r < 0.0159) {
        // Crimson Red Queen spot
        rCol = 188;
        gCol = 24;
        bCol = 32;
        // Concentric center dot
        if (r < 0.0032) {
          rCol = 248;
          gCol = 248;
          bCol = 244;
        }
      } else if (r >= 0.0159 && r < 0.0175) {
        // Gold inlay ring
        rCol = 218;
        gCol = 178;
        bCol = 52;
      } else if (r >= 0.037 && r <= 0.039) {
        // Outer tournament center circle (radius 3.8cm, diameter 7.6cm)
        rCol = 26;
        gCol = 26;
        bCol = 30;
      } else if (r > 0.0175 && r < 0.037) {
        // 8 radiating lotus petals
        const angle = Math.atan2(ym, xm);
        const petal = Math.cos(angle * 8);
        if (petal > 0.65 && r > 0.021 && r < 0.034) {
          rCol = 180;
          gCol = 30;
          bCol = 36;
        } else if (petal > 0.45 && r > 0.020 && r < 0.035) {
          rCol = 32;
          gCol = 32;
          bCol = 38;
        }
      }

      // 4. Baselines (4 sides, parallel double lines with red circle endpoints)
      const onSouth = ym > 0.222 && ym < 0.258 && absX <= 0.235;
      const onNorth = ym < -0.222 && ym > -0.258 && absX <= 0.235;
      const onEast = xm > 0.222 && xm < 0.258 && absY <= 0.235;
      const onWest = xm < -0.222 && xm > -0.258 && absY <= 0.235;

      const evaluateBaseline = (parallelCoord: number, axisCoord: number) => {
        const distEnd1 = Math.hypot(parallelCoord - 0.235, axisCoord - 0.24);
        const distEnd2 = Math.hypot(parallelCoord + 0.235, axisCoord - 0.24);

        if (distEnd1 < 0.015 || distEnd2 < 0.015) {
          // Circle endpoints
          if (distEnd1 < 0.0125 || distEnd2 < 0.0125) {
            // Inner dot
            if (distEnd1 < 0.003 || distEnd2 < 0.003) return 'white';
            return 'red';
          }
          return 'black';
        }

        // Parallel baseline rails
        const dLine1 = Math.abs(axisCoord - 0.226);
        const dLine2 = Math.abs(axisCoord - 0.254);
        if ((dLine1 < 0.0016 || dLine2 < 0.0016) && Math.abs(parallelCoord) < 0.235) {
          return 'black';
        }
        return null;
      };

      let mark: 'red' | 'black' | 'white' | null = null;
      if (onSouth) mark = evaluateBaseline(xm, ym);
      else if (onNorth) mark = evaluateBaseline(xm, -ym);
      else if (onEast) mark = evaluateBaseline(ym, xm);
      else if (onWest) mark = evaluateBaseline(ym, -xm);

      if (mark === 'red') {
        rCol = 192;
        gCol = 28;
        bCol = 34;
      } else if (mark === 'black') {
        rCol = 28;
        gCol = 28;
        bCol = 34;
      } else if (mark === 'white') {
        rCol = 245;
        gCol = 245;
        bCol = 240;
      }

      // 5. Diagonal Arrows toward corner pockets with chevron heads
      if (absX > 0.055 && absX < 0.295 && Math.abs(absX - absY) < 0.002) {
        rCol = 30;
        gCol = 30;
        bCol = 36;
      }

      // Outer framing square guideline
      if (
        (absX > 0.318 && absX < 0.320 && absY < 0.32) ||
        (absY > 0.318 && absY < 0.320 && absX < 0.32)
      ) {
        rCol = 38;
        gCol = 38;
        bCol = 44;
      }

      data[idx] = Math.min(255, Math.max(0, Math.round(rCol)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(gCol)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(bCol)));
      data[idx + 3] = 255;
    }
  }

  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates the complete Carrom Board assembly:
 * - High-grade satin maple playing surface
 * - Bevelled dark Indian rosewood borders with inner rebound cushions
 * - Functional net pocket openings with brass rims
 * - Sleek dark studio column stand at comfortable VR viewing height (0.75m)
 */
export function createCarromBoard(): Group {
  const root = new Group();
  root.name = 'CarromBoard';

  // 1. Satin-Finished Playing Surface
  const surfaceTexture = createCarromSurfaceTexture(1024);
  const boardMaterial = new MeshPhysicalMaterial({
    map: surfaceTexture,
    roughness: 0.12,
    metalness: 0.02,
    clearcoat: 0.75,
    clearcoatRoughness: 0.05,
    reflectivity: 0.90,
  });

  const boardGeo = new BoxGeometry(0.74, 0.014, 0.74);
  const boardMesh = new Mesh(boardGeo, boardMaterial);
  boardMesh.name = 'PlayingSurface';
  boardMesh.position.y = 0.743; // Surface at Y = 0.750m
  boardMesh.receiveShadow = true;
  boardMesh.castShadow = true;
  root.add(boardMesh);

  // 2. High-Grade Dark Rosewood Border Frame
  const frameMaterial = new MeshPhysicalMaterial({
    color: '#1e0e07', // Deep Indian rosewood
    roughness: 0.18,
    metalness: 0.04,
    clearcoat: 0.80,
    clearcoatRoughness: 0.08,
  });

  const railWidth = 0.07;
  const railHeight = 0.046;
  const outerSize = 0.88;
  const innerSize = 0.74;

  const nsRailGeo = new BoxGeometry(outerSize, railHeight, railWidth);
  const nRail = new Mesh(nsRailGeo, frameMaterial);
  nRail.name = 'FrameRailNorth';
  nRail.position.set(0, 0.758, -innerSize / 2 - railWidth / 2);
  nRail.castShadow = true;
  nRail.receiveShadow = true;

  const sRail = new Mesh(nsRailGeo, frameMaterial);
  sRail.name = 'FrameRailSouth';
  sRail.position.set(0, 0.758, innerSize / 2 + railWidth / 2);
  sRail.castShadow = true;
  sRail.receiveShadow = true;

  const ewRailGeo = new BoxGeometry(railWidth, railHeight, innerSize);
  const eRail = new Mesh(ewRailGeo, frameMaterial);
  eRail.name = 'FrameRailEast';
  eRail.position.set(innerSize / 2 + railWidth / 2, 0.758, 0);
  eRail.castShadow = true;
  eRail.receiveShadow = true;

  const wRail = new Mesh(ewRailGeo, frameMaterial);
  wRail.name = 'FrameRailWest';
  wRail.position.set(-innerSize / 2 - railWidth / 2, 0.758, 0);
  wRail.castShadow = true;
  wRail.receiveShadow = true;

  root.add(nRail, sRail, eRail, wRail);

  // Inner Rebound Rubber Cushions
  const cushionMaterial = new MeshStandardMaterial({
    color: '#150c07',
    roughness: 0.65,
    metalness: 0.0,
  });

  const cushionThick = 0.005;
  const cushionH = 0.022;

  const nsCushionGeo = new BoxGeometry(0.70, cushionH, cushionThick);
  const nCushion = new Mesh(nsCushionGeo, cushionMaterial);
  nCushion.position.set(0, 0.752, -innerSize / 2 + cushionThick / 2);
  const sCushion = new Mesh(nsCushionGeo, cushionMaterial);
  sCushion.position.set(0, 0.752, innerSize / 2 - cushionThick / 2);

  const ewCushionGeo = new BoxGeometry(cushionThick, cushionH, 0.70);
  const eCushion = new Mesh(ewCushionGeo, cushionMaterial);
  eCushion.position.set(innerSize / 2 - cushionThick / 2, 0.752, 0);
  const wCushion = new Mesh(ewCushionGeo, cushionMaterial);
  wCushion.position.set(-innerSize / 2 + cushionThick / 2, 0.752, 0);

  root.add(nCushion, sCushion, eCushion, wCushion);

  // Champagne Brass Corner Caps
  const cornerGeo = new CylinderGeometry(0.013, 0.013, railHeight + 0.003, 20);
  const cornerMat = new MeshPhysicalMaterial({
    color: '#bfa052',
    metalness: 0.9,
    roughness: 0.22,
    clearcoat: 0.4,
  });

  const cornerOffsets = [
    [-outerSize / 2 + 0.022, -outerSize / 2 + 0.022],
    [outerSize / 2 - 0.022, -outerSize / 2 + 0.022],
    [-outerSize / 2 + 0.022, outerSize / 2 - 0.022],
    [outerSize / 2 - 0.022, outerSize / 2 - 0.022],
  ];

  cornerOffsets.forEach(([cx, cz], i) => {
    const cornerCap = new Mesh(cornerGeo, cornerMat);
    cornerCap.name = `CornerAccent_${i + 1}`;
    cornerCap.position.set(cx, 0.759, cz);
    root.add(cornerCap);
  });

  // 3. Functional Pocket Openings with Net Cups
  const pocketPositions = [
    [-0.332, -0.332],
    [0.332, -0.332],
    [-0.332, 0.332],
    [0.332, 0.332],
  ];

  const netMaterial = new MeshStandardMaterial({
    color: '#0a0a0d',
    roughness: 0.92,
    metalness: 0.05,
  });

  const pocketRimMaterial = new MeshPhysicalMaterial({
    color: '#9e803c',
    metalness: 0.85,
    roughness: 0.28,
  });

  const pocketCupGeo = new CylinderGeometry(0.023, 0.018, 0.046, 24, 1, true);
  const pocketRimGeo = new TorusGeometry(0.023, 0.0022, 12, 24);

  pocketPositions.forEach(([px, pz], idx) => {
    const pocketGroup = new Group();
    pocketGroup.name = `Pocket_${idx + 1}`;
    pocketGroup.position.set(px, 0.73, pz);

    const cup = new Mesh(pocketCupGeo, netMaterial);
    cup.receiveShadow = true;

    const rim = new Mesh(pocketRimGeo, pocketRimMaterial);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.02;

    pocketGroup.add(cup, rim);
    root.add(pocketGroup);
  });

  // 4. Studio Pedestal Table Stand
  const standGroup = new Group();
  standGroup.name = 'StudioPedestal';

  const pillarMat = new MeshStandardMaterial({
    color: '#18191d',
    roughness: 0.45,
    metalness: 0.25,
  });

  const brassTrimMat = new MeshPhysicalMaterial({
    color: '#d4af37',
    roughness: 0.18,
    metalness: 0.92,
  });

  const columnGeo = new CylinderGeometry(0.065, 0.092, 0.70, 36);
  const column = new Mesh(columnGeo, pillarMat);
  column.position.y = 0.37;
  column.castShadow = true;
  column.receiveShadow = true;

  const ringGeo = new TorusGeometry(0.082, 0.007, 16, 36);
  const ring1 = new Mesh(ringGeo, brassTrimMat);
  ring1.rotation.x = Math.PI / 2;
  ring1.position.y = 0.68;

  const ring2 = new Mesh(ringGeo, brassTrimMat);
  ring2.rotation.x = Math.PI / 2;
  ring2.position.y = 0.15;

  const basePlateGeo = new CylinderGeometry(0.33, 0.36, 0.035, 40);
  const basePlate = new Mesh(basePlateGeo, pillarMat);
  basePlate.position.y = 0.0175;
  basePlate.castShadow = true;
  basePlate.receiveShadow = true;

  const subframeGeo = new BoxGeometry(0.60, 0.025, 0.60);
  const subframe = new Mesh(subframeGeo, pillarMat);
  subframe.position.y = 0.725;
  subframe.castShadow = true;

  standGroup.add(column, ring1, ring2, basePlate, subframe);
  root.add(standGroup);

  return root;
}

/**
 * Creates tournament Carrom Men with chamfered profile and dual engraved rings.
 */
export function createCarromCoin(color: 'white' | 'black' | 'queen'): Group {
  const coinGroup = new Group();
  coinGroup.name = `CarromCoin_${color}`;

  const radius = 0.0159;
  const height = 0.008;

  let mainMaterial: MeshPhysicalMaterial;

  if (color === 'white') {
    // Warm polished natural boxwood ivory with pearlescent luster
    mainMaterial = new MeshPhysicalMaterial({
      color: '#f7f2e7',
      roughness: 0.14,
      metalness: 0.02,
      clearcoat: 0.70,
      clearcoatRoughness: 0.05,
      reflectivity: 0.85,
    });
  } else if (color === 'black') {
    // Deep obsidian ebony with subtle dark walnut undertone
    mainMaterial = new MeshPhysicalMaterial({
      color: '#1a1815',
      roughness: 0.18,
      metalness: 0.04,
      clearcoat: 0.60,
      clearcoatRoughness: 0.07,
    });
  } else {
    // Royal Crimson Red Queen with deep lacquer gloss
    mainMaterial = new MeshPhysicalMaterial({
      color: '#c01628',
      roughness: 0.12,
      metalness: 0.04,
      clearcoat: 0.90,
      clearcoatRoughness: 0.04,
      reflectivity: 0.90,
    });
  }

  const bodyGeo = new CylinderGeometry(radius, radius, height, 36);
  const bodyMesh = new Mesh(bodyGeo, mainMaterial);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  coinGroup.add(bodyMesh);

  // Outer engraved concentric groove on top
  const outerRingGeo = new TorusGeometry(radius * 0.72, 0.00065, 8, 36);
  const outerRingMat =
    color === 'queen'
      ? new MeshPhysicalMaterial({
          color: '#ffd700',
          metalness: 0.95,
          roughness: 0.12,
        })
      : new MeshStandardMaterial({
          color: color === 'white' ? '#d8cebb' : '#2d2b27',
          roughness: 0.35,
        });

  const outerRing = new Mesh(outerRingGeo, outerRingMat);
  outerRing.rotation.x = Math.PI / 2;
  outerRing.position.y = height / 2 + 0.0001;
  coinGroup.add(outerRing);

  // Inner engraved ring or Queen starburst medallion
  if (color === 'queen') {
    const centerMedallionGeo = new CylinderGeometry(0.0045, 0.0045, 0.0005, 24);
    const goldMat = new MeshPhysicalMaterial({
      color: '#ffd700',
      metalness: 0.95,
      roughness: 0.10,
      clearcoat: 0.8,
    });
    const centerMedallion = new Mesh(centerMedallionGeo, goldMat);
    centerMedallion.position.y = height / 2 + 0.0002;
    coinGroup.add(centerMedallion);
  } else {
    const innerRingGeo = new TorusGeometry(radius * 0.38, 0.0005, 8, 32);
    const innerRing = new Mesh(innerRingGeo, outerRingMat);
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = height / 2 + 0.0001;
    coinGroup.add(innerRing);
  }

  return coinGroup;
}

/**
 * Creates the competition Striker with high-gloss synthetic ivory and mirror chrome rim.
 */
export function createCarromStriker(): Group {
  const strikerGroup = new Group();
  strikerGroup.name = 'CarromStriker';

  const radius = 0.02065;
  const height = 0.0085;

  const bodyMaterial = new MeshPhysicalMaterial({
    color: '#fdfefe',
    roughness: 0.05,
    metalness: 0.06,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    reflectivity: 0.95,
  });

  const bodyGeo = new CylinderGeometry(radius, radius, height, 48);
  const bodyMesh = new Mesh(bodyGeo, bodyMaterial);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  strikerGroup.add(bodyMesh);

  // Precision mirror-chrome edge band
  const edgeRimGeo = new TorusGeometry(radius, 0.0012, 16, 48);
  const chromeMat = new MeshPhysicalMaterial({
    color: '#ffffff',
    metalness: 0.98,
    roughness: 0.04,
    clearcoat: 1.0,
  });
  const edgeRim = new Mesh(edgeRimGeo, chromeMat);
  edgeRim.rotation.x = Math.PI / 2;
  strikerGroup.add(edgeRim);

  // Sapphire blue enamel medallion ring
  const crestGeo = new RingGeometry(0.0035, 0.0125, 36);
  const crestMat = new MeshPhysicalMaterial({
    color: '#07285a',
    metalness: 0.5,
    roughness: 0.12,
    clearcoat: 0.95,
  });
  const crestMesh = new Mesh(crestGeo, crestMat);
  crestMesh.rotation.x = -Math.PI / 2;
  crestMesh.position.y = height / 2 + 0.00015;

  // Gold starburst inlay ring
  const goldRingGeo = new TorusGeometry(0.0085, 0.0006, 10, 36);
  const goldRingMat = new MeshPhysicalMaterial({
    color: '#ffd700',
    metalness: 0.95,
    roughness: 0.10,
  });
  const goldRing = new Mesh(goldRingGeo, goldRingMat);
  goldRing.rotation.x = Math.PI / 2;
  goldRing.position.y = height / 2 + 0.00025;

  // Center ruby jewel cabochon with gold bezel
  const rubyGeo = new CylinderGeometry(0.0038, 0.0038, 0.0007, 24);
  const rubyMat = new MeshPhysicalMaterial({
    color: '#a80d22',
    roughness: 0.08,
    metalness: 0.1,
    clearcoat: 1.0,
    reflectivity: 0.9,
  });
  const ruby = new Mesh(rubyGeo, rubyMat);
  ruby.position.y = height / 2 + 0.00035;

  strikerGroup.add(crestMesh, goldRing, ruby);
  return strikerGroup;
}
