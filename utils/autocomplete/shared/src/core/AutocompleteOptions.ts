import { type MaybePromise } from '../MaybePromise';
import { type AutocompleteScopeApi, type BaseItem } from './AutocompleteApi';
import { type AutocompleteEnvironment } from './AutocompleteEnvironment';
import { type AutocompleteNavigator } from './AutocompleteNavigator';
import { type AutocompletePlugin } from './AutocompletePlugin';
import { type Reshape } from './AutocompleteReshape';
import {
  type AutocompleteSource,
  type InternalAutocompleteSource,
} from './AutocompleteSource';
import { type AutocompleteState } from './AutocompleteState';

export interface OnSubmitParams<TItem extends BaseItem>
  extends AutocompleteScopeApi<TItem> {
  state: AutocompleteState<TItem>;
  event: any;
}

export type OnResetParams<TItem extends BaseItem> = OnSubmitParams<TItem>;

export interface OnInputParams<TItem extends BaseItem>
  extends AutocompleteScopeApi<TItem> {
  /** the value typed in the search input */
  query: string;
  /** state is an underlying set of properties that drives the autocomplete behavior */
  state: AutocompleteState<TItem>;
}

export type GetSourcesParams<TItem extends BaseItem> = OnInputParams<TItem>;

export type GetSources<TItem extends BaseItem> = (
  params: GetSourcesParams<TItem>,
) => MaybePromise<Array<AutocompleteSource<TItem> | boolean | undefined>>;
export type InternalGetSources<TItem extends BaseItem> = (
  params: GetSourcesParams<TItem>,
) => Promise<Array<InternalAutocompleteSource<TItem>>>;

interface OnStateChangeProps<TItem extends BaseItem>
  extends AutocompleteScopeApi<TItem> {
  /**
   * The current Autocomplete state.
   */
  state: AutocompleteState<TItem>;
  /**
   * The previous Autocomplete state.
   */
  prevState: AutocompleteState<TItem>;
}

export interface AutocompleteOptions<TItem extends BaseItem> {
  /**
   * A flag to activate the debug mode.
   *
   * This is useful while developing because it keeps the panel open even when the blur event occurs. **Make sure to disable it in production.**
   *
   * See [**Debugging**](https://www.algolia.com/doc/ui-libraries/autocomplete/guides/debugging/) for more information.
   *
   * @default false
   * @link https://www.algolia.com/doc/ui-libraries/autocomplete/api-reference/autocomplete-js/autocomplete/#param-debug
   */
  debug?: boolean;
  /**
   * An ID for the autocomplete to create accessible attributes.
   *
   * It is incremented by default when creating a new Autocomplete instance.
   *
   * @default "autocomplete-0"
   * @link https://www.algolia.com/doc/ui-libraries/autocomplete/api-reference/autocomplete-js/autocomplete/#param-id
   */
  id?: string;
  /**
   * The function called when the internal state changes.
   * - firstly props.onStateChange , then plugin.onStateChange
   *
   * @link https://www.algolia.com/doc/ui-libraries/autocomplete/api-reference/autocomplete-js/autocomplete/#param-onstatechange
   */
  onStateChange?(props: OnStateChangeProps<TItem>): void;
  /**
   * The placeholder text to show in the search input when there's no query.
   * - the text that appears in the input before the user types anything.
   *
   * @link https://www.algolia.com/doc/ui-libraries/autocomplete/api-reference/autocomplete-js/autocomplete/#param-placeholder
   */
  placeholder?: string;
  /**
   * Whether to focus the search input or not when the page is loaded.
   * - if true, focus on the search box on page load
   * @default false
   * @link https://www.algolia.com/doc/ui-libraries/autocomplete/api-reference/autocomplete-js/autocomplete/#param-autofocus
   */
  autoFocus?: boolean;
  /**
   * The default item index to pre-select.
   * - We recommend using `0` when the autocomplete is used to open links, instead of triggering a search in an application.
   *
   * @default null
   * @link https://www.algolia.com/doc/ui-libraries/autocomplete/api-reference/autocomplete-js/autocomplete/#param-defaultactiveitemid
   */
  defaultActiveItemId?: number | null;
  /**
   * Whether to open the panel on focus when there's no query.
   * - display items as soon as a user selects the autocomplete, even without typing.
   * @default false
   * @link https://www.algolia.com/doc/ui-libraries/autocomplete/api-reference/autocomplete-js/autocomplete/#param-openonfocus
   */
  openOnFocus?: boolean;
  /**
   * How many milliseconds must elapse before considering the autocomplete experience [stalled](https://www.algolia.com/doc/ui-libraries/autocomplete/core-concepts/state/#param-status).
   *
   * @default 300
   * @link https://www.algolia.com/doc/ui-libraries/autocomplete/api-reference/autocomplete-js/autocomplete/#param-stallthreshold
   */
  stallThreshold?: number;
  /**
   * The initial state to apply when autocomplete is created.
   *
   * @link https://www.algolia.com/doc/ui-libraries/autocomplete/api-reference/autocomplete-js/autocomplete/#param-initialstate
   */
  initialState?: Partial<AutocompleteState<TItem>>;
  /**
   * The [sources](https://www.algolia.com/doc/ui-libraries/autocomplete/core-concepts/sources/) to get the suggestions from.
   *
   * @link https://www.algolia.com/doc/ui-libraries/autocomplete/api-reference/autocomplete-js/autocomplete/#param-getsources
   */
  getSources?: GetSources<TItem>;
  /**
   * The environment in which your application is running.
   * - This is useful if you're using autocomplete in a different context than `window`.
   *
   * @default window
   * @link https://www.algolia.com/doc/ui-libraries/autocomplete/api-reference/autocomplete-js/autocomplete/#param-environment
   */
  environment?: AutocompleteEnvironment;
  /**
   * An implementation of Autocomplete's Navigator API to redirect the user when opening a link.
   * - By default, the Navigator API uses the `Location` API
   * Learn more on the [**Navigator API**](https://www.algolia.com/doc/ui-libraries/autocomplete/core-concepts/keyboard-navigation/) documentation.
   *
   * @link https://www.algolia.com/doc/ui-libraries/autocomplete/api-reference/autocomplete-js/autocomplete/#param-navigator
   */
  navigator?: Partial<AutocompleteNavigator<TItem>>;
  /**
   * The function called to determine whether the panel should open or not.
   *
   * By default, the panel opens when there are items in the state.
   *
   * @link https://www.algolia.com/doc/ui-libraries/autocomplete/api-reference/autocomplete-js/autocomplete/#param-shouldpanelopen
   */
  shouldPanelOpen?(params: { state: AutocompleteState<TItem> }): boolean;
  /**
   * The function called when submitting the Autocomplete form.
   *
   * @link https://www.algolia.com/doc/ui-libraries/autocomplete/api-reference/autocomplete-js/autocomplete/#param-onsubmit
   */
  onSubmit?(params: OnSubmitParams<TItem>): void;
  /**
   * The function called when resetting the Autocomplete form.
   *
   * @link https://www.algolia.com/doc/ui-libraries/autocomplete/api-reference/autocomplete-js/autocomplete/#param-onreset
   */
  onReset?(params: OnResetParams<TItem>): void;
  /**
   * The plugins that encapsulate and distribute custom Autocomplete behaviors.
   * - a plugin is an object that implements the AutocompletePlugin interface.
   * - It can provide sources, react to state changes, and hook into various autocomplete lifecycle steps. It has access to setters, including the Context API, allowing it to store and retrieve arbitrary data at any time.
   * - Plugins execute sequentially, in the order you define them.
   *
   * See [**Plugins**](https://www.algolia.com/doc/ui-libraries/autocomplete/core-concepts/plugins/) for more information.
   * @link https://www.algolia.com/doc/ui-libraries/autocomplete/api-reference/autocomplete-js/autocomplete/#param-plugins
   */
  plugins?: Array<AutocompletePlugin<any, any>>;
  /**
   * The function called to reshape the sources after they're resolved.
   * - This is useful to transform sources before rendering them. You can group sources by attribute, remove duplicates, create shared limits between sources, etc.
   *
   * See [**Reshaping sources**](https://www.algolia.com/doc/ui-libraries/autocomplete/guides/reshaping-sources/) for more information.
   *
   * @link https://www.algolia.com/doc/ui-libraries/autocomplete/api-reference/autocomplete-js/autocomplete/#param-reshape
   */
  reshape?: Reshape<TItem>;
}

/** Props manipulated internally with default values. */
export interface InternalAutocompleteOptions<TItem extends BaseItem>
  extends AutocompleteOptions<TItem> {
  debug: boolean;
  id: string;
  onStateChange(props: OnStateChangeProps<TItem>): void;
  placeholder: string;
  autoFocus: boolean;
  defaultActiveItemId: number | null;
  openOnFocus: boolean;
  stallThreshold: number;
  initialState: AutocompleteState<TItem>;
  getSources: InternalGetSources<TItem>;
  environment: AutocompleteEnvironment;
  navigator: AutocompleteNavigator<TItem>;
  plugins: Array<AutocompletePlugin<any, any>>;
  shouldPanelOpen(params: { state: AutocompleteState<TItem> }): boolean;
  onSubmit(params: OnSubmitParams<TItem>): void;
  onReset(params: OnResetParams<TItem>): void;
  reshape: Reshape<TItem>;
}
