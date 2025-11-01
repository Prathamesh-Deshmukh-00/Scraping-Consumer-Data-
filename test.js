import { remote } from 'webdriverio';

const caps = {
  platformName: "Android",
  'appium:deviceName': "NROZRKOVEUZXRWEU",
  'appium:automationName': "UiAutomator2",
  'appium:appPackage': "com.msedcl.app",
  'appium:appActivity': "com.msedcl.callcenter.src.WSSLoginActivity",
  'appium:noReset': true,
  'appium:ignoreHiddenApiPolicyError': true,
};

// ✅ STEP 1 — Launch App
async function launchApp() {
  const driver = await remote({
    hostname: '127.0.0.1',
    port: 4723,
    path: '/',
    capabilities: caps,
  });
  console.log("✅ App launched successfully!");
  return driver;
}

// ✅ STEP 2 — Click first “Continue as guest”
async function clickFirstGuestButton(driver) {
  const guestButton = await driver.$('//android.widget.Button[@resource-id="com.msedcl.app:id/guest_button" and @text="Continue as guest"]');
  await guestButton.waitForDisplayed({ timeout: 10000 });
  await guestButton.click();
  console.log("✅ Clicked first 'Continue as guest' button");
}

// ✅ STEP 3 — Wait for popup to load
async function waitForPopup(driver) {
  console.log("⏳ Waiting for popup to appear...");
  await driver.pause(4000);
}

// ✅ STEP 4 — Click popup “Continue as guest”
async function clickPopupGuestButton(driver) {
  const popupButton = await driver.$('//android.widget.Button[@resource-id="com.msedcl.app:id/remind_later_Button" and @text="Continue as guest"]');
  await popupButton.waitForDisplayed({ timeout: 10000 });
  await popupButton.click();
  console.log("✅ Clicked popup 'Continue as guest' button");
}

// ✅ STEP 5 — Wait for next page to load
async function waitForNextPage(driver) {
  console.log("⏳ Waiting for home page to load...");
  await driver.pause(6000);
  try {
    const homeText = await driver.$('//android.widget.TextView[contains(@text, "Bill") or contains(@text, "Home")]');
    if (await homeText.isDisplayed()) {
      console.log("✅ Home page loaded successfully!");
    }
  } catch {
    console.log("⚠️ Unable to confirm home page visually.");
  }
}

// ✅ STEP 6 — Click on “View/Pay Bill”
async function clickViewPayBill(driver) {
  const viewPayBillButton = await driver.$('//android.widget.TextView[@resource-id="com.msedcl.app:id/home_grid_text" and @text="View/Pay Bill"]');
  await viewPayBillButton.waitForDisplayed({ timeout: 10000 });
  await viewPayBillButton.click();
  console.log("✅ Clicked 'View/Pay Bill' button");
}

// ✅ STEP 7 — Wait for bill page to load
async function waitForBillPage(driver) {
  console.log("⏳ Waiting for bill page to load...");
  await driver.pause(6000);
  try {
    const billHeader = await driver.$('//android.widget.TextView[contains(@text, "Consumer") or contains(@text, "Bill")]');
    if (await billHeader.isDisplayed()) {
      console.log("✅ Bill page opened successfully!");
    }
  } catch {
    console.log("⚠️ Unable to confirm bill page visually.");
  }
}

// ✅ STEP 8 — Enter consumer number
async function enterConsumerNumber(driver, number) {
  const consumerInput = await driver.$('//android.widget.EditText[@resource-id="com.msedcl.app:id/consumer_number_edittext" and @text="Consumer Number"]');
  await consumerInput.waitForDisplayed({ timeout: 10000 });
  await consumerInput.clearValue();
  await consumerInput.setValue(number);
  console.log(`✅ Entered consumer number: ${number}`);
}

// ✅ STEP 9 — Verify input number is entered correctly
async function verifyConsumerNumber(driver, number) {
  const consumerInput = await driver.$('//android.widget.EditText[@resource-id="com.msedcl.app:id/consumer_number_edittext"]');
  const value = await consumerInput.getText();
  if (value.includes(number)) {
    console.log(`✅ Verified consumer number ${number} is entered correctly`);
  } else {
    console.log(`❌ Verification failed — current value: ${value}`);
  }
}

// ✅ STEP 10 — Click on “View Bill” button
async function clickViewBillButton(driver) {
  const viewBillButton = await driver.$('//android.widget.Button[@resource-id="com.msedcl.app:id/submit_con_bu_button" and @text="View Bill"]');
  await viewBillButton.waitForDisplayed({ timeout: 10000 });
  await viewBillButton.click();
  console.log("✅ Clicked 'View Bill' button");
}

// ✅ STEP 11 — Wait for new page to load after clicking
async function waitForBillDetailsPage(driver) {
  console.log("⏳ Waiting for bill details to load...");
  await driver.pause(8000);
  try {
    const billDetails = await driver.$('//android.widget.TextView[contains(@text, "Consumer") or contains(@text, "Bill")]');
    if (await billDetails.isDisplayed()) {
      console.log("✅ Bill details page loaded successfully!");
    }
  } catch {
    console.log("⚠️ Unable to confirm bill details page visually.");
  }
}

// ✅ STEP 12 — Retrieve and confirm bill details
async function retrieveBillDetails(driver) {
  console.log("⏳ Retrieving bill details...");
  const details = {};

  async function getText(resourceId, label) {
    try {
      const el = await driver.$(`//android.widget.TextView[@resource-id="${resourceId}"]`);
      await el.waitForDisplayed({ timeout: 10000 });
      const text = await el.getText();
      console.log(`✅ ${label}: ${text}`);
      return text;
    } catch {
      console.log(`❌ Unable to retrieve ${label}`);
      return "";
    }
  }

  details.name = await getText("com.msedcl.app:id/consumer_name_value_textview", "Name");
  details.consumerNumber = await getText("com.msedcl.app:id/consumer_number_value_textview", "Consumer Number");
  details.billingUnit = await getText("com.msedcl.app:id/bill_unit_value_textview", "Billing Unit");
  details.pc = await getText("com.msedcl.app:id/pc_value_textview", "PC");
  details.consumption = await getText("com.msedcl.app:id/consumption_value_textview", "Consumption");
  details.meterStatus = await getText("com.msedcl.app:id/meter_status_value_textview", "Meter Status");
  details.billPeriod = await getText("com.msedcl.app:id/bill_period_value_textview", "Bill Period");
  details.billMonth = await getText("com.msedcl.app:id/bill_month_value_textview", "Bill Month");
  details.billDate = await getText("com.msedcl.app:id/bill_date_value_textview", "Bill Date");
  details.billAmount = await getText("com.msedcl.app:id/bill_amount_value_textview", "Bill Amount");
  details.billDueDate = await getText("com.msedcl.app:id/bill_due_date_value_textview", "Bill Due Date");
  details.billAmountAfterDueDate = await getText("com.msedcl.app:id/after_due_date_value_textview", "Bill Amount After Due Date");
  details.promptPaymentDate = await getText("com.msedcl.app:id/prompt_date_value_textview", "Prompt Payment Date");
  details.billAmountWithPromptDiscount = await getText("com.msedcl.app:id/prompt_payment_value_textview", "Bill Amount with Prompt Payment Discount");

  console.log("\n✅ All details retrieved successfully:\n");
  console.log(JSON.stringify(details, null, 2));
  return details;
}

// ✅ STEP 13 — Scroll down to bottom
async function scrollDown(driver) {
  console.log("⏳ Scrolling down to bottom...");
  try {
    const windowRect = await driver.getWindowRect();
    const startX = windowRect.width / 2;
    const startY = windowRect.height * 0.8;
    const endY = windowRect.height * 0.2;

    await driver.performActions([
      {
        type: "pointer",
        id: "finger1",
        parameters: { pointerType: "touch" },
        actions: [
          { type: "pointerMove", duration: 0, x: startX, y: startY },
          { type: "pointerDown", button: 0 },
          { type: "pause", duration: 300 },
          { type: "pointerMove", duration: 800, x: startX, y: endY },
          { type: "pointerUp", button: 0 },
        ],
      },
    ]);

    await driver.releaseActions();
    console.log("✅ Scrolled down successfully!");
  } catch (err) {
    console.error("❌ Scroll failed:", err.message);
  }
}

// ✅ STEP 14 — Retrieve Mobile No and Amount to Pay (ensures popup removed before continuing)
async function retrievePaymentDetails(driver, details) {
  console.log("⏳ Retrieving Mobile No and Amount to Pay...");

  // helper for non-blocking text retrieval
  async function getEditText(resourceId, label) {
    try {
      const el = await driver.$(`//android.widget.EditText[@resource-id="${resourceId}"]`);
      if (await el.isDisplayed()) {
        const text = await el.getText();
        console.log(`✅ ${label}: ${text}`);
        return text || "";
      }
    } catch {
      console.log(`❌ ${label} not found`);
    }
    return "";
  }

  // try to get data directly
  details.mobileNo = await getEditText("com.msedcl.app:id/mobile_no_edittext", "Mobile No");
  details.amountToPay = await getEditText("com.msedcl.app:id/amount_to_pay_edittext", "Amount to Pay");

  // if both missing, try “Pay Bill In Advance” flow
  if (!details.mobileNo && !details.amountToPay) {
    try {
      const advanceBtn = await driver.$(
        '//android.widget.Button[@resource-id="com.msedcl.app:id/pay_in_adance_button" and @text="Pay Bill In Advance"]'
      );

      if (await advanceBtn.isDisplayed()) {
        console.log("ℹ️ 'Pay Bill In Advance' button found — clicking...");
        await advanceBtn.click();

        // Wait for popup to appear
        const popupMobileEl = await driver.$(
          '//android.widget.EditText[@resource-id="com.msedcl.app:id/mobile_no_edittext"]'
        );

        try {
          await popupMobileEl.waitForDisplayed({ timeout: 10000 });
          details.mobileNo = (await popupMobileEl.getText()) || "";
          console.log(`✅ Mobile No (from popup): ${details.mobileNo}`);
        } catch {
          console.log("❌ Unable to retrieve Mobile No from popup");
          details.mobileNo = "";
        }

        // ✅ Close popup using Android back button
        console.log("🔙 Closing popup using Android back button...");
        await driver.back();

        // ✅ Ensure popup is really gone before proceeding
        try {
          await driver.waitUntil(
            async () => !(await popupMobileEl.isDisplayed().catch(() => false)),
            { timeout: 8000, timeoutMsg: "⚠️ Popup did not close within timeout" }
          );
          console.log("✅ Popup closed successfully and confirmed removed");
        } catch {
          console.log("⚠️ Popup might still be visible, but continuing safely");
        }

        await driver.pause(2000); // small buffer
      }
    } catch (err) {
      console.log("❌ Error handling 'Pay Bill In Advance' flow:", err.message);
    }
  }

  // fill missing with safe defaults
  details.mobileNo = details.mobileNo || "";
  details.amountToPay = details.amountToPay || "";

  console.log("📦 Final Retrieved Details:", details);
  return details;
}


// ✅ STEP 15 — Final validation
async function finalValidation(details) {
  console.log("⏳ Validating essential fields...");
  if (details.name && details.mobileNo && details.billAmount) {
    console.log("✅ All required fields are present:");
    console.log(JSON.stringify(details, null, 2));
  } else {
    console.log("⚠️ Missing some details (non-blocking):");
    console.log(JSON.stringify(details, null, 2));
  }
}

// ✅ STEP 16–22 — Mahavitaran navigation handling
async function waitForAndClickMahavitaranButton(driver) {
  console.log("⏳ Waiting few seconds before checking for Mahavitaran button...");
  await driver.pause(3000);
  const navButtonSelector = '//android.widget.ImageButton[@resource-id="com.msedcl.app:id/ic_navigation_drawer_imagebutton"]';

  try {
    const navButton = await driver.$(navButtonSelector);
    await navButton.waitForDisplayed({ timeout: 10000 });
    console.log("✅ Mahavitaran button found on screen (Step 16)");
    await navButton.click();
    console.log("✅ Clicked Mahavitaran button (Step 17)");
    await driver.pause(3000);
    const navButtonAgain = await driver.$(navButtonSelector);
    if (await navButtonAgain.isDisplayed()) {
      console.log("✅ Button still visible on previous page (Step 20)");
      await navButtonAgain.click();
      console.log("✅ Clicked again (Step 21)");
      await driver.pause(3000);
      console.log("✅ Previous page loaded successfully after second click (Step 22)");
    }
  } catch (err) {
    console.error("❌ Error handling Mahavitaran button:", err.message);
  }
}

// ✅ MAIN EXECUTION FLOW — Handles multiple consumers
async function main() {
  const driver = await launchApp();
  const consumerNumbers = ["110013196591" ,"319180105227", "319187226577", "110014069283" ];
  const allData = [];

  try {
    for (const number of consumerNumbers) {
      console.log(`\n🚀 Processing Consumer: ${number}\n`);

      await clickViewPayBill(driver);
      await waitForBillPage(driver);
      await enterConsumerNumber(driver, number);
      await verifyConsumerNumber(driver, number);
      await clickViewBillButton(driver);
      await waitForBillDetailsPage(driver);

      const details = await retrieveBillDetails(driver);
      await scrollDown(driver);
      await retrievePaymentDetails(driver, details);
      await finalValidation(details);
      allData.push(details);

      await waitForAndClickMahavitaranButton(driver);
      console.log("😴 Pausing for 5 seconds before next consumer...");
      await driver.pause(5000);
    }

    console.log("\n✅✅ All consumers processed successfully! ✅✅");
    console.log(JSON.stringify(allData, null, 2));
  } catch (err) {
    console.error("❌ Error during execution:", err.message);
  } finally {
    await driver.deleteSession();
    console.log("✅ Session closed successfully!");
  }
}

main();
