const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://www.google.com/search?q=it+company+in+surat&tbm=lcl', { waitUntil: 'networkidle2' });
    
    const results = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('.OSrC9, .qBF1Pd, .vwV14, .rnGtFd, .v55F0e, .dbg0pd, [role="heading"]'));
        return els.map(e => ({
            text: e.textContent.trim().substring(0, 50),
            className: e.className,
            tagName: e.tagName,
            isSponsored: !!e.closest('.uEierd') || !!e.closest('[data-text-ad]') || (e.parentElement && e.parentElement.textContent.includes('Sponsored'))
        }));
    });
    console.log(JSON.stringify(results, null, 2));
    await browser.close();
})();
