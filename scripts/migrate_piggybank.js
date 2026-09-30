const db = require('../db');

function runMigration() {
    db.serialize(() => {
        // 1. Create piggybank table
        db.run(`CREATE TABLE IF NOT EXISTS piggybank (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            amount REAL NOT NULL,
            date DATE NOT NULL,
            note TEXT,
            source TEXT DEFAULT 'extra_payment',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`, (err) => {
            if (err) console.error('Error creating piggybank table:', err);
            else console.log('✅ piggybank table ensured.');
        });

        // 2. Remove extra expense allocations from investments table
        db.run(`DELETE FROM investments WHERE asset_type = 'Extra Expense Allocation'`, function(err) {
            if (err) console.error('Error cleaning investments:', err);
            else console.log(`✅ Removed ${this.changes} extra expense entries from investments.`);
        });

        // 3. Migrate existing extra_payments from savings to piggybank
        db.all(`SELECT * FROM savings WHERE type = 'extra_payment'`, (err, rows) => {
            if (err) return console.error('Error selecting extra payments:', err);
            if (!rows || rows.length === 0) return console.log('No extra payments to migrate.');

            rows.forEach(r => {
                db.get(`SELECT id FROM piggybank WHERE user_id = ? AND title = ? AND amount = ? AND date = ?`, 
                    [r.user_id, r.title, r.amount, r.date], 
                    (err, existing) => {
                        if (!err && !existing) {
                            const isOverBudget = r.title.includes('Over-Budget');
                            const source = isOverBudget ? 'extra_expense' : 'extra_payment';
                            db.run(`INSERT INTO piggybank (user_id, title, amount, date, note, source) VALUES (?, ?, ?, ?, ?, ?)`,
                                [r.user_id, r.title, r.amount, r.date, r.note, source],
                                (insErr) => {
                                    if (insErr) console.error('Error inserting into piggybank:', insErr);
                                    else console.log(`✅ Migrated "${r.title}" (₹${r.amount}) to Piggy Bank.`);
                                }
                            );
                        }
                    }
                );
            });
        });
    });
}

runMigration();
setTimeout(() => {
    console.log('Migration finished.');
    process.exit(0);
}, 1500);
