const path = require('path');
const { scrapeGooglePlacesAndWebsites } = require('./scrapeService');

let clients = [];

const handleWebSocketConnection = (ws) => {
    console.log('Client connected');
    clients.push(ws);

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'START_SCRAPING') {
                console.log('Received start scraping request for URL:', data.url);
                // Pass the WebSocket client to the service to send progress updates
                await scrapeGooglePlacesAndWebsites(data.url, ws);
            }
        } catch (error) {
            console.error('Error processing message:', error);
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid request format.' }));
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        clients = clients.filter(client => client !== ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
};

const getExportedFile = (req, res) => {
    const { file } = req.params;
    const filePath = path.join(__dirname, 'exports', file);
    res.download(filePath, (err) => {
        if (err) {
            console.error('Error downloading file:', err);
            res.status(404).send('File not found.');
        }
    });
};

module.exports = {
    handleWebSocketConnection,
    getExportedFile,
};