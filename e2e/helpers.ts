import { type Browser, type BrowserContext } from "@playwright/test";

/**
 * Create a browser context with the app locale cookie pre-set to English
 * so tests can use English button labels regardless of the app default
 * (which is Swedish).
 */
export async function newEnContext(browser: Browser): Promise<BrowserContext> {
  const ctx = await browser.newContext();
  await ctx.addCookies([
    {
      name: "locale",
      value: "en",
      url: "http://localhost:3000",
    },
  ]);
  return ctx;
}
