import React, { useCallback, useReducer, useRef, useState } from 'react';

import cx from 'clsx';
import { createEditor, type Descendant, Editor } from 'slate';
import { DefaultEditable as Editable, ReactEditor, Slate } from 'slate-react';

import {
  type CustomEditor,
  type CustomElement,
  type CustomText,
  DndFeatureProvider,
  DragOverlayContent,
  useEditor,
  usePersistedState,
  usePlugins,
  usePluginsHandlers,
  useRenderElement,
  useRenderLeaf,
} from '../../src';
import { NosNavbar, NosToolbar } from '../components/noseditor-full';
import {
  initialData,
  initialDataLong,
  listData,
  simpleTableData,
} from '../config';

export const NosEditorFullFeatures = (props) => {
  const { id = 'mainNosEditor', initialValue = initialData } = props;

  const forceRerender = useReducer(() => ({}), {})[1];

  const [isReadOnly, setIsReadOnly] = useState(false);
  const [editorKey, setEditorKey] = useState<string>('');

  const plugins = usePlugins();
  const editor = useEditor(createEditor, plugins) as CustomEditor;
  window['ed'] = editor;

  const handlers = usePluginsHandlers(editor, [
    ...plugins,
    {
      handlers: {
        onKeyDown: () => () => {
          // after dnd ends then ReactEditor.focus call, to continue typing
          forceRerender();
        },
        // onClick: () => () => {
        //   if (editor.selection?.anchor) {
        //     const pathClone = [...editor.selection.anchor.path];
        //     pathClone.pop(); // get rid of trailing text node postion in path.
        //     const anchorNode = pathClone.reduce((node, pathPosition) => {
        //       if (!node) return editor.children[pathPosition];
        //       // @ts-expect-error fix-types
        //       return node.children[pathPosition];
        //     }, null);
        //     console.log(
        //       ';; ed-sel-start ',
        //       editor.selection?.anchor,
        //       anchorNode,
        //       // ExtendedEditor.semanticNode(anchorNode),
        //     );
        //   }
        // },
      },
    },
  ]);

  const renderElement = useRenderElement(editor, plugins);
  const renderLeaf = useRenderLeaf(editor, plugins);

  const [value, setValue] = usePersistedState<Descendant[]>(
    `${id}_content`,
    (restored) => (isReadOnly ? initialValue : restored ?? initialValue),
  );

  const resetEditorContents = useCallback(() => {
    editor.selection = null;
    editor.children = initialValue;
    setValue(initialValue);
    setIsReadOnly(false);
    setEditorKey(String(Math.random()) + Math.random());
  }, [editor, initialValue, setValue]);

  // console.log(';; editorKey ', editorKey, value, editor.children);

  return (
    <div className='nosedit-app'>
      <Slate key={editorKey} editor={editor} value={value} onChange={setValue}>
        <div className='nosedit-header'>
          <NosNavbar {...{ isReadOnly, setIsReadOnly, resetEditorContents }} />
          <NosToolbar />
        </div>
        <div className='nosedit-body'>
          <div className='nos-editor-container'>
            <DndFeatureProvider
              editor={editor}
              onDragEnd={useCallback(() => {
                // after dnd ends to provide the right DragOverlay drop animation
                forceRerender();
              }, [forceRerender])}
              renderDragOverlay={useCallback(
                (props) => (
                  <DragOverlayContent {...props} />
                ),
                [],
              )}
            >
              <Editable
                className={cx('nos-editable', { 'nos-readonly': isReadOnly })}
                readOnly={isReadOnly}
                renderElement={renderElement}
                renderLeaf={renderLeaf}
                {...handlers}
              />
            </DndFeatureProvider>
          </div>
        </div>
      </Slate>
    </div>
  );
};
