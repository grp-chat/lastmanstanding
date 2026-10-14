// app.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { initDB } = require('./db-sql');

// Initialize Express app and HTTP Server
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Attach socket logic from sockets.js
const initSockets = require('./sockets');
initSockets(io);

// Serve static assets from 'client' folder
app.use(express.static(path.join(__dirname, 'client')));

// Main HTML route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

// Start Server after verifying/initializing the database
const PORT = process.env.PORT || 3000;

initDB()
    .then(() => {
        server.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('❌ Failed to start server due to database error:', err);
    });