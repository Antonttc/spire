const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

app.use(cors());
app.use(express.json());

// Register Endpoint
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Требуется имя пользователя и пароль' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = 'INSERT INTO users (username, password_hash) VALUES (?, ?)';

        db.run(sql, [username, hashedPassword], function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'Имя пользователя уже занято' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: 'Пользователь успешно зарегистрирован', userId: this.lastID });
        });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Login Endpoint
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Требуется имя пользователя и пароль' });
    }

    const sql = 'SELECT * FROM users WHERE username = ?';
    db.get(sql, [username], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!user) {
            return res.status(401).json({ error: 'Неверные учетные данные' });
        }

        const match = await bcrypt.compare(password, user.password_hash);
        if (match) {
            const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
            res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
        } else {
            res.status(401).json({ error: 'Неверные учетные данные' });
        }
    });
});


// Factions API
app.get('/api/factions', (req, res) => {
    const sql = 'SELECT * FROM factions';
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        // Parse data JSON for each faction
        const factions = rows.map(row => {
            try {
                const parsedData = JSON.parse(row.data);
                return { ...parsedData, id: row.id, owner: row.owner };
            } catch (e) {
                console.error(`Error parsing faction data for id ${row.id}:`, e);
                return null;
            }
        }).filter(f => f !== null);
        res.json({ factions });
    });
});

app.post('/api/factions', (req, res) => {
    const faction = req.body;
    const { id, name, owner } = faction;

    // Store remaining data as JSON string
    // We separate id, name, owner for easier SQL querying/indexing if needed,
    // but full object is stored in 'data' for flexibility (minus duplicates if you want, 
    // but keeping full object in 'data' is often easier for simple apps)

    // Actually, let's keep it simple: id, name, owner match columns. 
    // The 'data' column stores the FULL faction object stringified.

    const data = JSON.stringify(faction);
    const sql = 'INSERT OR REPLACE INTO factions (id, name, owner, data) VALUES (?, ?, ?, ?)';

    db.run(sql, [id, name, owner, data], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Faction saved', id: id });
    });
});

app.post('/api/factions/batch', (req, res) => {
    const factions = req.body;
    if (!Array.isArray(factions)) {
        return res.status(400).json({ error: 'Expected array of factions' });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const stmt = db.prepare('INSERT OR REPLACE INTO factions (id, name, owner, data) VALUES (?, ?, ?, ?)');
        let errorOccurred = false;

        factions.forEach(faction => {
            const { id, name, owner } = faction;
            const data = JSON.stringify(faction);
            stmt.run([id, name, owner, data], (err) => {
                if (err) {
                    errorOccurred = true;
                    console.error("Batch update error:", err);
                }
            });
        });

        stmt.finalize((err) => {
            if (err || errorOccurred) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Batch update failed' });
            } else {
                db.run('COMMIT');
                res.json({ message: 'Batch update successful', count: factions.length });
            }
        });
    });
});

app.delete('/api/factions/:id', (req, res) => {
    const sql = 'DELETE FROM factions WHERE id = ?';
    db.run(sql, req.params.id, function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Faction deleted', changes: this.changes });
    });
});


// Game Settings API
app.get('/api/settings/:key', (req, res) => {
    const sql = 'SELECT value FROM game_settings WHERE key = ?';
    db.get(sql, [req.params.key], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ value: row ? row.value : null });
    });
});

app.post('/api/settings', (req, res) => {
    const { key, value } = req.body;
    const sql = 'INSERT OR REPLACE INTO game_settings (key, value) VALUES (?, ?)';
    db.run(sql, [key, value], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Setting saved', key });
    });
});

// Serve static files from the Vite build
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Catch-all route for SPA
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
