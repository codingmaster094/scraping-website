const scrapeService = require('../services/scrapeService');

exports.scrape = async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        const data = await scrapeService.scrapeGooglePlaces(url);
        res.json(data);
    } catch (error) {
        console.error('Error in scrape controller:', error);
        res.status(500).json({ error: 'Failed to scrape data' });
    }
};
