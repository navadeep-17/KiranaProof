import { test,expect } from "@playwright/test";

/**
 * REAL provider integration. Deliberately skipped in ordinary CI and runs only
 * with explicit opt-in and a dedicated development test account. No mocks.
 * WARNING: this creates synthetic delivery/claim records in the dev project.
 */
const enabled=process.env.KIRANAPROOF_LIVE_E2E==="1";
const email=process.env.KP_TEST_EMAIL;
const password=process.env.KP_TEST_PASSWORD;

test("signed-in delivery → discrepancy approval → supplier reply → resolution",async({page,browser},testInfo)=>{
 test.skip(!enabled||!email||!password,"Requires explicit live opt-in and a private development test account.");
 test.skip(testInfo.project.name!=="Desktop Chrome","Run integration flow once, not on both browser projects.");
 await page.goto("/login");
 await page.getByRole("textbox",{name:/Email address/i}).fill(email!);
 await page.getByLabel("Password").fill(password!);
 await page.getByRole("button",{name:/Sign in$/i}).click();
 await expect(page).toHaveURL(/\/dashboard/,{timeout:25000});
 await page.goto("/deliveries/new");
 await page.getByRole("button",{name:/Load sample invoice/i}).click();
 const reference=`E2E-${Date.now()}`;
 await page.getByRole("textbox",{name:/Invoice \/ order reference/i}).fill(reference);
 await page.getByRole("button",{name:/Save incomplete draft/i}).click();
 await expect(page.getByRole("status")).toContainText("Draft saved securely");
 await page.goto("/dashboard");
 await expect(page.getByRole("link",{name:reference})).toBeVisible();
 await page.getByRole("link",{name:reference}).click();
 await page.getByRole("link",{name:/Resume and finish verification/i}).click();
 await page.getByRole("checkbox",{name:/I confirm every line/i}).check();
 await page.getByRole("button",{name:/Continue to received items/i}).click();
 await page.getByRole("button",{name:/Confirm untouched lines correct/i}).click();
 const biscuit=page.locator("article").filter({has:page.getByRole("heading",{name:"Parle-G"})});
 await biscuit.getByRole("textbox",{name:/Quantity received/i}).fill("10");
 await biscuit.getByRole("checkbox",{name:/I verified this product/i}).check();
 await page.getByRole("checkbox",{name:/I checked for goods not listed/i}).check();
 await page.getByRole("button",{name:/Run full reconciliation/i}).click();
 await expect(page.getByRole("heading",{name:"Discrepancy detected"})).toBeVisible();
 await page.getByRole("button",{name:/Confirm discrepancies & save/i}).click();
 await expect(page).toHaveURL(/\/deliveries\/[a-f0-9-]+$/, {timeout:30000});
 await expect(page.getByText(/Discrepancy confirmed/i)).toBeVisible();
 await page.getByRole("checkbox",{name:/I reviewed the discrepancies/i}).check();
 await page.getByRole("button",{name:/Approve discrepancy claim/i}).click();
 await expect(page).toHaveURL(/\/claims\/[a-f0-9-]+$/, {timeout:30000});
 await page.getByRole("checkbox",{name:/I understand this is a bearer link/i}).check();
 await page.getByRole("button",{name:/Generate or rotate link/i}).click();
 const url=await page.getByRole("textbox",{name:"Supplier claim link"}).inputValue();
 expect(url).toContain("/supplier/");
 const supplierContext=await browser.newContext();
 try{
  const supplier=await supplierContext.newPage();
  await supplier.goto(url);
  await expect(supplier.getByRole("heading",{name:"Delivery discrepancy"})).toBeVisible();
  await supplier.getByRole("combobox",{name:"Your response"}).selectOption("PROPOSED_RESOLUTION");
  await supplier.getByRole("textbox",{name:/Explanation/i}).fill("Replacement will be provided.");
  await supplier.getByRole("button",{name:/Submit supplier response/i}).click();
  await expect(supplier.getByText("Response recorded")).toBeVisible();
 }finally{await supplierContext.close();}
 await page.reload();
 await expect(page.getByRole("heading",{name:/Supplier response/i})).toBeVisible();
 await page.getByRole("textbox",{name:/Resolution notes/i}).fill("Replacement goods received.");
 await page.getByRole("button",{name:/Record resolution/i}).click();
 await expect(page.getByText(/Resolved by retailer/i)).toBeVisible();
});
