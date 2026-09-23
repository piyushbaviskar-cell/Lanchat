import { Client } from '@stomp/stompjs';
import WebSocket from 'ws';

Object.assign(global, { WebSocket });

const WS_URL = 'ws://127.0.0.1:8080/ws';

async function runSimulation() {
  console.log('[SIM] Initializing Autonomous Chaos Test...');

  let client1Received = false;
  let client2Received = false;

  // 1. Initialize Operator Alpha (#7F2A)
  const client1 = new Client({
    brokerURL: WS_URL,
    reconnectDelay: 1000,
    onConnect: () => {
      console.log('[SIM] Operator Alpha (#7F2A) Connected.');
      client1.subscribe('/topic/public', (msg) => {
        const payload = JSON.parse(msg.body);
        if (payload.sender === 'Operator_Bravo' && payload.content === 'how are you') {
          console.log('[SIM] Alpha verified receipt of: "how are you"');
          client1Received = true;
        }
      });

      // Announce Presence
      client1.publish({
        destination: '/app/chat.addUser',
        body: JSON.stringify({ sender: 'Operator_Alpha', tag: '#7F2A', type: 'JOIN' })
      });
    }
  });

  // 2. Initialize Operator Bravo (#4B1C)
  const client2 = new Client({
    brokerURL: WS_URL,
    reconnectDelay: 1000,
    onConnect: () => {
      console.log('[SIM] Operator Bravo (#4B1C) Connected.');
      client2.subscribe('/topic/public', (msg) => {
        const payload = JSON.parse(msg.body);
        if (payload.sender === 'Operator_Alpha' && payload.content === 'hi') {
          console.log('[SIM] Bravo verified receipt of: "hi"');
          client2Received = true;

          // Respond back
          setTimeout(() => {
            console.log('[SIM] Bravo sending response: "how are you"');
            client2.publish({
              destination: '/app/chat.sendMessage',
              body: JSON.stringify({ sender: 'Operator_Bravo', tag: '#4B1C', content: 'how are you', type: 'CHAT' })
            });
          }, 300);
        }
      });

      client2.publish({
        destination: '/app/chat.addUser',
        body: JSON.stringify({ sender: 'Operator_Bravo', tag: '#4B1C', type: 'JOIN' })
      });

      // Alpha initiates conversation
      setTimeout(() => {
        console.log('[SIM] Alpha sending initial message: "hi"');
        client1.publish({
          destination: '/app/chat.sendMessage',
          body: JSON.stringify({ sender: 'Operator_Alpha', tag: '#7F2A', content: 'hi', type: 'CHAT' })
        });
      }, 500);
    }
  });

  client1.activate();
  client2.activate();

  // Await handshake and conversation verification
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (client1Received && client2Received) {
        clearInterval(interval);
        client1.deactivate();
        client2.deactivate();
        console.log('✅ [SIM SUCCESS] Bidirectional messaging ("hi" -> "how are you") passed.');
        resolve(true);
      } else if (attempts > 30) {
        clearInterval(interval);
        client1.deactivate();
        client2.deactivate();
        reject(new Error('[SIM TIMEOUT] Messages failed to route across STOMP broker.'));
      }
    }, 200);
  });
}

runSimulation().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
