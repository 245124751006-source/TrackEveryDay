# Monthly Expense Tracker

A full-stack web application designed with a beautiful liquid glassmorphism theme to track monthly expenses, incomes, simulated QR payments, and notify about upcoming bills.

## Tech Stack
- **Frontend**: HTML5, CSS3 (Glassmorphism), Vanilla JavaScript, Chart.js
- **Backend**: Node.js, Express.js
- **Database**: SQLite3
- **Authentication**: JWT (JSON Web Tokens), bcrypt

## Features
- **Liquid Glassmorphism Theme**: A bright, airy, and minimal design.
- **Authentication**: Secure login and registration using bcrypt and JWT.
- **Dashboard Overview**: View total spend, income, and a categorized breakdown chart.
- **Expense Tracking**: Add manual cash expenses.
- **Simulated Auto-Entries**: Simulate a QR/UPI payment or a Card sync callback which automatically adds a transaction.
- **Alerts**: Notifications for upcoming or overdue bills.

## Setup Instructions

1. **Prerequisites**: Make sure you have [Node.js](https://nodejs.org/) installed on your machine.
2. **Install Dependencies**: Open a terminal in the root directory and run:
   ```bash
   npm install
   ```
3. **Start the Application**:
   ```bash
   npm start
   ```
   *(Or you can run `node server.js` directly)*
4. **Access the Web App**: Open your browser and navigate to:
   `http://localhost:3000`

## Demo Login
The application will automatically seed a demo user on the first run.
- **Email**: `demo@example.com`
- **Password**: `password123`

## Note on Simulated Payments
In this mini project, real automatic QR (UPI) and card transaction syncs are simulated because actual APIs require bank/merchant credentials. The "Payments" tab allows you to trigger a callback that fires a success signal, automatically entering a transaction into your ledger to demonstrate the full UX flow.
