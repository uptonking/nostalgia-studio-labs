import { useMemo } from 'react';

import { type Editor } from 'slate';

import { type NosPlugin } from '../plugins/types';
import { composePlugins } from '../utils/plugins-config-compose';

/** reversely compose plugins with `withOverrides`-not-undefined
 *
 * todo name not start with use
 */
export const useEditor = (createEditor: () => Editor, plugins: NosPlugin[]) => {
  return useMemo(
    () =>
      composePlugins(
        plugins.filter((x) => x.withOverrides).map((x) => x.withOverrides!),
        createEditor(),
      ),
    [],
  );
};
