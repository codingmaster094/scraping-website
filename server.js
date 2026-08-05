const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const { fileURLToPath } = require('url');
const scrapeRoutes = require('./scrapeRoutes');
const { handleWebSocketConnection } = require('./scrapeController');

const app = express();

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from project root
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname))); // For existing js/css references
// Export folder
app.use('/exports', express.static(path.join(__dirname, 'exports')));

// Home Page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.set('view engine', 'ejs');
app.get('/v2', (req, res) => {
    res.render('index', { title: 'Web Scraping Tool' });
});

// API Routes
app.use('/api', scrapeRoutes);

// WebSocket
wss.on('connection', handleWebSocketConnection);

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});