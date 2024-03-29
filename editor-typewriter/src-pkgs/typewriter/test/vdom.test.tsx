import { expect } from 'chai';

import { h, React } from '../src/rendering/vdom';

describe('======== vdom ========', () => {
  describe('h', () => {
    it('should create a node for an element', () => {
      expect(h('div', { foo: 'bar' }, 'test')).to.deep.equal({
        type: 'div',
        key: undefined,
        props: { foo: 'bar' },
        children: ['test'],
      });
    });

    it('should work with JSX', () => {
      const str = 'test';
      // @ts-expect-error fix-types
      // eslint-disable-next-line
      const node = <div foo='bar'>{str}</div>;

      expect(node).to.deep.equal({
        type: 'div',
        key: undefined,
        props: { foo: 'bar' },
        children: ['test'],
      });
    });

    it('should work with functions', () => {
      function Test(attr, children) {
        return (
          // eslint-disable-next-line
          <div foo='bar' {...attr}>
            {children}
          </div>
        );
      }

      expect(<Test disabled>test</Test>).to.deep.equal({
        type: 'div',
        key: undefined,
        props: { foo: 'bar', disabled: true },
        children: ['test'],
      });
    });

    it('should work with children', () => {
      const items = ['red', 'green', 'blue'];
      const node = (
        // @ts-expect-error fix-types
        // eslint-disable-next-line
        <div foo='bar'>
          <ul>
            {items.map((item) => (
              <li>{item}</li>
            ))}
          </ul>
        </div>
      );

      expect(node).to.deep.equal({
        type: 'div',
        key: undefined,
        props: {
          foo: 'bar',
        },
        children: [
          {
            type: 'ul',
            key: undefined,
            props: {},
            children: [
              { type: 'li', key: undefined, props: {}, children: ['red'] },
              { type: 'li', key: undefined, props: {}, children: ['green'] },
              { type: 'li', key: undefined, props: {}, children: ['blue'] },
            ],
          },
        ],
      });
    });
  });
});
