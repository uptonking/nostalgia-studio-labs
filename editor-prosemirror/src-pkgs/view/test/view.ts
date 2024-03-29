import { EditorView, type DirectEditorProps } from 'prosemirror-view';
import {
  EditorState,
  Selection,
  TextSelection,
  NodeSelection,
  type Plugin,
} from 'prosemirror-state';
import { schema } from 'prosemirror-test-builder';
import { type Node as PMNode } from 'prosemirror-model';

function selFor(doc: PMNode) {
  const { tag } = doc as any;
  const a = tag.a;
  if (a != null) {
    const $a = doc.resolve(a);
    if ($a.parent.inlineContent)
      return new TextSelection(
        $a,
        tag.b != null ? doc.resolve(tag.b) : undefined,
      );
    else return new NodeSelection($a);
  }
  return Selection.atStart(doc);
}

let tempView: EditorView | null = null;

export function tempEditor(
  inProps: Partial<DirectEditorProps> & {
    plugins?: readonly Plugin[];
    doc?: PMNode;
  } = {},
) {
  const space = document.querySelector('#workspace');
  if (tempView) {
    tempView.destroy();
    tempView = null;
  }

  const props: DirectEditorProps = {} as any;
  for (const n in inProps)
    if (n != 'plugins') (props as any)[n] = (inProps as any)[n];
  props.state = EditorState.create({
    doc: inProps.doc,
    schema,
    selection: inProps.doc && selFor(inProps.doc),
    plugins: inProps && inProps.plugins,
  });
  return (tempView = new EditorView(space, props));
}

export function findTextNode(node: Node, text: string): Text | undefined {
  if (node.nodeType == 3) {
    if (node.nodeValue == text) return node as Text;
  } else if (node.nodeType == 1) {
    for (let ch = node.firstChild; ch; ch = ch.nextSibling) {
      const found = findTextNode(ch, text);
      if (found) return found;
    }
  }
}

export function requireFocus(pm: EditorView) {
  if (!document.hasFocus())
    throw new Error(
      "The document doesn't have focus, which is needed for this test",
    );
  pm.focus();
  return pm;
}
