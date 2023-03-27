import React, { DOMAttributes, SyntheticEvent } from 'react';

import { flatten, mergeWith } from 'ramda';
import { Editor } from 'slate';

import type { EnhanceEditorFnOrWithArgs } from '../plugins/types';

/** apply plugin in reverse order */
export const composePlugins = (
  plugins: EnhanceEditorFnOrWithArgs[],
  _editor: Editor,
) => {
  let editor = _editor;
  for (const plugin of plugins.reverse()) {
    if (typeof plugin === 'function') {
      editor = plugin(editor);
    } else {
      editor = plugin.withEnhance.apply(
        null,
        plugin.withArgs ? [editor, ...plugin.withArgs] : [editor],
      );
    }
  }

  return editor;
};

type KeysMatching<T extends object, V> = {
  [K in keyof T]-?: T[K] extends V ? K : never;
}[keyof T];

type Handler = React.EventHandler<SyntheticEvent> | undefined;
type EditorHandler = (editor: Editor) => Handler;
type DOMHandlersKeys = KeysMatching<DOMAttributes<Element>, Handler>;

/**
 * compose event handlers of the same name into one event
 *
 * todo remove ramda
 */
export const composeHandlers = (
  editor: Editor,
  handlersConfig: Partial<Record<DOMHandlersKeys, EditorHandler>>[],
) => {
  const grouped = handlersConfig.reduce(
    (acc, x) => mergeWith((a, b) => flatten([a, b]), acc, x),
    {},
  ) as unknown as Record<DOMHandlersKeys, Array<EditorHandler>>;
  // console.log(';; grouped ', grouped, handlersConfig);

  const composed: Partial<Record<string, Handler>> = {};
  for (const [eventName, callbacks] of Object.entries(grouped)) {
    let _callbacks = callbacks;
    if (!Array.isArray(callbacks)) {
      _callbacks = [callbacks];
    }

    composed[eventName] = (e: SyntheticEvent) => {
      _callbacks.forEach((handler) => handler && handler(editor)!(e));
    };
  }

  return composed as Partial<Record<DOMHandlersKeys, Handler>>;
};