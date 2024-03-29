import { Table } from 'leyden';
import React, { type FC, type ReactNode, useCallback } from 'react';
import { type Descendant, Element } from 'slate';
import { Slate } from 'slate-react';

import { type ReactEditor } from '../plugin/ReactEditor';

export interface Leyden {
  children: ReactNode;
  editor: ReactEditor;
  value: [Table];
  onChange: (value: [Table]) => void;
}

export const Leyden: FC<Leyden> = ({ children, editor, value, onChange }) => {
  const handleChange = useCallback(
    (newValue: Descendant[]) => {
      if (Element.isElement(newValue[0]) && Table.isTable(newValue[0])) {
        onChange([newValue[0]]);
      }
    },
    [onChange],
  );

  return (
    <Slate editor={editor} value={value} onChange={handleChange}>
      {children}
    </Slate>
  );
};
