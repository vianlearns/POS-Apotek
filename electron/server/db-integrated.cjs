const path = require('path');
const fs = require('fs');
const os = require('os');
const sqlite3 = require('sqlite3').verbose();

// Lokasi database
const getAppDataPath = () => {
  const appData = process.env.APPDATA || 
                  (process.platform === 'darwin' ? 
                    path.join(process.env.HOME, 'Library', 'Application Support') : 
                    path.join(process.env.HOME, '.local', 'share'));
  return path.join(appData, 'HanumFarma');
};

const DB_FILE_PATH = path.join(getAppDataPath(), 'data.db');

let db = null;

// Inisialisasi database
function ensureDb() {
  if (db) return db;
  
  const dir = getAppDataPath();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const dbExists = fs.existsSync(DB_FILE_PATH);
  console.log(`Database path: ${DB_FILE_PATH}`);
  
  db = new sqlite3.Database(DB_FILE_PATH, (err) => {
    if (err) {
      console.error('Error connecting to database:', err);
      throw err;
    }
    console.log('Connected to SQLite database');
  });
  
  db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON;');
    
    // Tabel users
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
        discount REAL DEFAULT 0,
        discount_type TEXT DEFAULT 'percentage',
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

    // --- Employees ---
    db.run(`
      CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        position TEXT NOT NULL,
        base_salary REAL NOT NULL,
        bonus REAL DEFAULT 0,
        start_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')),
        updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now'))
      );
    `);

    // --- Payrolls ---
    db.run(`
      CREATE TABLE IF NOT EXISTS payrolls (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        period_month TEXT NOT NULL,
        total_salary REAL NOT NULL,
        payment_date TEXT NOT NULL,
        notes TEXT,
        created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')),
        updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')),
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      );
    `);

    // --- Expenses ---
    db.run(`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')),
        updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now'))
      );
    `);
    
    // --- Collections (Inkaso) ---
    db.run(`
      CREATE TABLE IF NOT EXISTS collections (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        amount REAL NOT NULL,
        created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')),
        updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now'))
      );
    `);

    // --- Payments (Bayar) ---
    db.run(`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        amount REAL NOT NULL,
        created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now')),
        updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now'))
      );
    `);
    
    // Cek apakah ada user admin, jika tidak buat default
    db.get('SELECT COUNT(*) as count FROM local_users WHERE role = ?', ['admin'], (err, row) => {
      if (err) {
        console.error('Error checking admin user:', err);
        return;
      }
      
      if (row.count === 0) {
        // Buat user admin default
        db.run(
          `INSERT INTO local_users (username, password, role, name) VALUES (?, ?, ?, ?)`,
          ['admin', '1234', 'admin', 'Administrator'],
          function(err) {
            if (err) {
              console.error('Error creating default admin:', err);
              return;
            }
            console.log('Default admin user created');
          }
        );
      }
    });
  });

  return db;
}

// Mendapatkan koneksi database
function getDb() {
  if (!db) {
    return ensureDb();
  }
  return db;
}

module.exports = { 
  ensureDb, 
  getDb, 
  DB_FILE_PATH 
};