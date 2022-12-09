/**
 * Initialize client-side navigation. This function must be called (only once) before any
 * navigation occurs.
 */
export function initialize(
	/** Function to be called when a new page should render */
	renderFunction: RenderFunction,
	/** Whether to install a global click handler for a and area elements */
	installGlobalHandler?: boolean,
) {
	if (render) {
		throw new Error("Knave already initialized");
	}

	render = renderFunction;
	currentUrl = location.href;
	nextIndex = 0;
	savedScrollRestoration = history.scrollRestoration;
	history.scrollRestoration = "manual";

	addEventListener("popstate", handleNavigation);

	base = document.head.querySelector("base")!;
	if (!base) {
		base = document.createElement("base");
		document.head.insertBefore(base, document.head.firstChild);
	}

	base.href = location.href;

	if (installGlobalHandler) {
		document.body.addEventListener("click", handleClick);
	}

	lastRenderedId = createUniqueId();
	lastRenderedIndex = nextIndex++;

	history.replaceState(
		{ id: lastRenderedId, index: lastRenderedIndex },
		"",
		location.href,
	);
}

/** Finalize client-side navigation. You can call this function when you don't need client-side navigation anymore. */
export function finalize() {
	removeEventListener("popstate", handleNavigation);
	render = undefined;
	history.scrollRestoration = savedScrollRestoration;
	listeners = [];
	blockers = [];
	pending = undefined;
}

export interface MouseEventLike {
	target: EventTarget | null;
	defaultPrevented: boolean;
	button: number;
	shiftKey: boolean;
	altKey: boolean;
	ctrlKey: boolean;
	metaKey: boolean;

	preventDefault(): void;
}

function handleClick(e: MouseEventLike): void {
	if (!shouldHandleClick(e)) return;

	e.preventDefault();

	navigate((e.target as any).href);
}

export function shouldHandleClick(e: MouseEventLike): boolean {
	const t = e.target;

	return (
		(t instanceof HTMLAnchorElement ||
			t instanceof SVGAElement ||
			t instanceof HTMLAreaElement) &&
		!e.defaultPrevented &&
		t.href !== undefined &&
		e.button === 0 &&
		!e.shiftKey &&
		!e.altKey &&
		!e.ctrlKey &&
		!e.metaKey &&
		(!t.target || t.target !== "_self") &&
		!t.hasAttribute("download") &&
		!t.relList.contains("external")
	);
}

export async function navigate(
	to: string,
	options?: NavigationOptions,
): Promise<boolean> {
	if (!render) {
		throw new Error("Knave not initialized");
	}

	const url = new URL(to, location.href);

	if (url.origin !== location.origin) {
		location.href = url.href;
		return new Promise(() => {
			/* Do nothing */
		});
	}

	const { replace, scroll, data } = options || {};
	const id = createUniqueId();

	if (replace) {
		history.replaceState({ id, data, index: history.state.index }, "", to);
	} else {
		const index = nextIndex++;
		history.pushState({ id, data, index }, "", to);
	}

	return handleNavigation(undefined, scroll);
}

export interface NavigationOptions {
	replace?: boolean;
	scroll?: boolean;
	data?: any;
}

function handleBeforeUnload(e: BeforeUnloadEvent) {
	// Cancel the event
	e.preventDefault(); // If you prevent default behavior in Mozilla Firefox prompt will always be shown
	// Chrome requires returnValue to be set
	e.returnValue = "";
}

let blocking = false;
let ignoring = false;
let lastCanceled:
	| {
			delta: number;
			href: string;
			state: any;
	  }
	| undefined;
let redoing = false;
let pendingResolver: ((result: boolean) => void) | undefined;
let cancelResolver: (() => void) | undefined;

function ignoreNavigation() {
	ignoring = true;
	history.go(lastRenderedIndex - history.state.index);
}

function cancelNavigation() {
	lastCanceled = {
		delta: lastRenderedIndex - history.state.index,
		href: location.href,
		state: history.state,
	};

	return new Promise<void>((resolve) => {
		cancelResolver = resolve;

		history.go(lastCanceled?.delta);

		if (scroll !== undefined) {
			nextIndex--;
		}
	});
}

function redoNavigation() {
	redoing = true;
	history.go(-lastCanceled!.delta);
}

async function handleNavigation(_: unknown, scroll = true): Promise<boolean> {
	if (ignoring) {
		ignoring = false;
		return false;
	}

	if (cancelResolver) {
		cancelResolver();
		cancelResolver = undefined;
		return false;
	}

	if (redoing && lastCanceled) {
		history.replaceState(lastCanceled.state, "", lastCanceled.href);
	}

	if (blocking) {
		ignoreNavigation();
		return false;
	}

	if (!redoing && blockers.length) {
		redoing = false;
		blocking = true;

		await cancelNavigation();

		const result = await callNavigationBlockers();

		blocking = false;

		if (!result) {
			pendingResolver?.(false);
			pendingResolver = undefined;
			return false;
		}

		redoNavigation();
		return new Promise((resolve) => (pendingResolver = resolve));
	}

	redoing = false;

	// Save scroll position
	const scrollPosition = { x: scrollX, y: scrollY };
	sessionStorage.setItem(
		`knave:${lastRenderedId}`,
		JSON.stringify(scrollPosition),
	);

	// Abort any pending navigation
	if (pending) pending.abort();

	// Render new page
	const controller = new AbortController();

	const result = render!(controller.signal);

	if (isPromise(result)) {
		pending = controller;
		listeners.forEach((f) => f({ currentUrl, pendingUrl: location.href }));

		return result.then(() => {
			pending = undefined;
			if (controller.signal.aborted) {
				pendingResolver?.(false);
				pendingResolver = undefined;
				return false;
			}

			currentUrl = location.href;
			listeners.forEach((f) => f({ currentUrl }));

			if (scroll) restoreScrollPosition();

			lastRenderedId = history.state.id;
			lastRenderedIndex = history.state.index;
			base.href = location.href;
			pendingResolver?.(true);
			pendingResolver = undefined;
			return true;
		});
	} else {
		currentUrl = location.href;
		listeners.forEach((f) => f({ currentUrl }));
		if (scroll) restoreScrollPosition();

		lastRenderedId = history.state.id;
		lastRenderedIndex = history.state.index;
		base.href = location.href;
		pendingResolver?.(true);
		pendingResolver = undefined;
		return true;
	}
}

export type RenderFunction = (abortSignal: AbortSignal) => void | Promise<void>;

export type NavigationListener = (navigation: NavigationState) => void;

export interface NavigationState {
	currentUrl: string;
	pendingUrl?: string;
}

export function addNavigationListener(listener: NavigationListener): void {
	listeners.push(listener);
}

export function removeNavigationListener(listener: NavigationListener): void {
	listeners = listeners.filter((l) => l !== listener);
}

export function addNavigationBlocker(
	blocker: () => boolean | Promise<boolean>,
): void {
	blockers.push(blocker);
	if (blockers.length === 1 && render) {
		addEventListener("beforeunload", handleBeforeUnload);
	}
}

export function removeNavigationBlocker(
	blocker: () => boolean | Promise<boolean>,
): void {
	blockers = blockers.filter((b) => b !== blocker);
	if (blockers.length === 0) {
		removeEventListener("beforeunload", handleBeforeUnload);
	}
}

async function callNavigationBlockers(): Promise<boolean> {
	for (const blocker of blockers) {
		let result = true;

		try {
			result = await blocker();
		} catch {
			/* Ignore */
		}

		if (!result) return false;
	}

	return true;
}

function restoreScrollPosition() {
	const scrollPosition = sessionStorage.getItem(`knave:${history.state?.id}`);

	if (scrollPosition) {
		const { x, y } = JSON.parse(scrollPosition);
		scrollTo(x, y);
	} else {
		const hash = location.hash;
		if (hash) {
			const element = document.querySelector(hash);
			if (element) {
				element.scrollIntoView();
			}
		} else {
			scrollTo(0, 0);
		}
	}
}

let render: RenderFunction | undefined;
let pending: AbortController | undefined;
let listeners: NavigationListener[] = [];
let blockers: (() => boolean | Promise<boolean>)[] = [];
let nextIndex = 0;
let currentUrl: string;
let lastRenderedId: string;
let lastRenderedIndex: number;
let savedScrollRestoration: ScrollRestoration;
let base: HTMLBaseElement;

function createUniqueId(): string {
	return Math.random().toString(36).substr(2, 9);
}

function isPromise(value: any): value is Promise<any> {
	return value && typeof value.then === "function";
}
