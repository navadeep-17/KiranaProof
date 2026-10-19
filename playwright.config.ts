import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir:"./e2e",
  fullyParallel:true,
  forbidOnly:Boolean(process.env.CI),
  retries:process.env.CI?1:0,
  reporter:process.env.CI?"github":"list",
  projects:[
    {name:"Desktop Chrome",use:{...devices["Desktop Chrome"]}},
    {name:"Mobile Chrome",use:{...devices["Pixel 7"]}},
  ],
  use:{baseURL:"http://127.0.0.1:3000",trace:"retain-on-failure"},
  webServer:{
    command:"npm run dev -- --hostname 127.0.0.1",
    url:"http://127.0.0.1:3000/deliveries/new",
    timeout:120000,
    reuseExistingServer:!process.env.CI,
  },
});
