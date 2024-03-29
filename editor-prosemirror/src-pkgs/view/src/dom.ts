import * as browser from './browser';

export type DOMNode = InstanceType<typeof window.Node>;
export type DOMSelection = InstanceType<typeof window.Selection>;

export const domIndex = function (node: Node) {
  for (let index = 0; ; index++) {
    node = node.previousSibling!;
    if (!node) return index;
  }
};

export const parentNode = function (node: Node) {
  const parent = (node as HTMLSlotElement).assignedSlot || node.parentNode;
  return parent && parent.nodeType == 11 ? (parent as ShadowRoot).host : parent;
};

let reusedRange: Range | null = null;

/** Note that this will always return the same range, because DOM range
 * objects are every expensive, and keep slowing down subsequent DOM
 * updates, for some reason.
 */
export const textRange = function (node: Text, from?: number, to?: number) {
  const range = reusedRange || (reusedRange = document.createRange());
  range.setEnd(node, to == null ? node.nodeValue!.length : to);
  range.setStart(node, from || 0);
  return range;
};

/** Scans forward and backward through DOM positions equivalent to the
 * given one to see if the two are in the same place (i.e. after a
 * text node vs at the end of that text node)
 */
export const isEquivalentPosition = function (
  node: Node,
  off: number,
  targetNode: Node,
  targetOff: number,
) {
  return (
    targetNode &&
    (scanFor(node, off, targetNode, targetOff, -1) ||
      scanFor(node, off, targetNode, targetOff, 1))
  );
};

const atomElements = /^(img|br|input|textarea|hr)$/i;

function scanFor(
  node: Node,
  off: number,
  targetNode: Node,
  targetOff: number,
  dir: number,
) {
  for (;;) {
    if (node == targetNode && off == targetOff) return true;
    if (off == (dir < 0 ? 0 : nodeSize(node))) {
      const parent = node.parentNode;
      if (
        !parent ||
        parent.nodeType != 1 ||
        hasBlockDesc(node) ||
        atomElements.test(node.nodeName) ||
        (node as HTMLElement).contentEditable == 'false'
      )
        return false;
      off = domIndex(node) + (dir < 0 ? 0 : 1);
      node = parent;
    } else if (node.nodeType == 1) {
      node = node.childNodes[off + (dir < 0 ? -1 : 0)];
      if ((node as HTMLElement).contentEditable == 'false') return false;
      off = dir < 0 ? nodeSize(node) : 0;
    } else {
      return false;
    }
  }
}

export function nodeSize(node: Node) {
  return node.nodeType == 3 ? node.nodeValue!.length : node.childNodes.length;
}

export function isOnEdge(node: Node, offset: number, parent: Node) {
  for (
    let atStart = offset == 0, atEnd = offset == nodeSize(node);
    atStart || atEnd;

  ) {
    if (node == parent) return true;
    const index = domIndex(node);
    node = node.parentNode!;
    if (!node) return false;
    atStart = atStart && index == 0;
    atEnd = atEnd && index == nodeSize(node);
  }
}

function hasBlockDesc(dom: Node) {
  let desc;
  for (let cur: Node | null = dom; cur; cur = cur.parentNode)
    if ((desc = cur.pmViewDesc)) break;
  return (
    desc &&
    desc.node &&
    desc.node.isBlock &&
    (desc.dom == dom || desc.contentDOM == dom)
  );
}

/** (isCollapsed inappropriately returns true in shadow dom)
 * - Work around Chrome issue https://bugs.chromium.org/p/chromium/issues/detail?id=447523
 */
export const selectionCollapsed = function (domSel: Selection) {
  /** 根据浏览器选区判断 */
  let collapsed = domSel.isCollapsed;
  if (
    collapsed &&
    browser.chrome &&
    domSel.rangeCount &&
    !domSel.getRangeAt(0).collapsed
  ) {
    collapsed = false;
  }
  return collapsed;
};

/** 基于`document.createEvent`创建KeyboardEvent对象，此方法已不推荐，建议用构造函数方式
 * - https://developer.mozilla.org/en-US/docs/Web/Events/Creating_and_triggering_events
 * - https://developer.mozilla.org/en-US/docs/Web/API/Document/createEvent
 */
export function keyEvent(keyCode: number, key: string) {
  const event = document.createEvent('Event') as KeyboardEvent;
  event.initEvent('keydown', true, true);
  // any原因：Cannot assign to 'keyCode' because it is a read-only property.ts(2540)
  (event as any).keyCode = keyCode;
  (event as any).key = (event as any).code = key;
  return event;
}
