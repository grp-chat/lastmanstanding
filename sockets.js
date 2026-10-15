// sockets.js
const { pool } = require('./db-sql');

module.exports = (io) => {
    io.on('connection', async (socket) => {
        console.log(`⚡ Player connected: ${socket.id}`);

        // 1. When a client connects, fetch existing players from Neon DB and send them
        try {
            const result = await pool.query('SELECT * FROM players ORDER BY name ASC');
            socket.emit('load-players', result.rows);
        } catch (err) {
            console.error('❌ Error fetching players on connect:', err);
        }

        // 2. Listen for 'add-player' event from the frontend
        socket.on('add-player', async (playerData) => {
            const { name, icon, target, bonus } = playerData;
            try {
                await pool.query(
                    `INSERT INTO players (name, icon, target, bonus) VALUES ($1, $2, $3, $4)
                     ON CONFLICT (name) DO NOTHING`,
                    [name, icon || '❤️', target !== undefined ? target : 10.000, bonus !== undefined ? bonus : 0]
                );
                console.log(`✅ Player added to database: ${name}`);

                const result = await pool.query('SELECT * FROM players ORDER BY name ASC');
                io.emit('update-players', result.rows);

            } catch (err) {
                console.error('❌ Error adding player:', err);
                socket.emit('error-message', 'Failed to add player');
            }
        });

        // 3. Listen for 'remove-player' event from the frontend
        socket.on('remove-player', async (playerName) => {
            try {
                await pool.query('DELETE FROM players WHERE name = $1', [playerName]);
                console.log(`🗑️ Player removed from database: ${playerName}`);

                const result = await pool.query('SELECT * FROM players ORDER BY name ASC');
                io.emit('update-players', result.rows);

            } catch (err) {
                console.error('❌ Error removing player:', err);
                socket.emit('error-message', 'Failed to remove player');
            }
        });

        // 4. Listen for 'update-player-settings' event from the settings screen
        socket.on('update-player-settings', async (playerData) => {
            const { name, target, icon, bonus, life } = playerData;
            console.log(`📥 Received update request for player: "${name}"`, playerData);

            const performUpdate = async () => {
                await pool.query(
                    `UPDATE players SET target = $1, icon = $2, bonus = $3, life = $4 WHERE name = $5`,
                    [
                        target !== undefined ? target : 10.000, 
                        icon || '❤️', 
                        bonus !== undefined ? bonus : 0, 
                        life !== undefined ? life : 10, 
                        name
                    ]
                );
            };

            let retries = 2; // Try up to 2 retries (3 attempts total)
            while (retries >= 0) {
                try {
                    await performUpdate();
                    console.log(`⚙️ Player settings updated for: ${name}`);

                    const result = await pool.query('SELECT * FROM players ORDER BY name ASC');
                    io.emit('update-players', result.rows);
                    return; // Success! Exit loop.
                } catch (err) {
                    if (err.code === 'ECONNRESET' && retries > 0) {
                        retries--;
                        console.warn(`⚠️ Proxy dropped connection (ECONNRESET) for player "${name}". Retries left: ${retries}. Waiting for pool refresh...`);
                        
                        // Small pause to allow the pool to clean up the dead socket and dial a fresh one
                        await new Promise(resolve => setTimeout(resolve, 300));
                        continue;
                    }

                    console.error(`❌ Error updating player settings for "${name}":`, err.message);
                    socket.emit('error-message', `Failed to update player settings for ${name}`);
                    return;
                }
            }
        });

        // 5. Listen for 'batch-update-players' event from the dashboard (Next Round sync)
        socket.on('batch-update-players', async (playersData) => {
            try {
                for (const p of playersData) {
                    await pool.query(
                        `UPDATE players SET life = $1, bonus = $2 WHERE name = $3`,
                        [
                            p.life !== undefined ? p.life : 10, 
                            p.bonus !== undefined ? p.bonus : 0, 
                            p.name
                        ]
                    );
                }
                console.log(`🔄 Batch update successful for Next Round.`);

                const result = await pool.query('SELECT * FROM players ORDER BY name ASC');
                io.emit('update-players', result.rows);

            } catch (err) {
                console.error('❌ Error during batch update for next round:', err);
                socket.emit('error-message', 'Failed to save round progress');
            }
        });

        // Handle client disconnect
        socket.on('disconnect', () => {
            console.log(`❌ Player disconnected: ${socket.id}`);
        });
    });
};