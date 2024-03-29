import { isPlainObject } from 'is-plain-object';

import {
  type Ancestor,
  type ExtendedType,
  type Location,
  Node,
  type NodeEntry,
  Operation,
  Path,
  type PathRef,
  Point,
  type PointRef,
  Range,
  type RangeRef,
  Span,
  Text,
} from '../../src';
import {
  getCharacterDistance,
  getWordDistance,
  splitByCharacterDistance,
} from '../utils/string';
import {
  DIRTY_PATH_KEYS,
  DIRTY_PATHS,
  NORMALIZING,
  PATH_REFS,
  POINT_REFS,
  RANGE_REFS,
} from '../utils/weak-maps';
import { Element } from './element';
import { type Descendant } from './node';
import {
  type LeafEdge,
  type MaximizeMode,
  type RangeDirection,
  type SelectionMode,
  type TextDirection,
  type TextUnit,
  type TextUnitAdjustment,
} from './types';

export type BaseSelection = Range | null;

/**
 * - selection is a special range that is a property of the top-level Editor
 * - selection concept is also borrowed from the DOM, although in a greatly-simplified form
 * - Slate doesn't allow for multiple ranges inside a single selection, which makes things a lot easier to work with.
 */
export type Selection = ExtendedType<'Selection', BaseSelection>;

export type EditorMarks = Omit<Text, 'text'>;

/**
 * The `Editor` interface stores all the state of a Slate editor. It is extended
 * by plugins that wish to add their own helpers and implement new behaviors.
 */
export interface BaseEditor {
  /** contains the document tree of nodes that make up the editor's content */
  children: Descendant[];
  /** contains the user's current selection, if any. Don't set it directly; use `Transforms.select` */
  selection: Selection;
  /** stores formatting to be applied when the editor inserts text. If marks is null, the formatting will be taken from the current selection.
   * - Don't set it directly; use `Editor.addMark` and `Editor.removeMark`.
   * - represents text-level formatting that will be applied to the next character that is inserted.
   * - This state isn't stored in the document, and is instead stored as an extra property on the editor itself.
   */
  marks: EditorMarks | null;
  /** contains all of the operations that have been applied since the last "change" was flushed.
   * (Since Slate batches operations up into ticks of the event loop.) */
  operations: Operation[];

  // Schema-specific node behaviors.
  /**
   * - return `false` by default; All elements default to being "block" elements.
   * - Note that inline nodes cannot be the first or last child of a parent block,
   * nor can they be next to another inline node in the `children` array.
   * Slate will automatically space these with `{ text: '' }` children by default with `normalizeNode`.
   * - elements cannot contain some children that are blocks and some that are inlined.
   */
  isInline: (element: Element) => boolean;
  /**
   * - Elements default to being non-void, meaning that their children are fully editable as text.
   * - Void Elements must
   *   - always have one empty child text node (for selection)
   *   - render using attributes and children (so, their outermost HTML element can't be an HTML void element)
   *   - set `contentEditable={false}` (for Firefox)
   */
  isVoid: (element: Element) => boolean;
  /**
   * - "Normalizing" is how you can ensure that your editor's content is always of a certain shape.
   * - It's similar to "validating", except instead of just determining whether the content is valid or invalid, its job is to fix the content to make it valid again.
   * - `normalizeNode` function gets called every time an operation is applied that inserts or updates a node (or its descendants),
   * giving you the opportunity to ensure that the changes didn't leave it in an invalid state, and correcting the node if so.
   * - One thing to understand about normalizeNode constraints is that they are multi-pass.
   */
  normalizeNode: (entry: NodeEntry) => void;
  /** 内容或选区op执行完后，还需要执行的逻辑 */
  onChange: () => void;

  // Overrideable core actions.
  /**
   * - Add a custom property to the leaf text nodes in the current selection.
   * - If the selection is currently collapsed, the marks will be added to the
   * `editor.marks` property instead, and applied when text is inserted next.
   * - 具体逻辑在create-editor中实现
   */
  addMark: (key: string, value: any) => void;
  removeMark: (key: string) => void;
  /** apply is implemented in `createEditor()` */
  apply: (operation: Operation) => void;
  /**
   * Delete content in the editor backward from the current selection.
   */
  deleteBackward: (unit: TextUnit) => void;
  deleteForward: (unit: TextUnit) => void;
  deleteFragment: (direction?: TextDirection) => void;
  getFragment: () => Descendant[];
  /**
   * Insert a block break at the current selection.
   * - If the selection is currently expanded, it will be deleted first.
   */
  insertBreak: () => void;
  insertSoftBreak: () => void;
  /**
   * Insert a fragment at the current selection.
   * - If the selection is currently expanded, it will be deleted first.
   */
  insertFragment: (fragment: Node[]) => void;
  /** Inserts a node at the current selection.
   * - If the selection is currently expanded, it will be deleted first.
   * - To atomically insert a node (including at the very beginning or end), use `Transforms.insertNodes`.
   */
  insertNode: (node: Node) => void;
  /** Inserts text at the current selection.
   * - If the selection is currently expanded, it will be deleted first. */
  insertText: (text: string) => void;
}

/** A root-level `Editor` node that contains the entire document's content. */
export type Editor = ExtendedType<'Editor', BaseEditor>;

export interface EditorAboveOptions<T extends Ancestor> {
  at?: Location;
  match?: NodeMatch<T>;
  mode?: MaximizeMode;
  voids?: boolean;
}

export interface EditorAfterOptions {
  distance?: number;
  unit?: TextUnitAdjustment;
  voids?: boolean;
}

export interface EditorBeforeOptions {
  distance?: number;
  unit?: TextUnitAdjustment;
  voids?: boolean;
}

export interface EditorDirectedDeletionOptions {
  unit?: TextUnit;
}

export interface EditorFragmentDeletionOptions {
  direction?: TextDirection;
}

export interface EditorLeafOptions {
  depth?: number;
  edge?: LeafEdge;
}

export interface EditorLevelsOptions<T extends Node> {
  at?: Location;
  match?: NodeMatch<T>;
  reverse?: boolean;
  voids?: boolean;
}

export interface EditorNextOptions<T extends Descendant> {
  at?: Location;
  match?: NodeMatch<T>;
  mode?: SelectionMode;
  voids?: boolean;
}

export interface EditorNodeOptions {
  depth?: number;
  edge?: LeafEdge;
}

export interface EditorNodesOptions<T extends Node> {
  /** selects a Location in the editor. It defaults to the user's current selection. */
  at?: Location | Span;
  /** filters the set of Nodes with a custom function.  */
  match?: NodeMatch<T>;
  /** If `lowest`, returns the lowest matching ancestor.
   * - If `highest`, returns the highest matching ancestor. */
  mode?: SelectionMode;
  universal?: boolean;
  reverse?: boolean;
  /** When voids is false, void Elements are filtered out. */
  voids?: boolean;
}

export interface EditorNormalizeOptions {
  force?: boolean;
}

export interface EditorParentOptions {
  depth?: number;
  edge?: LeafEdge;
}

export interface EditorPathOptions {
  /** start from 0 */
  depth?: number;
  edge?: LeafEdge;
}

export interface EditorPathRefOptions {
  affinity?: TextDirection | null;
}

export interface EditorPointOptions {
  edge?: LeafEdge;
}

export interface EditorPointRefOptions {
  affinity?: TextDirection | null;
}

export interface EditorPositionsOptions {
  at?: Location;
  unit?: TextUnitAdjustment;
  reverse?: boolean;
  voids?: boolean;
}

export interface EditorPreviousOptions<T extends Node> {
  at?: Location;
  match?: NodeMatch<T>;
  mode?: SelectionMode;
  voids?: boolean;
}

export interface EditorRangeRefOptions {
  affinity?: RangeDirection | null;
}

export interface EditorStringOptions {
  voids?: boolean;
}

export interface EditorUnhangRangeOptions {
  voids?: boolean;
}

export interface EditorVoidOptions {
  at?: Location;
  mode?: MaximizeMode;
  voids?: boolean;
}

export interface EditorInterface {
  /** Get the matching ancestor above a location in the document. */
  above: <T extends Ancestor>(
    editor: Editor,
    options?: EditorAboveOptions<T>,
  ) => NodeEntry<T> | undefined;
  /**
   * - Add a custom property to the leaf text nodes in the current selection.
   * - If the selection is currently collapsed, the marks will be added to the
   * `editor.marks` property instead, and applied when text is inserted next.
   * - 具体逻辑在create-editor中实现，会执行 Transfroms.setNodes
   */
  addMark: (editor: Editor, key: string, value: any) => void;
  /**
   * Remove a custom property from all of the leaf text nodes in the current
   * selection.
   * - If the selection is currently collapsed, the removal will be stored on
   * `editor.marks` and applied to the text inserted next.
   */
  removeMark: (editor: Editor, key: string) => void;
  /**
   * Delete content in the editor backward from the current selection.
   */
  deleteBackward: (
    editor: Editor,
    options?: EditorDirectedDeletionOptions,
  ) => void;
  deleteForward: (
    editor: Editor,
    options?: EditorDirectedDeletionOptions,
  ) => void;
  deleteFragment: (
    editor: Editor,
    options?: EditorFragmentDeletionOptions,
  ) => void;
  /** Get the point after a location. If there is no point after the location (e.g. we are at the bottom of the document) returns undefined. */
  after: (
    editor: Editor,
    at: Location,
    options?: EditorAfterOptions,
  ) => Point | undefined;
  /** Get the point before a location. If there is no point before the location (e.g. we are at the top of the document) returns undefined. */
  before: (
    editor: Editor,
    at: Location,
    options?: EditorBeforeOptions,
  ) => Point | undefined;
  edges: (editor: Editor, at: Location) => [Point, Point];
  /**
   * Get the end point of a location.
   */
  end: (editor: Editor, at: Location) => Point;
  /**
   * Get the start point of a location.
   */
  start: (editor: Editor, at: Location) => Point;
  /** Get the first node at a location. */
  first: (editor: Editor, at: Location) => NodeEntry;
  /** Get the fragment at a location. */
  fragment: (editor: Editor, at: Location) => Descendant[];
  hasBlocks: (editor: Editor, element: Element) => boolean;
  hasInlines: (editor: Editor, element: Element) => boolean;
  hasPath: (editor: Editor, path: Path) => boolean;
  hasTexts: (editor: Editor, element: Element) => boolean;
  insertBreak: (editor: Editor) => void;
  insertSoftBreak: (editor: Editor) => void;
  insertFragment: (editor: Editor, fragment: Node[]) => void;
  insertNode: (editor: Editor, node: Node) => void;
  insertText: (editor: Editor, text: string) => void;
  isBlock: (editor: Editor, value: any) => value is Element;
  isEditor: (value: any) => value is Editor;
  isEnd: (editor: Editor, point: Point, at: Location) => boolean;
  isEdge: (editor: Editor, point: Point, at: Location) => boolean;
  isEmpty: (editor: Editor, element: Element) => boolean;
  isInline: (editor: Editor, value: any) => value is Element;
  isNormalizing: (editor: Editor) => boolean;
  isStart: (editor: Editor, point: Point, at: Location) => boolean;
  isVoid: (editor: Editor, value: any) => value is Element;
  last: (editor: Editor, at: Location) => NodeEntry;
  /** Get the leaf text node at a location. */
  leaf: (
    editor: Editor,
    at: Location,
    options?: EditorLeafOptions,
  ) => NodeEntry<Text>;
  /** Iterate through all of the levels at a location. */
  levels: <T extends Node>(
    editor: Editor,
    options?: EditorLevelsOptions<T>,
  ) => Generator<NodeEntry<T>, void, undefined>;
  /** Get the marks that would be added to text at the current selection. */
  marks: (editor: Editor) => Omit<Text, 'text'> | null;
  /** Get the matching node in the branch of the document after a location.
Note: If you are looking for the next Point, and not the next Node, you are probably looking for the method Editor.after */
  next: <T extends Descendant>(
    editor: Editor,
    options?: EditorNextOptions<T>,
  ) => NodeEntry<T> | undefined;
  /** Get the node at a location */
  node: (
    editor: Editor,
    at: Location,
    options?: EditorNodeOptions,
  ) => NodeEntry;
  /**
   * At any given Location or Span in the editor provided by `at` (default is the current selection),
   * this method returns a Generator of NodeEntry objects that represent the nodes that include `at`.
   * At the top of the hierarchy is the Editor object itself.
   */
  nodes: <T extends Node>(
    editor: Editor,
    options?: EditorNodesOptions<T>,
  ) => Generator<NodeEntry<T>, void, undefined>;
  /** Normalize any dirty objects in the editor. */
  normalize: (editor: Editor, options?: EditorNormalizeOptions) => void;
  /** Get the parent node of a location. */
  parent: (
    editor: Editor,
    at: Location,
    options?: EditorParentOptions,
  ) => NodeEntry<Ancestor>;
  /**
   * Get the path of a location.
   */
  path: (editor: Editor, at: Location, options?: EditorPathOptions) => Path;
  pathRef: (
    editor: Editor,
    path: Path,
    options?: EditorPathRefOptions,
  ) => PathRef;
  pathRefs: (editor: Editor) => Set<PathRef>;
  /** Get the start or end point of a location. */
  point: (editor: Editor, at: Location, options?: EditorPointOptions) => Point;
  pointRef: (
    editor: Editor,
    point: Point,
    options?: EditorPointRefOptions,
  ) => PointRef;
  pointRefs: (editor: Editor) => Set<PointRef>;
  /** Iterate through all of the positions in the document where a Point can be placed.
   * The first Point returns is always the starting point followed by the next Point as determined by the unit option.
   * Note: By default void nodes are treated as a single point and iteration will not happen inside their content unless you pass in true for the voids option, then iteration will occur
   * */
  positions: (
    editor: Editor,
    options?: EditorPositionsOptions,
  ) => Generator<Point, void, undefined>;
  /** Get the matching `Node` in the branch of the document before a location.
Note: If you are looking for the previous `Point`, and not the previous `Node`, you are probably looking for the method `Editor.before` */
  previous: <T extends Node>(
    editor: Editor,
    options?: EditorPreviousOptions<T>,
  ) => NodeEntry<T> | undefined;
  /** Get a range of a location. */
  range: (editor: Editor, at: Location, to?: Location) => Range;
  rangeRef: (
    editor: Editor,
    range: Range,
    options?: EditorRangeRefOptions,
  ) => RangeRef;
  rangeRefs: (editor: Editor) => Set<RangeRef>;
  setNormalizing: (editor: Editor, isNormalizing: boolean) => void;
  /** Get the text string content of a location.
   *
   * Note: by default text of void nodes is considered to be an empty string, regardless of content, unless you pass in true for the voids option */
  string: (
    editor: Editor,
    at: Location,
    options?: EditorStringOptions,
  ) => string;
  /** Convert a range into a non-hanging one.
   * - A "hanging" range is one created by the browser's "triple-click" selection behavior. When triple-clicking a block, the browser selects from the start of that block to the start of the next block. The range thus "hangs over" into the next block.
   * - If unhangRange is given such a range, it moves the end backwards until it's in a non-empty text node that precedes the hanging block.
   * - Note that unhangRange is designed for the specific purpose of fixing triple-clicked blocks, and therefore currently has a number of caveats
   */
  unhangRange: (
    editor: Editor,
    range: Range,
    options?: EditorUnhangRangeOptions,
  ) => Range;
  /**
   * Match a void node in the current branch of the editor.
   */
  void: (
    editor: Editor,
    options?: EditorVoidOptions,
  ) => NodeEntry<Element> | undefined;

  /** Call a function, deferring normalization until after it completes. */
  withoutNormalizing: (editor: Editor, fn: () => void) => void;
}

const IS_EDITOR_CACHE = new WeakMap<object, boolean>();

/**
 * - All of the behaviors, content and state of a Slate editor is rolled up into a single, top-level `Editor` object.
 * - Decorations are different from Marks in that they are not stored on editor state.
 * - Commands are the high-level actions that represent a specific intent of the user.
 *   - They are represented as helper functions on the `Editor` interface
 *   - The concept of commands is loosely based on the DOM's built-in execCommand
 *   - Slate takes care of converting each command into a set of low-level "operations" that are applied to produce a new value
 */
export const Editor: EditorInterface = {
  /**
   * Get the ancestor above a location in the document.
   */
  above<T extends Ancestor>(
    editor: Editor,
    options: EditorAboveOptions<T> = {},
  ): NodeEntry<T> | undefined {
    const {
      voids = false,
      mode = 'lowest',
      at = editor.selection,
      match,
    } = options;

    if (!at) {
      return;
    }

    const path = Editor.path(editor, at);
    const reverse = mode === 'lowest';

    for (const [n, p] of Editor.levels(editor, {
      at: path,
      voids,
      match,
      reverse,
    })) {
      if (!Text.isText(n) && !Path.equals(path, p)) {
        return [n, p];
      }
    }
  },

  addMark(editor: Editor, key: string, value: any): void {
    editor.addMark(key, value);
  },
  removeMark(editor: Editor, key: string): void {
    editor.removeMark(key);
  },

  /**
   * Get the point after a location.
   */
  after(
    editor: Editor,
    at: Location,
    options: EditorAfterOptions = {},
  ): Point | undefined {
    const anchor = Editor.point(editor, at, { edge: 'end' });
    const focus = Editor.end(editor, []);
    const range = { anchor, focus };
    const { distance = 1 } = options;
    let d = 0;
    let target;

    for (const p of Editor.positions(editor, {
      ...options,
      at: range,
    })) {
      if (d > distance) {
        break;
      }

      if (d !== 0) {
        target = p;
      }

      d++;
    }

    return target;
  },

  /**
   * Get the point before a location.
   */

  before(
    editor: Editor,
    at: Location,
    options: EditorBeforeOptions = {},
  ): Point | undefined {
    const anchor = Editor.start(editor, []);
    const focus = Editor.point(editor, at, { edge: 'start' });
    const range = { anchor, focus };
    const { distance = 1 } = options;
    let d = 0;
    let target;

    for (const p of Editor.positions(editor, {
      ...options,
      at: range,
      reverse: true,
    })) {
      if (d > distance) {
        break;
      }

      if (d !== 0) {
        target = p;
      }

      d++;
    }

    return target;
  },

  /**
   * Delete content in the editor backward from the current selection.
   */
  deleteBackward(
    editor: Editor,
    options: EditorDirectedDeletionOptions = {},
  ): void {
    const { unit = 'character' } = options;
    editor.deleteBackward(unit);
  },

  /**
   * Delete content in the editor forward from the current selection.
   */

  deleteForward(
    editor: Editor,
    options: EditorDirectedDeletionOptions = {},
  ): void {
    const { unit = 'character' } = options;
    editor.deleteForward(unit);
  },

  /**
   * Delete the content in the current selection.
   */
  deleteFragment(
    editor: Editor,
    options: EditorFragmentDeletionOptions = {},
  ): void {
    const { direction = 'forward' } = options;
    editor.deleteFragment(direction);
  },

  /**
   * Get the start and end points of a location.
   */
  edges(editor: Editor, at: Location): [Point, Point] {
    return [Editor.start(editor, at), Editor.end(editor, at)];
  },

  /**
   * Get the end point of a location.
   */
  end(editor: Editor, at: Location): Point {
    return Editor.point(editor, at, { edge: 'end' });
  },
  /**
   * Get the start point of a location.
   */
  start(editor: Editor, at: Location): Point {
    return Editor.point(editor, at, { edge: 'start' });
  },

  /**
   * Get the first node at a location.
   */
  first(editor: Editor, at: Location): NodeEntry {
    const path = Editor.path(editor, at, { edge: 'start' });
    return Editor.node(editor, path);
  },

  /**
   * Get the fragment at a location.
   */

  fragment(editor: Editor, at: Location): Descendant[] {
    const range = Editor.range(editor, at);
    const fragment = Node.fragment(editor, range);
    return fragment;
  },
  /**
   * Check if a node has block children.
   */

  hasBlocks(editor: Editor, element: Element): boolean {
    return element.children.some((n) => Editor.isBlock(editor, n));
  },

  /**
   * Check if a node has inline and text children.
   */

  hasInlines(editor: Editor, element: Element): boolean {
    return element.children.some(
      (n) => Text.isText(n) || Editor.isInline(editor, n),
    );
  },

  /**
   * Check if a node has text children.
   */

  hasTexts(editor: Editor, element: Element): boolean {
    return element.children.every((n) => Text.isText(n));
  },

  /**
   * Insert a block break at the current selection.
   *
   * If the selection is currently expanded, it will be deleted first.
   */
  insertBreak(editor: Editor): void {
    editor.insertBreak();
  },

  /**
   * Insert a soft break at the current selection.
   *
   * If the selection is currently expanded, it will be deleted first.
   */

  insertSoftBreak(editor: Editor): void {
    editor.insertSoftBreak();
  },

  /**
   * Insert a fragment at the current selection.
   *
   * If the selection is currently expanded, it will be deleted first.
   */
  insertFragment(editor: Editor, fragment: Node[]): void {
    editor.insertFragment(fragment);
  },

  /**
   * Insert a node at the current selection.
   *
   * If the selection is currently expanded, it will be deleted first.
   */

  insertNode(editor: Editor, node: Node): void {
    editor.insertNode(node);
  },

  /**
   * Insert text at the current selection.
   *
   * If the selection is currently expanded, it will be deleted first.
   */

  insertText(editor: Editor, text: string): void {
    editor.insertText(text);
  },

  /**
   * Check if a value is a block `Element` object.
   */

  isBlock(editor: Editor, value: any): value is Element {
    return Element.isElement(value) && !editor.isInline(value);
  },

  /**
   * Check if a value is an `Editor` object.
   */
  isEditor(value: any): value is Editor {
    if (!isPlainObject(value)) return false;
    const cachedIsEditor = IS_EDITOR_CACHE.get(value);
    if (cachedIsEditor !== undefined) {
      return cachedIsEditor;
    }
    const isEditor =
      typeof value.addMark === 'function' &&
      typeof value.apply === 'function' &&
      typeof value.deleteBackward === 'function' &&
      typeof value.deleteForward === 'function' &&
      typeof value.deleteFragment === 'function' &&
      typeof value.insertBreak === 'function' &&
      typeof value.insertSoftBreak === 'function' &&
      typeof value.insertFragment === 'function' &&
      typeof value.insertNode === 'function' &&
      typeof value.insertText === 'function' &&
      typeof value.isInline === 'function' &&
      typeof value.isVoid === 'function' &&
      typeof value.normalizeNode === 'function' &&
      typeof value.onChange === 'function' &&
      typeof value.removeMark === 'function' &&
      (value.marks === null || isPlainObject(value.marks)) &&
      (value.selection === null || Range.isRange(value.selection)) &&
      Node.isNodeList(value.children) &&
      Operation.isOperationList(value.operations);
    IS_EDITOR_CACHE.set(value, isEditor);
    return isEditor;
  },

  /**
   * Check if a point is the end point of a location.
   */

  isEnd(editor: Editor, point: Point, at: Location): boolean {
    const end = Editor.end(editor, at);
    return Point.equals(point, end);
  },

  /**
   * Check if a point is an edge of a location.
   */

  isEdge(editor: Editor, point: Point, at: Location): boolean {
    return Editor.isStart(editor, point, at) || Editor.isEnd(editor, point, at);
  },

  /**
   * Check if an element is empty, accounting for void nodes.
   */

  isEmpty(editor: Editor, element: Element): boolean {
    const { children } = element;
    const [first] = children;
    return (
      children.length === 0 ||
      (children.length === 1 &&
        Text.isText(first) &&
        first.text === '' &&
        !editor.isVoid(element))
    );
  },

  /**
   * Check if a value is an inline `Element` object.
   */

  isInline(editor: Editor, value: any): value is Element {
    return Element.isElement(value) && editor.isInline(value);
  },

  /**
   * Check if the editor is currently normalizing after each operation.
   */

  isNormalizing(editor: Editor): boolean {
    const isNormalizing = NORMALIZING.get(editor);
    return isNormalizing === undefined ? true : isNormalizing;
  },

  /**
   * Check if a point is the start point of a location.
   */

  isStart(editor: Editor, point: Point, at: Location): boolean {
    // PERF: If the offset isn't `0` we know it's not the start.
    if (point.offset !== 0) {
      return false;
    }

    const start = Editor.start(editor, at);
    return Point.equals(point, start);
  },

  /**
   * Check if a value is a void `Element` object.
   */
  isVoid(editor: Editor, value: any): value is Element {
    return Element.isElement(value) && editor.isVoid(value);
  },

  /**
   * Get the last node at a location.
   */

  last(editor: Editor, at: Location): NodeEntry {
    const path = Editor.path(editor, at, { edge: 'end' });
    return Editor.node(editor, path);
  },

  /**
   * Get the leaf text node at a location.
   */

  leaf(
    editor: Editor,
    at: Location,
    options: EditorLeafOptions = {},
  ): NodeEntry<Text> {
    const path = Editor.path(editor, at, options);
    const node = Node.leaf(editor, path);
    return [node, path];
  },

  /**
   * Iterate through all of the levels at a location.
   */

  *levels<T extends Node>(
    editor: Editor,
    options: EditorLevelsOptions<T> = {},
  ): Generator<NodeEntry<T>, void, undefined> {
    const { at = editor.selection, reverse = false, voids = false } = options;
    let { match } = options;

    if (match == null) {
      match = () => true;
    }

    if (!at) {
      return;
    }

    const levels: NodeEntry<T>[] = [];
    const path = Editor.path(editor, at);

    for (const [n, p] of Node.levels(editor, path)) {
      if (!match(n, p)) {
        continue;
      }

      levels.push([n, p]);

      if (!voids && Editor.isVoid(editor, n)) {
        break;
      }
    }

    if (reverse) {
      levels.reverse();
    }

    yield* levels;
  },

  /**
   * Get the marks that would be added to text at the current selection.
   */

  marks(editor: Editor): Omit<Text, 'text'> | null {
    const { marks, selection } = editor;

    if (!selection) {
      return null;
    }

    if (marks) {
      return marks;
    }

    if (Range.isExpanded(selection)) {
      const [match] = Editor.nodes(editor, { match: Text.isText });

      if (match) {
        const [node] = match as NodeEntry<Text>;
        const { text, ...rest } = node;
        return rest;
      } else {
        return {};
      }
    }

    const { anchor } = selection;
    const { path } = anchor;
    let [node] = Editor.leaf(editor, path);

    if (anchor.offset === 0) {
      const prev = Editor.previous(editor, { at: path, match: Text.isText });
      const block = Editor.above(editor, {
        match: (n) => Editor.isBlock(editor, n),
      });

      if (prev && block) {
        const [prevNode, prevPath] = prev;
        const [, blockPath] = block;

        if (Path.isAncestor(blockPath, prevPath)) {
          node = prevNode as Text;
        }
      }
    }

    const { text, ...rest } = node;
    return rest;
  },

  /**
   * Get the matching node in the branch of the document after a location.
   */

  next<T extends Descendant>(
    editor: Editor,
    options: EditorNextOptions<T> = {},
  ): NodeEntry<T> | undefined {
    const { mode = 'lowest', voids = false } = options;
    let { match, at = editor.selection } = options;

    if (!at) {
      return;
    }

    const pointAfterLocation = Editor.after(editor, at, { voids });

    if (!pointAfterLocation) return;

    const [, to] = Editor.last(editor, []);

    const span: Span = [pointAfterLocation.path, to];

    if (Path.isPath(at) && at.length === 0) {
      throw new Error(`Cannot get the next node from the root node!`);
    }

    if (match == null) {
      if (Path.isPath(at)) {
        const [parent] = Editor.parent(editor, at);
        match = (n) => parent.children.includes(n);
      } else {
        match = () => true;
      }
    }

    const [next] = Editor.nodes(editor, { at: span, match, mode, voids });
    return next;
  },

  /**
   * Get the node at a location.
   */

  node(
    editor: Editor,
    at: Location,
    options: EditorNodeOptions = {},
  ): NodeEntry {
    const path = Editor.path(editor, at, options);
    const node = Node.get(editor, path);
    return [node, path];
  },

  /**
   * Iterate through all of the nodes in the Editor.
   * - `mode` defaults to `all`
   */
  *nodes<T extends Node>(
    editor: Editor,
    options: EditorNodesOptions<T> = {},
  ): Generator<NodeEntry<T>, void, undefined> {
    const {
      at = editor.selection,
      mode = 'all',
      universal = false,
      reverse = false,
      voids = false,
    } = options;
    let { match } = options;

    if (!match) {
      match = () => true;
    }

    if (!at) {
      return;
    }

    let from;
    let to;

    if (Span.isSpan(at)) {
      from = at[0];
      to = at[1];
    } else {
      const first = Editor.path(editor, at, { edge: 'start' });
      const last = Editor.path(editor, at, { edge: 'end' });
      from = reverse ? last : first;
      to = reverse ? first : last;
    }

    const nodeEntries = Node.nodes(editor, {
      reverse,
      from,
      to,
      pass: ([n]) => (voids ? false : Editor.isVoid(editor, n)),
    });

    const matches: NodeEntry<T>[] = [];
    let hit: NodeEntry<T> | undefined;

    for (const [node, path] of nodeEntries) {
      const isLower = hit && Path.compare(path, hit[1]) === 0;

      // In highest mode any node lower than the last hit is not a match.
      if (mode === 'highest' && isLower) {
        continue;
      }

      if (!match(node, path)) {
        // If we've arrived at a leaf text node that is not lower than the last
        // hit, then we've found a branch that doesn't include a match, which
        // means the match is not universal.
        if (universal && !isLower && Text.isText(node)) {
          return;
        } else {
          continue;
        }
      }

      // If there's a match and it's lower than the last, update the hit.
      if (mode === 'lowest' && isLower) {
        hit = [node, path];
        continue;
      }

      // In lowest mode we emit the last hit, once it's guaranteed lowest.
      const emit: NodeEntry<T> | undefined =
        mode === 'lowest' ? hit : [node, path];

      if (emit) {
        if (universal) {
          matches.push(emit);
        } else {
          yield emit;
        }
      }

      hit = [node, path];
    }

    // Since lowest is always emitting one behind, catch up at the end.
    if (mode === 'lowest' && hit) {
      if (universal) {
        matches.push(hit);
      } else {
        yield hit;
      }
    }

    // Universal defers to ensure that the match occurs in every branch, so we
    // yield all of the matches after iterating.
    if (universal) {
      yield* matches;
    }
  },

  /**
   * Call a function, deferring normalization until after it completes.
   */
  withoutNormalizing(editor: Editor, fn: () => void): void {
    const value = Editor.isNormalizing(editor);
    Editor.setNormalizing(editor, false);
    try {
      fn();
    } finally {
      Editor.setNormalizing(editor, value);
    }
    Editor.normalize(editor);
  },

  /**
   * Normalize any dirty objects in the editor.
   */
  normalize(editor: Editor, options: EditorNormalizeOptions = {}): void {
    const { force = false } = options;
    const getDirtyPaths = (editor: Editor) => {
      return DIRTY_PATHS.get(editor) || [];
    };

    const getDirtyPathKeys = (editor: Editor) => {
      return DIRTY_PATH_KEYS.get(editor) || new Set();
    };

    const popDirtyPath = (editor: Editor): Path => {
      const path = getDirtyPaths(editor).pop()!;
      const key = path.join(',');
      getDirtyPathKeys(editor).delete(key);
      return path;
    };

    if (!Editor.isNormalizing(editor)) {
      return;
    }

    if (force) {
      const allPaths = Array.from(Node.nodes(editor), ([, p]) => p);
      const allPathKeys = new Set(allPaths.map((p) => p.join(',')));
      DIRTY_PATHS.set(editor, allPaths);
      DIRTY_PATH_KEYS.set(editor, allPathKeys);
    }

    if (getDirtyPaths(editor).length === 0) {
      return;
    }

    Editor.withoutNormalizing(editor, () => {
      /*
        Fix dirty elements with no children.
        editor.normalizeNode() does fix this, but some normalization fixes also require it to work.
        Running an initial pass avoids the catch-22 race condition.
      */
      for (const dirtyPath of getDirtyPaths(editor)) {
        if (Node.has(editor, dirtyPath)) {
          // 通过 Path 找到 Node
          const entry = Editor.node(editor, dirtyPath);
          const [node, _] = entry;

          /*
            The default normalizer inserts an empty text node in this scenario, but it can be customised.
            So there is some risk here.

            As long as the normalizer only inserts child nodes for this case it is safe to do in any order;
            by definition adding children to an empty node can't cause other paths to change.
          */
          if (Element.isElement(node) && node.children.length === 0) {
            editor.normalizeNode(entry);
          }
        }
      }

      const max = getDirtyPaths(editor).length * 42; // HACK: better way?
      let m = 0;

      // 💡 创建一个循环，从 model 树的叶节点自底向上地不断获取脏路径并调用 nomalizeNode 检验路径所对应的节点是否合法
      while (getDirtyPaths(editor).length !== 0) {
        if (m > max) {
          throw new Error(`
            Could not completely normalize the editor after ${max} iterations! This is usually due to incorrect normalization logic that leaves a node in an invalid state.
          `);
        }

        const dirtyPath = popDirtyPath(editor);

        // If the node doesn't exist in the tree, it does not need to be normalized.
        if (Node.has(editor, dirtyPath)) {
          const entry = Editor.node(editor, dirtyPath);
          editor.normalizeNode(entry);
        }
        m++;
      }
    });
  },

  /**
   * Get the parent node of a location.
   */

  parent(
    editor: Editor,
    at: Location,
    options: EditorParentOptions = {},
  ): NodeEntry<Ancestor> {
    const path = Editor.path(editor, at, options);
    const parentPath = Path.parent(path);
    const entry = Editor.node(editor, parentPath);
    return entry as NodeEntry<Ancestor>;
  },

  /**
   * Get the path of a location.
   */
  path(editor: Editor, at: Location, options: EditorPathOptions = {}): Path {
    const { depth, edge } = options;

    if (Path.isPath(at)) {
      if (edge === 'start') {
        const [, firstPath] = Node.first(editor, at);
        at = firstPath;
      } else if (edge === 'end') {
        const [, lastPath] = Node.last(editor, at);
        at = lastPath;
      }
    }

    if (Range.isRange(at)) {
      if (edge === 'start') {
        at = Range.start(at);
      } else if (edge === 'end') {
        at = Range.end(at);
      } else {
        // Get the common ancestor path of two paths.
        at = Path.common(at.anchor.path, at.focus.path);
      }
    }

    if (Point.isPoint(at)) {
      at = at.path;
    }

    if (depth != null) {
      at = at.slice(0, depth);
    }

    return at;
  },

  hasPath(editor: Editor, path: Path): boolean {
    return Node.has(editor, path);
  },

  /**
   * Create a mutable ref for a `Path` object, which will stay in sync as new
   * operations are applied to the editor.
   */
  pathRef(
    editor: Editor,
    path: Path,
    options: EditorPathRefOptions = {},
  ): PathRef {
    const { affinity = 'forward' } = options;
    const ref: PathRef = {
      current: path,
      affinity,
      unref() {
        const { current } = ref;
        const pathRefs = Editor.pathRefs(editor);
        pathRefs.delete(ref);
        ref.current = null;
        return current;
      },
    };

    const refs = Editor.pathRefs(editor);
    refs.add(ref);
    return ref;
  },

  /**
   * Get the set of currently tracked path refs of the editor.
   */

  pathRefs(editor: Editor): Set<PathRef> {
    let refs = PATH_REFS.get(editor);

    if (!refs) {
      refs = new Set();
      PATH_REFS.set(editor, refs);
    }

    return refs;
  },

  /**
   * Get the start or end point of a location.
   */

  point(editor: Editor, at: Location, options: EditorPointOptions = {}): Point {
    const { edge = 'start' } = options;

    if (Path.isPath(at)) {
      let path;

      if (edge === 'end') {
        const [, lastPath] = Node.last(editor, at);
        path = lastPath;
      } else {
        const [, firstPath] = Node.first(editor, at);
        path = firstPath;
      }

      const node = Node.get(editor, path);

      if (!Text.isText(node)) {
        throw new Error(
          `Cannot get the ${edge} point in the node at path [${at}] because it has no ${edge} text node.`,
        );
      }

      return { path, offset: edge === 'end' ? node.text.length : 0 };
    }

    if (Range.isRange(at)) {
      const [start, end] = Range.edges(at);
      return edge === 'start' ? start : end;
    }

    return at;
  },

  /**
   * Create a mutable ref for a `Point` object, which will stay in sync as new
   * operations are applied to the editor.
   */

  pointRef(
    editor: Editor,
    point: Point,
    options: EditorPointRefOptions = {},
  ): PointRef {
    const { affinity = 'forward' } = options;
    const ref: PointRef = {
      current: point,
      affinity,
      unref() {
        const { current } = ref;
        const pointRefs = Editor.pointRefs(editor);
        pointRefs.delete(ref);
        ref.current = null;
        return current;
      },
    };

    const refs = Editor.pointRefs(editor);
    refs.add(ref);
    return ref;
  },

  /**
   * Get the set of currently tracked point refs of the editor.
   */

  pointRefs(editor: Editor): Set<PointRef> {
    let refs = POINT_REFS.get(editor);

    if (!refs) {
      refs = new Set();
      POINT_REFS.set(editor, refs);
    }

    return refs;
  },

  /**
   * Return all the positions in `at` range where a `Point` can be placed.
   *
   * By default, moves forward by individual offsets at a time, but
   * the `unit` option can be used to to move by character, word, line, or block.
   *
   * The `reverse` option can be used to change iteration direction.
   *
   * Note: By default void nodes are treated as a single point and iteration
   * will not happen inside their content unless you pass in true for the
   * `voids` option, then iteration will occur.
   */

  *positions(
    editor: Editor,
    options: EditorPositionsOptions = {},
  ): Generator<Point, void, undefined> {
    const {
      at = editor.selection,
      unit = 'offset',
      reverse = false,
      voids = false,
    } = options;

    if (!at) {
      return;
    }

    /**
     * Algorithm notes:
     *
     * Each step `distance` is dynamic depending on the underlying text
     * and the `unit` specified.  Each step, e.g., a line or word, may
     * span multiple text nodes, so we iterate through the text both on
     * two levels in step-sync:
     *
     * `leafText` stores the text on a text leaf level, and is advanced
     * through using the counters `leafTextOffset` and `leafTextRemaining`.
     *
     * `blockText` stores the text on a block level, and is shortened
     * by `distance` every time it is advanced.
     *
     * We only maintain a window of one blockText and one leafText because
     * a block node always appears before all of its leaf nodes.
     */

    const range = Editor.range(editor, at);
    const [start, end] = Range.edges(range);
    const first = reverse ? end : start;
    let isNewBlock = false;
    let blockText = '';
    let distance = 0; // Distance for leafText to catch up to blockText.
    let leafTextRemaining = 0;
    let leafTextOffset = 0;

    // Iterate through all nodes in range, grabbing entire textual content
    // of block nodes in blockText, and text nodes in leafText.
    // Exploits the fact that nodes are sequenced in such a way that we first
    // encounter the block node, then all of its text nodes, so when iterating
    // through the blockText and leafText we just need to remember a window of
    // one block node and leaf node, respectively.
    for (const [node, path] of Editor.nodes(editor, { at, reverse, voids })) {
      /*
       * ELEMENT NODE - Yield position(s) for voids, collect blockText for blocks
       */
      if (Element.isElement(node)) {
        // Void nodes are a special case, so by default we will always
        // yield their first point. If the `voids` option is set to true,
        // then we will iterate over their content.
        if (!voids && editor.isVoid(node)) {
          yield Editor.start(editor, path);
          // It's possible the start of the range we're iterating over is in a void, in which case
          // we want to make sure we don't incorrectly yield the start of a subsequent text node for unit !== 'offset'
          isNewBlock = false;
          continue;
        }

        // Inline element nodes are ignored as they don't themselves
        // contribute to `blockText` or `leafText` - their parent and
        // children do.
        if (editor.isInline(node)) continue;

        // Block element node - set `blockText` to its text content.
        if (Editor.hasInlines(editor, node)) {
          // We always exhaust block nodes before encountering a new one:
          //   console.assert(blockText === '',
          //     `blockText='${blockText}' - `+
          //     `not exhausted before new block node`, path)

          // Ensure range considered is capped to `range`, in the
          // start/end edge cases where block extends beyond range.
          // Equivalent to this, but presumably more performant:
          //   blockRange = Editor.range(editor, ...Editor.edges(editor, path))
          //   blockRange = Range.intersection(range, blockRange) // intersect
          //   blockText = Editor.string(editor, blockRange, { voids })
          const e = Path.isAncestor(path, end.path)
            ? end
            : Editor.end(editor, path);
          const s = Path.isAncestor(path, start.path)
            ? start
            : Editor.start(editor, path);

          blockText = Editor.string(editor, { anchor: s, focus: e }, { voids });
          isNewBlock = true;
        }
      }

      /*
       * TEXT LEAF NODE - Iterate through text content, yielding
       * positions every `distance` offset according to `unit`.
       */
      if (Text.isText(node)) {
        const isFirst = Path.equals(path, first.path);

        // Proof that we always exhaust text nodes before encountering a new one:
        //   console.assert(leafTextRemaining <= 0,
        //     `leafTextRemaining=${leafTextRemaining} - `+
        //     `not exhausted before new leaf text node`, path)

        // Reset `leafText` counters for new text node.
        if (isFirst) {
          leafTextRemaining = reverse
            ? first.offset
            : node.text.length - first.offset;
          leafTextOffset = first.offset; // Works for reverse too.
        } else {
          leafTextRemaining = node.text.length;
          leafTextOffset = reverse ? leafTextRemaining : 0;
        }

        // Yield position at the start of node (potentially).
        if (isFirst || isNewBlock || unit === 'offset') {
          yield { path, offset: leafTextOffset };
          isNewBlock = false;
        }

        // Yield positions every (dynamically calculated) `distance` offset.
        while (true) {
          // If `leafText` has caught up with `blockText` (distance=0),
          // and if blockText is exhausted, break to get another block node,
          // otherwise advance blockText forward by the new `distance`.
          if (distance === 0) {
            if (blockText === '') break;
            distance = calcDistance(blockText, unit, reverse);
            // Split the string at the previously found distance and use the
            // remaining string for the next iteration.
            blockText = splitByCharacterDistance(
              blockText,
              distance,
              reverse,
            )[1];
          }

          // Advance `leafText` by the current `distance`.
          leafTextOffset = reverse
            ? leafTextOffset - distance
            : leafTextOffset + distance;
          leafTextRemaining = leafTextRemaining - distance;

          // If `leafText` is exhausted, break to get a new leaf node
          // and set distance to the overflow amount, so we'll (maybe)
          // catch up to blockText in the next leaf text node.
          if (leafTextRemaining < 0) {
            distance = -leafTextRemaining;
            break;
          }

          // Successfully walked `distance` offsets through `leafText`
          // to catch up with `blockText`, so we can reset `distance`
          // and yield this position in this node.
          distance = 0;
          yield { path, offset: leafTextOffset };
        }
      }
    }
    // Proof that upon completion, we've exahusted both leaf and block text:
    //   console.assert(leafTextRemaining <= 0, "leafText wasn't exhausted")
    //   console.assert(blockText === '', "blockText wasn't exhausted")

    // Helper:
    // Return the distance in offsets for a step of size `unit` on given string.
    function calcDistance(text: string, unit: string, reverse?: boolean) {
      if (unit === 'character') {
        return getCharacterDistance(text, reverse);
      } else if (unit === 'word') {
        return getWordDistance(text, reverse);
      } else if (unit === 'line' || unit === 'block') {
        return text.length;
      }
      return 1;
    }
  },

  /**
   * Get the matching node in the branch of the document before a location.
   */

  previous<T extends Node>(
    editor: Editor,
    options: EditorPreviousOptions<T> = {},
  ): NodeEntry<T> | undefined {
    const { mode = 'lowest', voids = false } = options;
    let { match, at = editor.selection } = options;

    if (!at) {
      return;
    }

    const pointBeforeLocation = Editor.before(editor, at, { voids });

    if (!pointBeforeLocation) {
      return;
    }

    const [, to] = Editor.first(editor, []);

    // The search location is from the start of the document to the path of
    // the point before the location passed in
    const span: Span = [pointBeforeLocation.path, to];

    if (Path.isPath(at) && at.length === 0) {
      throw new Error(`Cannot get the previous node from the root node!`);
    }

    if (match == null) {
      if (Path.isPath(at)) {
        const [parent] = Editor.parent(editor, at);
        match = (n) => parent.children.includes(n);
      } else {
        match = () => true;
      }
    }

    const [previous] = Editor.nodes(editor, {
      reverse: true,
      at: span,
      match,
      mode,
      voids,
    });

    return previous;
  },

  /**
   * Get a range of a location.
   */

  range(editor: Editor, at: Location, to?: Location): Range {
    if (Range.isRange(at) && !to) {
      return at;
    }

    const start = Editor.start(editor, at);
    const end = Editor.end(editor, to || at);
    return { anchor: start, focus: end };
  },

  /**
   * Create a mutable ref for a `Range` object, which will stay in sync as new
   * operations are applied to the editor.
   */

  rangeRef(
    editor: Editor,
    range: Range,
    options: EditorRangeRefOptions = {},
  ): RangeRef {
    const { affinity = 'forward' } = options;
    const ref: RangeRef = {
      current: range,
      affinity,
      unref() {
        const { current } = ref;
        const rangeRefs = Editor.rangeRefs(editor);
        rangeRefs.delete(ref);
        ref.current = null;
        return current;
      },
    };

    const refs = Editor.rangeRefs(editor);
    refs.add(ref);
    return ref;
  },

  /**
   * Get the set of currently tracked range refs of the editor.
   */

  rangeRefs(editor: Editor): Set<RangeRef> {
    let refs = RANGE_REFS.get(editor);

    if (!refs) {
      refs = new Set();
      RANGE_REFS.set(editor, refs);
    }

    return refs;
  },

  /**
   * Manually set if the editor should currently be normalizing.
   *
   * Note: Using this incorrectly can leave the editor in an invalid state.
   *
   */
  setNormalizing(editor: Editor, isNormalizing: boolean): void {
    NORMALIZING.set(editor, isNormalizing);
  },

  /**
   * Get the text string content of a location.
   *
   * Note: by default the text of void nodes is considered to be an empty
   * string, regardless of content, unless you pass in true for the voids option
   */

  string(
    editor: Editor,
    at: Location,
    options: EditorStringOptions = {},
  ): string {
    const { voids = false } = options;
    const range = Editor.range(editor, at);
    const [start, end] = Range.edges(range);
    let text = '';

    for (const [node, path] of Editor.nodes(editor, {
      at: range,
      match: Text.isText,
      voids,
    })) {
      let t = node.text;

      if (Path.equals(path, end.path)) {
        t = t.slice(0, end.offset);
      }

      if (Path.equals(path, start.path)) {
        t = t.slice(start.offset);
      }

      text += t;
    }

    return text;
  },

  /**
   * Convert a range into a non-hanging one.
   */

  unhangRange(
    editor: Editor,
    range: Range,
    options: EditorUnhangRangeOptions = {},
  ): Range {
    const { voids = false } = options;
    let [start, end] = Range.edges(range);

    // PERF: exit early if we can guarantee that the range isn't hanging.
    if (start.offset !== 0 || end.offset !== 0 || Range.isCollapsed(range)) {
      return range;
    }

    const endBlock = Editor.above(editor, {
      at: end,
      match: (n) => Editor.isBlock(editor, n),
    });
    const blockPath = endBlock ? endBlock[1] : [];
    const first = Editor.start(editor, start);
    const before = { anchor: first, focus: end };
    let skip = true;

    for (const [node, path] of Editor.nodes(editor, {
      at: before,
      match: Text.isText,
      reverse: true,
      voids,
    })) {
      if (skip) {
        skip = false;
        continue;
      }

      if (node.text !== '' || Path.isBefore(path, blockPath)) {
        end = { path, offset: node.text.length };
        break;
      }
    }

    return { anchor: start, focus: end };
  },

  /**
   * Match a void node in the current branch of the editor.
   */
  void(
    editor: Editor,
    options: EditorVoidOptions = {},
  ): NodeEntry<Element> | undefined {
    return Editor.above(editor, {
      ...options,
      match: (n) => Editor.isVoid(editor, n),
    });
  },
};

/**
 * A helper type for narrowing matched nodes with a predicate.
 */

export type NodeMatch<T extends Node> =
  | ((node: Node, path: Path) => node is T)
  | ((node: Node, path: Path) => boolean);

export type PropsCompare = (
  prop: Partial<Node>,
  node: Partial<Node>,
) => boolean;
export type PropsMerge = (prop: Partial<Node>, node: Partial<Node>) => object;
