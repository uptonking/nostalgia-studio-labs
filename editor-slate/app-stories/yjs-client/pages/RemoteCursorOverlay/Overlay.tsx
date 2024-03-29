import React, {
  type CSSProperties,
  type PropsWithChildren,
  useRef,
} from 'react';

import clsx from 'clsx';

import {
  type CursorOverlayData,
  useRemoteCursorOverlayPositions,
} from '@slate-yjs/react';

import { type CursorData } from '../../types';
import { addAlpha } from '../../utils';

type CaretProps = Pick<CursorOverlayData<CursorData>, 'caretPosition' | 'data'>;

function Caret({ caretPosition, data }: CaretProps) {
  const caretStyle: CSSProperties = {
    ...caretPosition,
    background: data?.color,
    width: 2,
  };

  const labelStyle: CSSProperties = {
    transform: 'translateY(-100%)',
    background: data?.color,
    color: 'white',
  };

  return (
    <div style={caretStyle} className='w-0.5 absolute'>
      <div
        className='absolute border-radius-md text-xs whitespace-nowrap top-0 rounded rounded-bl-none px-2 py-1'
        style={labelStyle}
      >
        {data?.name}
      </div>
    </div>
  );
}

function RemoteSelection({
  data,
  selectionRects,
  caretPosition,
}: CursorOverlayData<CursorData>) {
  if (!data) {
    return null;
  }

  const selectionStyle: CSSProperties = {
    // Add a opacity to the background color
    backgroundColor: addAlpha(data.color, 0.3),
  };

  return (
    <React.Fragment>
      {selectionRects.map((position, i) => (
        <div
          style={{ ...selectionStyle, ...position }}
          className='absolute pointer-events-none'
          key={i}
        />
      ))}
      {caretPosition && <Caret caretPosition={caretPosition} data={data} />}
    </React.Fragment>
  );
}

type RemoteCursorsProps = PropsWithChildren<{
  className?: string;
}>;

export function RemoteCursorOverlay({
  className,
  children,
}: RemoteCursorsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursors] = useRemoteCursorOverlayPositions<CursorData>({
    containerRef,
  });

  return (
    <div className={clsx('relative', className)} ref={containerRef}>
      {children}
      {cursors.map((cursor) => (
        <RemoteSelection key={cursor.clientId} {...cursor} />
      ))}
    </div>
  );
}
