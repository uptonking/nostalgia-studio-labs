import React, { useState } from 'react';
import { createEditor } from 'slate';
import { type BaseEditor, type Descendant } from 'slate';
import { DefaultEditable as Editable, Slate, withReact } from 'slate-react';
import { type ReactEditor } from 'slate-react';

const initialValue = [
  {
    type: 'paragraph',
    children: [
      { text: '👏 Hello, Slate editor!   A line of text in a paragraph.' },
    ],
  },
];

export const SlateMinimalApp = () => {
  const [editor] = useState(() => withReact(createEditor()));

  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  editor.selection;

  return (
    <Slate editor={editor} value={initialValue as any}>
      <Editable />
    </Slate>
  );
};
