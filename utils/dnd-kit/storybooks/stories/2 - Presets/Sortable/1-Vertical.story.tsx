import React from 'react';

import {MeasuringStrategy} from '@dnd-kit/core';
import {restrictToWindowEdges} from '@dnd-kit/modifiers';
import {
  restrictToFirstScrollableAncestor,
  restrictToVerticalAxis,
} from '@dnd-kit/modifiers';
import {
  AnimateLayoutChanges,
  defaultAnimateLayoutChanges,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import {createRange} from '../../utilities';
import {Sortable, SortableProps} from './Sortable';

export default {
  title: 'Presets/Sortable/Vertical',
};

const props: Partial<SortableProps> = {
  strategy: verticalListSortingStrategy,
  itemCount: 50,
};

export const BasicSetup = () => <Sortable {...props} />;

export const WithoutDragOverlay = () => (
  <Sortable {...props} useDragOverlay={false} />
);

export const DragHandle = () => <Sortable {...props} handle />;

export const LockedAxis = () => (
  <Sortable
    {...props}
    modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}
  />
);

export const RestrictToScrollContainer = () => (
  <div
    style={{
      height: '50vh',
      width: 350,
      margin: '200px auto 0',
      overflow: 'auto',
    }}
  >
    <Sortable {...props} modifiers={[restrictToFirstScrollableAncestor]} />
  </div>
);

export const ScrollContainer = () => (
  <div
    style={{
      height: '50vh',
      margin: '200px auto 0',
      overflow: 'auto',
    }}
  >
    <Sortable {...props} />
  </div>
);

export const PressDelay = () => (
  <Sortable
    {...props}
    activationConstraint={{
      delay: 250,
      tolerance: 5,
    }}
  />
);

export const MinimumDistance = () => (
  <Sortable
    {...props}
    activationConstraint={{
      distance: 15,
    }}
  />
);

export const VariableHeights = () => {
  const randomHeights = createRange(props.itemCount as number).map(() => {
    const heights = [110, undefined, 140, undefined, 90, undefined];
    const randomHeight = heights[Math.floor(Math.random() * heights.length)];

    return randomHeight;
  });

  return (
    <Sortable
      {...props}
      wrapperStyle={({id}) => {
        return {
          height: randomHeights[Number(id)],
        };
      }}
    />
  );
};

export const DisabledItems = () => (
  <Sortable
    {...props}
    isDisabled={(value) => ['1', '5', '8', '13', '20'].includes(value)}
  />
);

export const MarginBetweenItems = () => {
  const getMargin = (index: number) => {
    if ([0, 6, 25, 45].includes(index)) {
      return 25;
    }

    if ([10, 15, 35].includes(index)) {
      return 80;
    }

    return 0;
  };

  return (
    <Sortable
      {...props}
      wrapperStyle={({index}) => {
        return {
          marginBottom: getMargin(index),
        };
      }}
    />
  );
};

export const RerenderBeforeSorting = () => {
  return (
    <Sortable
      {...props}
      wrapperStyle={({isDragging}) => {
        return {
          transition: 'height 250ms ease',
          height: isDragging ? 100 : 200,
        };
      }}
    />
  );
};

export const RemovableItems = () => {
  const animateLayoutChanges: AnimateLayoutChanges = (args) =>
    args.isSorting || args.wasDragging
      ? defaultAnimateLayoutChanges(args)
      : true;

  return (
    <Sortable
      {...props}
      animateLayoutChanges={animateLayoutChanges}
      measuring={{droppable: {strategy: MeasuringStrategy.Always}}}
      removable
      handle
    />
  );
};

export const TransformedContainer = () => {
  return (
    <Sortable {...props} style={{transform: 'translate3d(100px, 100px, 0)'}} />
  );
};