const express = require('express');
const router = express.Router();
const scrapeController = require('../controllers/scrapeController');

router.post('/scrape', scrapeController.scrape);

module.exports = router;
