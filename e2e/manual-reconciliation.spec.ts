import { test, expect, type Page } from "@playwright/test";

async function loadInvoice(page:Page) {
  await page.goto("/deliveries/new");
  await page.getByRole("button",{name:/Load sample invoice/i}).click();
  await page.getByRole("checkbox",{name:/I confirm every line/i}).check();
  await page.getByRole("button",{name:/Continue to received items/i}).click();
}
test("fully checked, clean receipt is eligible for reconciliation without any claim",async({page})=>{
  await loadInvoice(page);
  await page.getByRole("button",{name:/Confirm untouched lines correct/i}).click();
  await page.getByRole("checkbox",{name:/I checked for goods not listed/i}).check();
  await page.getByRole("button",{name:/Run full reconciliation/i}).click();
  await expect(page.getByRole("heading",{name:"Eligible for reconciliation"})).toBeVisible();
  await expect(page.getByRole("button",{name:/Confirm clean delivery & save/i})).toBeVisible();
  await expect(page.getByText("No discrepancy claim is needed.",{exact:false})).toBeVisible();
});
test("unverified invoice line remains NEEDS_REVIEW, not a falsely clean delivery",async({page})=>{
  await loadInvoice(page);
  await page.getByRole("checkbox",{name:/I checked for goods not listed/i}).check();
  await page.getByRole("button",{name:/Run full reconciliation/i}).click();
  await expect(page.getByRole("heading",{name:"Needs review"})).toBeVisible();
  await expect(page.getByText("RECEIPT UNVERIFIED").first()).toBeVisible();
  await expect(page.getByRole("button",{name:/Confirm clean delivery & save/i})).toHaveCount(0);
});
test("shortage is reported from a fully checked receipt, not assumed delivered",async({page})=>{
  await loadInvoice(page);
  await page.getByRole("button",{name:/Confirm untouched lines correct/i}).click();
  const biscuit=page.locator("article").filter({has:page.getByRole("heading",{name:"Parle-G"})});
  await biscuit.getByRole("textbox",{name:/Quantity received/i}).fill("10");
  await biscuit.getByRole("checkbox",{name:/I verified this product/i}).check();
  await page.getByRole("checkbox",{name:/I checked for goods not listed/i}).check();
  await page.getByRole("button",{name:/Run full reconciliation/i}).click();
  await expect(page.getByRole("heading",{name:"Discrepancy detected"})).toBeVisible();
  await expect(page.getByText("SHORTAGE",{exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:/Confirm discrepancies & save/i})).toBeVisible();
});
