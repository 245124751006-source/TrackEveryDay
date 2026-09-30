const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        // Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Accounts Table
        db.run(`CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            bank_name TEXT NOT NULL,
            account_type TEXT NOT NULL,
            masked_number TEXT NOT NULL,
            balance REAL DEFAULT 0,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // Categories Table (Global)
        db.run(`CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            color TEXT,
            icon TEXT
        )`);

        // Transactions Table
        db.run(`CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('expense', 'income')),
            method TEXT NOT NULL CHECK(method IN ('qr', 'cash', 'card')),
            category_id INTEGER,
            account_id INTEGER,
            note TEXT,
            date DATE NOT NULL,
            auto BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(category_id) REFERENCES categories(id),
            FOREIGN KEY(account_id) REFERENCES accounts(id)
        )`);

        // Coupons Table
        db.run(`CREATE TABLE IF NOT EXISTS coupons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            code TEXT NOT NULL,
            store TEXT NOT NULL,
            discount TEXT,
            expiry_date DATE NOT NULL,
            status TEXT DEFAULT 'active',
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // Bills Table
        db.run(`CREATE TABLE IF NOT EXISTS bills (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            amount REAL NOT NULL,
            due_date DATE NOT NULL,
            status TEXT DEFAULT 'unpaid' CHECK(status IN ('paid', 'unpaid')),
            category_id INTEGER,
            recurrence TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(category_id) REFERENCES categories(id)
        )`);

        // Notifications Table
        db.run(`CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            is_read BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // Savings Table
        db.run(`CREATE TABLE IF NOT EXISTS savings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            amount REAL NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('rollover', 'extra_payment')),
            date DATE NOT NULL,
            note TEXT,
            month_year TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // Investments Table 📈
        db.run(`CREATE TABLE IF NOT EXISTS investments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            amount REAL NOT NULL,
            asset_type TEXT NOT NULL,
            date DATE NOT NULL,
            note TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);

        // Piggy Bank Table 🐷
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
        )`);

        seedDemoData();
    });
}

function seedDemoData() {
    db.get('SELECT COUNT(*) as count FROM users', async (err, row) => {
        if (err) return console.error(err);
        
        if (row.count === 0) {
            console.log('Seeding demo data...');
            const passwordHash = await bcrypt.hash('password123', 10);
            
            db.run(`INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)`, 
                ['Demo User', 'demo@example.com', passwordHash], 
                function(err) {
                    if (err) return console.error(err);
                    const userId = this.lastID;
                    
                    // Seed Accounts
                    db.run(`INSERT INTO accounts (user_id, bank_name, account_type, masked_number, balance) VALUES (?, ?, ?, ?, ?)`, 
                        [userId, 'Chase Bank', 'Checking', '**** 1234', 5000.00]);
                        
                    // Note: We don't seed categories here anymore, they are seeded globally below
                    
                    // Wait a bit to ensure categories are inserted, then insert some transactions
                    setTimeout(() => {
                        // Income
                        db.run(`INSERT INTO transactions (user_id, amount, type, method, category_id, date, note) VALUES (?, ?, ?, ?, ?, date('now', '-5 days'), ?)`, 
                            [userId, 25000, 'income', 'card', 13, 'Monthly Allowance']);
                        
                        // Expenses
                        db.run(`INSERT INTO transactions (user_id, amount, type, method, category_id, date, note, auto) VALUES (?, ?, ?, ?, ?, date('now', '-2 days'), ?, ?)`, 
                            [userId, 10000, 'expense', 'card', 3, 'Rent Payment', 1]);
                        db.run(`INSERT INTO transactions (user_id, amount, type, method, category_id, date, note, auto) VALUES (?, ?, ?, ?, ?, date('now', '-1 days'), ?, ?)`, 
                            [userId, 250, 'expense', 'qr', 2, 'Lunch', 0]);
                        db.run(`INSERT INTO transactions (user_id, amount, type, method, category_id, date, note, auto) VALUES (?, ?, ?, ?, ?, date('now'), ?, ?)`, 
                            [userId, 120, 'expense', 'cash', 5, 'Auto Fare', 0]);
                            
                        // Seed Coupons
                        db.run(`INSERT INTO coupons (user_id, code, store, discount, expiry_date) VALUES (?, ?, ?, ?, date('now', '+2 days'))`, 
                            [userId, 'SAVE20', 'Target', '20% OFF']);
                            
                        // Seed Bills
                        db.run(`INSERT INTO bills (user_id, title, amount, due_date, status, category_id) VALUES (?, ?, ?, date('now', '+3 days'), 'unpaid', ?)`, 
                            [userId, 'Internet Bill', 800, 4]);
                            
                        // Seed Notification
                        db.run(`INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)`, 
                            [userId, 'welcome', 'Welcome to your Monthly Expense Tracker!']);
                            
                    }, 500);
                }
            );
        }
    });

    db.get('SELECT COUNT(*) as count FROM categories', (err, row) => {
        if (row && row.count === 0) {
            const categories = [
                ['Groceries', '#10b981', '🛒'],       // 1
                ['Dining Out', '#f59e0b', '🍽️'],     // 2
                ['Rent', '#4ECDC4', '🏠'],            // 3
                ['Utilities', '#3b82f6', '⚡'],      // 4
                ['Transport', '#45B7D1', '🚗'],       // 5
                ['Shopping', '#ec4899', '🛍️'],       // 6
                ['Entertainment', '#96CEB4', '🎬'],   // 7
                ['Subscriptions', '#8b5cf6', '📱'],   // 8
                ['Personal Care', '#f43f5e', '💅'],   // 9
                ['Healthcare', '#ef4444', '⚕️'],      // 10
                ['Education', '#eab308', '📚'],       // 11
                ['Miscellaneous', '#64748b', '📦'],   // 12
                ['Earnings', '#27AE60', '💰']         // 13
            ];
            
            categories.forEach(cat => {
                db.run(`INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)`, cat);
            });
        }
    });
}

module.exports = db;
