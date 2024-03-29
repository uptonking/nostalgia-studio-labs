import { type Ancestor, type Editor, type Node, type RangeRef } from 'slate';

import { type TextInsertion } from '../components/android/diff-text';
import { type Key } from './key';

/**
 * - Two weak maps that allow us rebuild a path given a node.
 * - They are populated at render time such that after a render occurs we can always backtrack.
 */
/** { slaNode: indexInSiblings } */
export const NODE_TO_INDEX: WeakMap<Node, number> = new WeakMap();
/** { slaNode: parentNode }  */
export const NODE_TO_PARENT: WeakMap<Node, Ancestor> = new WeakMap();

/**
 * Weak maps that allow us to go between Slate nodes and DOM nodes. These
 * are used to resolve DOM event-related logic into Slate actions.
 * 存储 slate node节点 和 真实dom节点的映射
 */
export const EDITOR_TO_WINDOW: WeakMap<Editor, Window> = new WeakMap();
export const EDITOR_TO_ELEMENT: WeakMap<Editor, HTMLElement> = new WeakMap();
export const EDITOR_TO_PLACEHOLDER: WeakMap<Editor, string> = new WeakMap();
/** { domElem: slaNode } */
export const ELEMENT_TO_NODE: WeakMap<HTMLElement, Node> = new WeakMap();
/** { slaNode: domElem } */
export const NODE_TO_ELEMENT: WeakMap<Node, HTMLElement> = new WeakMap();
/** { slaNode: key } */
export const NODE_TO_KEY: WeakMap<Node, Key> = new WeakMap();
/** { editor: {key: domElem} }, 使用场景slaNodeTODomNode */
export const EDITOR_TO_KEY_TO_ELEMENT: WeakMap<
  Editor,
  WeakMap<Key, HTMLElement>
> = new WeakMap();

/**
 * Weak maps for storing editor-related state.
 */
export const IS_READ_ONLY: WeakMap<Editor, boolean> = new WeakMap();
export const IS_FOCUSED: WeakMap<Editor, boolean> = new WeakMap();
export const IS_DRAGGING: WeakMap<Editor, boolean> = new WeakMap();
export const IS_CLICKING: WeakMap<Editor, boolean> = new WeakMap();
export const IS_COMPOSING: WeakMap<Editor, boolean> = new WeakMap();
export const IS_ON_COMPOSITION_END: WeakMap<Editor, boolean> = new WeakMap();

export const EDITOR_TO_USER_SELECTION: WeakMap<Editor, RangeRef> =
  new WeakMap();

/**
 * Weak maps for saving text on composition stage.
 */
export const EDITOR_ON_COMPOSITION_TEXT: WeakMap<Editor, TextInsertion[]> =
  new WeakMap();

/**
 * Weak map for associating the context `onChange` context with the plugin.
 */
export const EDITOR_TO_ON_CHANGE = new WeakMap<Editor, () => void>();

export const NODE_TO_RESTORE_DOM = new WeakMap<Node, () => void>();

/**
 * Symbols.
 */
export const PLACEHOLDER_SYMBOL = Symbol('placeholder') as unknown as string;
