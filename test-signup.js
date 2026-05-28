const { chromium } = require('playwright');

(async () => {
    console.log("Starting E2E test for Sign-Up flow...");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Catch any page errors or console logs
    page.on('pageerror', err => {
        console.error('Page Error:', err.message);
    });
    page.on('console', msg => {
        console.log('Page Console:', msg.text());
    });

    // 1. Load the login page
    await page.goto('http://127.0.0.1:8080/index.html');
    console.log("Page loaded.");

    // Verify Login Form is displayed
    const isLoginVisible = await page.isVisible('#login-form');
    console.log(`Login Form Visible: ${isLoginVisible}`);

    // 2. Navigate to Registration Form
    await page.click('text=REGISTER UNIT');
    const isRegisterVisible = await page.isVisible('#register-form');
    console.log(`Register Form Visible: ${isRegisterVisible}`);

    // 3. Fill in registration details
    await page.fill('#reg-name', 'John Doe');
    await page.fill('#reg-email', 'johndoe@institution.edu');
    await page.fill('#reg-pass', 'password123');

    // 4. Submit enrollment
    console.log("Submitting enrollment form...");
    await page.click('button:has-text("ENROLL PROFILE UNIT")');

    // 5. Verify redirection back to login
    await page.waitForTimeout(1000); // Wait for transition
    const isLoginVisibleAfterReg = await page.isVisible('#login-form');
    console.log(`Login Form Visible after registration: ${isLoginVisibleAfterReg}`);

    // 6. Attempt login with registered user
    console.log("Attempting login...");
    await page.fill('#login-email', 'johndoe@institution.edu');
    await page.fill('#login-pass', 'password123');
    await page.click('button:has-text("EXECUTE BIOMETRIC SIGN-IN")');

    // 7. Wait for biometric scan and redirection
    console.log("Waiting for biometric scan...");
    await page.waitForSelector('#app-layout', { state: 'visible', timeout: 25000 });
    console.log("App Layout visible!");

    // 8. Verify the sidebar display name
    const sidebarName = await page.textContent('.profile-name');
    console.log(`Sidebar display name: "${sidebarName.trim()}"`);

    await browser.close();
    console.log("E2E test complete.");
})();
