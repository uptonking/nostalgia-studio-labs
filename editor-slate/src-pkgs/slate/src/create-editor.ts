import {
  type Descendant,
  Editor,
  Element,
  Node,
  type NodeEntry,
  type Operation,
  Path,
  PathRef,
  PointRef,
  Range,
  RangeRef,
  Text,
  Transforms,
} from '.';
import { type TextUnit } from './interfaces/types';
import { DIRTY_PATH_KEYS, DIRTY_PATHS, FLUSHING } from './utils/weak-maps';

/**
 * - Create a new Slate `Editor` object.
 */
export const createEditor = (): Editor => {
  const editor: Editor = {
    children: [],
    selection: null,
    marks: null,
    operations: [],
    isInline: () => false,
    isVoid: () => false,
    onChange: () => {},

    /**
     * selection和内容的更新都是通过op触发，apply的末尾会执行 editor.onChange()
     * - 在withReact中会被加强
     */
    apply: (op: Operation) => {
      for (const ref of Editor.pathRefs(editor)) {
        PathRef.transform(ref, op);
      }

      for (const ref of Editor.pointRefs(editor)) {
        PointRef.transform(ref, op);
      }

      for (const ref of Editor.rangeRefs(editor)) {
        RangeRef.transform(ref, op);
      }

      // 一部分脏路径是在 operation apply 之前的 oldDirtypath，这一部分根据op的类型做路径转换处理
      const oldDirtyPaths = DIRTY_PATHS.get(editor) || [];
      const oldDirtyPathKeys = DIRTY_PATH_KEYS.get(editor) || new Set();
      let dirtyPaths: Path[];
      let dirtyPathKeys: Set<string>;

      const add = (path: Path | null) => {
        if (path) {
          const key = path.join(',');

          if (!dirtyPathKeys.has(key)) {
            dirtyPathKeys.add(key);
            dirtyPaths.push(path);
          }
        }
      };

      if (Path.operationCanTransformPath(op)) {
        dirtyPaths = [];
        dirtyPathKeys = new Set();
        for (const path of oldDirtyPaths) {
          const newPath = Path.transform(path, op);
          add(newPath);
        }
      } else {
        dirtyPaths = oldDirtyPaths;
        dirtyPathKeys = oldDirtyPathKeys;
      }

      // 另一部分脏路径是 operation 自己创建的，由 getDirthPaths 方法获取
      const newDirtyPaths = getDirtyPaths(op);
      for (const path of newDirtyPaths) {
        add(path);
      }

      DIRTY_PATHS.set(editor, dirtyPaths);
      DIRTY_PATH_KEYS.set(editor, dirtyPathKeys);
      Transforms.transform(editor, op);
      editor.operations.push(op);
      Editor.normalize(editor);

      // Clear any formats applied to the cursor if the selection changes.
      if (op.type === 'set_selection') {
        editor.marks = null;
      }

      if (!FLUSHING.get(editor)) {
        // 设置状态，表明正在执行onChange
        // 当执行某个复杂命令时，浏览器会在一个 task 中执行多次 apply，这意味着 onChange 会被调用多次，
        // 这里用了一个巧妙的方式：将 onChange 放在 Promise 的回调中，在当前 task 完成后才会调用一次 onChange 方法。
        // slate 这里多次执行的 apply ，会将其中的 Promise.then 放到队列中，当同步任务执行完，在 DOM 重新渲染之前执行其中的 onChange 事件。
        FLUSHING.set(editor, true);

        Promise.resolve().then(() => {
          // 💡 在多个apply任务完成后才执行onChange
          FLUSHING.set(editor, false);
          // slate-react会增强onChange，触发视图组件rerender
          editor.onChange();
          editor.operations = [];
        });
      }
    },

    /** 原理是在文本节点上执行 Transforms.setNodes  */
    addMark: (key: string, value: any) => {
      const { selection } = editor;

      if (selection) {
        if (Range.isExpanded(selection)) {
          Transforms.setNodes(
            editor,
            { [key]: value },
            { match: Text.isText, split: true },
          );
        } else {
          // 对于光标，直接设置全局 marks. 渲染层根据 mark 切为多个 decoration 做渲染
          const marks = {
            ...(Editor.marks(editor) || {}),
            [key]: value,
          };
          editor.marks = marks;

          if (!FLUSHING.get(editor)) {
            editor.onChange();
          }
        }
      }
    },
    /** 原理是在文本节点上执行 Transforms.unsetNodes  */
    removeMark: (key: string) => {
      const { selection } = editor;

      if (selection) {
        if (Range.isExpanded(selection)) {
          Transforms.unsetNodes(editor, key, {
            match: Text.isText,
            split: true,
          });
        } else {
          const marks = { ...(Editor.marks(editor) || {}) };
          delete marks[key];
          editor.marks = marks;
          if (!FLUSHING.get(editor)) {
            editor.onChange();
          }
        }
      }
    },

    deleteBackward: (unit: TextUnit) => {
      const { selection } = editor;

      if (selection && Range.isCollapsed(selection)) {
        Transforms.delete(editor, { unit, reverse: true });
      }
    },

    deleteForward: (unit: TextUnit) => {
      const { selection } = editor;

      if (selection && Range.isCollapsed(selection)) {
        Transforms.delete(editor, { unit });
      }
    },

    deleteFragment: (direction?: 'forward' | 'backward') => {
      const { selection } = editor;

      if (selection && Range.isExpanded(selection)) {
        Transforms.delete(editor, { reverse: direction === 'backward' });
      }
    },

    getFragment: () => {
      const { selection } = editor;

      if (selection) {
        return Node.fragment(editor, selection);
      }
      return [];
    },

    insertBreak: () => {
      Transforms.splitNodes(editor, { always: true });
    },

    insertSoftBreak: () => {
      Transforms.splitNodes(editor, { always: true });
    },

    insertFragment: (fragment: Node[]) => {
      Transforms.insertFragment(editor, fragment);
    },

    insertNode: (node: Node) => {
      Transforms.insertNodes(editor, node);
    },

    insertText: (text: string) => {
      const { selection, marks } = editor;

      if (selection) {
        if (marks) {
          const node = { text, ...marks };
          Transforms.insertNodes(editor, node);
        } else {
          Transforms.insertText(editor, text);
        }

        editor.marks = null;
      }
    },

    normalizeNode: (entry: NodeEntry) => {
      const [node, path] = entry;

      // There are no core normalizations for text nodes.
      if (Text.isText(node)) {
        return;
      }

      // Ensure that block and inline nodes have at least one text child.
      if (Element.isElement(node) && node.children.length === 0) {
        const child = { text: '' };
        Transforms.insertNodes(editor, child, {
          at: path.concat(0),
          voids: true,
        });
        return;
      }

      // Determine whether the node should have block or inline children.
      const shouldHaveInlines = Editor.isEditor(node)
        ? false
        : Element.isElement(node) &&
          (editor.isInline(node) ||
            node.children.length === 0 ||
            Text.isText(node.children[0]) ||
            editor.isInline(node.children[0]));

      // Since we'll be applying operations while iterating, keep track of an
      // index that accounts for any added/removed nodes.
      let n = 0;

      for (let i = 0; i < node.children.length; i++, n++) {
        const currentNode = Node.get(editor, path);
        if (Text.isText(currentNode)) continue;
        const child = node.children[i] as Descendant;
        const prev = currentNode.children[n - 1] as Descendant;
        const isLast = i === node.children.length - 1;
        const isInlineOrText =
          Text.isText(child) ||
          (Element.isElement(child) && editor.isInline(child));

        // Only allow block nodes in the top-level children and parent blocks
        // that only contain block nodes. Similarly, only allow inline nodes in
        // other inline nodes, or parent blocks that only contain inlines and
        // text.
        if (isInlineOrText !== shouldHaveInlines) {
          Transforms.removeNodes(editor, { at: path.concat(n), voids: true });
          n--;
        } else if (Element.isElement(child)) {
          // Ensure that inline nodes are surrounded by text nodes.
          if (editor.isInline(child)) {
            if (prev == null || !Text.isText(prev)) {
              const newChild = { text: '' };
              Transforms.insertNodes(editor, newChild, {
                at: path.concat(n),
                voids: true,
              });
              n++;
            } else if (isLast) {
              const newChild = { text: '' };
              Transforms.insertNodes(editor, newChild, {
                at: path.concat(n + 1),
                voids: true,
              });
              n++;
            }
          }
        } else {
          // Merge adjacent text nodes that are empty or match.
          if (prev != null && Text.isText(prev)) {
            if (Text.equals(child, prev, { loose: true })) {
              Transforms.mergeNodes(editor, {
                at: path.concat(n),
                voids: true,
              });
              n--;
            } else if (prev.text === '') {
              Transforms.removeNodes(editor, {
                at: path.concat(n - 1),
                voids: true,
              });
              n--;
            } else if (child.text === '') {
              Transforms.removeNodes(editor, {
                at: path.concat(n),
                voids: true,
              });
              n--;
            }
          }
        }
      }
    },
  };

  return editor;
};

/**
 * Get the "dirty" paths generated from an operation.
 */
const getDirtyPaths = (op: Operation): Path[] => {
  switch (op.type) {
    case 'insert_text':
    case 'remove_text':
    case 'set_node': {
      const { path } = op;
      return Path.levels(path);
    }

    case 'insert_node': {
      const { node, path } = op;
      const levels = Path.levels(path);
      const descendants = Text.isText(node)
        ? []
        : Array.from(Node.nodes(node), ([, p]) => path.concat(p));

      return [...levels, ...descendants];
    }

    case 'merge_node': {
      const { path } = op;
      const ancestors = Path.ancestors(path);
      const previousPath = Path.previous(path);
      return [...ancestors, previousPath];
    }

    case 'move_node': {
      const { path, newPath } = op;

      if (Path.equals(path, newPath)) {
        return [];
      }

      const oldAncestors: Path[] = [];
      const newAncestors: Path[] = [];

      for (const ancestor of Path.ancestors(path)) {
        const p = Path.transform(ancestor, op);
        oldAncestors.push(p!);
      }

      for (const ancestor of Path.ancestors(newPath)) {
        const p = Path.transform(ancestor, op);
        newAncestors.push(p!);
      }

      const newParent = newAncestors[newAncestors.length - 1];
      const newIndex = newPath[newPath.length - 1];
      const resultPath = newParent.concat(newIndex);

      return [...oldAncestors, ...newAncestors, resultPath];
    }

    case 'remove_node': {
      const { path } = op;
      const ancestors = Path.ancestors(path);
      return [...ancestors];
    }

    case 'split_node': {
      const { path } = op;
      const levels = Path.levels(path);
      const nextPath = Path.next(path);
      return [...levels, nextPath];
    }

    default: {
      return [];
    }
  }
};
