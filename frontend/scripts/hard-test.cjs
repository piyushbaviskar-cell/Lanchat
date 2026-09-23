const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors']
  });

  const page = await browser.newPage();
  
  // Console Trap
  let hasErrors = false;
  page.on('pageerror', error => {
    console.error(`[FAIL - UNCAUGHT RUNTIME EXCEPTION]: ${error.message}`);
    hasErrors = true;
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore React strict mode expected errors or non-fatal ones
      if (!text.includes('ERR_CONNECTION_REFUSED') && !text.includes('Failed to load resource')) {
         console.error(`[CONSOLE ERROR]: ${text}`);
      }
    }
  });

  try {
    console.log('[Test] Navigating to Vite Server...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 15000 });
    
    // Check if #root is rendered
    const rootHasChildren = await page.evaluate(() => {
      const root = document.getElementById('root');
      return root && root.children.length > 0;
    });

    if (!rootHasChildren) {
      console.error('[FAIL - DOM EMPTY]: #root has no children');
      process.exit(1);
    }

    console.log('[Test] Corrupting localStorage...');
    await page.evaluate(() => {
      localStorage.setItem('apex_identity', '{broken:');
      localStorage.setItem('apex_config', 'undefined');
    });

    console.log('[Test] Reloading with corrupted storage...');
    await page.reload({ waitUntil: 'networkidle0' });

    console.log('[Test] Disabling WebCrypto (simulating insecure context)...');
    await page.evaluate(() => {
      Object.defineProperty(window.crypto, 'subtle', {
        get: () => undefined
      });
    });

    console.log('[Test] Rapid Resize Simulation...');
    await page.setViewport({ width: 375, height: 812 });
    await new Promise(r => setTimeout(r, 100));
    await page.setViewport({ width: 1920, height: 1080 });
    await new Promise(r => setTimeout(r, 100));
    await page.setViewport({ width: 800, height: 600 });
    
    if (hasErrors) {
      console.error('[FAIL] Runtime exceptions were trapped.');
      process.exit(1);
    }

    console.log('[SUCCESS] All chaos scenarios passed cleanly.');
    process.exit(0);

  } catch (err) {
    console.error('[FATAL]', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
