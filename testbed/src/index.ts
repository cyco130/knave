async function main() {
	const container = document.getElementById("app");
	if (!container) {
		throw new Error("Container not found");
	}

	const path = window.location.pathname;

	if (path.startsWith("/vanilla")) {
		await import("./vanilla-page");
	} else {
		container.innerHTML = `
			<h1>Knave Testbed Main Page</h1>
			<p>Available tests:</p>
			<ul>
				<li><a href="/vanilla">Vanilla</a></li>
			</ul>
		`;
	}
}

main().catch((error) => {
	console.error(error);
	if (error instanceof Error) {
		alert(error.message);
	} else {
		alert("Unknown error");
	}
});
