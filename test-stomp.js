const { Client } = require('@stomp/stompjs');
const WebSocket = require('ws');
Object.assign(global, { WebSocket });

const client = new Client({
    brokerURL: 'ws://127.0.0.1:5173/ws?password=secret123&clientId=123',
    onConnect: () => {
        console.log('STOMP CONNECTED SUCCESSFULLY!');
        process.exit(0);
    },
    onStompError: (frame) => {
        console.error('STOMP Error:', frame.headers['message']);
        process.exit(1);
    },
    onWebSocketError: (event) => {
        console.error('WS Error');
        process.exit(1);
    },
    debug: (str) => console.log(str),
});

client.activate();
