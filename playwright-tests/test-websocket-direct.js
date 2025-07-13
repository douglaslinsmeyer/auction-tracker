// Direct WebSocket connection test
const WebSocket = require('ws');

async function testDirectWebSocket() {
    console.log('Testing direct WebSocket connection to backend...\n');
    
    const wsUrl = 'ws://localhost:3000';
    console.log(`Connecting to: ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);
    
    ws.on('open', () => {
        console.log('✓ WebSocket connected successfully');
        console.log('  Ready state:', ws.readyState);
        console.log('  URL:', ws.url);
        
        // Try to authenticate
        console.log('\nSending authentication...');
        ws.send(JSON.stringify({
            type: 'authenticate',
            token: 'dev-token',
            requestId: Date.now().toString()
        }));
    });
    
    ws.on('message', (data) => {
        console.log('\nReceived message:');
        try {
            const parsed = JSON.parse(data);
            console.log(JSON.stringify(parsed, null, 2));
        } catch (e) {
            console.log(data.toString());
        }
    });
    
    ws.on('error', (error) => {
        console.error('✗ WebSocket error:', error.message);
    });
    
    ws.on('close', (code, reason) => {
        console.log(`\nWebSocket closed. Code: ${code}, Reason: ${reason}`);
        process.exit(0);
    });
    
    // Keep the script running
    setTimeout(() => {
        console.log('\nClosing connection...');
        ws.close();
    }, 5000);
}

testDirectWebSocket().catch(console.error);