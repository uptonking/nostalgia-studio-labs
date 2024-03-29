import { createContext } from 'react';
import { type MenuContextProps, MenuItemType } from './types';

export const MenuContext = createContext<MenuContextProps>({
  registerItem: () => {},
  unregisterItem: () => {},
  updateItem: () => {},
  onSelectItem: () => {},
  onFocusItem: () => {},
  type: MenuItemType.Menu,
  focusedItem: -1,
});
