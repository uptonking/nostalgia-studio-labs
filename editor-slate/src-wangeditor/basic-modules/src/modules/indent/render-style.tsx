/**
 * @description render indent style
 * @author wangfupeng
 */

import { Element, type Descendant } from 'slate';
import { jsx, type VNode } from 'snabbdom';
import { addVnodeStyle } from '../../utils/vdom';
import { type IndentElement } from './custom-types';

/**
 * 添加样式
 * @param node slate elem
 * @param vnode vnode
 * @returns vnode
 */
export function renderStyle(node: Descendant, vnode: VNode): VNode {
  if (!Element.isElement(node)) return vnode;

  const { indent } = node as IndentElement; // 如 '2em'
  let styleVnode: VNode = vnode;

  if (indent) {
    addVnodeStyle(styleVnode, { textIndent: indent });
  }

  return styleVnode;
}
