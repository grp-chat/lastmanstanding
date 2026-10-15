// client/js/settings.js

document.addEventListener('DOMContentLoaded', () => {
    // Reuse the global socket instance
    const socket = window.gameSocket ? window.gameSocket.socket : io();
    const settingsListContainer = document.getElementById('settings-players-list');

    const availableIcons = [
        '❤️', '⚡', '❄', '💎', '🔋', '🪙', '🛡', '🧬', 
        '🐎', '🦣', '🦏', '🦖', '🌻', '🌼', '🌷', '🍎', '🧀'
    ];

    function renderSettingsList(players) {
        if (!settingsListContainer) return;
        settingsListContainer.innerHTML = '';

        if (players.length === 0) {
            settingsListContainer.innerHTML = '<p class="no-players">No players found. Add players first!</p>';
            return;
        }

        players.forEach(p => {
            const card = document.createElement('div');
            card.className = 'settings-card';

            // Generate icon dropdown options dynamically with current selection selected
            const iconOptions = availableIcons.map(icon => 
                `<option value="${icon}" ${p.icon === icon ? 'selected' : ''}>${icon}</option>`
            ).join('');

            const formattedTarget = Number(p.target).toFixed(3);

            card.innerHTML = `
                <div class="settings-player-header">
                    <span class="settings-p-name"><strong>${p.name}</strong></span>
                </div>
                <div class="settings-form-grid">
                    <div class="form-group">
                        <label>Icon</label>
                        <select class="form-select setting-icon" data-name="${p.name}">
                            ${iconOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Life</label>
                        <input type="number" class="setting-life" data-name="${p.name}" value="${p.life}">
                    </div>
                    <div class="form-group">
                        <label>Target (3 decimals)</label>
                        <input type="number" step="0.001" class="setting-target" data-name="${p.name}" value="${formattedTarget}">
                    </div>
                    <div class="form-group">
                        <label>Bonus</label>
                        <input type="number" class="setting-bonus" data-name="${p.name}" value="${p.bonus}">
                    </div>
                </div>
                <button class="menu-btn primary btn-save-settings" data-name="${p.name}" data-saving="false">💾 Save ${p.name}</button>
            `;
            settingsListContainer.appendChild(card);
        });
    }

    // Listen for player data loads and live updates from socket
    socket.on('load-players', (players) => {
        renderSettingsList(players);
    });

    socket.on('update-players', (players) => {
        renderSettingsList(players);
    });

    // Listen for server-side save errors and update the specific button's visual state
    socket.on('error-message', (msg) => {
        console.error('Server error:', msg);
        document.querySelectorAll('.btn-save-settings').forEach(btn => {
            if (btn.dataset.saving === 'true') {
                const name = btn.getAttribute('data-name');
                btn.textContent = '❌ Failed, try again';
                btn.style.backgroundColor = '#e74c3c';
                btn.dataset.saving = 'false';
                btn.disabled = false;
                setTimeout(() => {
                    btn.textContent = `💾 Save ${name}`;
                    btn.style.backgroundColor = '';
                }, 2500);
            }
        });
    });

    // Handle saving individual player settings
    if (settingsListContainer) {
        settingsListContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-save-settings')) {
                const btn = e.target;
                const name = btn.getAttribute('data-name');
                const card = btn.closest('.settings-card');

                const icon = card.querySelector('.setting-icon').value;
                const life = parseInt(card.querySelector('.setting-life').value, 10) || 10;
                const target = parseFloat(card.querySelector('.setting-target').value) || 10.000;
                const bonus = parseInt(card.querySelector('.setting-bonus').value, 10) || 0;

                // Mark button as actively saving
                btn.dataset.saving = 'true';
                btn.textContent = '⏳ Saving...';

                // Emit update event to backend socket
                socket.emit('update-player-settings', { name, icon, life, target, bonus });
                
                // Visual confirmation hint (assumes success unless overridden by error-message)
                setTimeout(() => {
                    if (btn.dataset.saving === 'true') {
                        btn.dataset.saving = 'false';
                        btn.textContent = '✅ Saved!';
                        setTimeout(() => {
                            btn.textContent = `💾 Save ${name}`;
                        }, 1500);
                    }
                }, 800);
            }
        });
    }
});