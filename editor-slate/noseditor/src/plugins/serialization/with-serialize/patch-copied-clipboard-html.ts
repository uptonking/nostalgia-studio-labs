import { ListVariants, type ListVariantsType } from '../../list/utils';
import {
  convertHtmlToPlainText,
  crawlDom,
  getListItemPropertiesFromDom,
  isHtmlElement,
  isHtmlListItem,
} from '../utils';

export const getHtmlTag = (listType: ListVariantsType) => {
  const tag = listType === ListVariants.Numbered ? 'ol' : 'ul';
  return tag;
};

/**
 * patch dom list item elements
 */
export const patchCopiedClipboardHtml = (root: Element) => {
  const listItemDomNodes: Node[][] = [[]];

  crawlDom(root.childNodes, (node, context) => {
    const depth = (context as any).cursor.depth;

    if (depth !== 1) return;

    if (isHtmlListItem(node)) {
      return listItemDomNodes[listItemDomNodes.length - 1].push(node);
    }

    if (listItemDomNodes[listItemDomNodes.length - 1].length > 0)
      listItemDomNodes.push([]);
  });

  listItemDomNodes.forEach((nodes) => {
    if (nodes.length > 0) {
      const props = getListItemPropertiesFromDom(nodes[0] as HTMLElement);
      const ul = document.createElement(getHtmlTag(props.listType));
      //
      root.insertBefore(ul, nodes[0]);
      //
      nodes.forEach((li) => ul.appendChild(li));
    }
  });

  const listNodes = Array.from(root.querySelectorAll('ul, ol'));

  for (const listNode of listNodes) {
    const items = [];
    for (const listItemNode of listNode.childNodes) {
      if (isHtmlElement(listItemNode)) {
        const item = getListItemPropertiesFromDom(listItemNode);
        items.push({ ...item, text: convertHtmlToPlainText(listItemNode) });
      }
    }

    // flatten items to tree
    const tree = listItemsToTree(items);

    listNode.innerHTML = '';
    // tree to DOM tree
    createDOMTree(listNode, tree);
  }
};

const getMin = (array: number[]) =>
  array.reduce((acc, x) => Math.min(acc, x), 0);
const getMax = (array: number[]) =>
  array.reduce((acc, x) => Math.max(acc, x), 0);

const createDOMTree = (container: Element, data: any) => {
  for (const { text, children } of data.children) {
    const li = document.createElement('li');

    li.innerHTML = text;
    container.appendChild(li);

    if (children && children.length > 0) {
      const list = document.createElement(getHtmlTag(children[0].listType));
      li.appendChild(list);
      createDOMTree(list, { children });
    }
  }
};

export const listItemsToTree = (listItems: any) => {
  const baseDepth = getMin(listItems.map((item: any) => item.depth));
  const maxDepth = getMax(listItems.map((item: any) => item.depth));

  const tree: { children?: any[] } = { children: [] };
  const parents = { [baseDepth - 1]: tree }; // depth-parents map

  for (const item of listItems) {
    const { depth } = item;

    // reset all parents with larger depth
    for (let i = depth + 1; i <= maxDepth; i++) {
      // @ts-ignore
      parents[i] = null;
    }

    if (!parents[depth]) {
      parents[depth] = {};
    }

    let parent;
    // get first available parent
    for (let parentDepth = depth - 1; parent == null; parentDepth--) {
      parent = parents[parentDepth];
    }

    if (parent.children) {
      parent.children.push(item);
    } else {
      parent.children = [item];
    }

    parents[depth] = item;
  }

  return tree;
};
