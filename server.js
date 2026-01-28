const WebSocket = require('ws');

// Configuration
const PORT = process.env.PORT || 8080;
const server = new WebSocket.Server({ port: PORT });

console.log(`Signaling server running on port ${PORT}`);

// Store connected clients
const clients = new Map();
let clientId = 1;

server.on('connection', (ws) => {
    const id = clientId++;
    clients.set(id, ws);
    
    console.log(`Client ${id} connected. Total clients: ${clients.size}`);
    
    // Assign a simple ID to the client
    ws.clientId = id;
    
    // Send welcome message
    ws.send(JSON.stringify({
        type: 'welcome',
        id: id,
        totalClients: clients.size
    }));
    
    // Broadcast to other clients about new connection
    broadcast({
        type: 'client-connected',
        id: id,
        totalClients: clients.size
    }, id);
    
    // Handle messages from client
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log(`Message from client ${id}:`, data.type);
            
            // Add sender ID to message
            data.sender = id;
            
            // Broadcast to all other clients
            broadcast(data, id);
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });
    
    // Handle client disconnection
    ws.on('close', () => {
        clients.delete(id);
        console.log(`Client ${id} disconnected. Total clients: ${clients.size}`);
        
        // Broadcast disconnection to other clients
        broadcast({
            type: 'client-disconnected',
            id: id,
            totalClients: clients.size
        }, id);
    });
    
    // Handle errors
    ws.on('error', (error) => {
        console.error(`Error with client ${id}:`, error);
    });
});

function broadcast(message, excludeId = null) {
    const messageStr = JSON.stringify(message);
    
    clients.forEach((client, id) => {
        if (id !== excludeId && client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
        }
    });
}

// Handle server shutdown
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    
    // Notify all clients
    broadcast({
        type: 'server-shutdown',
        message: 'Server is shutting down'
    });
    
    // Close all connections
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
