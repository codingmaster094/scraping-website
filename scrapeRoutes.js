const express = require('express');
const router = express.Router();
const { getExportedFile } = require('./scrapeController');

// Note: The main scraping logic is initiated via WebSocket, not a standard HTTP route.
// This route is for downloading the generated files.
router.get('/download/:file', getExportedFile);

module.exports = router;