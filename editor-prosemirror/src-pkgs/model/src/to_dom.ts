import { DOMNode } from './dom';
import { Fragment } from './fragment';
import { Mark } from './mark';
import { Node } from './node';
import { MarkType, NodeType, Schema } from './schema';

/// A description of a DOM structure. Can be either a string, which is
/// interpreted as a text node, a DOM node, which is interpreted as
/// itself, a `{dom, contentDOM}` object, or an array.
///
/// An array describes a DOM element. The first value in the array
/// should be a string—the name of the DOM element, optionally prefixed
/// by a namespace URL and a space. If the second element is plain
/// object, it is interpreted as a set of attributes for the element.
/// Any elements after that (including the 2nd if it's not an attribute
/// object) are interpreted as children of the DOM elements, and must
/// either be valid `DOMOutputSpec` values, or the number zero.
///
/// The number zero (pronounced “hole”) is used to indicate the place
/// where a node's child nodes should be inserted. If it occurs in an
/// output spec, it should be the only child element in its parent
/// node.
export type DOMOutputSpec =
  | string
  | DOMNode
  | { dom: DOMNode; contentDOM?: HTMLElement }
  | readonly [string, ...any[]];

/** A DOM serializer knows how to convert ProseMirror nodes and
 * marks of various types to DOM nodes.
 */
export class DOMSerializer {
  /// Create a serializer. `nodes` should map node names to functions
  /// that take a node and return a description of the corresponding
  /// DOM. `marks` does the same for mark names, but also gets an
  /// argument that tells it whether the mark's content is block or
  /// inline content (for typical use, it'll always be inline). A mark
  /// serializer may be `null` to indicate that marks of that type
  /// should not be serialized.
  constructor(
    /// The node serialization functions.
    readonly nodes: { [node: string]: (node: Node) => DOMOutputSpec },
    /// The mark serialization functions.
    readonly marks: {
      [mark: string]: (mark: Mark, inline: boolean) => DOMOutputSpec;
    },
  ) {}

  /// Serialize the content of this fragment to a DOM fragment. When
  /// not in the browser, the `document` option, containing a DOM
  /// document, should be passed so that the serializer can create
  /// nodes.
  serializeFragment(
    fragment: Fragment,
    options: { document?: Document } = {},
    target?: HTMLElement | DocumentFragment,
  ) {
    if (!target) target = doc(options).createDocumentFragment();

    let top = target!;
    const active: [Mark, HTMLElement | DocumentFragment][] = [];
    fragment.forEach((node) => {
      if (active.length || node.marks.length) {
        let keep = 0;
        let rendered = 0;
        while (keep < active.length && rendered < node.marks.length) {
          const next = node.marks[rendered];
          if (!this.marks[next.type.name]) {
            rendered++;
            continue;
          }
          if (!next.eq(active[keep][0]) || next.type.spec.spanning === false)
            break;
          keep++;
          rendered++;
        }
        while (keep < active.length) top = active.pop()![1];
        while (rendered < node.marks.length) {
          const add = node.marks[rendered++];
          const markDOM = this.serializeMark(add, node.isInline, options);
          if (markDOM) {
            active.push([add, top]);
            top.appendChild(markDOM.dom);
            top = markDOM.contentDOM || (markDOM.dom as HTMLElement);
          }
        }
      }
      top.appendChild(this.serializeNodeInner(node, options));
    });

    return target;
  }

  /// @internal
  serializeNodeInner(node: Node, options: { document?: Document }) {
    const { dom, contentDOM } = DOMSerializer.renderSpec(
      doc(options),
      this.nodes[node.type.name](node),
    );
    if (contentDOM) {
      if (node.isLeaf)
        throw new RangeError('Content hole not allowed in a leaf node spec');
      this.serializeFragment(node.content, options, contentDOM);
    }
    return dom;
  }

  /// Serialize this node to a DOM node. This can be useful when you
  /// need to serialize a part of a document, as opposed to the whole
  /// document. To serialize a whole document, use
  /// [`serializeFragment`](#model.DOMSerializer.serializeFragment) on
  /// its [content](#model.Node.content).
  serializeNode(node: Node, options: { document?: Document } = {}) {
    let dom = this.serializeNodeInner(node, options);
    for (let i = node.marks.length - 1; i >= 0; i--) {
      const wrap = this.serializeMark(node.marks[i], node.isInline, options);
      if (wrap) {
        (wrap.contentDOM || wrap.dom).appendChild(dom);
        dom = wrap.dom;
      }
    }
    return dom;
  }

  /// @internal
  serializeMark(
    mark: Mark,
    inline: boolean,
    options: { document?: Document } = {},
  ) {
    const toDOM = this.marks[mark.type.name];
    return toDOM && DOMSerializer.renderSpec(doc(options), toDOM(mark, inline));
  }

  /// Render an [output spec](#model.DOMOutputSpec) to a DOM node. If
  /// the spec has a hole (zero) in it, `contentDOM` will point at the
  /// node with the hole.
  static renderSpec(
    doc: Document,
    structure: DOMOutputSpec,
    xmlNS: string | null = null,
  ): {
    dom: DOMNode;
    contentDOM?: HTMLElement;
  } {
    if (typeof structure === 'string')
      return { dom: doc.createTextNode(structure) };
    if ((structure as DOMNode).nodeType != null)
      return { dom: structure as DOMNode };
    if ((structure as any).dom && (structure as any).dom.nodeType != null)
      return structure as { dom: DOMNode; contentDOM?: HTMLElement };
    let tagName = (structure as [string])[0];
    const space = tagName.indexOf(' ');
    if (space > 0) {
      xmlNS = tagName.slice(0, space);
      tagName = tagName.slice(space + 1);
    }
    let contentDOM: HTMLElement | undefined;
    const dom = (
      xmlNS ? doc.createElementNS(xmlNS, tagName) : doc.createElement(tagName)
    ) as HTMLElement;
    const attrs = (structure as any)[1];
    let start = 1;
    if (
      attrs &&
      typeof attrs === 'object' &&
      attrs.nodeType == null &&
      !Array.isArray(attrs)
    ) {
      start = 2;
      for (const name in attrs)
        if (attrs[name] != null) {
          const space = name.indexOf(' ');
          if (space > 0)
            dom.setAttributeNS(
              name.slice(0, space),
              name.slice(space + 1),
              attrs[name],
            );
          else dom.setAttribute(name, attrs[name]);
        }
    }
    for (let i = start; i < (structure as readonly any[]).length; i++) {
      const child = (structure as any)[i] as DOMOutputSpec | 0;
      if (child === 0) {
        if (i < (structure as readonly any[]).length - 1 || i > start)
          throw new RangeError(
            'Content hole must be the only child of its parent node',
          );
        return { dom, contentDOM: dom };
      } else {
        const { dom: inner, contentDOM: innerContent } =
          DOMSerializer.renderSpec(doc, child, xmlNS);
        dom.appendChild(inner);
        if (innerContent) {
          if (contentDOM) throw new RangeError('Multiple content holes');
          contentDOM = innerContent as HTMLElement;
        }
      }
    }
    return { dom, contentDOM };
  }

  /// Build a serializer using the [`toDOM`](#model.NodeSpec.toDOM)
  /// properties in a schema's node and mark specs.
  static fromSchema(schema: Schema): DOMSerializer {
    return (
      (schema.cached.domSerializer as DOMSerializer) ||
      (schema.cached.domSerializer = new DOMSerializer(
        this.nodesFromSchema(schema),
        this.marksFromSchema(schema),
      ))
    );
  }

  /// Gather the serializers in a schema's node specs into an object.
  /// This can be useful as a base to build a custom serializer from.
  static nodesFromSchema(schema: Schema) {
    const result = gatherToDOM(schema.nodes);
    if (!result.text) result.text = (node) => node.text;
    return result as { [node: string]: (node: Node) => DOMOutputSpec };
  }

  /// Gather the serializers in a schema's mark specs into an object.
  static marksFromSchema(schema: Schema) {
    return gatherToDOM(schema.marks) as {
      [mark: string]: (mark: Mark, inline: boolean) => DOMOutputSpec;
    };
  }
}

function gatherToDOM(obj: { [node: string]: NodeType | MarkType }) {
  const result: {
    [node: string]: (value: any, inline: boolean) => DOMOutputSpec;
  } = {};
  for (const name in obj) {
    const toDOM = obj[name].spec.toDOM;
    if (toDOM) result[name] = toDOM;
  }
  return result;
}

function doc(options: { document?: Document }) {
  return options.document || window.document;
}
