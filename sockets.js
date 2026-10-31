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

        // Track server-side saving state to prevent overlapping double-saves


        // 5. Listen for 'batch-update-players' (The ONE and ONLY place where saves happen)
        // Inside sockets.js

        let isServerSaving = false;

        socket.on('batch-update-players', async (playersData) => {
            if (isServerSaving) {
                console.warn('⚠️ [SERVER] Save already in progress. Ignoring duplicate request.');
                return;
            }

            isServerSaving = true;
            console.log('📥 [SERVER] Saving round data to database...');

            try {
                if (playersData && Array.isArray(playersData)) {
                    // 1. Await EVERY single database update query to finish completely
                    await Promise.all(
                        playersData.map(async (p) => {
                            const targetLife = p.life !== undefined ? p.life : 10;
                            const targetBonus = p.bonus !== undefined ? p.bonus : 0;

                            return pool.query(
                                `UPDATE players SET life = $1, bonus = $2 WHERE name = $3`,
                                [targetLife, targetBonus, p.name]
                            );
                        })
                    );
                }

                console.log('🔄 [SERVER] Batch update successfully committed to DB.');

                // 2. ONLY after the database promises are fully resolved, fetch the fresh data
                const result = await pool.query('SELECT * FROM players ORDER BY name ASC');

                // 3. Send the confirmation back to the client so resetRoundLocks() runs safely
                socket.emit('update-players', result.rows);

            } catch (err) {
                console.error('❌ [SERVER] Error during batch update:', err);
                socket.emit('error-message', 'Failed to save round progress');
            } finally {
                // 4. Release the lock
                isServerSaving = false;
            }
        });

        // 6. Listen for 'trigger-next-round' from the tablet control panel
        socket.on('trigger-next-round', () => {
            console.log(`📱 [SERVER] Remote "Next Round" signal received from tablet. Requesting dashboard save...`);
            // Tell the TV dashboard to execute its save using its current local state
            io.emit('request-dashboard-save');
        });

        // Handle client disconnect
        socket.on('disconnect', () => {
            console.log(`❌ Player disconnected: ${socket.id}`);
        });
    });
};