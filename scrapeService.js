const { scrapeGoogleSearchPlaces, scrapeWebsite } = require('./backend/dist/scraper');
// const { scrapeWebsite } = require('./websiteScraper'); // Assuming scrapeWebsite is also in backend/dist/scraper.js
const { exportData } = require('./exportHelper');

const CONCURRENCY_LIMIT = 5; // Number of websites to scrape concurrently

/**
 * Main service to orchestrate the entire scraping process.
 * @param {string} googleSearchUrl - The Google Places search URL.
 * @param {WebSocket} ws - The WebSocket client for sending progress.
 */
async function scrapeGooglePlacesAndWebsites(googleSearchUrl, ws) {
    const sendJSON = (type, payload) => ws.send(JSON.stringify({ type, ...payload }));

    try {
        sendJSON('STATUS_UPDATE', { message: 'Starting to scrape Google Places...' });

        try {
            let url = new URL(googleSearchUrl);
            if (url.hostname.includes("google.") && url.pathname === '/search') {
                // To ensure we get local business results, we can adjust the URL.
                // 'tbm=lcl' is for "local".
                if (url.searchParams.get('tbm') !== 'lcl') {
                    url.searchParams.set('tbm', 'lcl');
                    // These params can sometimes alter the page structure unexpectedly.
                    const paramsToRemove = ['sca_esv', 'sxsrf', 'udm', 'lsack', 'ved', 'biw', 'bih', 'dpr', 'sourceid', 'ie'];
                    paramsToRemove.forEach(p => url.searchParams.delete(p));
                    googleSearchUrl = url.toString();
                    sendJSON('STATUS_UPDATE', { message: `Adjusted URL for local search to ensure compatibility.` });
                }
            }
        } catch (e) {
            // If URL parsing fails, proceed with the original URL but log it.
            console.warn("Could not parse or modify the provided URL, proceeding with original.", e.message);
        }

        const initialCompanies = await scrapeGoogleSearchPlaces(googleSearchUrl, (progress) => {
            sendJSON('PROGRESS_UPDATE', { progress, message: `Scraping Google Places: ${Math.round(progress)}%` });
        });

        if (initialCompanies.length === 0) {
            sendJSON('STATUS_UPDATE', { message: 'No companies found on Google Places for the given URL. The process will stop.' });
            sendJSON('SCRAPING_COMPLETE', {
                message: 'Scraping complete! No results found.',
                results: [],
                exportFiles: {},
            });
            return;
        }

        sendJSON('STATUS_UPDATE', { message: `Found ${initialCompanies.length} companies. Now scraping individual websites...` });
        sendJSON('TOTAL_COMPANIES', { total: initialCompanies.length });

        const allResults = [];
        let completedCount = 0;

        for (let i = 0; i < initialCompanies.length; i += CONCURRENCY_LIMIT) {
            const batch = initialCompanies.slice(i, i + CONCURRENCY_LIMIT);
            
            const batchPromises = batch.map(company => 
                scrapeWebsite(company.websiteUrl, company)
                    .then(result => {
                        completedCount++;
                        const progress = (completedCount / initialCompanies.length) * 100;
                        sendJSON('PROGRESS_UPDATE', { progress, message: `Scraped ${completedCount}/${initialCompanies.length}: ${company.name}` });
                        
                        // Merge the Maps data with the scraped website data
                        const mergedResult = { 
                            ...company, 
                            ...result, 
                            // Force companyName to be the exact name from Google Maps!
                            companyName: company.name || result.companyName 
                        };
                        
                        sendJSON('DATA_UPDATE', { company: mergedResult });
                        return mergedResult;
                    })
                    .catch(error => {
                        console.error(`Failed to scrape ${company.websiteUrl}:`, error.message);
                        completedCount++;
                         const progress = (completedCount / initialCompanies.length) * 100;
                        sendJSON('PROGRESS_UPDATE', { progress, message: `Failed to scrape ${company.name}` });
                        // Return the company data with an error flag
                        return { ...company, error: `Failed to scrape: ${error.message}` };
                    })
            );

            const batchResults = await Promise.all(batchPromises);
            allResults.push(...batchResults);
        }

        sendJSON('STATUS_UPDATE', { message: 'Exporting data...' });
        const exportFiles = await exportData(allResults);

        sendJSON('SCRAPING_COMPLETE', {
            message: 'Scraping complete!',
            results: allResults,
            exportFiles,
        });

    } catch (error) {
        console.error('An error occurred during the scraping process:', error);
        sendJSON('ERROR', { message: `A critical error occurred: ${error.message}` });
    }
}

module.exports = { scrapeGooglePlacesAndWebsites };