import {
  type AutocompleteState,
  type AutocompleteStore,
  type BaseItem,
  type InternalAutocompleteOptions,
  type Reducer,
} from './types';
import { createCancelablePromiseList } from './utils';

type OnStoreStateChange<TItem extends BaseItem> = ({
  prevState,
  state,
}: {
  prevState: AutocompleteState<TItem>;
  state: AutocompleteState<TItem>;
}) => void;

/** redux style createStore */
export function createStore<TItem extends BaseItem>(
  reducer: Reducer,
  props: InternalAutocompleteOptions<TItem>,
  onStoreStateChange: OnStoreStateChange<TItem>,
): AutocompleteStore<TItem> {
  let state = props.initialState;

  return {
    getState() {
      return state;
    },
    dispatch(action, payload) {
      const prevState = { ...state };
      state = reducer(state, {
        type: action,
        props,
        payload,
      });

      onStoreStateChange({ state, prevState });
    },
    pendingRequests: createCancelablePromiseList(),
  };
}
