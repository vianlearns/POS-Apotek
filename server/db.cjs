const path = require('path');
const fs = require('fs');
const os = require('os');
const sqlite3 = require('sqlite3');
const SQL = sqlite3.verbose();

const getAppDataPath = () => {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(appData, 'HanumFarma');
};

const DB_FILE_PATH = path.join(getAppDataPath(), 'data.db');

function ensureDb() {
  const dir = getAppDataPath();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const dbExists = fs.existsSync(DB_FILE_PATH);

  const db = new SQL.Database(DB_FILE_PATH);
  db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON;');
    // Skema final: tanpa email & active, id AUTOINCREMENT
    db.run(`
      CREATE TABLE IF NOT EXISTS local_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin','apoteker','kasir')),
        name TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);

    if (!dbExists) {
      // Seed default admin
      db.run(
        `INSERT INTO local_users (username, password, role, name) VALUES (?, ?, ?, ?)`,
        ['admin', '1234', 'admin', 'Administrator']
      );
    }

    // --- Suppliers ---
    db.run(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        contact TEXT,
        address TEXT,
        phone TEXT,
        email TEXT,
        created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')),
        updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now'))
      );
    `);

    // --- Products ---
    db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT,
        stock INTEGER NOT NULL DEFAULT 0,
        min_stock INTEGER NOT NULL DEFAULT 0,
        price REAL NOT NULL,
        buy_price REAL NOT NULL,
        expiry_date TEXT,
        requires_prescription INTEGER NOT NULL DEFAULT 0,
        supplier_id TEXT,
        description TEXT,
        created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')),
        updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')),
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
      );
    `);

    // --- Prescriptions ---
    db.run(`
      CREATE TABLE IF NOT EXISTS prescriptions (
        id TEXT PRIMARY KEY,
        doctor_name TEXT NOT NULL,
        patient_name TEXT NOT NULL,
        date TEXT NOT NULL DEFAULT (date('now')),
        status TEXT NOT NULL DEFAULT 'active',
        created_by TEXT NOT NULL,
        created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')),
        updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now'))
      );
    `);

    // --- Prescription medications ---
    db.run(`
      CREATE TABLE IF NOT EXISTS prescription_medications (
        id TEXT PRIMARY KEY,
        prescription_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        dosage TEXT NOT NULL,
        instructions TEXT NOT NULL,
        created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')),
        FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
      );
    `);

    // --- Transactions ---
    db.run(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        date TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')),
        cashier_id TEXT NOT NULL,
        subtotal REAL NOT NULL,
        total REAL NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'cash',
        prescription_id TEXT,
        status TEXT NOT NULL DEFAULT 'completed',
        created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')),
        FOREIGN KEY (prescription_id) REFERENCES prescriptions(id)
      );
    `);

    // --- Transaction items ---
    db.run(`
      CREATE TABLE IF NOT EXISTS transaction_items (
        id TEXT PRIMARY KEY,
        transaction_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        total REAL NOT NULL,
        created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')),
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
      );
    `);
  });

  return db;
}

function getDb() {
  if (!fs.existsSync(DB_FILE_PATH)) {
    ensureDb();
  }
  return new SQL.Database(DB_FILE_PATH);
}

module.exports = { ensureDb, getDb, DB_FILE_PATH };