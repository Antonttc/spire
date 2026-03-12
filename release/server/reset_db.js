const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, async (err) => {
    if (err) {
        console.error('Error opening database', err.message);
        process.exit(1);
    }
    console.log('Connected to the SQLite database. Resetting data...');

    db.serialize(async () => {
        // Clear all tables
        db.run(`DELETE FROM users`);
        db.run(`DELETE FROM factions`);
        db.run(`DELETE FROM game_settings`);
        
        // Reset sqlite_sequence to clear AUTOINCREMENT counters
        db.run(`DELETE FROM sqlite_sequence WHERE name='users'`);

        console.log('Tables cleared.');

        // Add admin user
        try {
            const hashedPassword = await bcrypt.hash('admin123!', 10);
            db.run(`INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`, 
                ['admin', hashedPassword, 'admin'], 
                function(err) {
                    if (err) {
                        console.error('Error creating admin:', err.message);
                    } else {
                        console.log('Admin user successfully created.');
                    }
                    db.close((err) => {
                        if (err) console.error(err.message);
                        console.log('Database connection closed.');
                    });
                }
            );
        } catch (hashError) {
            console.error('Bcrypt error:', hashError);
            db.close();
        }
    });
});
