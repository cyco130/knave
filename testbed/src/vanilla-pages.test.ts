import { afterAll, beforeAll, it, expect } from "vitest";
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

it("should use client-side navigation", async () => {
	await page.goto("http://localhost:3000/vanilla");
	await page.waitForSelector(".loaded");

	const link: ElementHandle<HTMLAnchorElement> = (await page.waitForSelector(
		"#link-1",
	))!;

	expect(link).toBeDefined();

	await link.click();

	await page.waitForFunction(
		() => document.getElementById("path")?.textContent === "/vanilla/aaa",
	);

	const url = await page.url();
	expect(url).toBe("http://localhost:3000/vanilla/aaa");

	const renderNo = await page.evaluate(() => RENDER_NO);
	expect(renderNo).toBe(2);
});

it("should honor rel=external", async () => {
	await page.goto("http://localhost:3000/vanilla");
	await page.waitForSelector(".loaded");

	const link: ElementHandle<HTMLAnchorElement> = (await page.waitForSelector(
		"#external-link",
	))!;

	expect(link).toBeDefined();

	await link.click();

	await page.waitForFunction(
		() => document.getElementById("path")?.textContent === "/vanilla/aaa",
	);

	const url = await page.url();
	expect(url).toBe("http://localhost:3000/vanilla/aaa");

	const renderNo = await page.evaluate(() => RENDER_NO);
	expect(renderNo).toBe(1);
});

it("should restore scroll position", async () => {
	await page.goto("http://localhost:3000/vanilla");
	await page.waitForSelector(".loaded");

	// Scroll to the bottom
	await page.evaluate(() =>
		document.getElementById("bottom")!.scrollIntoView(),
	);

	// Click on a link
	let link1: ElementHandle<HTMLAnchorElement> = (await page.waitForSelector(
		"#link-1",
	))!;

	await link1.click();

	await page.waitForFunction(
		() => document.getElementById("path")?.textContent === "/vanilla/aaa",
	);

	// Make sure it scrolled to the top
	let scrollPos = await page.evaluate(() => window.scrollY);
	expect(scrollPos).toBe(0);

	// Go back to the first page
	await page.goBack();

	await page.waitForFunction(
		() => document.getElementById("path")?.textContent === "/vanilla",
	);

	// Make sure it scrolls to the bottom
	await page.waitForFunction(() => window.scrollY > 0);

	// Click on the link again
	link1 = (await page.waitForSelector("#link-1"))!;

	await link1.click();

	await page.waitForFunction(
		() => document.getElementById("path")?.textContent === "/vanilla/aaa",
	);

	// Click on another link
	const link2: ElementHandle<HTMLAnchorElement> = (await page.waitForSelector(
		"#link-2",
	))!;

	await link2.click();

	await page.waitForFunction(
		() => document.getElementById("path")?.textContent === "/vanilla/bbb",
	);

	// Go back to the first page

	await page.evaluate(() => window.history.go(-2));

	await page.waitForFunction(
		() => document.getElementById("path")?.textContent === "/vanilla",
	);

	// Make sure it scrolls to the bottom
	await page.waitForFunction(() => window.scrollY > 0);
});

it("emits navigation state events", async () => {
	await page.goto("http://localhost:3000/vanilla");
	await page.waitForSelector(".loaded");

	const slowLink: ElementHandle<HTMLAnchorElement> =
		(await page.waitForSelector("#slow-link"))!;
	await slowLink.click();

	let backgroundColor = await page.evaluate(
		() => document.body.style.backgroundColor,
	);
	expect(backgroundColor).toBe("red");

	// Complete the navigation
	await page.evaluate(() => continueRendering());

	await page.waitForFunction(
		() => document.getElementById("path")?.textContent === "/vanilla/slow",
	);

	backgroundColor = await page.evaluate(
		() => document.body.style.backgroundColor,
	);
	expect(backgroundColor).not.toBe("red");
});

it("renders relative links correctly", async () => {
	await page.goto("http://localhost:3000/vanilla");
	await page.waitForSelector(".loaded");

	const originalHref = await page.evaluate(
		() => (document.getElementById("relative-link") as HTMLAnchorElement).href,
	);

	const slowLink: ElementHandle<HTMLAnchorElement> =
		(await page.waitForSelector("#slow-link"))!;
	await slowLink.click();

	const pendingHref = await page.evaluate(
		() => (document.getElementById("relative-link") as HTMLAnchorElement).href,
	);

	expect(pendingHref).toBe(originalHref);
});

it("blocks navigation", async () => {
	await page.goto("http://localhost:3000/vanilla/block");
	await page.waitForSelector(".loaded");

	const link1 = (await page.waitForSelector("#link-1"))!;
	await link1.click();

	const noButton = (await page.waitForSelector("#no"))!;

	expect(noButton).toBeDefined();

	await noButton.click();

	await page.waitForFunction(() => !document.getElementById("no"));

	await page.waitForFunction(
		() => document.getElementById("path")?.textContent === "/vanilla/block",
	);
});

it("completes navigation after blocking", async () => {
	await page.goto("http://localhost:3000/vanilla/block");
	await page.waitForSelector(".loaded");

	const link1 = (await page.waitForSelector("#link-1"))!;
	await link1.click();

	const yesButton = (await page.waitForSelector("#yes"))!;

	expect(yesButton).toBeDefined();

	await yesButton.click();

	await page.waitForFunction(
		() => document.getElementById("path")?.textContent === "/vanilla/aaa",
	);
});
