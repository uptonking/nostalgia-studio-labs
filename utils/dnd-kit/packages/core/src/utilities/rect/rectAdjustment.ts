import { type ClientRect, type Coordinates } from '../../types';

/** return fn, apply adjustments to rect */
export function createRectAdjustmentFn(modifier: number) {
  return function adjustClientRect(
    rect: ClientRect,
    ...adjustments: Coordinates[]
  ): ClientRect {
    return adjustments.reduce<ClientRect>(
      (acc, adjustment) => ({
        ...acc,
        top: acc.top + modifier * adjustment.y,
        bottom: acc.bottom + modifier * adjustment.y,
        left: acc.left + modifier * adjustment.x,
        right: acc.right + modifier * adjustment.x,
      }),
      { ...rect },
    );
  };
}

export const getAdjustedRect = createRectAdjustmentFn(1);
