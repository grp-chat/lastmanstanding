// client/js/panel.js

document.addEventListener('DOMContentLoaded', () => {
    console.log('📱 Control Panel Initialized');

    // ✅ Reuse the global socket instance
    const socket = window.gameSocket ? window.gameSocket.socket : io();

    // Find the control panel view content container
    const panelContent = document.querySelector('#view-control-panel .view-content');

    if (panelContent) {
        // Render the control panel interface with the remote Next Round button
        panelContent.innerHTML = `
            <div class="control-panel-container" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; gap: 20px;">
                <h3>Tablet Remote Controls</h3>
                <button id="btn-panel-next-round" class="menu-btn primary" style="font-size: 1.5rem; padding: 20px 40px;">
                    🔄 Next Round (Remote)
                </button>
            </div>
        `;

        const panelNextRoundBtn = document.getElementById('btn-panel-next-round');
        if (panelNextRoundBtn) {
            panelNextRoundBtn.addEventListener('click', () => {
                panelNextRoundBtn.textContent = '⏳ Triggering Next Round...';
                panelNextRoundBtn.disabled = true;

                // Emit remote signal to the server
                socket.emit('trigger-next-round');

                // Reset button state after a brief visual confirmation
                setTimeout(() => {
                    panelNextRoundBtn.textContent = '🔄 Next Round (Remote)';
                    panelNextRoundBtn.disabled = false;
                }, 1000);
            });
        }
    }
});