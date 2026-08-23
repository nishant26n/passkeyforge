import { expect, type Page } from "@playwright/test";

export const RECOVERY_CODE_PATTERN = /[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}/;

/** The recovery-codes card on the settings page. */
export function recoverySection(page: Page) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Recovery codes" }) });
}

/**
 * Reads the one-time codes out of the list the UI shows immediately after
 * generation. Each `<li>` carries an index alongside the code, so the code is
 * pulled out by shape. The returned values are secrets — never log them.
 */
export async function readDisplayedCodes(page: Page) {
  const items = recoverySection(page).locator("ol > li");
  await expect(items.first()).toBeVisible();

  const rows = await items.allInnerTexts();
  return rows.map((row) => {
    const match = row.match(RECOVERY_CODE_PATTERN);
    expect(match, "each row should contain a recovery code").not.toBeNull();
    return match![0];
  });
}

/** Generates a first set of codes through the settings UI. */
export async function generateFirstSet(page: Page) {
  await page.goto("/settings/passkeys");
  await page.getByRole("button", { name: "Generate recovery codes" }).click();
  return readDisplayedCodes(page);
}

/** Replaces an existing set, going through the confirmation step. */
export async function regenerateCodes(page: Page) {
  await page.getByRole("button", { name: "Generate new codes" }).click();
  await page.getByRole("button", { name: "Yes, replace them" }).click();
  return readDisplayedCodes(page);
}

/** The accessible label of the remaining-codes meter. */
export function remainingCodesLabel(remaining: number, total: number) {
  return `${remaining} of ${total} recovery codes unused`;
}
