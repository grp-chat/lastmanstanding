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

    // Safety fallback timer reference
    let saveTimeout = null;

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
                    <div class="dash-icons-row">${lifeIcons || '(Eliminated)'}</div>
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

    // Function to reset all player action locks and re-enable buttons for the new round
    function resetRoundLocks() {
        // Clear any active safety timeout since we successfully reset
        if (saveTimeout) {
            clearTimeout(saveTimeout);
            saveTimeout = null;
        }

        localPlayers = localPlayers.map(p => ({
            ...p,
            hasActed: false,
            lastAction: null,
            targetChanged: false
        }));

        isSavingRound = false;

        if (btnNextRound) {
            btnNextRound.textContent = '🔄 Next Round';
            btnNextRound.disabled = false;
        }

        renderDashboard(localPlayers);
        console.log('🔄 Round locks reset. Buttons are clickable again!');
    }

    // --- Socket Event Listeners ---

    // Load players safely on initial connection/sync
    socket.on('load-players', (players) => {
        localPlayers = players.map(p => ({ ...p, hasActed: false, lastAction: null, targetChanged: false }));
        renderDashboard(localPlayers);
    });

    // Update players and handle round reset confirmation from the server database broadcast
    socket.on('update-players', (newPlayers) => {
        localPlayers = newPlayers.map(serverP => {
            const existing = localPlayers.find(lp => lp.name === serverP.name);
            const targetChanged = existing && Number(existing.target) !== Number(serverP.target);

            return {
                ...serverP,
                hasActed: existing ? existing.hasActed : false,
                lastAction: existing ? existing.lastAction : null,
                targetChanged: targetChanged || (existing ? existing.targetChanged : false)
            };
        });

        // If we were in the middle of saving, confirm completion and reset locks
        if (isSavingRound) {
            console.log('✅ Round successfully saved and synced from database!');
            resetRoundLocks();
        } else {
            renderDashboard(localPlayers);
            
        }

        // Clear target container glow after 10 seconds for any players who changed targets
        localPlayers.forEach(p => {
            if (p.targetChanged) {
                setTimeout(() => {
                    p.targetChanged = false;
                    const card = dashboardGrid.querySelector(`[data-player-name="${p.name}"]`);
                    if (card) {
                        const targetEl = card.querySelector('.dash-p-target');
                        if (targetEl) targetEl.classList.remove('target-highlight-glow');
                    }
                }, 10000);
            }
        });
    });

    // Listen for remote 'Next Round' request from the server (triggered by the tablet)
    // Listen for remote 'Next Round' request directly from the tablet control panel
    socket.on('request-dashboard-save', () => {
        console.log('📡 Received request-dashboard-save from server. Executing direct round save...');
        
        if (isSavingRound) {
            console.warn('⚠️ Already saving round, ignoring duplicate remote request.');
            return;
        }

        isSavingRound = true;
        
        if (btnNextRound) {
            btnNextRound.textContent = '💾 Saving Round...';
            btnNextRound.disabled = true;
        }

        console.log('🚀 Sending batch update for current localPlayers state (via remote):', localPlayers.map(p => `${p.name}: life=${p.life}`));
        // socket.emit('batch-update-players', localPlayers);
        resetRoundLocks();
        

        // 🛡️ Safety Fallback Timer
        saveTimeout = setTimeout(() => {
            if (isSavingRound) {
                console.warn('⚠️ Safety fallback: Server response timed out on remote save. Force-releasing locks.');
                // resetRoundLocks();
            }
        }, 5000);
    });

    // --- DOM Event Listeners ---

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
            if (isSavingRound) {
                console.warn('⚠️ Already saving round, ignoring extra click.');
                return;
            }

            isSavingRound = true;
            btnNextRound.textContent = '💾 Saving Round...';
            btnNextRound.disabled = true;

            console.log('🚀 Sending batch update for current localPlayers state:', localPlayers.map(p => `${p.name}: life=${p.life}`));
            socket.emit('batch-update-players', localPlayers);

            // 🛡️ Safety Fallback: If the server response takes longer than 5 seconds, 
            // force-unlock the UI automatically so it never stays frozen.
            saveTimeout = setTimeout(() => {
                if (isSavingRound) {
                    console.warn('⚠️ Safety fallback: Server response timed out. Force-releasing locks.');
                    resetRoundLocks();
                }
            }, 5000);
        });
    }

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