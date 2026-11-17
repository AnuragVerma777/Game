/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  createSceneMaterial,
  createScenePrimitiveObject,
  DataTexture,
  Group,
  IcosahedronGeometry,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshStandardMaterial,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  TorusKnotGeometry,
  UnsignedByteType,
} from '@iwsdk/core';

/**
 * Starter-only studio set, built in code so the starter downloads no extra
 * models: floor, stage, plinths and the graphite pieces you interact with.
 * Each one is registered in src/assets.ts and placed by the scene; it is safe
 * to delete them together with those asset entries and scene nodes.
 *
 * The rest of the look is authored in the scene with built-in components: the
 * sky is the level root's DomeGradient, the floor fades into it with the
 * floor node's DomeFade, and the soft blobs and the AR shadow floor are
 * ContactShadow and ShadowCatcher nodes.
 */

const clayMaterial = createSceneMaterial({
  id: 'studio-clay',
  model: 'standard',
  baseColor: '#EEE9E0',
  roughness: 0.9,
});

const stoneMaterial = createSceneMaterial({
  id: 'studio-stone',
  model: 'standard',
  roughness: 0.7,
  textures: {
    albedo: {
      type: 'procedural',
      algorithm: 'periodic-fbm-v1',
      resolution: [256, 256],
      seed: 7,
      bands: [
        { frequency: [110, 110], amplitude: 0.7 },
        { frequency: [240, 240], amplitude: 0.3 },
      ],
      ramp: [
        { at: 0, color: '#A59E93' },
        { at: 1, color: '#B0A99E' },
      ],
      // Tiled twice: a quarter of the pixels to generate, same grain size.
      sampler: { repeat: [2, 2] },
    },
    roughness: {
      type: 'procedural',
      algorithm: 'periodic-fbm-v1',
      resolution: [256, 256],
      seed: 8,
      bands: [{ frequency: [30, 30], amplitude: 1 }],
      range: [0.72, 0.8],
    },
  },
});

// Dark, glossy graphite marks everything you can interact with.
const graphiteMaterial = createSceneMaterial({
  id: 'studio-graphite',
  model: 'physical',
  baseColor: '#464950',
  roughness: 0.38,
  metalness: 0,
  clearcoat: 0.6,
  clearcoatRoughness: 0.15,
  envMapIntensity: 2.6,
  textures: {
    roughness: {
      type: 'procedural',
      algorithm: 'periodic-fbm-v1',
      resolution: [256, 256],
      seed: 3,
      bands: [
        { frequency: [12, 12], amplitude: 0.6 },
        { frequency: [48, 48], amplitude: 0.4 },
      ],
      range: [0.26, 0.52],
    },
    bump: {
      type: 'procedural',
      algorithm: 'periodic-fbm-v1',
      resolution: [256, 256],
      seed: 43,
      bands: [
        { frequency: [32, 32], amplitude: 0.6 },
        { frequency: [96, 96], amplitude: 0.4 },
      ],
      scale: 0.04,
      sampler: { repeat: [3, 3] },
    },
  },
});

/** Opaque sRGB texture from RGBA pixels, filtered like an image texture. */
function pixelTexture(size: number, pixels: Uint8Array): DataTexture {
  const texture = new DataTexture(
    pixels,
    size,
    size,
    RGBAFormat,
    UnsignedByteType,
  );
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Procedural dark luxury hardwood parquet plank texture.
 * Features:
 * - 4 staggered rich walnut planks with individual color nuances
 * - Multi-frequency natural longitudinal wood grain
 * - Clean beveled perimeter plank seams
 * - High-end satin studio finish
 */
function createHardwoodFloorTexture(size = 512): DataTexture {
  const pixels = new Uint8Array(size * size * 4);
  const numPlanks = 4;
  const plankWidth = size / numPlanks;
  const plankLength = size / 2;

  // Rich walnut tone variations per plank
  const plankTones = [
    { r: 42, g: 28, b: 18 },  // Dark walnut
    { r: 48, g: 33, b: 22 },  // Warm mahogany
    { r: 38, g: 25, b: 16 },  // Deep ebony walnut
    { r: 45, g: 30, b: 20 },  // Amber rosewood
  ];

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const plankIdxX = Math.floor(px / plankWidth);
      const plankOffset = (plankIdxX % 2) * (plankLength / 2);
      const staggeredY = (py + plankOffset) % plankLength;

      const baseTone = plankTones[plankIdxX % plankTones.length];

      // Natural longitudinal grain fibers
      const localX = px % plankWidth;
      const grainMajor = Math.sin(localX * 0.35 + Math.sin(py * 0.04) * 2.5) * 0.5 + 0.5;
      const grainFine = Math.sin(localX * 1.2 + Math.cos(py * 0.12) * 1.2) * 0.5 + 0.5;
      const microNoise = ((px * 31 + py * 59) % 23) / 23.0 - 0.5;

      const grainBrightness = (grainMajor * 0.6 + grainFine * 0.4 + microNoise * 0.15) * 14 - 7;

      let r = baseTone.r + grainBrightness;
      let g = baseTone.g + grainBrightness * 0.85;
      let b = baseTone.b + grainBrightness * 0.7;

      // Dark beveled seam borders between planks
      const distToEdgeX = Math.min(localX, plankWidth - localX);
      const distToEdgeY = Math.min(staggeredY, plankLength - staggeredY);
      const seamDist = Math.min(distToEdgeX, distToEdgeY);

      if (seamDist < 2.5) {
        const seamFactor = Math.max(0.2, seamDist / 2.5);
        r *= seamFactor;
        g *= seamFactor;
        b *= seamFactor;
      }

      const idx = (py * size + px) * 4;
      pixels[idx] = Math.min(255, Math.max(0, Math.round(r)));
      pixels[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      pixels[idx + 2] = Math.min(255, Math.max(0, Math.round(b)));
      pixels[idx + 3] = 255;
    }
  }

  return pixelTexture(size, pixels);
}

/**
 * Square luxury dark wooden floor. The scene's DomeFade on
 * this node softly blends it into the ambient dark background at distance.
 */
export function createStudioFloor(size = 36): Group {
  const woodTexture = createHardwoodFloorTexture(512);
  woodTexture.wrapS = woodTexture.wrapT = RepeatWrapping;
  // Planks: ~0.18m wide x 1.4m long in world space
  woodTexture.repeat.set(size / 0.72, size / 1.44);

  const floor = createScenePrimitiveObject(
    { geometry: { type: 'plane', size: [size, size] } },
    new MeshStandardMaterial({
      map: woodTexture,
      roughness: 0.38,
      metalness: 0.05,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  const root = new Group();
  root.add(floor);
  return root;
}

/** Low turned stage with an inset stone ring. */
export function createStage(radius = 1.85): Group {
  const height = 0.035;
  const disc = createScenePrimitiveObject(
    {
      geometry: {
        type: 'lathe',
        profile: [
          [0.001, 0],
          [radius, 0],
          [radius + 0.004, height * 0.5],
          [radius - 0.012, height],
          [0.001, height],
        ],
        segments: 128,
      },
    },
    clayMaterial,
  );
  const inlay = createScenePrimitiveObject(
    {
      geometry: {
        type: 'torus',
        radius: radius - 0.16,
        tube: 0.012,
        radialSegments: 8,
        tubularSegments: 192,
      },
    },
    stoneMaterial,
  );
  inlay.rotation.x = -Math.PI / 2;
  inlay.scale.z = 0.3;
  inlay.position.y = height;
  const stage = new Group();
  stage.add(disc, inlay);
  return stage;
}

/** Pedestal: a warm stone slab on a tapered clay pillar with a turned foot. */
export function createPlinth(height = 0.92, width = 0.8): Group {
  const pillar = createScenePrimitiveObject(
    {
      geometry: {
        type: 'lathe',
        profile: [
          [0.001, 0],
          [0.16, 0],
          [0.17, 0.018],
          [0.16, 0.04],
          [0.09, 0.085],
          [0.066, 0.3],
          [0.06, height - 0.12],
          [0.11, height - 0.06],
          [0.001, height - 0.055],
        ],
        segments: 64,
      },
    },
    clayMaterial,
  );
  const top = createScenePrimitiveObject(
    {
      geometry: {
        type: 'roundedBox',
        size: [width, 0.055, width * 0.72],
        radius: 0.022,
        segments: 4,
      },
    },
    stoneMaterial,
  );
  top.position.y = height - 0.0275;
  const plinth = new Group();
  plinth.add(pillar, top);
  return plinth;
}

/** Rounded graphite cube with its origin at the center. */
export function createGraphiteCube(size = 0.13): Mesh {
  return createScenePrimitiveObject(
    {
      geometry: {
        type: 'roundedBox',
        size: [size, size, size],
        radius: size * 0.12,
        segments: 5,
      },
    },
    graphiteMaterial,
  );
}

/** Faceted graphite gem. */
export function createGraphiteGem(radius = 0.085): Mesh {
  return new Mesh(new IcosahedronGeometry(radius, 0), graphiteMaterial);
}

/** Graphite trefoil knot. */
export function createGraphiteKnot(): Mesh {
  return new Mesh(
    new TorusKnotGeometry(0.1, 0.032, 200, 24, 2, 3),
    graphiteMaterial,
  );
}

/** Upright graphite ring. */
export function createGraphiteRing(radius = 0.2): Mesh {
  return createScenePrimitiveObject(
    {
      geometry: {
        type: 'torus',
        radius,
        tube: 0.035,
        radialSegments: 24,
        tubularSegments: 96,
      },
    },
    graphiteMaterial,
  );
}
