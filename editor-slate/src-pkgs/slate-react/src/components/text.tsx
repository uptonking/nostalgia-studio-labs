import React, { useRef } from 'react';
import { type Element, type Range, Text as SlateText } from 'slate';

import { useContentKey } from '../hooks/use-content-key';
import { useIsomorphicLayoutEffect } from '../hooks/use-isomorphic-layout-effect';
import { IS_ANDROID } from '../utils/environment';
import { isDecoratorRangeListEqual } from '../utils/range-list';
import {
  EDITOR_TO_KEY_TO_ELEMENT,
  ELEMENT_TO_NODE,
  NODE_TO_ELEMENT,
} from '../utils/weak-maps';
import { type RenderLeafProps, type RenderPlaceholderProps } from './editable';
import Leaf from './leaf';
import { ReactEditor, useSlateStatic } from '..';

/**
 * Text.
 */
const Text = (props: {
  decorations: Range[];
  isLast: boolean;
  parent: Element;
  renderPlaceholder: (props: RenderPlaceholderProps) => JSX.Element;
  renderLeaf?: (props: RenderLeafProps) => JSX.Element;
  text: SlateText;
}) => {
  const { decorations, isLast, parent, renderPlaceholder, renderLeaf, text } =
    props;
  const editor = useSlateStatic();
  const ref = useRef<HTMLSpanElement>(null);
  const leaves = SlateText.decorations(text, decorations);
  const key = ReactEditor.findKey(editor, text);
  const children = [];

  for (let i = 0; i < leaves.length; i++) {
    const leaf = leaves[i];

    children.push(
      <Leaf
        isLast={isLast && i === leaves.length - 1}
        key={`${key.id}-${i}`}
        renderPlaceholder={renderPlaceholder}
        leaf={leaf}
        text={text}
        parent={parent}
        renderLeaf={renderLeaf}
      />,
    );
  }

  // Update element-related weak maps with the DOM element ref.
  useIsomorphicLayoutEffect(() => {
    const KEY_TO_ELEMENT = EDITOR_TO_KEY_TO_ELEMENT.get(editor);
    if (ref.current) {
      KEY_TO_ELEMENT?.set(key, ref.current);
      NODE_TO_ELEMENT.set(text, ref.current);
      ELEMENT_TO_NODE.set(ref.current, text);
    } else {
      KEY_TO_ELEMENT?.delete(key);
      NODE_TO_ELEMENT.delete(text);
    }
  });

  // const contentKey = IS_ANDROID ? useContentKey(text) : undefined;
  const contentKey = undefined;

  return (
    <span data-slate-node='text' ref={ref} key={contentKey}>
      {children}
    </span>
  );
};

const MemoizedText = React.memo(Text, (prev, next) => {
  return (
    next.parent === prev.parent &&
    next.isLast === prev.isLast &&
    next.renderLeaf === prev.renderLeaf &&
    next.text === prev.text &&
    isDecoratorRangeListEqual(next.decorations, prev.decorations)
  );
});

export default MemoizedText;
