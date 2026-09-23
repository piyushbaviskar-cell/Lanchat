const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:5173/ws?password=secret123&clientId=test1');

ws.on('open', () => {
    console.log('WS connection OPENED');
    process.exit(0);
});

ws.on('error', (err) => {
    console.error('WS connection ERROR:', err);
});

ws.on('unexpected-response', (req, res) => {
    console.error('WS unexpected response:', res.statusCode);
    res.on('data', (chunk) => console.error(chunk.toString()));
});

ws.on('close', (code, reason) => {
    console.log('WS connection CLOSED:', code, reason.toString());
});
