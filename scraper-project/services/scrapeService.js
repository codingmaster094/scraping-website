const googleScraper = require('../scrapers/googleScraper');
const websiteScraper = require('../scrapers/websiteScraper');

// In-memory store for results
let lastScrapedData = [];

async function scrapeGooglePlaces(url) {
    console.log('Starting Google Places scraping for:', url);
    const places = await googleScraper.scrape(url);
    console.log(`Found ${places.length} places from Google.`);

    const detailedData = [];
    let processedCount = 0;

    // Concurrently scrape websites
    const scrapePromises = places.map(async (place) => {
        let siteData = {};
        if (place.website) {
            try {
                console.log(`Scraping website: ${place.website}`);
                const scraper = new websiteScraper(place.website);
                siteData = await scraper.scrape();
            } catch (error) {
                console.error(`Failed to scrape website: ${place.website}`, error.message);
                siteData = { error: `Failed to scrape: ${error.message}` };
            }
        }
        
        processedCount++;
        console.log(`Progress: ${processedCount}/${places.length}`);

        detailedData.push({
            ...place,
            ...siteData,
        });
    });

    await Promise.all(scrapePromises);

    lastScrapedData = detailedData;
    console.log('Scraping complete.');
    return detailedData;
}

function getLatestResults() {
    return lastScrapedData;
}

module.exports = {
    scrapeGooglePlaces,
    getLatestResults
};
