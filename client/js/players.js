// client/js/players.js

document.addEventListener('DOMContentLoaded', () => {
    // ✅ Reuse the global socket instance
    const socket = window.gameSocket ? window.gameSocket.socket : io();

    const form = document.getElementById('add-player-form');
    const nameInput = document.getElementById('player-name');
    const iconInput = document.getElementById('player-icon');
    const targetInput = document.getElementById('player-target');
    const bonusInput = document.getElementById('player-bonus');
    const playersUl = document.getElementById('players-ul');

    // Render players list into the DOM
    function renderPlayers(players) {
        playersUl.innerHTML = '';
        if (players.length === 0) {
            playersUl.innerHTML = '<li class="no-players">No players added yet.</li>';
            return;
        }

        players.forEach(p => {
            const li = document.createElement('li');
            li.className = 'player-item';
            
            // Format target cleanly to 3 decimals
            const formattedTarget = Number(p.target).toFixed(3);

            li.innerHTML = `
                <span class="p-icon">${p.icon || '❤️'}</span>
                <span class="p-name"><strong>${p.name}</strong></span>
                <span class="p-details">Life: ${p.life} | Target: ${formattedTarget} | Bonus: ${p.bonus}</span>
                <button class="btn-delete-player" data-name="${p.name}" title="Remove Player">❌</button>
            `;
            playersUl.appendChild(li);
        });
    }

    // Listen for initial load of players from database
    socket.on('load-players', (players) => {
        renderPlayers(players);
    });

    // Listen for live broadcasts when a player is added, updated, or removed
    socket.on('update-players', (players) => {
        renderPlayers(players);
    });

    // Handle form submission
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const name = nameInput.value.trim();
            const icon = iconInput.value || '❤️';
            const target = parseFloat(targetInput.value) || 10.000;
            const bonus = parseInt(bonusInput.value, 10) || 0;

            if (!name) return;

            // Emit add-player event to server
            socket.emit('add-player', { name, icon, target, bonus });

            // Reset name input for quick next-player entry
            nameInput.value = '';
            nameInput.focus();
        });
    }

    // Handle player deletion via event delegation
    if (playersUl) {
        playersUl.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-delete-player')) {
                const playerName = e.target.getAttribute('data-name');
                if (confirm(`Are you sure you want to remove player "${playerName}"?`)) {
                    socket.emit('remove-player', playerName);
                }
            }
        });
    }
});