# knave-react

**knave-react** is a complete MIT-licensed client-side navigation solution for React. It supports scroll restoration, navigation blocking, asynchronous rendering and optional global onclick handling. See the [design](https://github.com/cyco130/knave/blob/main/design.md) document for the rational.

Check out [`knave`](https://github.com/cyco130/knave/tree/main/packages/knave-react) if you want to use Knave with other frameworks

## Installation

```sh
npm install --save knave
```

## API

### `Knave`

This is the main client-side navigation component, it takes the  following props:

```ts
export interface KnaveProps {
  render(abortSignal: AbortSignal): ReactNode | Promise<ReactNode>;
  installGlobalHandler?: boolean;
}
```

The `render` callback will be called when a new page needs to be rendered. On the first render, the children will be rendered instead. `abortSignal` can be used to detect aborted navigation for example when the user clicks on another link before the previous page has finished rendering.

If `installGlobalHandler` is `true`, the library will install a global onclick handler which will try to use client-side navigation for all `a` and `area` elements. You can opt out of client-side navigation with `rel="external"`.

Say you have a very simple web app with three pages, each page represented by a React component:

| Path     | Component   |
| -------- | ----------- |
| `/`      | `HomePage`  |
| `/news`  | `NewsPage`  |
| `/about` | `AboutPage` |

You would do something like this:

```jsx
import React from 'react';
import { Knave } from 'knave-react';
import { render } from 'react-dom';

function renderPage() {
  // Map path to component
  const Component =
    {
      '/': HomePage,
      '/news': NewsPage,
      '/about': AboutPage,
    }[new URL(location.href).pathname] || NotFoundPage;

  return (
    <div>
      {/* This navigation menu will be shared by all pages */}
      <nav>
        <ul>
          <li>
            <a href="/">Home</a>
          </li>
          <li>
            <a href="/news">News</a>
          </li>
          <li>
            <a href="/about">About</a>
          </li>
          <li>
            <a href="/404">Broken link</a>
          </li>
        </ul>
      </nav>
      <Component />
    </div>
  );
}

const App = ({ children }) => (
  <Knave installGlobalHandler render={renderPage}>
    {children}
  </Knave>
);

const HomePage = () => <p>This is the home page</p>;
const NewsPage = () => <p>This is the news page</p>;
const AboutPage = () => <p>This is the about page</p>;

const NotFoundPage = () => <p>Not found</p>;

render(<App>{renderPage()}</App>, document.getElementById('root'));
```

A more involved scenario would look like this:

```jsx
<Knave
  installGlobalHandler
  // Render callback can return a Promise (so it can use async logic)
  render={async () => {
    try {
      // findModuleNameForUrl is a hypothetical function for matching
      // URLs with modules that default export a page component
      const moduleName = findModuleNameForUrl(url);

      // All modern bundlers support something like this:
      const pageModule = await import(`./pages/${moduleName}`);

      // Extract the page component and render it
      const PageComponent = pageModule.default;

      // getPageProps is a hypothetical function for fetching data
      // needed for a page
      const props = await getPageProps(url);

      return <PageComponent {...props} />;
    } catch (error) {
      return <p>Could not load page: {error.message}</p>;
    }
  }}
>
  {initialRender}
</Knave>
```

### `navigate()`

```ts
function navigate(to: string, options?: NavigationOptions): Promise<boolean>;

interface NavigationOptions {
  replace?: boolean;
  scroll?: boolean;
  data?: any;
}
```

`navigate` can be used for programmatic navigation. It tries to perform client-side navigation to the given `to` URL. It returns a promise which resolves to `true` if the navigation was successful and `false` if it was aborted (for example by another call to `navigate`). If the given URL's origin is different from the current one, normal navigation will be performed instead and the promise will never resolve.

You can control the navigation behavior by passing an `options` object. If `replace` is `true`, the current history entry will be replaced instead of pushing a new entry. If `scroll` is `true`, the page will be scrolled to the `#hash` element if there is one or to the top. `data` will be saved in the history entry and can be accessed with `history.state.data`.

### `useCurrentLocation`, `useNavigationState`, and `usePendingLocation`

```ts
function useCurrentLocation(): string;
function usePendingLocation(): string | undefined;
function useNavigationState(): NavigationState;

interface NavigationState {
    currentUrl: string;
    pendingUrl?: string;
}
```

These custom hooks can be used to rerender a component when the current URL or the pending URL changes. `currentUrl` will contain the URL of the last rendered page which may be different than `location.href` when rendering asynchronously. The `pendingUrl` property will be set when rendering asynchronously and will contain the URL that is currently being rendered. The listeners will be called again with `pendingUrl` set to `undefined` when the rendering is finished. It will always be `undefined` when rendering synchronously.

### `useNavigationBlocker()`

```ts
function useNavigationBlocker(blocker?: boolean | (() => boolean | Promise<boolean>)): void;
```

This custom hook can be used to register navigation blockers. Navigation blocking is useful for notifying the user that there is unsaved data that may be lost. A navigation blocker is a function that returns `true` if the navigation should be blocked and `false` if it should be allowed. It can be asynchronous. Typically it would show the user a confirmation dialog and return according to the user's choice. `knave` will also install an `onbeforeunload` handler when a navigation blocker is added. Blockers are called in the order they were added and the first blocker that returns `false` will block the navigation.

You can use `useNavigationBlocker` like this (`showFancyConfirmationDialog` can be asynchronous):

```ts
// useCallback is necessary to prevent the function from being recreated on every render
const showModal = useCallback(() => showFancyConfirmationDialog("Are you sure you want to leave?"), []);

useNavigationBlocker(thereAreUnsavedChanges && );
```

### `Link`

You can use the `Link` component if you don't want to install the global click handler. It accepts all the props that an `<a>` element accepts and the following extra props:

```ts
// Extra data to be saved in history state. It can be accessed with
// `history.state.data`.
historyState?: any;
// If true, scroll restoration will be disabled.
noScroll?: boolean;
// If true, the current history entry will be replaced instead of pushing a
// new entry
replaceState?: boolean;
// Fired when navigation starts
onNavigationStart?: () => void;
// Fired when navigation ends. `completed` will be false if the navigation was
// aborted.
onNavigationEnd?(completed: boolean): void;
```

### `StyledLink`

The `StyledLink` component is useful for styling a link differently based on its active or pending state. It accepts all the `Link` props plus the following extras:

```ts
// Class to be added if `href` matches the current URL
activeClass?: string;

// Styles to be added if `href` matches the current URL
activeStyle?: CSSProperties;

// Class to be added if navigation is underway because the user clicked on this link
pendingClass?: string;

// Styles to be added if navigation is underway because the user clicked on this link
pendingStyle?: CSSProperties;

// Custom comparison function for checking if the current URL matches this link
// @param url  URL to be compared to `href`
// @param href Value of `href` property, passed for convenience
//
// Return true if the URL matches `href`
onCompareUrls?(url: URL, href: URL): boolean;
```
