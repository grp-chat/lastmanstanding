// client/js/dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    // ✅ Reuse the global socket instance
    const socket = window.gameSocket ? window.gameSocket.socket : io();
    const dashboardGrid = document.getElementById('dashboard-players-grid');
    const btnNextRound = document.getElementById('btn-next-round');

    // Keep track of players locally
    let localPlayers = [];
    
    // Flag to track when we are waiting for a database save confirmation
    let isSavingRound = false;

    function renderDashboard(players) {
        if (!dashboardGrid) return;
        dashboardGrid.innerHTML = '';

        if (players.length === 0) {
            dashboardGrid.innerHTML = '<p class="no-players">No players registered yet. Add players from the main menu!</p>';
            return;
        }

        players.forEach((p, index) => {
            const card = document.createElement('div');
            card.className = `dashboard-card ${p.hasActed ? 'acted' : ''}`;
            card.setAttribute('data-index', index);
            card.setAttribute('data-player-name', p.name);

            // Repeat the player icon according to their current life count
            const lifeIcons = p.icon.repeat(Math.max(0, p.life));
            const formattedTarget = Number(p.target).toFixed(3);

            // Check target change state safely for container glow
            const targetGlowClass = p.targetChanged ? 'target-highlight-glow' : '';

            const successClass = p.lastAction === 'success' 
                ? 'menu-btn primary btn-success action-selected' 
                : 'menu-btn primary btn-success';
            
            const failClass = p.lastAction === 'fail' 
                ? 'menu-btn accent btn-fail action-selected' 
                : 'menu-btn accent btn-fail';

            card.innerHTML = `
                <div class="dash-card-header">
                    <span class="dash-p-name">${p.name}</span>
                    <span class="dash-p-target ${targetGlowClass}">Target: ${formattedTarget}</span>
                </div>
                <div class="dash-life-display">
                    <div class="dash-icons-row">${lifeIcons || '💀 (Eliminated)'}</div>
                    <span class="dash-life-count">Life: ${p.life} | Bonus: ${p.bonus}/3</span>
                </div>
                <div class="dash-actions">
                    <button class="${successClass}" data-index="${index}" ${p.hasActed ? 'disabled' : ''}>✅ Good!</button>
                    <button class="${failClass}" data-index="${index}" ${p.hasActed ? 'disabled' : ''}>❌ Not good</button>
                </div>
            `;
            dashboardGrid.appendChild(card);
        });
    }

    // Load players safely
    socket.on('load-players', (players) => {
        localPlayers = players.map(p => ({ ...p, hasActed: false, lastAction: null, targetChanged: false }));
        renderDashboard(localPlayers);
    });

    // Update players and handle round reset confirmation from the server database broadcast
    socket.on('update-players', (newPlayers) => {
        localPlayers = newPlayers.map(serverP => {
            const existing = localPlayers.find(lp => lp.name === serverP.name);
            
            // Check if target changed from previous local state
            const targetChanged = existing && Number(existing.target) !== Number(serverP.target);

            // If we were waiting for a next-round save, clear actions/locks for the new round!
            const hasActed = isSavingRound ? false : (existing ? existing.hasActed : false);
            const lastAction = isSavingRound ? null : (existing ? existing.lastAction : null);

            return {
                ...serverP,
                hasActed: hasActed,
                lastAction: lastAction,
                targetChanged: targetChanged || (existing ? existing.targetChanged : false)
            };
        });

        // If we were saving, the round save is now 100% confirmed by the DB broadcast!
        if (isSavingRound) {
            isSavingRound = false;
            if (btnNextRound) {
                btnNextRound.textContent = '🔄 Next Round';
                btnNextRound.disabled = false;
            }
            console.log('✅ Round successfully saved and synced from database!');
        }

        renderDashboard(localPlayers);

        // Clear target container glow after 10 seconds for any players who changed targets
        localPlayers.forEach(p => {
            if (p.targetChanged) {
                setTimeout(() => {
                    p.targetChanged = false;
                    // Safely remove class from DOM element if card still exists
                    const card = dashboardGrid.querySelector(`[data-player-name="${p.name}"]`);
                    if (card) {
                        const targetEl = card.querySelector('.dash-p-target');
                        if (targetEl) targetEl.classList.remove('target-highlight-glow');
                    }
                }, 10000);
            }
        });
    });

    // Handle Success / Fail clicks per player card
    if (dashboardGrid) {
        dashboardGrid.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-index'), 10);
            if (isNaN(index) || !localPlayers[index]) return;

            const player = localPlayers[index];
            if (player.hasActed) return;

            if (e.target.classList.contains('btn-success')) {
                player.bonus = Math.min(3, (player.bonus || 0) + 1);
                player.hasActed = true;
                player.lastAction = 'success';
                renderDashboard(localPlayers);
            } else if (e.target.classList.contains('btn-fail')) {
                player.life = Math.max(0, player.life - 1);
                player.hasActed = true;
                player.lastAction = 'fail';
                renderDashboard(localPlayers);
            }
        });
    }

    // Handle Next Round click (Batch save to DB and wait for server confirmation)
    if (btnNextRound) {
        btnNextRound.addEventListener('click', () => {
            if (isSavingRound) return; // Prevent double clicking

            btnNextRound.textContent = '💾 Saving Round...';
            btnNextRound.disabled = true;
            isSavingRound = true; // Flag that we are waiting for DB confirmation

            // Send batch update to backend socket
            socket.emit('batch-update-players', localPlayers);
        });
    }

    // Listen for remote 'Next Round' trigger from the tablet control panel
    socket.on('remote-next-round', () => {
        console.log('📡 Received remote "Next Round" trigger from control panel.');
        if (btnNextRound && !btnNextRound.disabled) {
            // Programmatically trigger the same click handler logic
            btnNextRound.click();
        }
    });

    // --- View Toggle Controller ---
    const toggleBtn = document.getElementById('btn-toggle-view');
    if (toggleBtn && dashboardGrid) {
        toggleBtn.addEventListener('click', () => {
            dashboardGrid.classList.toggle('grid-large');
            if (dashboardGrid.classList.contains('grid-large')) {
                toggleBtn.textContent = '🔳 Compact View';
            } else {
                toggleBtn.textContent = '🔲 Large View';
            }
        });
    }

    // --- Fullscreen Toggle Controller ---
    const fullscreenBtn = document.getElementById('btn-toggle-fullscreen');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.error(`Error attempting to enable fullscreen: ${err.message}`);
                });
                fullscreenBtn.textContent = '↙️ Exit Fullscreen';
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                    fullscreenBtn.textContent = '⛶ Fullscreen';
                }
            }
        });
    }
});