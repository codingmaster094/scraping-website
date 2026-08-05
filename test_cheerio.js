const cheerio = require('cheerio');
const html = '<html><body>Hello</body></html>';
try {
    const $ = cheerio.load(html);
    $('[class*="service" i]');
    console.log('SUCCESS');
} catch (e) {
    console.error('ERROR:', e.message);
}
