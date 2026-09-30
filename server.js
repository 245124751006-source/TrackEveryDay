const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_change_me';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

const INDIAN_BUDGET_STATS_BY_NAME = {
    'Groceries': 0.15,
    'Dining Out': 0.05,
    'Rent': 0.30,
    'Utilities': 0.05,
    'Transport': 0.10,
    'Shopping': 0.05,
    'Entertainment': 0.05,
    'Subscriptions': 0.02,
    'Personal Care': 0.03,
    'Healthcare': 0.05,
    'Education': 0.05,
    'Miscellaneous': 0.10
};

function checkBudgetLimits(userId, amount, categoryId, dateStr) {
    const month = dateStr.slice(0, 7); // YYYY-MM
    db.get('SELECT name FROM categories WHERE id = ?', [categoryId], (err, catRow) => {
        if (err || !catRow) return;
        const catNameStr = catRow.name;
        
        db.get(`SELECT SUM(amount) as total_income FROM transactions WHERE user_id = ? AND type = 'income' AND strftime('%Y-%m', date) = ?`, [userId, month], (err, incRow) => {
            if (err) return;
            const totalIncome = incRow?.total_income || 0;
            if (totalIncome <= 0) return;
            
            const limitPercentage = INDIAN_BUDGET_STATS_BY_NAME[catNameStr];
            if (!limitPercentage) return;
        
            const limit = totalIncome * limitPercentage;
            
            db.get(`SELECT SUM(amount) as total_expense, (SELECT name FROM categories WHERE id = ?) as cat_name FROM transactions WHERE user_id = ? AND type = 'expense' AND category_id = ? AND strftime('%Y-%m', date) = ?`, [categoryId, userId, categoryId, month], (err, expRow) => {
                if (err) return;
                const totalExpense = expRow?.total_expense || 0;
                const previousExpense = totalExpense - amount;
                const catName = expRow?.cat_name || 'Category';
                
                let alertMsg = null;
                if (previousExpense <= limit && totalExpense > limit) {
                    alertMsg = `Alert: You have exceeded your ${catName} budget for this month! (Limit: ₹${limit.toFixed(2)})`;
                } else if (previousExpense <= 0.9 * limit && totalExpense > 0.9 * limit) {
                    alertMsg = `Warning: You are approaching your ${catName} budget! (Over 90% of ₹${limit.toFixed(2)})`;
                }
                
                if (alertMsg) {
                    db.run(`INSERT INTO notifications (user_id, type, message) VALUES (?, 'alert', ?)`, [userId, alertMsg]);
                }

                // Automatically route exceeded budget expense into "Piggy Bank" space!
                if (totalExpense > limit) {
                    const excessAmount = Math.min(amount, totalExpense - limit);
                    if (excessAmount > 0) {
                        const title = `Over-Budget: ${catName}`;
                        const note = `Auto-routed extra payment to Piggy Bank: Exceeded ${catName} budget limit of ₹${limit.toFixed(2)} (Spent: ₹${totalExpense.toFixed(2)})`;
                        
                        // Insert into piggybank table so it counts in Piggy Bank and Total Savings (NOT investments!)
                        db.run(
                            `INSERT INTO piggybank (user_id, title, amount, date, note, source) VALUES (?, ?, ?, ?, ?, 'extra_expense')`,
                            [userId, title, excessAmount, dateStr, note],
                            function(insertErr) {
                                if (!insertErr) {
                                    const notif = `🐷 Piggy Bank Extra Payment: ₹${excessAmount.toFixed(2)} exceeded in ${catName} was added to Piggy Bank & Total Savings!`;
                                    db.run(`INSERT INTO notifications (user_id, type, message) VALUES (?, 'savings', ?)`, [userId, notif]);
                                }
                            }
                        );

                        // Also record in savings table for complete historical records
                        db.run(
                            `INSERT INTO savings (user_id, title, amount, type, date, note) VALUES (?, ?, ?, 'extra_payment', ?, ?)`,
                            [userId, title, excessAmount, dateStr, note]
                        );
                    }
                }
            });
        });
    });
}

function syncExistingOverBudgets(userId, callback) {
    const currentMonthStr = new Date().toISOString().slice(0, 7);
    db.get(
        `SELECT SUM(amount) as total_income FROM transactions WHERE user_id = ? AND type = 'income' AND strftime('%Y-%m', date) = ?`,
        [userId, currentMonthStr],
        (err, incRow) => {
            if (err || !incRow || (incRow.total_income || 0) <= 0) {
                return callback ? callback() : null;
            }
            const totalIncome = incRow.total_income;

            db.all(
                `SELECT c.id, c.name, SUM(t.amount) as total_expense 
                 FROM transactions t 
                 JOIN categories c ON t.category_id = c.id 
                 WHERE t.user_id = ? AND t.type = 'expense' AND strftime('%Y-%m', t.date) = ?
                 GROUP BY c.id, c.name`,
                [userId, currentMonthStr],
                (err, rows) => {
                    if (err || !rows || rows.length === 0) {
                        return callback ? callback() : null;
                    }

                    const exceeded = [];
                    rows.forEach(r => {
                        const pct = INDIAN_BUDGET_STATS_BY_NAME[r.name];
                        if (pct) {
                            const limit = totalIncome * pct;
                            if (r.total_expense > limit) {
                                exceeded.push({
                                    id: r.id,
                                    name: r.name,
                                    limit,
                                    totalExpense: r.total_expense,
                                    overspend: r.total_expense - limit
                                });
                            }
                        }
                    });

                    if (exceeded.length === 0) {
                        return callback ? callback() : null;
                    }

                    let pending = exceeded.length;
                    const done = () => {
                        pending--;
                        if (pending <= 0 && callback) callback();
                    };

                    exceeded.forEach(cat => {
                        const titlePattern = `Over-Budget: ${cat.name}`;
                        // Check if recorded in piggybank
                        db.get(
                            `SELECT SUM(amount) as recorded 
                             FROM piggybank 
                             WHERE user_id = ? AND title = ? AND strftime('%Y-%m', date) = ?`,
                            [userId, titlePattern, currentMonthStr],
                            (err, recRow) => {
                                const recordedAmount = recRow?.recorded || 0;
                                const difference = cat.overspend - recordedAmount;

                                if (difference > 0.01) {
                                    const todayStr = new Date().toISOString().split('T')[0];
                                    const note = `Auto-routed extra payment to Piggy Bank: Exceeded ${cat.name} budget limit of ₹${cat.limit.toFixed(2)} (Spent: ₹${cat.totalExpense.toFixed(2)})`;
                                    
                                    db.run(
                                        `INSERT INTO piggybank (user_id, title, amount, date, note, source) VALUES (?, ?, ?, ?, ?, 'extra_expense')`,
                                        [userId, titlePattern, difference, todayStr, note],
                                        () => {
                                            db.run(
                                                `INSERT INTO savings (user_id, title, amount, type, date, note) VALUES (?, ?, ?, 'extra_payment', ?, ?)`,
                                                [userId, titlePattern, difference, todayStr, note],
                                                () => done()
                                            );
                                        }
                                    );
                                } else {
                                    done();
                                }
                            }
                        );
                    });
                }
            );
        }
    );
}

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ status: 'error', message: 'Access denied' });
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ status: 'error', message: 'Invalid token' });
        req.user = user;
        next();
    });
};

// --- AUTH ROUTES ---
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ status: 'error', message: 'All fields required' });
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [name, email, hashedPassword], function(err) {
            if (err) return res.status(400).json({ status: 'error', message: 'Email already exists' });
            res.json({ status: 'success', message: 'User registered successfully' });
        });
    } catch (e) {
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err || !user) return res.status(400).json({ status: 'error', message: 'Invalid email or password' });
        
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return res.status(400).json({ status: 'error', message: 'Invalid email or password' });
        
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ status: 'success', data: { token, user: { id: user.id, name: user.name, email: user.email } } });
    });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
    db.get('SELECT id, name, email FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user) return res.status(404).json({ status: 'error', message: 'User not found' });
        res.json({ status: 'success', data: user });
    });
});

// --- TRANSACTIONS ---
app.get('/api/transactions', authenticateToken, (req, res) => {
    let query = `
        SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon 
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.user_id = ?
        ORDER BY t.date DESC
    `;
    db.all(query, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', data: rows });
    });
});

app.post('/api/transactions', authenticateToken, (req, res) => {
    const { amount, type, method, category_id, note, date } = req.body;
    db.run(`INSERT INTO transactions (user_id, amount, type, method, category_id, note, date, auto) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [req.user.id, amount, type, method, category_id, note, date], function(err) {
            if (err) return res.status(500).json({ status: 'error', message: err.message });
            
            if (type === 'expense') {
                checkBudgetLimits(req.user.id, parseFloat(amount), parseInt(category_id), date);
            }
            
            res.json({ status: 'success', data: { id: this.lastID } });
    });
});

// --- CATEGORIES ---
app.get('/api/categories', authenticateToken, (req, res) => {
    db.all('SELECT * FROM categories', [], (err, rows) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', data: rows });
    });
});

// --- SUMMARY ---
app.get('/api/summary', authenticateToken, (req, res) => {
    const month = req.query.month || new Date().toISOString().slice(0, 7); // YYYY-MM
    db.all(`
        SELECT type, SUM(amount) as total 
        FROM transactions 
        WHERE user_id = ? AND strftime('%Y-%m', date) = ?
        GROUP BY type
    `, [req.user.id, month], (err, totalsRows) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        
        db.all(`
            SELECT c.id, c.name, c.color, SUM(t.amount) as total
            FROM transactions t
            JOIN categories c ON t.category_id = c.id
            WHERE t.user_id = ? AND t.type = 'expense' AND strftime('%Y-%m', t.date) = ?
            GROUP BY c.id
        `, [req.user.id, month], (err, categoryRows) => {
            if (err) return res.status(500).json({ status: 'error', message: err.message });
            
            const totals = { income: 0, expense: 0 };
            totalsRows.forEach(row => { totals[row.type] = row.total; });
            
            db.all('SELECT id, name FROM categories', [], (err, cats) => {
                const categoryBudgets = {};
                const totalInc = totals.income || 0;
                cats.forEach(c => {
                    const pct = INDIAN_BUDGET_STATS_BY_NAME[c.name];
                    if (pct) {
                        categoryBudgets[c.id] = { limit: totalInc * pct, name: c.name };
                    }
                });
                
                res.json({ status: 'success', data: { totals, categoryBreakdown: categoryRows, categoryBudgets } });
            });
        });
    });
});

// --- SIMULATED PAYMENTS ---
app.post('/api/payments/upi/pay', authenticateToken, (req, res) => {
    const { amount, note, category_id } = req.body;
    db.run(`INSERT INTO transactions (user_id, amount, type, method, category_id, note, date, auto) VALUES (?, ?, 'expense', 'upi', ?, ?, date('now'), 1)`,
        [req.user.id, amount, category_id, note], function(err) {
            if (err) return res.status(500).json({ status: 'error', message: err.message });
            
            checkBudgetLimits(req.user.id, parseFloat(amount), parseInt(category_id), new Date().toISOString().split('T')[0]);
            
            res.json({ status: 'success', message: 'UPI payment confirmed', data: { id: this.lastID } });
    });
});

app.post('/api/payments/card/pay', authenticateToken, (req, res) => {
    const { amount, note, category_id } = req.body;
    db.run(`INSERT INTO transactions (user_id, amount, type, method, category_id, note, date, auto) VALUES (?, ?, 'expense', 'card', ?, ?, date('now'), 1)`,
        [req.user.id, amount, category_id, note], function(err) {
            if (err) return res.status(500).json({ status: 'error', message: err.message });
            
            checkBudgetLimits(req.user.id, parseFloat(amount), parseInt(category_id), new Date().toISOString().split('T')[0]);
            
            res.json({ status: 'success', message: 'Card payment complete', data: { id: this.lastID } });
    });
});

// --- COUPONS, BILLS, NOTIFICATIONS, ACCOUNTS (Basic endpoints) ---
app.get('/api/coupons', authenticateToken, (req, res) => {
    db.all('SELECT * FROM coupons WHERE user_id = ?', [req.user.id], (err, rows) => {
        res.json({ status: 'success', data: rows || [] });
    });
});

app.get('/api/bills', authenticateToken, (req, res) => {
    db.all('SELECT * FROM bills WHERE user_id = ?', [req.user.id], (err, rows) => {
        res.json({ status: 'success', data: rows || [] });
    });
});

app.post('/api/bills', authenticateToken, (req, res) => {
    const { title, amount, due_date, recurrence } = req.body;
    db.run(`INSERT INTO bills (user_id, title, amount, due_date, status, recurrence) VALUES (?, ?, ?, ?, 'unpaid', ?)`,
        [req.user.id, title, amount, due_date, recurrence], function(err) {
            if (err) return res.status(500).json({ status: 'error', message: err.message });
            res.json({ status: 'success', message: 'Bill added successfully', data: { id: this.lastID } });
    });
});

app.get('/api/notifications', authenticateToken, (req, res) => {
    db.all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC', [req.user.id], (err, rows) => {
        res.json({ status: 'success', data: rows || [] });
    });
});

app.get('/api/accounts', authenticateToken, (req, res) => {
    db.all('SELECT * FROM accounts WHERE user_id = ?', [req.user.id], (err, rows) => {
        res.json({ status: 'success', data: rows || [] });
    });
});

// --- SAVINGS & MONTH-END ROLLOVERS ---
function autoSweepMonthEndLeftovers(userId, callback) {
    const currentMonthStr = new Date().toISOString().slice(0, 7);
    
    // Find all distinct past months with transactions that have ended
    db.all(
        `SELECT DISTINCT strftime('%Y-%m', date) as month 
         FROM transactions 
         WHERE user_id = ? AND strftime('%Y-%m', date) < ?`,
        [userId, currentMonthStr],
        (err, months) => {
            if (err || !months || months.length === 0) {
                return callback ? callback() : null;
            }

            let pending = months.length;
            const done = () => {
                pending--;
                if (pending <= 0 && callback) callback();
            };

            months.forEach(({ month }) => {
                // Check if already swept for this month
                db.get(
                    `SELECT id FROM savings WHERE user_id = ? AND month_year = ? AND type = 'rollover'`,
                    [userId, month],
                    (err, existing) => {
                        if (err || existing) {
                            return done();
                        }

                        // Calculate income and expense for this month
                        db.get(
                            `SELECT 
                                SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as inc,
                                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as exp
                             FROM transactions 
                             WHERE user_id = ? AND strftime('%Y-%m', date) = ?`,
                            [userId, month],
                            (err, totals) => {
                                if (err || !totals) return done();

                                const leftover = (totals.inc || 0) - (totals.exp || 0);
                                if (leftover > 0) {
                                    const dateObj = new Date(month + '-01');
                                    const monthName = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
                                    
                                    const [y, m] = month.split('-').map(Number);
                                    const lastDay = new Date(y, m, 0).getDate();
                                    const rolloverDate = `${month}-${String(lastDay).padStart(2, '0')}`;
                                    const title = `Month-End Leftover Rollover (${monthName})`;
                                    const note = `Auto-saved unspent income from ${monthName}`;

                                    db.run(
                                        `INSERT INTO savings (user_id, title, amount, type, date, note, month_year) 
                                         VALUES (?, ?, ?, 'rollover', ?, ?, ?)`,
                                        [userId, title, leftover, rolloverDate, note, month],
                                        function(insertErr) {
                                            if (!insertErr) {
                                                const notifMsg = `💰 Month-End Savings: ₹${leftover.toFixed(2)} leftover from ${monthName} was transferred to your Savings!`;
                                                db.run(
                                                    `INSERT INTO notifications (user_id, type, message) VALUES (?, 'savings', ?)`,
                                                    [userId, notifMsg]
                                                );
                                            }
                                            done();
                                        }
                                    );
                                } else {
                                    done();
                                }
                            }
                        );
                    }
                );
            });
        }
    );
}

app.get('/api/savings', authenticateToken, (req, res) => {
    autoSweepMonthEndLeftovers(req.user.id, () => {
        syncExistingOverBudgets(req.user.id, () => {
            db.all(
                `SELECT * FROM savings WHERE user_id = ? ORDER BY date DESC, id DESC`,
                [req.user.id],
                (err, rows) => {
                    if (err) return res.status(500).json({ status: 'error', message: err.message });
                    
                    db.all(
                        `SELECT * FROM investments WHERE user_id = ? ORDER BY date DESC, id DESC`,
                        [req.user.id],
                        (invErr, invRows) => {
                            if (invErr) return res.status(500).json({ status: 'error', message: invErr.message });

                            db.all(
                                `SELECT * FROM piggybank WHERE user_id = ? ORDER BY date DESC, id DESC`,
                                [req.user.id],
                                (piggyErr, piggyRows) => {
                                    if (piggyErr) return res.status(500).json({ status: 'error', message: piggyErr.message });

                                    let rolloverTotal = 0;
                                    let extraPaymentsTotal = 0;
                                    let investmentsTotal = 0;
                                    let piggybankTotal = 0;

                                    (rows || []).forEach(r => {
                                        if (r.type === 'rollover') rolloverTotal += r.amount;
                                        else extraPaymentsTotal += r.amount;
                                    });

                                    (invRows || []).forEach(i => {
                                        investmentsTotal += i.amount;
                                    });

                                    (piggyRows || []).forEach(p => {
                                        piggybankTotal += p.amount;
                                    });

                                    // TOTAL SAVINGS: Rollovers + Investments + Piggy Bank!
                                    const totalSavings = rolloverTotal + investmentsTotal + piggybankTotal;

                                    // Calculate current month's prospective leftover
                                    const currentMonthStr = new Date().toISOString().slice(0, 7);
                                    db.get(
                                        `SELECT 
                                            SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as inc,
                                            SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as exp
                                         FROM transactions 
                                         WHERE user_id = ? AND strftime('%Y-%m', date) = ?`,
                                        [req.user.id, currentMonthStr],
                                        (err, curTotals) => {
                                            const curIncome = curTotals ? (curTotals.inc || 0) : 0;
                                            const curExpense = curTotals ? (curTotals.exp || 0) : 0;
                                            const curLeftover = Math.max(0, curIncome - curExpense);

                                            res.json({
                                                status: 'success',
                                                data: {
                                                    records: rows || [],
                                                    investments: invRows || [],
                                                    piggybank: piggyRows || [],
                                                    stats: {
                                                        totalSavings, // Rollovers + Investments + Piggy Bank
                                                        rolloverTotal,
                                                        investmentsTotal,
                                                        piggybankTotal,
                                                        extraPaymentsTotal, // Red color extra expenses
                                                        currentMonthLeftover: curLeftover
                                                    }
                                                }
                                            });
                                        }
                                    );
                                }
                            );
                        }
                    );
                }
            );
        });
    });
});

// --- INVESTMENTS SPACE 📈 ---
app.get('/api/investments', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM investments WHERE user_id = ? ORDER BY date DESC, id DESC`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        const total = (rows || []).reduce((acc, curr) => acc + curr.amount, 0);
        res.json({ status: 'success', data: { investments: rows || [], total } });
    });
});

app.post('/api/investments', authenticateToken, (req, res) => {
    const { title, amount, asset_type, date, note } = req.body;
    if (!title || !amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ status: 'error', message: 'Valid investment title and amount required' });
    }

    const entryDate = date || new Date().toISOString().split('T')[0];
    const parsedAmount = parseFloat(amount);
    const assetType = asset_type || 'Mutual Funds';

    db.run(
        `INSERT INTO investments (user_id, title, amount, asset_type, date, note) VALUES (?, ?, ?, ?, ?, ?)`,
        [req.user.id, title, parsedAmount, assetType, entryDate, note || 'Investment Asset'],
        function(err) {
            if (err) return res.status(500).json({ status: 'error', message: err.message });

            const notif = `📈 New Investment of ₹${parsedAmount.toFixed(2)} (${title}) added to your portfolio!`;
            db.run(`INSERT INTO notifications (user_id, type, message) VALUES (?, 'savings', ?)`, [req.user.id, notif]);

            res.json({ status: 'success', message: 'Investment added successfully', data: { id: this.lastID } });
        }
    );
});

app.delete('/api/investments/:id', authenticateToken, (req, res) => {
    db.run(
        `DELETE FROM investments WHERE id = ? AND user_id = ?`,
        [req.params.id, req.user.id],
        function(err) {
            if (err) return res.status(500).json({ status: 'error', message: err.message });
            res.json({ status: 'success', message: 'Investment deleted successfully' });
        }
    );
});

// --- PIGGY BANK SPACE 🐷 ---
app.get('/api/piggybank', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM piggybank WHERE user_id = ? ORDER BY date DESC, id DESC`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        const total = (rows || []).reduce((acc, curr) => acc + curr.amount, 0);
        res.json({ status: 'success', data: { piggybank: rows || [], total } });
    });
});

app.post('/api/piggybank', authenticateToken, (req, res) => {
    const { title, amount, date, note } = req.body;
    if (!title || !amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ status: 'error', message: 'Valid title and amount required' });
    }

    const entryDate = date || new Date().toISOString().split('T')[0];
    const parsedAmount = parseFloat(amount);

    db.run(
        `INSERT INTO piggybank (user_id, title, amount, date, note, source) VALUES (?, ?, ?, ?, ?, 'extra_payment')`,
        [req.user.id, title, parsedAmount, entryDate, note || 'Extra Payment to Piggy Bank'],
        function(err) {
            if (err) return res.status(500).json({ status: 'error', message: err.message });

            // Also keep in savings table
            db.run(
                `INSERT INTO savings (user_id, title, amount, type, date, note) VALUES (?, ?, ?, 'extra_payment', ?, ?)`,
                [req.user.id, title, parsedAmount, entryDate, note || 'Extra Payment to Piggy Bank']
            );

            const notif = `🐷 Extra Payment of ₹${parsedAmount.toFixed(2)} (${title}) added to Piggy Bank & Total Savings!`;
            db.run(`INSERT INTO notifications (user_id, type, message) VALUES (?, 'savings', ?)`, [req.user.id, notif]);

            res.json({ status: 'success', message: 'Extra payment added to Piggy Bank', data: { id: this.lastID } });
        }
    );
});

app.delete('/api/piggybank/:id', authenticateToken, (req, res) => {
    db.run(
        `DELETE FROM piggybank WHERE id = ? AND user_id = ?`,
        [req.params.id, req.user.id],
        function(err) {
            if (err) return res.status(500).json({ status: 'error', message: err.message });
            res.json({ status: 'success', message: 'Entry removed from Piggy Bank' });
        }
    );
});

app.post('/api/savings', authenticateToken, (req, res) => {
    const { title, amount, date, note } = req.body;
    if (!title || !amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ status: 'error', message: 'Valid title and amount required' });
    }

    const entryDate = date || new Date().toISOString().split('T')[0];
    const parsedAmount = parseFloat(amount);

    db.run(
        `INSERT INTO savings (user_id, title, amount, type, date, note) VALUES (?, ?, ?, 'extra_payment', ?, ?)`,
        [req.user.id, title, parsedAmount, entryDate, note || 'Extra Payment to Piggy Bank'],
        function(err) {
            if (err) return res.status(500).json({ status: 'error', message: err.message });

            // Automatically add to piggybank space (NOT investments!)
            db.run(
                `INSERT INTO piggybank (user_id, title, amount, date, note, source) VALUES (?, ?, ?, ?, ?, 'extra_payment')`,
                [req.user.id, title, parsedAmount, entryDate, note || 'Extra Payment to Piggy Bank']
            );

            const notif = `🐷 Extra Payment of ₹${parsedAmount.toFixed(2)} (${title}) added to Piggy Bank & Total Savings!`;
            db.run(`INSERT INTO notifications (user_id, type, message) VALUES (?, 'savings', ?)`, [req.user.id, notif]);

            res.json({ status: 'success', message: 'Extra payment added to Piggy Bank and Savings', data: { id: this.lastID } });
        }
    );
});

app.post('/api/savings/sweep', authenticateToken, (req, res) => {
    const targetMonth = req.body.month || new Date().toISOString().slice(0, 7);

    db.get(
        `SELECT id FROM savings WHERE user_id = ? AND month_year = ? AND type = 'rollover'`,
        [req.user.id, targetMonth],
        (err, existing) => {
            if (err) return res.status(500).json({ status: 'error', message: err.message });
            if (existing) {
                return res.status(400).json({ status: 'error', message: `Leftover for ${targetMonth} has already been swept to Savings.` });
            }

            db.get(
                `SELECT 
                    SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as inc,
                    SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as exp
                 FROM transactions 
                 WHERE user_id = ? AND strftime('%Y-%m', date) = ?`,
                [req.user.id, targetMonth],
                (err, totals) => {
                    if (err) return res.status(500).json({ status: 'error', message: err.message });
                    const inc = totals ? totals.inc || 0 : 0;
                    const exp = totals ? totals.exp || 0 : 0;
                    const leftover = inc - exp;

                    if (leftover <= 0) {
                        return res.status(400).json({ 
                            status: 'error', 
                            message: `No positive leftover balance to sweep for ${targetMonth} (Net: ₹${leftover.toFixed(2)}).` 
                        });
                    }

                    const dateObj = new Date(targetMonth + '-01');
                    const monthName = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
                    const todayStr = new Date().toISOString().split('T')[0];
                    const title = `Month-End Leftover Rollover (${monthName})`;
                    const note = `Unspent leftover swept into savings for ${monthName}`;

                    db.run(
                        `INSERT INTO savings (user_id, title, amount, type, date, note, month_year) 
                         VALUES (?, ?, ?, 'rollover', ?, ?, ?)`,
                        [req.user.id, title, leftover, todayStr, note, targetMonth],
                        function(insErr) {
                            if (insErr) return res.status(500).json({ status: 'error', message: insErr.message });

                            const notif = `💰 Month-End Savings: ₹${leftover.toFixed(2)} leftover from ${monthName} was transferred to Savings!`;
                            db.run(`INSERT INTO notifications (user_id, type, message) VALUES (?, 'savings', ?)`, [req.user.id, notif]);

                            res.json({
                                status: 'success',
                                message: `Successfully swept ₹${leftover.toFixed(2)} leftover into Savings!`,
                                data: { id: this.lastID, amount: leftover }
                            });
                        }
                    );
                }
            );
        }
    );
});

app.delete('/api/savings/:id', authenticateToken, (req, res) => {
    db.run(
        `DELETE FROM savings WHERE id = ? AND user_id = ?`,
        [req.params.id, req.user.id],
        function(err) {
            if (err) return res.status(500).json({ status: 'error', message: err.message });
            res.json({ status: 'success', message: 'Savings entry removed' });
        }
    );
});

// Serve frontend for all other routes
app.use((req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ status: 'error', message: `API route ${req.method} ${req.path} not found` });
    }
    const publicIndex = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(publicIndex)) {
        return res.sendFile(publicIndex);
    }
    const rootIndex = path.join(__dirname, 'index.html');
    if (fs.existsSync(rootIndex)) {
        return res.sendFile(rootIndex);
    }
    res.status(404).send('Page Not Found');
});

if (require.main === module || !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
