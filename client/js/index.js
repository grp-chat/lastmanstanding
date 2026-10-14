// client/js/index.js

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 Main Navigation Controller Initialized');

    // Helper function to switch active screen view
    function switchView(targetViewId) {
        // Hide all screens
        document.querySelectorAll('.view').forEach(view => {
            view.classList.add('hidden');
        });

        // Show requested screen
        const activeView = document.getElementById(targetViewId);
        if (activeView) {
            activeView.classList.remove('hidden');
        } else {
            console.warn(`View ID "${targetViewId}" not found!`);
        }

        // Toggle body class for full-width dashboard layout
        if (targetViewId === 'view-dashboard') {
            document.body.classList.add('dashboard-active');
        } else {
            document.body.classList.remove('dashboard-active');
        }
    }

    // Main Menu Navigation Buttons
    document.getElementById('btn-goto-add-players').addEventListener('click', () => {
        switchView('view-add-players');
    });

    document.getElementById('btn-goto-settings').addEventListener('click', () => {
        switchView('view-player-settings');
    });

    document.getElementById('btn-goto-bonus').addEventListener('click', () => {
        switchView('view-bonus-settings');
    });

    document.getElementById('btn-goto-dashboard').addEventListener('click', () => {
        switchView('view-dashboard');
    });

    document.getElementById('btn-goto-panel').addEventListener('click', () => {
        switchView('view-control-panel');
    });

    // Global 'Back to Main Menu' listener for all back buttons
    document.querySelectorAll('.btn-back').forEach(btn => {
        btn.addEventListener('click', () => {
            switchView('view-main-menu');
        });
    });
});