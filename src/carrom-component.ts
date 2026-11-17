/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createComponent, Types } from '@iwsdk/core';

export const CarromPieceType = {
  White: 'white',
  Black: 'black',
  Queen: 'queen',
  Striker: 'striker',
} as const;

export const CarromPiece = createComponent('CarromPiece', {
  pieceType: {
    type: Types.Enum,
    enum: CarromPieceType,
    default: CarromPieceType.White,
  },
  initialX: { type: Types.Float32, default: 0 },
  initialY: { type: Types.Float32, default: 0 },
  initialZ: { type: Types.Float32, default: 0 },
  pocketed: { type: Types.Boolean, default: false },
});
