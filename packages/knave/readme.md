# Knave

Knave is a MIT-licensed, zero-dependency client-side navigation library which is framework-agnostic. It supports scroll restoration, navigation blocking, asynchronous rendering and optional global onclick handling. See the [design](https://github.com/cyco130/knave/blob/main/design.md) document for the rational.

Check out [`knave-react`](https://github.com/cyco130/knave/tree/main/packages/knave-react) if you want to use Knave with React.

## Installation

```sh
npm install --save knave
```

## API

### `initialize()`

```ts
function initialize(renderFunction: (abortSignal: AbortSignal) => void | Promise<void>, installGlobalHandler?: boolean): Promise<void>
```

You must call this function once in order to initialize the library and set the render function. Render function will be called for the first time after initialization. It will be called again every time client-side navigation is used. Its purpose is to render the content of the page synchronously or asynchronously. `abortSignal` can be used to detect aborted navigation for example when the user clicks on another link before the previous page has finished rendering.

If `installGlobalHandler` is `true`, the library will install a global onclick handler which will try to use client-side navigation for all `a` and `area` elements. You can opt out of client-side navigation with `rel="external"`.

### `finalize()`

You may call this function to perform cleanup if you don't need client-side navigation anymore. Typically it's not necessary.

### `navigate()`

```ts
function navigate(to: string, options?: NavigationOptions): Promise<boolean>;

interface NavigationOptions {
  replace?: boolean;
  scroll?: boolean;
  data?: any;
}
```

This is the heart of `knave`. It tries to perform client-side navigation to the given `to` URL. It returns a promise which resolves to `true` if the navigation was successful and `false` if it was aborted (for example by another call to `navigate`). If the given URL's origin is different from the current one, normal navigation will be performed instead and the promise will never resolve.

You can control the navigation behavior by passing an `options` object. If `replace` is `true`, the current history entry will be replaced instead of pushed. If `scroll` is `true`, the page will be scrolled to the `#hash` element if there is one or to the top. `data` will be saved in the history entry and can be accessed with `history.state.data`.

### `addNavigationListener() and removeNavigationListener()`

```ts
function addNavigationListener(listener: NavigationListener): void;
function removeNavigationListener(listener: NavigationListener): void;

type NavigationListener = (navigation: {
    currentUrl: string;
    pendingUrl?: string;
}) => void;
```

With these pair of functions you can add or remove listeners that will be called on every navigation. The `currentUrl` property will contain the URL of the last rendered page which may be different than `location.href` when rendering asynchronously. The `pendingUrl` property will be set when rendering asynchronously and will contain the URL that is currently being rendered. The listeners will be called again with `pendingUrl` set to `undefined` when the rendering is finished. It will always be `undefined` when rendering synchronously.

### `addNavigationBlocker() and removeNavigationBlocker()`

```ts
function addNavigationBlocker(blocker: () => boolean | Promise<boolean>): void;
function removeNavigationBlocker(blocker: () => boolean | Promise<boolean>): void;
```

With these pair of functions you can add or remove navigation blockers. Navigation blocking is useful for notifying the user that there is unsaved data that may be lost. A navigation blocker is a function that returns `true` if the navigation should be blocked and `false` if it should be allowed. It can be asynchronous. Typically it would show the user a confirmation dialog and return according to the user's choice. `knave` will also install an `onbeforeunload` handler when a navigation blocker is added. Blockers are called in the order they were added and the first blocker that returns `false` will block the navigation.