import { Element } from 'slate';

import type { BlockquoteElement, BlockquoteType } from './types';

export const BlockquoteSpec: BlockquoteType = 'blockquote';

export const isBlockquoteElement = (value: any): value is BlockquoteElement => {
  return Element.isElementType<BlockquoteElement>(value, BlockquoteSpec);
};
