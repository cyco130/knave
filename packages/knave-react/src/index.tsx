import React, {
	FC,
	useEffect,
	useState,
	ReactNode,
	useRef,
	useContext,
	createContext,
	forwardRef,
	AnchorHTMLAttributes,
	CSSProperties,
} from "react";
import {
	initialize,
	finalize,
	addNavigationListener,
	removeNavigationListener,
	NavigationListener,
	NavigationState,
	addNavigationBlocker,
	removeNavigationBlocker,
	navigate,
	shouldHandleClick,
} from "knave";

export { navigate };

export interface KnaveProps {
	render(abortSignal: AbortSignal): ReactNode | Promise<ReactNode>;
	installGlobalHandler?: boolean;
}

export const Knave: FC<KnaveProps> = ({
	children,
	render,
	installGlobalHandler,
}) => {
	const resolveRef = useRef<() => void>();
	const initialRef = useRef(true);
	const [rendered, setRendered] = useState<ReactNode>(children);

	function doRender(signal: AbortSignal): Promise<void> {
		return new Promise(async (resolve) => {
			resolveRef.current = resolve;

			initialRef.current = false;

			let rendered: ReactNode = null;

			try {
				rendered = await render(signal);
			} catch (error) {
				console.error(error);
			}

			if (signal.aborted) {
				resolve();
			} else {
				setRendered(rendered);
			}
		});
	}

	useEffect(() => {
		initialize(doRender, installGlobalHandler);
		return finalize;
	}, []);

	return (
		<KnaveContext.Provider
			value={initialRef.current ? location.href : undefined}
		>
			<KnaveContent
				onRenderComplete={() => {
					resolveRef.current?.();
				}}
			>
				{rendered}
			</KnaveContent>
		</KnaveContext.Provider>
	);
};

const KnaveContext = createContext<string | undefined>(undefined);

export const KnaveServerSideProvider: FC<{ url: string }> = ({
	url,
	children,
}) => <KnaveContext.Provider value={url}>{children}</KnaveContext.Provider>;

export function useCurrentLocation(): string {
	const contextValue = useContext(KnaveContext);

	const [loc, setLoc] = useState(contextValue || location.href);

	useEffect(() => {
		const handler: NavigationListener = (nav) => {
			setLoc(nav.currentUrl);
		};

		addNavigationListener(handler);

		return () => removeNavigationListener(handler);
	}, []);

	return loc;
}

export function useNavigationState(): NavigationState {
	const contextValue = useContext(KnaveContext);

	const [state, setState] = useState<NavigationState>({
		currentUrl: contextValue || location.href,
	});

	useEffect(() => {
		const handler: NavigationListener = (nav) => {
			setState(nav);
		};

		addNavigationListener(handler);

		return () => removeNavigationListener(handler);
	}, []);

	return state;
}

export function usePendingLocation(): string | undefined {
	const [loc, setLoc] = useState<string | undefined>(undefined);

	useEffect(() => {
		const handler: NavigationListener = (nav) => {
			setLoc(nav.pendingUrl);
		};

		addNavigationListener(handler);

		return () => removeNavigationListener(handler);
	}, []);

	return loc;
}

export function useNavigationBlocker(
	blocker?: boolean | (() => boolean | Promise<boolean>),
) {
	useEffect(() => {
		if (typeof blocker === "function") {
			addNavigationBlocker(blocker);
			return () => removeNavigationBlocker(blocker);
		}
	}, [blocker]);
}

interface KnaveContentProps {
	onRenderComplete: () => void;
}

const KnaveContent: FC<KnaveContentProps> = ({
	children,
	onRenderComplete,
}) => {
	useEffect(() => onRenderComplete);

	return <>{children}</>;
};

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
	historyState?: any;
	noScroll?: boolean;
	replaceState?: boolean;
	onNavigationStart?: () => void;
	onNavigationEnd?(completed: boolean): void;
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(
	(
		{
			onNavigationStart,
			onNavigationEnd,
			onClick,
			historyState,
			noScroll,
			replaceState,
			...props
		},
		ref,
	) => (
		<a
			{...props}
			ref={ref}
			onClick={(e) => {
				onClick?.(e);
				if (!shouldHandleClick(e)) {
					return;
				}

				onNavigationStart?.();

				navigate(e.currentTarget.href, {
					data: historyState,
					replace: replaceState,
					scroll: !noScroll,
				}).then((complete) => onNavigationEnd?.(complete));

				e.preventDefault();
			}}
		/>
	),
);

Link.displayName = "Link";

export interface StyledLinkProps extends LinkProps {
	/** Class to be added if `href` matches the current URL */
	activeClass?: string;
	/** Style to be added if `href` matches the current URL */
	activeStyle?: CSSProperties;

	/** Class to be added if navigation is underway because the user clicked on this link */
	pendingClass?: string;
	/** Style to be added if navigation is underway because the user clicked on this link */
	pendingStyle?: CSSProperties;

	/**
	 * Custom comparison function for checking if the current URL matches this link
	 * @param url  URL to be compared to `href`
	 * @param href Value of `href` property, passed for convenience
	 *
	 * @returns true if the URL matches `href`
	 */
	onCompareUrls?(url: URL, href: URL): boolean;
}

/**
 * Like {@link Link} but allows adding classes and/or styles based on whether this is the active URL.
 */
export const StyledLink = forwardRef<HTMLAnchorElement, StyledLinkProps>(
	(
		{
			activeClass,
			pendingClass,
			pendingStyle,
			activeStyle,
			onCompareUrls = defaultCompareUrls,
			className,
			style,
			onNavigationStart,
			onNavigationEnd,

			...props
		},
		ref,
	) => {
		const [navigating, setNavigating] = useState(false);
		const current = useCurrentLocation();

		const classNames = className ? [className] : [];

		if (
			props.href !== undefined &&
			(activeClass || pendingClass || activeStyle || pendingStyle)
		) {
			const url = new URL(props.href, current);
			if (navigating) {
				if (pendingClass) classNames.push(pendingClass);
				if (pendingStyle) style = { ...style, ...pendingStyle };
			}

			if (current && onCompareUrls(new URL(current), url)) {
				if (activeClass) classNames.push(activeClass);
				if (activeStyle) style = { ...style, ...activeStyle };
			}
		}

		return (
			<Link
				{...props}
				ref={ref}
				className={classNames.join(" ") || undefined}
				style={style}
				onNavigationStart={() => {
					setNavigating(true);
					onNavigationStart?.();
				}}
				onNavigationEnd={() => {
					setNavigating(false);
					onNavigationEnd?.(true);
				}}
			/>
		);
	},
);

StyledLink.displayName = "StyledLink";

function defaultCompareUrls(a: URL, b: URL) {
	return a.href === b.href;
}
