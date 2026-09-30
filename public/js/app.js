const API_URL = 'http://localhost:3000/api';
let token = localStorage.getItem('token');
let user = JSON.parse(localStorage.getItem('user'));
let chartInstance = null;
let allTransactions = [];

// --- DOM Elements ---
const viewHome = document.getElementById('view-home');
const viewLogin = document.getElementById('view-login');
const viewSignup = document.getElementById('view-signup');
const viewDashboard = document.getElementById('view-dashboard');
const navBeginJourney = document.getElementById('nav-begin-journey');
const heroBeginJourney = document.getElementById('hero-begin-journey');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const logoutBtn = document.getElementById('logout-btn');
const userNameEl = document.getElementById('user-name');
const showSignupBtn = document.getElementById('show-signup');
const showLoginBtn = document.getElementById('show-login');

// Navigation & Modals
const addExpenseBtn = document.getElementById('add-expense-btn');
const modalAddExpense = document.getElementById('modal-add-expense');
const filterDateEl = document.getElementById('filter-date');
const navLinks = document.querySelectorAll('.nav-links a');
const modalPayments = document.getElementById('modal-payments');
const closeModals = document.querySelectorAll('.close-modal');
const modalAddBill = document.getElementById('modal-add-bill');
const addBillBtn = document.getElementById('add-bill-btn');

// Forms
const addExpenseForm = document.getElementById('add-expense-form');
const addBillForm = document.getElementById('add-bill-form');
const simUpiBtn = document.getElementById('sim-upi-btn');
const simCardBtn = document.getElementById('sim-card-btn');

// Savings, Investment & Piggy Bank Elements 💰 📈 🐷
const modalAddSavings = document.getElementById('modal-add-savings');
const addSavingsBtn = document.getElementById('add-savings-btn');
const sweepLeftoverBtn = document.getElementById('sweep-leftover-btn');
const addSavingsForm = document.getElementById('add-savings-form');
const modalAddInvestment = document.getElementById('modal-add-investment');
const addInvestmentBtn = document.getElementById('add-investment-btn');
const addInvestmentForm = document.getElementById('add-investment-form');
const modalAddPiggybank = document.getElementById('modal-add-piggybank');
const addPiggybankBtn = document.getElementById('add-piggybank-btn');
const addPiggybankForm = document.getElementById('add-piggybank-form');
let allSavingsData = null;
let currentSavingsFilter = 'all';

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    if (token) {
        showDashboard();
    } else {
        showHome();
    }
    if (filterDateEl) {
        filterDateEl.addEventListener('change', () => {
            renderTransactions(allTransactions);
        });
    }
});

// --- Auth ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        
        if (data.status === 'success') {
            token = data.data.token;
            user = data.data.user;
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            showToast('Logged in successfully');
            showDashboard();
        } else {
            showToast(data.message, 'danger');
        }
    } catch (err) {
        showToast('Login failed', 'danger');
    }
});

signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        
        if (data.status === 'success') {
            showToast('Registered successfully! Please log in.');
            showLogin();
        } else {
            showToast(data.message, 'danger');
        }
    } catch (err) {
        showToast('Registration failed', 'danger');
    }
});
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    token = null;
    user = null;
    showLogin();
});

// --- View Logic ---
function showHome() {
    viewHome.classList.remove('hidden');
    viewLogin.classList.add('hidden');
    if (viewSignup) viewSignup.classList.add('hidden');
    viewDashboard.classList.add('hidden');
}

function showLogin() {
    viewLogin.classList.remove('hidden');
    if (viewHome) viewHome.classList.add('hidden');
    if (viewSignup) viewSignup.classList.add('hidden');
    viewDashboard.classList.add('hidden');
}

function showSignup() {
    viewSignup.classList.remove('hidden');
    viewLogin.classList.add('hidden');
    if (viewHome) viewHome.classList.add('hidden');
    viewDashboard.classList.add('hidden');
}

showSignupBtn.addEventListener('click', (e) => {
    e.preventDefault();
    showSignup();
});

showLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    showLogin();
});

function showDashboard() {
    viewLogin.classList.add('hidden');
    if (viewHome) viewHome.classList.add('hidden');
    if (viewSignup) viewSignup.classList.add('hidden');
    viewDashboard.classList.remove('hidden');
    userNameEl.textContent = user.name;
    loadDashboardData();
}

if (navBeginJourney) navBeginJourney.addEventListener('click', showLogin);
if (heroBeginJourney) heroBeginJourney.addEventListener('click', showLogin);

// --- Navigation & Modals ---
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        
        const target = e.target.getAttribute('data-target');
        
        if (target === 'payments') {
            loadCategoriesForSelect('upi-category');
            loadCategoriesForSelect('card-category');
            openModal(modalPayments);
            // We do not change active tab or section view when opening the payment modal
            return;
        }

        // Change active link styling
        navLinks.forEach(l => l.classList.remove('active'));
        e.target.classList.add('active');
        
        // Hide all sections first
        const sections = document.querySelectorAll('.grid-layout > section');
        sections.forEach(sec => sec.classList.add('hidden'));

        // Show sections matching the target
        const targetSections = document.querySelectorAll(`.grid-layout > section[data-section="${target}"]`);
        targetSections.forEach(sec => sec.classList.remove('hidden'));
    });
});

addExpenseBtn.addEventListener('click', () => {
    loadCategoriesForSelect();
    openModal(modalAddExpense);
});

if (addBillBtn) {
    addBillBtn.addEventListener('click', () => {
        openModal(modalAddBill);
    });
}

closeModals.forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.target.closest('.modal').classList.add('hidden');
    });
});

function openModal(modal) {
    modal.classList.remove('hidden');
}

// Tabs in Payment Modal
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        document.getElementById(`tab-${e.target.getAttribute('data-tab')}`).classList.remove('hidden');
    });
});

// --- Data Fetching ---
async function fetchAPI(endpoint, options = {}) {
    options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
    const res = await fetch(`${API_URL}${endpoint}`, options);
    if (res.status === 401 || res.status === 403) {
        logoutBtn.click();
        throw new Error('Unauthorized');
    }
    return res.json();
}

async function loadDashboardData() {
    try {
        const [summary, transactions, bills, notifications, savings] = await Promise.all([
            fetchAPI('/summary'),
            fetchAPI('/transactions'),
            fetchAPI('/bills'),
            fetchAPI('/notifications'),
            fetchAPI('/savings').catch(() => null)
        ]);

        allTransactions = transactions.data;

        renderSummary(summary.data);
        renderBudgets(summary.data);
        renderTransactions(allTransactions);
        if (typeof renderBills === 'function') renderBills(bills.data);
        if (typeof renderSavings === 'function' && savings) renderSavings(savings.data);
        
        const budgetAlerts = [];
        const breakdownMap = {};
        summary.data.categoryBreakdown.forEach(c => { breakdownMap[c.id] = c; });
        for (const [catId, budgetInfo] of Object.entries(summary.data.categoryBudgets)) {
            if (budgetInfo.limit > 0) {
                const spentInfo = breakdownMap[catId];
                const spent = spentInfo ? spentInfo.total : 0;
                const pct = (spent / budgetInfo.limit) * 100;
                if (pct > 60) {
                    budgetAlerts.push({
                        type: pct >= 100 ? 'danger' : 'warning',
                        message: `Budget Alert: ${Math.round(pct)}% used in ${budgetInfo.name}`
                    });
                }
            }
        }
        
        // Notify the user via toast for new alerts
        if (!window.notifiedAlerts) window.notifiedAlerts = new Set();
        budgetAlerts.forEach(alert => {
            if (!window.notifiedAlerts.has(alert.message)) {
                showToast(alert.message, alert.type);
                window.notifiedAlerts.add(alert.message);
            }
        });

        renderAlerts(bills.data, notifications.data, budgetAlerts);
        renderChart(summary.data.categoryBreakdown);
        
    } catch (err) {
        console.error(err);
    }
}

async function loadCategoriesForSelect(selectId = 'exp-category') {
    const res = await fetchAPI('/categories');
    const select = document.getElementById(selectId);
    if(select) {
        select.innerHTML = res.data.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
    }
}

// --- Rendering ---
function renderSummary(data) {
    const expense = data.totals.expense || 0;
    const income = data.totals.income || 0;
    const balance = income - expense;

    const spendEl = document.getElementById('total-spend');
    const incomeEl = document.getElementById('total-income');
    const balanceEl = document.getElementById('total-balance');

    if (window.animateCounter) {
        animateCounter(spendEl, expense, { prefix: '₹', decimals: 2, duration: 0.6, grouping: 'indian' });
        animateCounter(incomeEl, income, { prefix: '₹', decimals: 2, duration: 0.6, grouping: 'indian' });
        animateCounter(balanceEl, balance, { prefix: '₹', decimals: 2, duration: 0.6, grouping: 'indian' });
    } else {
        spendEl.textContent = `₹${expense.toFixed(2)}`;
        incomeEl.textContent = `₹${income.toFixed(2)}`;
        balanceEl.textContent = `₹${balance.toFixed(2)}`;
    }
    if (balance < 0) {
        balanceEl.classList.add('negative');
        balanceEl.classList.remove('positive');
    } else {
        balanceEl.classList.add('positive');
        balanceEl.classList.remove('negative');
    }
}

function renderBudgets(summaryData) {
    const list = document.getElementById('budget-list');
    const { categoryBreakdown, categoryBudgets } = summaryData;
    
    let html = '';
    const breakdownMap = {};
    categoryBreakdown.forEach(c => { breakdownMap[c.id] = c; });
    
    for (const [catId, budgetInfo] of Object.entries(categoryBudgets)) {
        const limit = budgetInfo.limit;
        if (limit > 0) {
            const spentInfo = breakdownMap[catId];
            const spent = spentInfo ? spentInfo.total : 0;
            const pct = Math.min((spent / limit) * 100, 100);
            const color = spentInfo ? spentInfo.color : '#cbd5e1';
            const catName = budgetInfo.name;
            
            let barColor = color;
            if (pct >= 100) barColor = 'var(--danger)';
            else if (pct >= 90) barColor = '#f59e0b';
            
            html += `
                <div class="budget-item">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.3rem; font-size: 0.85rem;">
                        <strong>${catName}</strong>
                        <span>₹${spent.toFixed(2)} / ₹${limit.toFixed(2)} (${Math.round(pct)}%)</span>
                    </div>
                    <div style="width: 100%; background: rgba(0,0,0,0.08); height: 8px; border-radius: 4px; overflow: hidden;">
                        <div style="width: ${pct}%; background: ${barColor}; height: 100%; transition: width 0.3s ease;"></div>
                    </div>
                </div>
            `;
        }
    }
    
    if (!html) {
        html = '<p class="text-muted text-center" style="font-size:0.9rem;">Add some income to see your personalized budget limits!</p>';
    }
    
    if(list) list.innerHTML = html;
}

function renderTransactions(transactions) {
    const list = document.getElementById('transaction-list');
    const filterDate = document.getElementById('filter-date')?.value;
    
    let filteredTxs = transactions;
    if (filterDate) {
        filteredTxs = transactions.filter(tx => {
            const txDate = new Date(tx.date).toISOString().split('T')[0];
            return txDate === filterDate;
        });
    }
    
    // Group by date
    const groups = {};
    filteredTxs.forEach(tx => {
        const d = new Date(tx.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        if (!groups[d]) groups[d] = { txs: [], totalExpense: 0 };
        groups[d].txs.push(tx);
        if (tx.type === 'expense') {
            groups[d].totalExpense += tx.amount;
        }
    });

    let html = '';
    for (const [date, group] of Object.entries(groups)) {
        html += `
            <div class="date-group" style="margin-bottom: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 0.4rem;">
                    <h4 style="color: var(--text-main); font-size: 0.95rem; margin: 0;">${date}</h4>
                    <span style="font-size: 0.85rem; font-weight: 600; color: var(--danger);">Total Expense: ₹${group.totalExpense.toFixed(2)}</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.8rem;">
                    ${group.txs.map(tx => `
                        <div class="transaction-item" style="margin-bottom: 0;">
                            <div class="tx-left">
                                <div class="tx-icon" style="background: ${tx.category_color}33;">${tx.category_icon || '💳'}</div>
                                <div class="tx-details">
                                    <h4>${tx.category_name || 'Transaction'} ${tx.auto ? '<span style="font-size: 0.7em; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; margin-left: 5px;">Auto</span>' : ''}</h4>
                                    <p>${tx.method.toUpperCase()} ${tx.note ? `• ${tx.note}` : ''}</p>
                                </div>
                            </div>
                            <div class="tx-amount ${tx.type}">${tx.type === 'expense' ? '-' : '+'}₹${tx.amount.toFixed(2)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    if (Object.keys(groups).length === 0) {
        html = '<p class="text-muted text-center" style="margin-top:1rem; font-size:0.9rem;">No transactions found.</p>';
    }

    list.innerHTML = html;
}

function renderAlerts(bills, notifications, budgetAlerts = []) {
    const list = document.getElementById('alerts-list');
    let html = '';
    
    // Check upcoming bills
    bills.forEach(bill => {
        if (bill.status === 'unpaid') {
            const daysToDue = Math.ceil((new Date(bill.due_date) - new Date()) / (1000 * 60 * 60 * 24));
            if (daysToDue <= 3 && daysToDue >= 0) {
                html += `<div class="alert-item warning">Bill due soon: ${bill.title} (₹${bill.amount}) in ${daysToDue} days.</div>`;
            } else if (daysToDue < 0) {
                html += `<div class="alert-item danger">Overdue bill: ${bill.title} (₹${bill.amount}).</div>`;
            }
        }
    });

    budgetAlerts.forEach(alert => {
        html += `<div class="alert-item ${alert.type}">${alert.message}</div>`;
    });

    notifications.slice(0, 3).forEach(notif => {
        html += `<div class="alert-item success">${notif.message}</div>`;
    });

    if(!html) html = '<p class="text-muted text-center" style="margin-top:1rem; font-size:0.9rem;">No new alerts.</p>';
    list.innerHTML = html;
}

function renderBills(bills) {
    const list = document.getElementById('bills-list');
    if (!list) return;
    let html = '';
    
    bills.forEach(bill => {
        const daysToDue = Math.ceil((new Date(bill.due_date) - new Date()) / (1000 * 60 * 60 * 24));
        let statusColor = '#cbd5e1';
        let statusText = 'Upcoming';
        if (daysToDue < 0) { statusColor = 'var(--danger)'; statusText = 'Overdue'; }
        else if (daysToDue <= 3) { statusColor = '#f59e0b'; statusText = 'Due Soon'; }
        
        html += `
            <div class="transaction-item" style="border-left: 4px solid ${statusColor};">
                <div class="tx-left">
                    <div class="tx-icon" style="border-radius: 8px;">🗓️</div>
                    <div class="tx-details">
                        <h4>${bill.title} <span style="font-size: 0.7em; background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px; margin-left: 5px;">${bill.recurrence}</span></h4>
                        <p>Due: ${bill.due_date} (${statusText})</p>
                    </div>
                </div>
                <div class="tx-amount expense">₹${bill.amount.toFixed(2)}</div>
            </div>
        `;
    });

    if(!html) html = '<p class="text-muted text-center" style="margin-top:1rem; font-size:0.9rem;">No active subscriptions found.</p>';
    list.innerHTML = html;
}

// --- Savings & Leftovers Vault Rendering 💰 ---
function renderSavings(data) {
    if (!data) return;
    allSavingsData = data;
    const { records = [], investments = [], piggybank = [], stats = {} } = data;

    const totalSavingsEl = document.getElementById('total-savings');
    const piggybankSavingsEl = document.getElementById('piggybank-savings');
    const investmentSavingsEl = document.getElementById('investment-savings');
    const rolloverSavingsEl = document.getElementById('rollover-savings');
    const extraSavingsEl = document.getElementById('extra-savings');
    const pendingLeftoverEl = document.getElementById('pending-leftover');

    // Total Savings = Rollovers + Investments + Piggy Bank!
    const totalSavingsVal = stats.totalSavings || 0;
    const piggybankVal = stats.piggybankTotal || 0;
    const investmentVal = stats.investmentsTotal || 0;
    const rolloverVal = stats.rolloverTotal || 0;
    const extraVal = stats.extraPaymentsTotal || 0;
    const curLeftoverVal = stats.currentMonthLeftover || 0;

    if (window.animateCounter) {
        if (totalSavingsEl) animateCounter(totalSavingsEl, totalSavingsVal, { prefix: '₹', decimals: 2, duration: 0.6, grouping: 'indian' });
        if (piggybankSavingsEl) animateCounter(piggybankSavingsEl, piggybankVal, { prefix: '₹', decimals: 2, duration: 0.6, grouping: 'indian' });
        if (investmentSavingsEl) animateCounter(investmentSavingsEl, investmentVal, { prefix: '₹', decimals: 2, duration: 0.6, grouping: 'indian' });
        if (rolloverSavingsEl) animateCounter(rolloverSavingsEl, rolloverVal, { prefix: '₹', decimals: 2, duration: 0.6, grouping: 'indian' });
        if (extraSavingsEl) animateCounter(extraSavingsEl, extraVal, { prefix: '₹', decimals: 2, duration: 0.6, grouping: 'indian' });
        if (pendingLeftoverEl) animateCounter(pendingLeftoverEl, curLeftoverVal, { prefix: '₹', decimals: 2, duration: 0.6, grouping: 'indian' });
    } else {
        if (totalSavingsEl) totalSavingsEl.textContent = `₹${totalSavingsVal.toFixed(2)}`;
        if (piggybankSavingsEl) piggybankSavingsEl.textContent = `₹${piggybankVal.toFixed(2)}`;
        if (investmentSavingsEl) investmentSavingsEl.textContent = `₹${investmentVal.toFixed(2)}`;
        if (rolloverSavingsEl) rolloverSavingsEl.textContent = `₹${rolloverVal.toFixed(2)}`;
        if (extraSavingsEl) extraSavingsEl.textContent = `₹${extraVal.toFixed(2)}`;
        if (pendingLeftoverEl) pendingLeftoverEl.textContent = `₹${curLeftoverVal.toFixed(2)}`;
    }

    renderSavingsList(records, investments, piggybank);
}

function renderSavingsList(records = [], investments = [], piggybank = []) {
    const listEl = document.getElementById('savings-list');
    const countEl = document.getElementById('savings-record-count');
    if (!listEl) return;

    // Normalize investments into displayable items
    const invItems = (investments || []).map(inv => ({
        ...inv,
        isInvestment: true,
        type: 'investment'
    }));

    // Normalize piggybank items
    const piggyItems = (piggybank || []).map(p => ({
        ...p,
        isPiggybank: true,
        type: 'piggybank',
        isOverBudget: p.source === 'extra_expense' || (p.title && p.title.includes('Over-Budget'))
    }));

    // Rollover items from savings
    const rolloverItems = (records || []).filter(r => r.type === 'rollover');

    let allItems = [];
    if (currentSavingsFilter === 'all') {
        allItems = [...rolloverItems, ...invItems, ...piggyItems].sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (currentSavingsFilter === 'piggybank') {
        allItems = piggyItems.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (currentSavingsFilter === 'investment') {
        allItems = invItems.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (currentSavingsFilter === 'rollover') {
        allItems = rolloverItems.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (currentSavingsFilter === 'extra_payment') {
        // Red color extra expenses (over-budget & extra payment allocations)
        allItems = piggyItems.filter(p => p.isOverBudget || p.source === 'extra_expense' || p.source === 'extra_payment')
                             .sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    if (countEl) countEl.textContent = `${allItems.length} record${allItems.length === 1 ? '' : 's'}`;

    if (allItems.length === 0) {
        let emptyIcon = '💰';
        let emptyMsg = 'No records found in this view';
        if (currentSavingsFilter === 'investment') {
            emptyIcon = '📈';
            emptyMsg = 'No investments added yet';
        } else if (currentSavingsFilter === 'piggybank') {
            emptyIcon = '🐷';
            emptyMsg = 'Piggy Bank is currently empty';
        } else if (currentSavingsFilter === 'extra_payment') {
            emptyIcon = '⚠️';
            emptyMsg = 'No extra expenses recorded';
        }

        listEl.innerHTML = `
            <div style="text-align: center; padding: 2.5rem 1rem; color: #94a3b8;">
                <p style="font-size: 2.5rem; margin: 0 0 0.5rem 0;">${emptyIcon}</p>
                <p style="margin: 0; font-size: 1rem; font-weight: 500; color: var(--text-main);">
                    ${emptyMsg}
                </p>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.35rem; max-width: 440px; margin-left: auto; margin-right: auto;">
                    ${currentSavingsFilter === 'piggybank' 
                        ? 'Extra payments and over-budget expense allocations are automatically saved into your Piggy Bank 🐷!'
                        : (currentSavingsFilter === 'investment' 
                            ? 'Click "+ Add Investment 📈" to record your SIP, Mutual Funds, Stocks, or Gold assets into Total Savings!' 
                            : 'Unspent income rollovers, investments, and piggy bank deposits count directly towards your Total Savings!')}
                </p>
            </div>
        `;
        return;
    }

    listEl.innerHTML = allItems.map(item => {
        // 1. INVESTMENTS 📈
        if (item.isInvestment) {
            let invIcon = '📈';
            if (item.asset_type === 'Stocks') invIcon = '📊';
            else if (item.asset_type === 'Fixed Deposit') invIcon = '🏛️';
            else if (item.asset_type === 'Gold') invIcon = '🪙';
            else if (item.asset_type === 'Real Estate') invIcon = '🏠';
            else if (item.asset_type === 'Crypto') invIcon = '🚀';

            return `
                <div class="transaction-item" style="border-left: 4px solid #6366f1;">
                    <div class="tx-left">
                        <div class="tx-icon" style="font-size: 1.4rem;">${invIcon}</div>
                        <div class="tx-details">
                            <h4>
                                ${item.title}
                                <span class="savings-badge" style="background: rgba(99, 102, 241, 0.12); color: #6366f1; border: 1px solid rgba(99, 102, 241, 0.25); margin-left: 8px;">
                                    ${item.asset_type || 'Investment'} 📈
                                </span>
                            </h4>
                            <p>${item.date} ${item.note ? `• ${item.note}` : ''}</p>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <div class="tx-amount" style="color: #6366f1; font-weight: 600;">+₹${item.amount.toFixed(2)}</div>
                        <button class="delete-investment-btn" data-id="${item.id}" title="Remove investment">🗑️</button>
                    </div>
                </div>
            `;
        }

        // 2. PIGGY BANK / EXTRA EXPENSES 🐷 ⚠️
        if (item.isPiggybank) {
            if (item.isOverBudget) {
                // RED COLOR FOR EXTRA EXPENSES AS REQUESTED!
                return `
                    <div class="transaction-item" style="border-left: 4px solid #ef4444; background: rgba(239, 68, 68, 0.03);">
                        <div class="tx-left">
                            <div class="tx-icon" style="font-size: 1.4rem; background: rgba(239, 68, 68, 0.1); border-radius: 8px; padding: 4px;">⚠️</div>
                            <div class="tx-details">
                                <h4 style="color: #ef4444; font-weight: 600;">
                                    ${item.title}
                                    <span class="savings-badge" style="background: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); margin-left: 8px;">
                                        Extra Expense ⚠️
                                    </span>
                                    <span class="savings-badge" style="background: rgba(236, 72, 153, 0.12); color: #ec4899; border: 1px solid rgba(236, 72, 153, 0.25); margin-left: 5px;">
                                        In Piggy Bank 🐷
                                    </span>
                                </h4>
                                <p style="color: #64748b;">${item.date} ${item.note ? `• ${item.note}` : ''}</p>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <div class="tx-amount" style="color: #ef4444; font-weight: 700;">+₹${item.amount.toFixed(2)}</div>
                            <button class="delete-piggybank-btn" data-id="${item.id}" title="Delete extra payment from Piggy Bank">🗑️</button>
                        </div>
                    </div>
                `;
            } else {
                // Regular Piggy Bank extra payment deposit
                return `
                    <div class="transaction-item" style="border-left: 4px solid #ec4899;">
                        <div class="tx-left">
                            <div class="tx-icon" style="font-size: 1.4rem;">🐷</div>
                            <div class="tx-details">
                                <h4>
                                    ${item.title}
                                    <span class="savings-badge" style="background: rgba(236, 72, 153, 0.12); color: #ec4899; border: 1px solid rgba(236, 72, 153, 0.25); margin-left: 8px;">
                                        Piggy Bank 🐷
                                    </span>
                                </h4>
                                <p>${item.date} ${item.note ? `• ${item.note}` : ''}</p>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <div class="tx-amount" style="color: #ec4899; font-weight: 600;">+₹${item.amount.toFixed(2)}</div>
                            <button class="delete-piggybank-btn" data-id="${item.id}" title="Delete entry from Piggy Bank">🗑️</button>
                        </div>
                    </div>
                `;
            }
        }

        // 3. MONTH-END ROLLOVERS 🏦
        const isRollover = item.type === 'rollover';
        const icon = isRollover ? '🏦' : '💵';
        const badgeLabel = isRollover ? 'Month-End Rollover 🏦' : 'Extra Deposit 💵';
        const amountColor = isRollover ? '#10b981' : '#3b82f6';

        return `
            <div class="transaction-item" style="border-left: 4px solid ${amountColor};">
                <div class="tx-left">
                    <div class="tx-icon" style="font-size: 1.4rem;">${icon}</div>
                    <div class="tx-details">
                        <h4>
                            ${item.title}
                            <span class="savings-badge ${isRollover ? 'rollover' : 'extra'}" style="margin-left: 8px;">${badgeLabel}</span>
                        </h4>
                        <p>${item.date} ${item.note ? `• ${item.note}` : ''}</p>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div class="tx-amount" style="color: ${amountColor}; font-weight: 600;">+₹${item.amount.toFixed(2)}</div>
                    ${!isRollover ? `<button class="delete-savings-btn" data-id="${item.id}" title="Delete extra payment">🗑️</button>` : ''}
                </div>
            </div>
        `;
    }).join('');

    // Attach delete listeners for investments
    listEl.querySelectorAll('.delete-investment-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            if (confirm('Are you sure you want to remove this investment?')) {
                try {
                    await fetchAPI(`/investments/${id}`, { method: 'DELETE' });
                    showToast('Investment removed', 'success');
                    loadDashboardData();
                } catch (err) {
                    showToast('Error removing investment', 'danger');
                }
            }
        });
    });

    // Attach delete listeners for piggy bank
    listEl.querySelectorAll('.delete-piggybank-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            if (confirm('Are you sure you want to remove this extra payment from Piggy Bank?')) {
                try {
                    await fetchAPI(`/piggybank/${id}`, { method: 'DELETE' });
                    showToast('Removed from Piggy Bank', 'success');
                    loadDashboardData();
                } catch (err) {
                    showToast('Error removing from Piggy Bank', 'danger');
                }
            }
        });
    });

    // Attach delete listeners for extra payments
    listEl.querySelectorAll('.delete-savings-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            if (confirm('Are you sure you want to remove this extra payment from savings?')) {
                try {
                    await fetchAPI(`/savings/${id}`, { method: 'DELETE' });
                    showToast('Extra payment removed from Savings', 'success');
                    loadDashboardData();
                } catch (err) {
                    showToast('Error removing payment', 'danger');
                }
            }
        });
    });
}

function renderChart(categoryBreakdown) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: categoryBreakdown.map(c => c.name),
            datasets: [{
                data: categoryBreakdown.map(c => c.total),
                backgroundColor: categoryBreakdown.map(c => c.color),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'right', labels: { usePointStyle: true, font: { family: 'Inter' } } }
            }
        }
    });
}

// --- Actions ---
addExpenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('exp-type').value;
    const amount = document.getElementById('exp-amount').value;
    const category_id = document.getElementById('exp-category').value;
    const date = document.getElementById('exp-date').value;
    const note = document.getElementById('exp-note').value;

    try {
        await fetchAPI('/transactions', {
            method: 'POST',
            body: JSON.stringify({ amount, type, method: 'cash', category_id, date, note })
        });
        modalAddExpense.classList.add('hidden');
        showToast('Transaction added successfully');
        loadDashboardData();
        addExpenseForm.reset();
    } catch (err) {
        showToast('Error adding transaction', 'danger');
    }
});

if (addBillForm) {
    addBillForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('bill-title').value;
        const amount = document.getElementById('bill-amount').value;
        const due_date = document.getElementById('bill-due-date').value;
        const recurrence = document.getElementById('bill-recurrence').value;

        try {
            await fetchAPI('/bills', {
                method: 'POST',
                body: JSON.stringify({ title, amount, due_date, recurrence })
            });
            modalAddBill.classList.add('hidden');
            showToast('Subscription added successfully');
            loadDashboardData();
            addBillForm.reset();
        } catch (err) {
            showToast('Error adding subscription', 'danger');
        }
    });
}

simUpiBtn.addEventListener('click', async () => {
    const upiId = document.getElementById('upi-id').value;
    const amount = document.getElementById('upi-amount').value;
    const category_id = document.getElementById('upi-category').value;
    
    if (!upiId || !amount || !category_id) {
        showToast('Please enter UPI ID, Amount and select Category', 'danger');
        return;
    }

    try {
        await fetchAPI('/payments/upi/pay', {
            method: 'POST',
            body: JSON.stringify({ amount, category_id, note: `UPI Payment to ${upiId}` })
        });
        modalPayments.classList.add('hidden');
        showToast('UPI Payment synced automatically!', 'success');
        loadDashboardData();
    } catch (err) {
        showToast('Error syncing payment', 'danger');
    }
});

simCardBtn.addEventListener('click', async () => {
    const cardNumber = document.getElementById('card-number').value;
    const expiry = document.getElementById('card-expiry').value;
    const cvv = document.getElementById('card-cvv').value;
    const amount = document.getElementById('card-amount').value;
    const category_id = document.getElementById('card-category').value;

    if (!cardNumber || !expiry || !cvv || !amount || !category_id) {
        showToast('Please fill all card details, amount and select Category', 'danger');
        return;
    }

    try {
        await fetchAPI('/payments/card/pay', { 
            method: 'POST',
            body: JSON.stringify({ amount, category_id, note: `Card Payment ending in ${cardNumber.slice(-4) || cardNumber}` })
        });
        modalPayments.classList.add('hidden');
        showToast('Card payment complete!', 'success');
        loadDashboardData();
    } catch (err) {
        showToast('Error syncing card', 'danger');
    }
});

// --- Savings Event Listeners 💰 ---
if (addSavingsBtn && modalAddSavings) {
    addSavingsBtn.addEventListener('click', () => {
        const dateInput = document.getElementById('savings-date');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
        openModal(modalAddSavings);
    });
}

if (addSavingsForm) {
    addSavingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('savings-title').value;
        const amount = document.getElementById('savings-amount').value;
        const date = document.getElementById('savings-date').value;
        const note = document.getElementById('savings-note').value;

        try {
            await fetchAPI('/savings', {
                method: 'POST',
                body: JSON.stringify({ title, amount, date, note })
            });
            modalAddSavings.classList.add('hidden');
            showToast('💵 Extra payment deposited into Savings!', 'success');
            addSavingsForm.reset();
            loadDashboardData();
        } catch (err) {
            showToast(err.message || 'Error depositing to savings', 'danger');
        }
    });
}

if (sweepLeftoverBtn) {
    sweepLeftoverBtn.addEventListener('click', async () => {
        try {
            const res = await fetchAPI('/savings/sweep', {
                method: 'POST',
                body: JSON.stringify({})
            });
            showToast(res.message || '💰 Leftover swept into Savings!', 'success');
            loadDashboardData();
        } catch (err) {
            showToast(err.message || 'Unable to sweep leftover', 'danger');
        }
    });
}

// Investment Event Listeners 📈
if (addInvestmentBtn && modalAddInvestment) {
    addInvestmentBtn.addEventListener('click', () => {
        const dateInput = document.getElementById('inv-date');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
        openModal(modalAddInvestment);
    });
}

if (addInvestmentForm) {
    addInvestmentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('inv-title').value;
        const asset_type = document.getElementById('inv-asset-type').value;
        const amount = document.getElementById('inv-amount').value;
        const date = document.getElementById('inv-date').value;
        const note = document.getElementById('inv-note').value;

        try {
            await fetchAPI('/investments', {
                method: 'POST',
                body: JSON.stringify({ title, asset_type, amount, date, note })
            });
            modalAddInvestment.classList.add('hidden');
            showToast('📈 Investment added to Savings portfolio!', 'success');
            addInvestmentForm.reset();
            loadDashboardData();
        } catch (err) {
            showToast(err.message || 'Error adding investment', 'danger');
        }
    });
}

// Savings Filter Buttons
const savingsFilterGroup = document.getElementById('savings-filter-group');
if (savingsFilterGroup) {
    savingsFilterGroup.querySelectorAll('.savings-filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            savingsFilterGroup.querySelectorAll('.savings-filter-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            currentSavingsFilter = e.currentTarget.getAttribute('data-filter');
            if (allSavingsData) renderSavingsList(allSavingsData.records || [], allSavingsData.investments || [], allSavingsData.piggybank || []);
        });
    });
}

// Piggy Bank Event Listeners 🐷
if (addPiggybankBtn && modalAddPiggybank) {
    addPiggybankBtn.addEventListener('click', () => {
        const dateInput = document.getElementById('piggy-date');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
        openModal(modalAddPiggybank);
    });
}

if (addPiggybankForm) {
    addPiggybankForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('piggy-title').value;
        const amount = document.getElementById('piggy-amount').value;
        const date = document.getElementById('piggy-date').value;
        const note = document.getElementById('piggy-note').value;

        try {
            await fetchAPI('/piggybank', {
                method: 'POST',
                body: JSON.stringify({ title, amount, date, note })
            });
            modalAddPiggybank.classList.add('hidden');
            showToast('🐷 Extra payment deposited into Piggy Bank & Total Savings!', 'success');
            addPiggybankForm.reset();
            loadDashboardData();
        } catch (err) {
            showToast(err.message || 'Error depositing to Piggy Bank', 'danger');
        }
    });
}

// --- Utils ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.borderLeft = `4px solid ${type === 'success' ? 'var(--success)' : 'var(--danger)'}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add CSS for toast out animation dynamically
const style = document.createElement('style');
style.innerHTML = `@keyframes toastOut { to { transform: translateX(120%); opacity: 0; } }`;
document.head.appendChild(style);

// --- Video Background Loop Logic ---
const bgVideo = document.getElementById('bg-video');
if (bgVideo) {
    let animationFrameId;

    function handleVideoLoop() {
        if (!bgVideo.duration) {
            animationFrameId = requestAnimationFrame(handleVideoLoop);
            return;
        }

        const currentTime = bgVideo.currentTime;
        const duration = bgVideo.duration;

        // Fade in over 0.5s
        if (currentTime < 0.5) {
            bgVideo.style.opacity = currentTime / 0.5;
        } 
        // Fade out over 0.5s before end
        else if (currentTime > duration - 0.5) {
            bgVideo.style.opacity = (duration - currentTime) / 0.5;
        } 
        // Fully visible in between
        else {
            bgVideo.style.opacity = 1;
        }

        animationFrameId = requestAnimationFrame(handleVideoLoop);
    }

    bgVideo.addEventListener('play', () => {
        animationFrameId = requestAnimationFrame(handleVideoLoop);
    });

    bgVideo.addEventListener('ended', () => {
        cancelAnimationFrame(animationFrameId);
        bgVideo.style.opacity = 0;
        
        setTimeout(() => {
            bgVideo.currentTime = 0;
            bgVideo.play();
        }, 100);
    });

    // Handle initial load if already playing
    if (!bgVideo.paused) {
        animationFrameId = requestAnimationFrame(handleVideoLoop);
    }
}
