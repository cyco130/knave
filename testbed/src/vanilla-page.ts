import {
	addNavigationListener,
	initialize,
	addNavigationBlocker,
	removeNavigationBlocker,
} from "knave";

let blocker: (() => Promise<boolean>) | undefined;

async function render() {
	RENDER_NO++;

	const container = document.getElementById("app");
	if (!container) {
		throw new Error("Could not find container");
	}

	if (location.pathname === "/vanilla/slow") {
		await new Promise<void>((resolve) => {
			continueRendering = resolve;
		});
	}

	if (location.pathname === "/vanilla/block") {
		blocker = () =>
			new Promise<boolean>((resolve) => {
				container.innerHTML += `<p id="buttons">
				<button type="button" id="yes">Yes</button>
				<button type="button" id="no">No</button>
			</p>`;

				document
					.getElementById("yes")!
					.addEventListener("click", () => resolve(true));
				document
					.getElementById("no")!
					.addEventListener("click", () => resolve(false));
			}).then((result) => {
				document.getElementById("buttons")!.remove();

				return result;
			});

		addNavigationBlocker(blocker);
	} else if (blocker) {
		removeNavigationBlocker(blocker);
		blocker = undefined;
	}

	let html = `
		<h1>Vanilla</h1>

		<p id="path">${location.pathname}</p>

		<ul>
			<li><a id="link-1" href="/vanilla/aaa">Link 1</a></li>
			<li><a id="link-2" href="/vanilla/bbb">Link 2</a></li>
			<li><a id="external-link" href="/vanilla/aaa" rel="external">External link</a></li>
			<li><a id="slow-link" href="/vanilla/slow">Slow</a></li>
			<li><a id="relative-link" href="relative">Relative</a></li>
		</ul>
	`;

	container.innerHTML = html;
}

async function main() {
	await initialize(render, true);

	addNavigationListener(
		(nav) =>
			(document.body.style.backgroundColor = nav.pendingUrl ? "red" : "white"),
	);

	document.body.classList.add("loaded");
}

main();
