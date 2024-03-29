import React, { useCallback } from 'react';

import cx from 'clsx';
import { type Element } from 'slate';
import {
  type ReactEditor,
  type RenderElementProps,
  useSelected,
  useSlateStatic,
} from 'slate-react';

import { DraggableCollapsibleEditor, useDndContext } from '../../../plugins';
import { toggleCollapsibleElement } from '../../../plugins/draggable-collapsible-feature/commands';
import { type IdentityElement } from '../../../plugins/draggable-collapsible-feature/types';
import { ELEMENT_TO_SEMANTIC_PATH } from '../../../plugins/draggable-collapsible-feature/weakmaps';
import { isCheckboxListItemElement } from '../../../plugins/list/utils';
import { createListItemAttributes } from '../../../plugins/serialization/utils';
import { ListItemDefaultIndentWidth } from '../../../utils/constants';
import { UnitItem, type UnitItemProps } from './components/unit-item';
import { UnitSortable } from './components/unit-sortable';
import { useDraggableObserver } from './use-draggable-observer';

/**
 * may wrap item in sortable container
 */
export const DraggableContainer = (
  props: Omit<RenderElementProps, 'children'> & { children: React.ReactNode },
) => {
  const { attributes, children } = props;
  const element = props.element as IdentityElement & Element;
  const { activeId, activeElement, dragDepth, dragOverlayHeight } =
    useDndContext();

  const editor = useSlateStatic() as DraggableCollapsibleEditor & ReactEditor;
  const selected = useSelected();
  const id = element.id!;

  // 🚨 hack，在Editable rerender而SlateProvider未更新时手动跟新dargSort信息
  // todo 减少计算量
  editor.semanticChildren = DraggableCollapsibleEditor.getSemanticChildren(
    editor,
    editor.children,
    {
      setPath: (element, path) => {
        ELEMENT_TO_SEMANTIC_PATH.set(element, path);
      },
    },
  );

  const semanticNode = DraggableCollapsibleEditor.semanticNode(element);
  // console.log(';; getSemNode ', semanticNode.element.children[0]);
  const { listIndex } = semanticNode;
  const isHiddenById =
    DraggableCollapsibleEditor.isNestableElement(editor, activeElement) &&
    activeId !== id &&
    DraggableCollapsibleEditor.isHiddenById(element, activeId);
  const hidden = semanticNode.hidden || isHiddenById;

  const isInViewport = useDraggableObserver(attributes.ref, activeId != null, [
    hidden,
  ]);

  const isSortableEnabled =
    !hidden && (selected || isInViewport || activeId === element.id);

  const handleCollapse = useCallback(() => {
    toggleCollapsibleElement(editor, element);
  }, [editor, element]);

  const itemProps: UnitItemProps = {
    element: element,
    elementRef: attributes.ref,
    selected: selected,
    hidden: hidden,
    onCollapse: handleCollapse,
    isInViewport: isInViewport,
    dragDepth: dragDepth,
  };

  const isDragging = activeId === id;

  /** indent for list */
  const realSpacing = DraggableCollapsibleEditor.isNestableElement(
    editor,
    element,
  )
    ? ListItemDefaultIndentWidth * element.depth
    : 0;

  const dragSpacing = ListItemDefaultIndentWidth * dragDepth;

  const spellCheck = selected ? 'true' : 'false';

  const Tag = DraggableCollapsibleEditor.isNestableElement(editor, element)
    ? 'li'
    : 'div';

  // console.log(';; isSortableEnabled ', isSortableEnabled)
  return (
    <Tag
      spellCheck={spellCheck}
      {...attributes}
      {...(DraggableCollapsibleEditor.isNestableElement(editor, element)
        ? createListItemAttributes({
            depth: element.depth,
            // @ts-expect-error fix-types
            listType: element.listType,
            index: listIndex,
            checked: isCheckboxListItemElement(element) && element.checked,
          })
        : {})}
      // ? data-slate-node-type only used for css?
      data-slate-node-type={element['type']}
      className={cx('item-container', 'clipboardSkipLinebreak', {
        'item-container-list': DraggableCollapsibleEditor.isNestableElement(
          editor,
          element,
        ),
        dragging: activeId === id,
      })}
      style={
        {
          '--spacing': `${isDragging ? dragSpacing : realSpacing}px`,
          ...(dragOverlayHeight
            ? {
                '--drag-overlay-height': `${dragOverlayHeight}px`,
              }
            : null),
        } as React.CSSProperties
      }
    >
      {isSortableEnabled ? (
        <UnitSortable id={id} {...itemProps}>
          {/* <span>{realSpacing}{' - '   + ' - ' +ExtendedEditor.hasSemanticChildren(element)}</span> */}
          {children}
        </UnitSortable>
      ) : (
        <UnitItem {...itemProps}>{children}</UnitItem>
      )}
    </Tag>
  );
};
