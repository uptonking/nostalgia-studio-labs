import React from 'react';

import { type CreateNosPluginType } from '../types';
import { Heading1, Heading2, Heading3 } from './components/heading';
import {
  isHeading1Element,
  isHeading2Element,
  isHeading3Element,
} from './utils';
import { withHeading } from './with-heading';

export const useHeadingPlugin: CreateNosPluginType = () => {
  return {
    withOverrides: withHeading,
    renderElement: (props) => {
      if (isHeading1Element(props.element)) {
        return <Heading1 {...props} element={props.element} />;
      }

      if (isHeading2Element(props.element)) {
        return <Heading2 {...props} element={props.element} />;
      }

      if (isHeading3Element(props.element)) {
        return <Heading3 {...props} element={props.element} />;
      }

      return null;
    },
  };
};
