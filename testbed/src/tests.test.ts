import { afterAll, beforeAll, it, expect, describe } from "vitest";
import puppeteer, { Browser, Page, ElementHandle } from "puppeteer";

let browser: Browser;
let page: Page;

beforeAll(async () => {
	browser = await puppeteer.launch({
		defaultViewport: { width: 1200, height: 800 },
	});

	const pages = await browser.pages();
	page = pages[0];

	page.on("dialog", (dialog) => dialog.accept());
});

afterAll(async () => {
	await browser.close();
});

function defineTests(framework: string) {
	describe(`${framework} tests`, () => {
		const root = `http://localhost:5173/${framework}`;

		it("should use client-side navigation", async () => {
			await page.goto(root);
			await page.waitForSelector(".loaded");

			const link = (await page.waitForSelector(
				"#link-1",
			)) as ElementHandle<HTMLAnchorElement>;

			expect(link).toBeDefined();

			await link.click();

			await page.waitForFunction(
				() =>
					document.getElementById("path")?.textContent ===
					"/" + framework + "/aaa",
			);

			const url = await page.url();
			expect(url).toBe(root + "/aaa");

			const renderNo = await page.evaluate(() => RENDER_NO);
			expect(renderNo).toBe(2);
		});

		it("should honor rel=external", async () => {
			await page.goto(root);
			await page.waitForSelector(".loaded");

			const link = (await page.waitForSelector(
				"#external-link",
			)) as ElementHandle<HTMLAnchorElement>;

			expect(link).toBeDefined();

			await link.click();

			await page.waitForSelector(".loaded");

			await page.waitForFunction(
				() =>
					document.getElementById("path")?.textContent ===
					"/" + framework + "/aaa",
			);

			const url = await page.url();
			expect(url).toBe(root + "/aaa");

			const renderNo = await page.evaluate(() => RENDER_NO);
			expect(renderNo).toBe(1);
		});

		it("should restore scroll position", async () => {
			await page.goto(root);
			await page.waitForSelector(".loaded");

			// Scroll to the bottom
			await page.evaluate(() =>
				document.getElementById("bottom")!.scrollIntoView(),
			);

			// Click on a link
			let link1 = (await page.waitForSelector(
				"#link-1",
			)) as ElementHandle<HTMLAnchorElement>;

			await link1.click();

			await page.waitForFunction(
				() =>
					document.getElementById("path")?.textContent ===
					"/" + framework + "/aaa",
			);

			// Make sure it scrolled to the top
			let scrollPos = await page.evaluate(() => window.scrollY);
			expect(scrollPos).toBe(0);

			// Go back to the first page
			await page.goBack();

			await page.waitForFunction(
				() => document.getElementById("path")?.textContent === "/" + framework,
			);

			// Make sure it scrolls to the bottom
			await page.waitForFunction(() => window.scrollY > 0);

			// Click on the link again
			link1 = (await page.waitForSelector(
				"#link-1",
			)) as ElementHandle<HTMLAnchorElement>;

			await link1.click();

			await page.waitForFunction(
				() =>
					document.getElementById("path")?.textContent ===
					"/" + framework + "/aaa",
			);

			// Click on another link
			const link2: ElementHandle<HTMLAnchorElement> =
				(await page.waitForSelector(
					"#link-2",
				)) as ElementHandle<HTMLAnchorElement>;

			await link2.click();

			await page.waitForFunction(
				() =>
					document.getElementById("path")?.textContent ===
					"/" + framework + "/bbb",
			);

			// Go back to the first page

			await page.evaluate(() => window.history.go(-2));

			await page.waitForFunction(
				() => document.getElementById("path")?.textContent === "/" + framework,
			);

			// Make sure it scrolls to the bottom
			await page.waitForFunction(() => window.scrollY > 0);
		});

		it("emits navigation state events", async () => {
			await page.goto(root);
			await page.waitForSelector(".loaded");

			const slowLink: ElementHandle<HTMLAnchorElement> =
				(await page.waitForSelector(
					"#slow-link",
				)) as ElementHandle<HTMLAnchorElement>;

			await slowLink.click();

			await page.waitForFunction(
				() => document.body.style.backgroundColor === "red",
			);

			// Complete the navigation
			await page.evaluate(() => continueRendering());

			await page.waitForFunction(
				() =>
					document.getElementById("path")?.textContent ===
					"/" + framework + "/slow",
			);

			await page.waitForFunction(
				() => document.body.style.backgroundColor !== "red",
			);
		});

		it("renders relative links correctly", async () => {
			await page.goto(root);
			await page.waitForSelector(".loaded");

			const originalHref = await page.evaluate(
				() =>
					(document.getElementById("relative-link") as HTMLAnchorElement).href,
			);

			const slowLink = (await page.waitForSelector(
				"#slow-link",
			)) as ElementHandle<HTMLAnchorElement>;

			await slowLink.click();

			const pendingHref = await page.evaluate(
				() =>
					(document.getElementById("relative-link") as HTMLAnchorElement).href,
			);

			expect(pendingHref).toBe(originalHref);
		});

		it("blocks navigation", async () => {
			await page.goto(root + "/block");
			await page.waitForSelector(".loaded");

			const link1 = (await page.waitForSelector("#link-1"))!;
			await link1.click();

			const noButton = (await page.waitForSelector("#no"))!;

			expect(noButton).toBeDefined();

			await noButton.click();

			await page.waitForFunction(() => !document.getElementById("no"));

			await page.waitForFunction(
				() =>
					document.getElementById("path")?.textContent ===
					"/" + framework + "/block",
			);
		});

		it("completes navigation after blocking", async () => {
			await page.goto(root + "/block");
			await page.waitForSelector(".loaded");

			const link1 = (await page.waitForSelector("#link-1"))!;
			await link1.click();

			const yesButton = (await page.waitForSelector("#yes"))!;

			expect(yesButton).toBeDefined();

			await yesButton.click();

			await page.waitForFunction(
				() =>
					document.getElementById("path")?.textContent ===
					"/" + framework + "/aaa",
			);
		});
	});
}

defineTests("vanilla");
defineTests("react");
