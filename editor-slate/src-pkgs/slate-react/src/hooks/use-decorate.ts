import { createContext, useContext } from 'react';
import { type Range, type NodeEntry } from 'slate';

/**
 * A React context for sharing the `decorate` prop of the editable.
 */

export const DecorateContext = createContext<(entry: NodeEntry) => Range[]>(
  () => [],
);

/**
 * Get the current `decorate` prop of the editable.
 */

export const useDecorate = (): ((entry: NodeEntry) => Range[]) => {
  return useContext(DecorateContext);
};
