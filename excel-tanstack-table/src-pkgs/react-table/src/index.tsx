import * as React from 'react';

import {
  createTable,
  type RowData,
  type TableOptions,
  type TableOptionsResolved,
} from '@tanstack/table-core';

export * from '@tanstack/table-core';

export type Renderable<TProps> = React.ReactNode | React.ComponentType<TProps>;

//

/** default cell renderer, support Comp as plain value or reactElement */
export function flexRender<TProps extends object>(
  Comp: Renderable<TProps>,
  props: TProps,
): React.ReactNode | JSX.Element {
  return !Comp ? null : isReactComponent<TProps>(Comp) ? (
    <Comp {...props} />
  ) : (
    Comp
  );
}

function isReactComponent<TProps>(
  component: unknown,
): component is React.ComponentType<TProps> {
  return (
    isClassComponent(component) ||
    typeof component === 'function' ||
    isExoticComponent(component)
  );
}

function isClassComponent(component: any) {
  return (
    typeof component === 'function' &&
    (() => {
      const proto = Object.getPrototypeOf(component);
      return proto.prototype && proto.prototype.isReactComponent;
    })()
  );
}

function isExoticComponent(component: any) {
  return (
    typeof component === 'object' &&
    typeof component.$$typeof === 'symbol' &&
    ['react.memo', 'react.forward_ref'].includes(component.$$typeof.description)
  );
}

/**
 * a wrapper around the core table logic.
 * - `createTable` + `setOptions`
 * - Most of its job is related to managing state the "react" way, providing types and the rendering implementation of cell/header/footer templates
 */
export function useReactTable<TData extends RowData>(
  options: TableOptions<TData>,
) {
  // Compose in the generic options to the user options
  const resolvedOptions: TableOptionsResolved<TData> = {
    state: {}, // Dummy state
    onStateChange: () => {}, // noop
    renderFallbackValue: null,
    ...options,
  };
  // console.log(';; tb-resolvedOptions ', resolvedOptions);

  // 👇🏻 Create a stable table instance and store it in state
  const [tableRef] = React.useState(() => ({
    current: createTable<TData>(resolvedOptions),
  }));

  // 👀 By default, manage table state here using the table's initial state
  const [state, setState] = React.useState(() => tableRef.current.initialState);

  console.log(';; tableRef-setOpts1 ', tableRef.current.getState().sorting);

  // Compose the default state above with any user state.
  // This will allow the user to only control a subset of the state if desired.
  tableRef.current.setOptions((prev) => ({
    ...prev,
    ...options,
    state: {
      ...state,
      ...options.state,
    },
    // Similarly, we'll maintain both internal state and any user-provided state
    onStateChange: (updater) => {
      console.log(';; useReactTbl-onStateChg ');
      setState(updater);
      options.onStateChange?.(updater);
    },
  }));

  console.log(';; tableRef-setOpts2 ', tableRef.current.getState().sorting);

  return tableRef.current;
}
