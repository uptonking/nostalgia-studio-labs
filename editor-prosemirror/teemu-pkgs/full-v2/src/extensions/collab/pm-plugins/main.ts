import { Plugin } from 'prosemirror-state';
import { DecorationSet } from 'prosemirror-view';

import { type EditorContext } from '../../../context';
import { type CollabParticipant } from '../types';
import { type CollabState, collabEditPluginKey, getPluginState } from './state';
import { type CollabExtensionProps } from '..';

export const collabEditPluginFactory = (
  ctx: EditorContext,
  props: CollabExtensionProps,
) =>
  new Plugin<CollabState>({
    state: {
      init(_, state) {
        return {
          decorations: DecorationSet.create(state.doc, []),
          participants: new Map<string, CollabParticipant>(),
          isCollabInitialized: false,
        };
      },
      apply(tr, pluginState) {
        return pluginState;
      },
    },
    key: collabEditPluginKey,
    props: {
      decorations(this: Plugin, state) {
        return this.getState(state).decorations;
      },
    },
    filterTransaction(tr, state) {
      // TODO 28.3.2021: not sure is this whole block needed
      const pluginState = getPluginState(state);
      const isCollabInitialized = tr.getMeta('collabInitialized');

      // Don't allow transactions that modifies the document before
      // collab-plugin is ready.
      if (isCollabInitialized) {
        return true;
      }

      if (!pluginState.isCollabInitialized && tr.docChanged) {
        return false;
      }

      return true;
    },
    view(view) {
      return {
        destroy() {},
      };
    },
    // view(view) {
    //   const addErrorAnalytics = addSynchronyErrorAnalytics(
    //     view.state,
    //     view.state.tr,
    //   )

    //   const cleanup = collabProviderCallback(
    //     initialize({ view, options, providerFactory }),
    //     addErrorAnalytics,
    //   )

    //   return {
    //     destroy() {
    //       providerFactory.unsubscribeAll('collabEditProvider')
    //       if (cleanup) {
    //         cleanup.then(unsubscribe => {
    //           if (unsubscribe) {
    //             unsubscribe()
    //           }
    //         })
    //       }
    //     },
    //   }
    // },
  });
