import React, { FC, useCallback, useEffect, useRef, useState } from "react";
import { render } from "react-dom";
import { Knave, useNavigationBlocker, useNavigationState } from "knave-react";

(window as any).framework = "react";

const container = document.getElementById("app");

if (!container) {
	throw new Error("Could not find container");
}

const App: FC = () => {
	const [modalVisible, setModalVisible] = useState(false);
	const resolverRef = useRef<(allow: boolean) => void>();

	useEffect(() => {
		document.body.classList.add("loaded");
	}, []);

	const { currentUrl, pendingUrl } = useNavigationState();

	useEffect(() => {
		document.body.style.backgroundColor = pendingUrl ? "red" : "white";
	}, [!!pendingUrl]);

	const showModal = useCallback(
		() =>
			new Promise<boolean>((resolve) => {
				resolverRef.current = resolve;
				setModalVisible(true);
			}),
		[],
	);

	useNavigationBlocker(
		new URL(currentUrl).pathname === "/react/block" && showModal,
	);

	return (
		<>
			<h1>React</h1>

			<p id="path">{location.pathname}</p>

			<ul>
				<li>
					<a id="link-1" href="/react/aaa">
						Link 1
					</a>
				</li>
				<li>
					<a id="link-2" href="/react/bbb">
						Link 2
					</a>
				</li>
				<li>
					<a id="external-link" href="/react/aaa" rel="external">
						External link
					</a>
				</li>
				<li>
					<a id="slow-link" href="/react/slow">
						Slow
					</a>
				</li>
				<li>
					<a id="relative-link" href="relative">
						Relative
					</a>
				</li>
			</ul>

			{modalVisible && (
				<p id="buttons">
					<button
						type="button"
						id="yes"
						onClick={() => {
							resolverRef.current?.(true);
							setModalVisible(false);
						}}
					>
						Yes
					</button>
					<button
						type="button"
						id="no"
						onClick={() => {
							resolverRef.current?.(false);
							setModalVisible(false);
						}}
					>
						No
					</button>
				</p>
			)}
		</>
	);
};

async function doRender() {
	console.log("Rendering");
	RENDER_NO++;

	if (location.pathname === "/react/slow") {
		await new Promise<void>((resolve) => {
			continueRendering = resolve;
		});
	}

	return <App />;
}

async function main() {
	const initial = await doRender();
	render(
		<Knave render={doRender} installGlobalHandler>
			{initial}
		</Knave>,
		container,
	);
}

main();
