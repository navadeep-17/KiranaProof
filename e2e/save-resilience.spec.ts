import { expect, test } from "@playwright/test";

test("saving a partial invoice is explicit, never claims reconciliation",async({page})=>{
  let observed=false;
  await page.route("**/api/v1/deliveries",async route=>{
    const body=route.request().postDataJSON();
    expect(body.invoiceCompleteConfirmed).toBe(false);
    expect(body.receipts).toHaveLength(0);
    observed=true;
    await route.fulfill({
      status:201,contentType:"application/json",
      body:JSON.stringify({id:"11111111-1111-4111-8111-111111111111",version:1,status:"NEEDS_REVIEW",replayed:false}),
    });
  });
  await page.goto("/deliveries/new");
  await page.getByRole("button",{name:/Load sample invoice/i}).click();
  await page.getByRole("button",{name:/Save incomplete draft/i}).click();
  await expect(page.getByRole("status")).toContainText("Draft saved securely");
  expect(observed).toBe(true);
  await expect(page.getByRole("button",{name:/Confirm clean delivery & save/i})).toHaveCount(0);
});

test("network loss plus changed input reuses original create request and updates existing draft",async({page})=>{
  const deliveryId="22222222-2222-4222-8222-222222222222";
  let requestId:string|null=null;
  let createCalls=0;
  let updateCalls=0;
  await page.route("**/api/v1/deliveries",async route=>{
    const body=route.request().postDataJSON();
    if(createCalls===0){
      requestId=body.clientRequestId;
      createCalls++;
      await route.abort("failed");
      return;
    }
    expect(body.clientRequestId).toBe(requestId);
    expect(body.referenceNumber).toBe("INV-1208-revised");
    createCalls++;
    await route.fulfill({
      status:200,contentType:"application/json",
      body:JSON.stringify({id:deliveryId,version:1,status:"NEEDS_REVIEW",replayed:true}),
    });
  });
  await page.route(`**/api/v1/deliveries/${deliveryId}`,async route=>{
    expect(route.request().method()).toBe("PUT");
    const body=route.request().postDataJSON();
    expect(body.expectedVersion).toBe(1);
    expect(body.referenceNumber).toBe("INV-1208-revised");
    updateCalls++;
    await route.fulfill({
      status:200,contentType:"application/json",
      body:JSON.stringify({id:deliveryId,version:2,status:"NEEDS_REVIEW"}),
    });
  });
  await page.goto("/deliveries/new");
  await page.getByRole("button",{name:/Load sample invoice/i}).click();
  await page.getByRole("button",{name:/Save incomplete draft/i}).click();
  await expect(page.getByRole("alert").filter({hasText:"Connection lost"})).toContainText("Connection lost");
  await page.getByRole("textbox",{name:/Invoice \/ order reference/i}).fill("INV-1208-revised");
  await page.getByRole("button",{name:/Save incomplete draft/i}).click();
  await expect(page.getByRole("status")).toContainText("Draft saved securely");
  expect(createCalls).toBe(2);
  expect(updateCalls).toBe(1);
});
