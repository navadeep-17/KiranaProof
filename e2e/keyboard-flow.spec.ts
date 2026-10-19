import { test,expect } from "@playwright/test";

test("manual delivery and voice fallback can be navigated by keyboard",async({page})=>{
  await page.goto("/deliveries/new");
  await page.getByRole("button",{name:/Load sample invoice/i}).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByPlaceholder("e.g. Parle-G")).toHaveValue("Parle-G");
  const baseline=page.getByRole("checkbox",{name:/I confirm every line/i});
  await baseline.focus();
  await page.keyboard.press("Space");
  await expect(baseline).toBeChecked();
  await page.getByRole("button",{name:/Continue to received items/i}).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading",{name:"Speak what went wrong"})).toBeVisible();
  const words=page.getByRole("textbox",{name:/Review or type the exact spoken words/i});
  await words.focus();
  await page.keyboard.type("Parle G 2 cartons missing");
  await page.getByRole("button",{name:/Analyze transcript/i}).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Suggested received: 10 carton/)).toBeVisible();
  await expect(page.getByText("0 of 3 lines explicitly verified")).toBeVisible();
});
