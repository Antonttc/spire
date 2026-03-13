const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = process.env.DB_PATH || path.resolve(__dirname, 'database.sqlite');

// Убедимся, что папка для базы существует (особенно важно для Volumes в Railway)
const fs = require('fs');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password_hash TEXT,
            role TEXT DEFAULT 'player',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Error creating users table', err.message);
            } else {
                console.log('Users table ready.');
                // Проверяем, есть ли пользователи. Если нет — создаем дефолтного админа.
                db.get("SELECT COUNT(*) as count FROM users", (err, row) => {
                    if (!err && row.count === 0) {
                        const adminUser = 'admin';
                        const adminPass = 'admin123!';
                        bcrypt.hash(adminPass, 10, (err, hash) => {
                            if (!err) {
                                db.run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", 
                                    [adminUser, hash, 'admin'], 
                                    (err) => {
                                        if (!err) console.log('Default admin user created.');
                                    }
                                );
                            }
                        });
                    }
                });
            }
        });

        db.run(`CREATE TABLE IF NOT EXISTS factions (
            id TEXT PRIMARY KEY,
            name TEXT,
            owner TEXT,
            data TEXT
        )`, (err) => {
            if (err) {
                console.error('Error creating factions table', err.message);
            } else {
                console.log('Factions table ready.');
            }
        });

        db.run(`CREATE TABLE IF NOT EXISTS game_settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )`, (err) => {
            if (err) {
                console.error('Error creating game_settings table', err.message);
            } else {
                console.log('Game Settings table ready.');
            }
        });
    });
}

module.exports = db;
