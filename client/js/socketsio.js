// client/js/socketsio.js

// Initialize the socket connection
const socket = io();

socket.on('connect', () => {
    console.log('⚡ Connected to server via socketsio.js with ID:', socket.id);
});

// You can export or expose functions here for your SPA views to use
window.gameSocket = {
    socket,
    emitAction: (event, data) => {
        socket.emit(event, data);
    },
    onEvent: (event, callback) => {
        socket.on(event, callback);
    }
};