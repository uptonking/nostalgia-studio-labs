/**
 * @description to html
 * @author wangfupeng
 */

import { type Element } from 'slate';

function quoteToHtml(elem: Element, childrenHtml: string): string {
  return `<blockquote>${childrenHtml}</blockquote>`;
}

export const quoteToHtmlConf = {
  type: 'blockquote',
  elemToHtml: quoteToHtml,
};
