const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://www.google.com/search?q=surat+it+company&tbm=lcl', { waitUntil: 'networkidle2' });
    
    const results = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('.qBF1Pd, .OSrC9, .v55F0e, .dbg0pd, .vwV14, .rnGtFd, .BNeawe, [role="heading"]'));
        return els.map(e => ({
            text: e.textContent.trim(),
            className: e.className,
            tagName: e.tagName,
            hasRoleHeading: e.getAttribute('role') === 'heading'
        }));
    });
    console.log(JSON.stringify(results, null, 2));
    await browser.close();
})();
