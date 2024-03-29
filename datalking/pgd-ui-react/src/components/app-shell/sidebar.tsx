import React from 'react';

import cx from 'clsx';

import { useStoreState } from '@ariakit/react-core/utils/store';
import { css } from '@linaria/core';
import { fixed, themed } from '@pgd/ui-tokens';

import { useAppShellContext } from './api-hooks';

const defaultSidebarContent =
  'sidebar------------------------------------------------------';

type SidebarProps = {
  children?: React.ReactNode;
};

export const Sidebar = (props: SidebarProps) => {
  const { children } = props;
  const appShellStore = useAppShellContext();
  const isSidebarOpen = useStoreState(appShellStore, (state) => {
    return state.isSidebarOpen;
  });

  return (
    <aside
      className={cx(rootCss, {
        [rootPositionCss]: !isSidebarOpen,
      })}
    >
      <div className={rootInnerCss}>{children || defaultSidebarContent}</div>
    </aside>
  );
};

const rootCss = css`
  position: fixed;
  overflow-y: auto;
  width: ${themed.spacing.rem.n64};
  height: 100%;
  /* transform: translateX(0); */
  border-right: ${themed.border.presets.default};
  transition: transform ${themed.transition.period.n200} ease;
`;

const rootPositionCss = css`
  transform: translateX(calc(${themed.spacing.rem.n64}*-1));
`;

const rootInnerCss = css`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  margin: ${themed.spacing.rem.n5};
  /* padding: 0 16px; */
`;
