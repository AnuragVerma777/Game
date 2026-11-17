/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AssetType, defineAssets } from '@iwsdk/core';
import {
  createCarromBoard,
  createCarromCoin,
  createCarromStriker,
} from './scene-assets/carrom.scene-asset.js';
import { createStudioFloor } from './scene-assets/studio.scene-asset.js';

const publicAssetUrl = (filePath: string): string =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

const uikitml = (fileName: string, name: string) => ({
  url: publicAssetUrl(`ui/${fileName}`),
  type: AssetType.UIKitML,
  name,
});

export default defineAssets({
  'studio-floor': createStudioFloor(),
  'carrom-board': createCarromBoard(),
  'coin-white': createCarromCoin('white'),
  'coin-black': createCarromCoin('black'),
  'coin-queen': createCarromCoin('queen'),
  'carrom-striker': createCarromStriker(),
  'carrom-panel': uikitml('carrom-panel.uikitml', 'Carrom Panel'),
});
