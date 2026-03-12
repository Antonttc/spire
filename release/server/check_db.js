const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
        return;
    }
    console.log('Connected to database.');

    db.all('SELECT * FROM factions', [], (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }

        console.log(`Found ${rows.length} factions.`);
        rows.forEach(row => {
            try {
                const data = JSON.parse(row.data);
                console.log(`Faction: ${data.name} (ID: ${row.id})`);
                console.log(`  Owner: ${row.owner}`);
                console.log(`  Turn Phase: ${data.turnPhase}`);
                console.log(`  Treasure: ${data.treasure}`);
                console.log('---');
            } catch (e) {
                console.error(`Error parsing faction ${row.id}:`, e);
            }
        });

        db.all('SELECT * FROM game_settings', [], (err, settings) => {
            console.log('Settings:', settings);
        });
    });
});
