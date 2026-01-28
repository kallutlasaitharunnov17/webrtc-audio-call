const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const PORT = process.env.PORT || 8080;

// Create HTTP server for serving HTML if needed
const server = http.createServer((req, res) => {
    // Serve index.html if requested
    if (req.url === '/' || req.url === '/index.html') {
        fs.readFile(path.join(__dirname, '../index.html'), (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('File not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
        return;
    }
    
    // For other requests, show server info
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        name: 'WebRTC Signaling Server',
        status: 'running',
        clients: wsServer.clients.size,
        uptime: process.uptime(),
        endpoints: {
            websocket: `ws://${req.headers.host}`,
            health: `http://${req.headers.host}/health`
        }
    }));
});

// Create WebSocket server
const wsServer = new WebSocket.Server({ server });

// Store rooms (groups of connected clients)
const rooms = new Map();

// Generate a simple room ID
function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

console.log(`🚀 WebRTC Signaling Server starting...`);
console.log(`📡 WebSocket: ws://localhost:${PORT}`);
console.log(`🌐 HTTP: http://localhost:${PORT}`);

wsServer.on('connection', (ws, req) => {
    const clientId = Math.random().toString(36).substring(2, 10);
    const clientIp = req.socket.remoteAddress;
    
    console.log(`✅ Client ${clientId} connected from ${clientIp}`);
    
    // Store client info
    ws.clientId = clientId;
    ws.clientIp = clientIp;
    ws.roomId = null;
    ws.isCaller = false;
    ws.isCallee = false;
    
    // Send welcome message
    ws.send(JSON.stringify({
        type: 'welcome',
        clientId: clientId,
        message: 'Connected to WebRTC Signaling Server',
        timestamp: Date.now(),
        serverInfo: {
            name: 'WebRTC Audio Call Server',
            version: '1.0.0'
        }
    }));
    
    // Handle messages from client
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            
            console.log(`📨 ${clientId}: ${data.type}`);
            
            switch (data.type) {
                case 'create-room':
                    handleCreateRoom(ws, data);
                    break;
                    
                case 'join-room':
                    handleJoinRoom(ws, data);
                    break;
                    
                case 'offer':
                case 'answer':
                case 'candidate':
                case 'hangup':
                case 'ping':
                    forwardMessage(ws, data);
                    break;
                    
                case 'list-rooms':
                    sendRoomList(ws);
                    break;
                    
                default:
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Unknown message type'
                    }));
            }
        } catch (error) {
            console.error(`❌ Error processing message from ${clientId}:`, error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format'
            }));
        }
    });
    
    // Handle ping/pong for keep-alive
    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
    });
    
    // Handle client disconnection
    ws.on('close', () => {
        console.log(`❌ Client ${clientId} disconnected`);
        
        // Clean up room if client was in one
        if (ws.roomId && rooms.has(ws.roomId)) {
            const room = rooms.get(ws.roomId);
            
            // Remove client from room
            room.clients = room.clients.filter(client => client.clientId !== clientId);
            
            // Notify other clients in the room
            room.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'peer-disconnected',
                        clientId: clientId,
                        roomId: ws.roomId
                    }));
                }
            });
            
            // Delete room if empty
            if (room.clients.length === 0) {
                rooms.delete(ws.roomId);
                console.log(`🗑️ Room ${ws.roomId} deleted (empty)`);
            } else {
                console.log(`👥 Room ${ws.roomId} now has ${room.clients.length} client(s)`);
            }
        }
    });
    
    // Handle errors
    ws.on('error', (error) => {
        console.error(`⚠️ WebSocket error for ${clientId}:`, error.message);
    });
});

// Heartbeat to keep connections alive
setInterval(() => {
    wsServer.clients.forEach((ws) => {
        if (!ws.isAlive) {
            console.log(`💔 Terminating dead connection: ${ws.clientId}`);
            return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

// Handle room creation
function handleCreateRoom(ws, data) {
    const roomId = data.roomId || generateRoomId();
    
    if (rooms.has(roomId)) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Room already exists'
        }));
        return;
    }
    
    // Create new room
    rooms.set(roomId, {
        id: roomId,
        clients: [ws],
        createdAt: Date.now(),
        createdBy: ws.clientId
    });
    
    ws.roomId = roomId;
    ws.isCaller = true;
    
    console.log(`🏠 Room ${roomId} created by ${ws.clientId}`);
    
    ws.send(JSON.stringify({
        type: 'room-created',
        roomId: roomId,
        clientId: ws.clientId,
        message: 'Room created. Share this room ID with others.'
    }));
}

// Handle room joining
function handleJoinRoom(ws, data) {
    const roomId = data.roomId;
    
    if (!roomId) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Room ID required'
        }));
        return;
    }
    
    if (!rooms.has(roomId)) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Room not found'
        }));
        return;
    }
    
    const room = rooms.get(roomId);
    
    // Check if room is full (for 1:1 calls, max 2 clients)
    if (room.clients.length >= 2) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Room is full (max 2 clients)'
        }));
        return;
    }
    
    // Add client to room
    room.clients.push(ws);
    ws.roomId = roomId;
    ws.isCallee = true;
    
    console.log(`👤 ${ws.clientId} joined room ${roomId}`);
    
    // Notify all clients in the room about new peer
    room.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'peer-joined',
                roomId: roomId,
                clientId: ws.clientId,
                totalClients: room.clients.length
            }));
        }
    });
    
    // Send join confirmation
    ws.send(JSON.stringify({
        type: 'room-joined',
        roomId: roomId,
        clientId: ws.clientId,
        otherClients: room.clients
            .filter(c => c.clientId !== ws.clientId)
            .map(c => c.clientId)
    }));
}

// Forward WebRTC signaling messages
function forwardMessage(senderWs, data) {
    if (!senderWs.roomId || !rooms.has(senderWs.roomId)) {
        senderWs.send(JSON.stringify({
            type: 'error',
            message: 'Not in a room'
        }));
        return;
    }
    
    const room = rooms.get(senderWs.roomId);
    
    // Add sender info to message
    data.sender = senderWs.clientId;
    
    // Forward to all other clients in the room
    room.clients.forEach(client => {
        if (client !== senderWs && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
    
    // Log for debugging
    if (data.type !== 'ping') {
        console.log(`📤 ${senderWs.clientId} -> room ${senderWs.roomId}: ${data.type}`);
    }
}

// Send room list to client
function sendRoomList(ws) {
    const roomList = Array.from(rooms.entries()).map(([id, room]) => ({
        id: id,
        clientCount: room.clients.length,
        createdBy: room.createdBy,
        createdAt: room.createdAt
    }));
    
    ws.send(JSON.stringify({
        type: 'room-list',
        rooms: roomList,
        totalRooms: rooms.size,
        totalClients: wsServer.clients.size
    }));
}

// Health check endpoint
server.on('request', (req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'healthy',
            uptime: process.uptime(),
            clients: wsServer.clients.size,
            rooms: rooms.size,
            memory: process.memoryUsage()
        }));
        return;
    }
});

// Start the server
server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║   🚀 WebRTC Signaling Server Started!                    ║
║                                                          ║
║   📡 WebSocket URL: ws://localhost:${PORT}              ${PORT < 10000 ? ' ' : ''}║
║   🌐 HTTP URL:      http://localhost:${PORT}            ${PORT < 10000 ? ' ' : ''}║
║   📊 Health Check:  http://localhost:${PORT}/health     ${PORT < 10000 ? ' ' : ''}║
║                                                          ║
║   📍 Use this URL in your WebRTC app:                   ║
║   ws://localhost:${PORT} or ws://YOUR_IP:${PORT}        ${PORT < 10000 ? ' ' : ''}║
╚══════════════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    
    // Notify all clients
    wsServer.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'server-shutdown',
                message: 'Server is shutting down'
            }));
            client.close();
        }
    });
    
    server.close(() => {
        console.log('✅ Server closed gracefully');
        process.exit(0);
    });
});
