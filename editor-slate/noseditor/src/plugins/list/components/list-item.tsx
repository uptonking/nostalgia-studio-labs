import './styles.scss';

import React from 'react';

import cx from 'clsx';
import { useSlate, useSlateStatic } from 'slate-react';

import { ExtendedEditor } from '../../../slate-extended/extended-editor';
import { foldElement } from '../../../slate-extended/transforms/fold-element';
import { ElementProps } from '../../types';
import {
  getBulletedPointerContent,
  getNumberedPointerContent,
} from '../get-pointer-content';
import { checkTodoItem } from '../transforms';
import type { ListItemElement } from '../types';
import { isTodoListItemElement, ListTypes } from '../utils';

export const ListItem = (
  props: ElementProps & { element: ListItemElement },
) => {
  const editor = useSlateStatic();

  const { children, attributes, element } = props;
  const { depth, listType } = element;

  return (
    <div
      {...attributes}
      className={cx('nos-elem', 'list-item', `list-item-${listType}`)}
    >
      {listType === ListTypes.Bulleted && (
        <button
          contentEditable={false}
          className='pointer clipboardSkip'
        // style={
        //   {
        //     '--pointer-content': `"${getBulletedPointerContent(depth)}"`,
        //   } as React.CSSProperties
        // }
        // onMouseDown={() => {
        //   foldElement(editor, element);
        // }}
        >
          {
            // 👀 `+''` is a trick to show cursor when clicking in zero-width string
            getBulletedPointerContent(depth) + ''
          }
        </button>
      )}
      {listType === ListTypes.Numbered ? (
        <NumberedPointer element={element} />
      ) : null}
      {isTodoListItemElement(element) ? (
        <div contentEditable={false} className='pointer clipboardSkip'>
          <input
            type='checkbox'
            checked={Boolean(element.checked)}
            onChange={(e) => checkTodoItem(editor, element, e.target.checked)}
            className='checkbox-pointer'
          />
        </div>
      ) : null}
      <div
        className={cx({
          'list-checkbox-item-content': isTodoListItemElement(element),
        })}
      >
        {children}
      </div>
    </div>
  );
};

/** preceding number of ordered list  */
const NumberedPointer = (props: { element: ListItemElement }) => {
  const editor = useSlate(); // useSlate to rerender pointer content (index) when this element isn't changed directly

  const { element } = props;
  const { depth } = element;

  const semanticNode = ExtendedEditor.semanticNode(element);
  const { listIndex } = semanticNode;

  return (
    <button
      contentEditable={false}
      className='pointer clipboardSkip'
    // style={
    //   {
    //     '--pointer-content': `"${getNumberedPointerContent(
    //       depth,
    //       listIndex,
    //     )}"`,
    //   } as React.CSSProperties
    // }
    // onMouseDown={() => {
    //   foldElement(editor, element);
    // }}
    >
      {getNumberedPointerContent(depth, listIndex) + '.'}
    </button>
  );
};

export default ListItem;
