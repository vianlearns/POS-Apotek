const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { ensureDb, getDb } = require('./db-integrated.cjs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Init DB on server start
ensureDb();

// API Routes
app.get('/api/init', (req, res) => {
  try {
    ensureDb();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  }

  const db = getDb();
  db.get(
    `SELECT id, username, name, role FROM local_users WHERE username = ? AND password = ?`,
    [username, password],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Kesalahan server: ' + err.message });
      }
      if (!row) {
        return res.status(401).json({ error: 'Kredensial tidak valid' });
      }
      return res.json({
        ok: true,
        user: {
          id: row.id,
          username: row.username,
          name: row.name,
          role: row.role,
        }
      });
    }
  );
});

// CRUD Users
app.get('/api/users', (req, res) => {
  const db = getDb();
  db.all(
    `SELECT id, username, name, role, created_at, updated_at FROM local_users ORDER BY created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      res.json({ ok: true, data: rows });
    }
  );
});

app.post('/api/users', (req, res) => {
  const { username, password, name, role } = req.body || {};
  if (!username || !password || !role) {
    return res.status(400).json({ ok: false, error: 'username, password, dan role wajib diisi' });
  }
  const db = getDb();
  db.run(
    `INSERT INTO local_users (username, password, role, name, created_at, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [username, password, role, name || null],
    function(err) {
      if (err) {
        if (String(err.message).includes('UNIQUE')) {
          return res.status(409).json({ ok: false, error: 'Username sudah digunakan' });
        }
        return res.status(500).json({ ok: false, error: err.message });
      }
      res.status(201).json({ ok: true, data: { id: this.lastID, username, name: name || null, role } });
    }
  );
});

app.put('/api/users/:id', (req, res) => {
  const id = Number(req.params.id);
  const { name, role, password } = req.body || {};
  if (!id || (!name && !role && !password)) {
    return res.status(400).json({ ok: false, error: 'Tidak ada data untuk diperbarui' });
  }
  const db = getDb();
  const fields = [];
  const params = [];
  if (typeof name !== 'undefined') { fields.push('name = ?'); params.push(name || null); }
  if (typeof role !== 'undefined') { fields.push('role = ?'); params.push(role); }
  if (typeof password !== 'undefined' && password !== '') { fields.push('password = ?'); params.push(password); }
  fields.push(`updated_at = datetime('now')`);
  const sql = `UPDATE local_users SET ${fields.join(', ')} WHERE id = ?`;
  params.push(id);
  db.run(sql, params, function(err) {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true });
  });
});

app.delete('/api/users/:id', (req, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  db.run(`DELETE FROM local_users WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true });
  });
});

// --- Helpers ---
const genId = () => crypto.randomBytes(16).toString('hex');

// --- Products ---
app.get('/api/products', (req, res) => {
  const { requires_prescription, inStock } = req.query;
  const db = getDb();
  const where = [];
  const params = [];
  if (typeof requires_prescription !== 'undefined') {
    where.push('requires_prescription = ?');
    params.push(String(requires_prescription) === 'true' ? 1 : 0);
  }
  if (String(inStock) === 'true') {
    where.push('stock > 0');
  }
  const sql = `SELECT * FROM products ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`;
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    rows.forEach(r => { r.requires_prescription = !!r.requires_prescription; });
    res.json({ ok: true, data: rows });
  });
});

app.post('/api/products', (req, res) => {
  const p = req.body || {};
  if (!p.name || typeof p.price === 'undefined' || typeof p.buy_price === 'undefined') {
    return res.status(400).json({ ok: false, error: 'name, price, buy_price wajib diisi' });
  }
  const id = genId();
  const db = getDb();
  db.run(
    `INSERT INTO products (id, name, category, stock, min_stock, price, buy_price, expiry_date, requires_prescription, supplier_id, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      id,
      p.name,
      p.category || null,
      Number(p.stock) || 0,
      Number(p.min_stock) || 0,
      Number(p.price),
      Number(p.buy_price),
      p.expiry_date || null,
      p.requires_prescription ? 1 : 0,
      p.supplier_id || null,
      p.description || null
    ],
    function(err) {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      res.status(201).json({ ok: true, data: { id, ...p } });
    }
  );
});

app.put('/api/products/:id', (req, res) => {
  const id = req.params.id;
  const p = req.body || {};
  const fields = [];
  const params = [];
  const m = (name, val) => { fields.push(`${name} = ?`); params.push(val); };
  if (typeof p.name !== 'undefined') m('name', p.name);
  if (typeof p.category !== 'undefined') m('category', p.category || null);
  if (typeof p.stock !== 'undefined') m('stock', Number(p.stock));
  if (typeof p.min_stock !== 'undefined') m('min_stock', Number(p.min_stock));
  if (typeof p.price !== 'undefined') m('price', Number(p.price));
  if (typeof p.buy_price !== 'undefined') m('buy_price', Number(p.buy_price));
  if (typeof p.expiry_date !== 'undefined') m('expiry_date', p.expiry_date || null);
  if (typeof p.requires_prescription !== 'undefined') m('requires_prescription', p.requires_prescription ? 1 : 0);
  if (typeof p.supplier_id !== 'undefined') m('supplier_id', p.supplier_id || null);
  if (typeof p.description !== 'undefined') m('description', p.description || null);
  fields.push(`updated_at = datetime('now')`);
  if (!fields.length) return res.status(400).json({ ok: false, error: 'Tidak ada perubahan' });
  const sql = `UPDATE products SET ${fields.join(', ')} WHERE id = ?`;
  params.push(id);
  const db = getDb();
  db.run(sql, params, function(err) {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true });
  });
});

app.delete('/api/products/:id', (req, res) => {
  const id = req.params.id;
  const db = getDb();
  db.run(`DELETE FROM products WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true });
  });
});

// --- Suppliers ---
app.get('/api/suppliers', (req, res) => {
  const db = getDb();
  db.all(`SELECT * FROM suppliers ORDER BY created_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true, data: rows });
  });
});

app.post('/api/suppliers', (req, res) => {
  const s = req.body || {};
  if (!s.name) return res.status(400).json({ ok: false, error: 'name wajib diisi' });
  const id = genId();
  const db = getDb();
  db.run(
    `INSERT INTO suppliers (id, name, contact, address, phone, email, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [id, s.name, s.contact || null, s.address || null, s.phone || null, s.email || null],
    function(err) {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      res.status(201).json({ ok: true, data: { id, ...s } });
    }
  );
});

app.put('/api/suppliers/:id', (req, res) => {
  const id = req.params.id;
  const s = req.body || {};
  const fields = [];
  const params = [];
  const m = (name, val) => { fields.push(`${name} = ?`); params.push(val); };
  if (typeof s.name !== 'undefined') m('name', s.name);
  if (typeof s.contact !== 'undefined') m('contact', s.contact || null);
  if (typeof s.address !== 'undefined') m('address', s.address || null);
  if (typeof s.phone !== 'undefined') m('phone', s.phone || null);
  if (typeof s.email !== 'undefined') m('email', s.email || null);
  fields.push(`updated_at = datetime('now')`);
  if (!fields.length) return res.status(400).json({ ok: false, error: 'Tidak ada perubahan' });
  const sql = `UPDATE suppliers SET ${fields.join(', ')} WHERE id = ?`;
  params.push(id);
  const db = getDb();
  db.run(sql, params, function(err) {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true });
  });
});

app.delete('/api/suppliers/:id', (req, res) => {
  const id = req.params.id;
  const db = getDb();
  db.run(`DELETE FROM suppliers WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true });
  });
});

// --- Prescriptions ---
app.get('/api/prescriptions', (req, res) => {
  const { status } = req.query;
  const db = getDb();
  const where = [];
  const params = [];
  if (typeof status !== 'undefined') { where.push('status = ?'); params.push(String(status)); }
  const sql = `SELECT * FROM prescriptions ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`;
  db.all(sql, params, (err, prescriptions) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    const ids = prescriptions.map(p => p.id);
    if (!ids.length) return res.json({ ok: true, data: [] });
    const qMarks = ids.map(() => '?').join(',');
    db.all(
      `SELECT pm.*, pr.patient_name, pr.doctor_name, pr.status AS prescription_status, p.name AS product_name
       FROM prescription_medications pm
       JOIN prescriptions pr ON pr.id = pm.prescription_id
       JOIN products p ON p.id = pm.product_id
       WHERE pm.prescription_id IN (${qMarks})`,
      ids,
      (err2, meds) => {
        if (err2) return res.status(500).json({ ok: false, error: err2.message });
        const grouped = {};
        meds.forEach(m => {
          const pid = m.prescription_id;
          if (!grouped[pid]) grouped[pid] = [];
          grouped[pid].push({
            id: m.id,
            prescription_id: m.prescription_id,
            product_id: m.product_id,
            product_name: m.product_name,
            quantity: m.quantity,
            dosage: m.dosage,
            instructions: m.instructions,
            created_at: m.created_at
          });
        });
        const result = prescriptions.map(p => ({ ...p, medications: grouped[p.id] || [] }));
        res.json({ ok: true, data: result });
      }
    );
  });
});

app.post('/api/prescriptions', (req, res) => {
  const p = req.body || {};
  if (!p.doctor_name || !p.patient_name || !p.created_by) {
    return res.status(400).json({ ok: false, error: 'doctor_name, patient_name, created_by wajib diisi' });
  }
  const id = genId();
  const db = getDb();
  db.run(
    `INSERT INTO prescriptions (id, doctor_name, patient_name, date, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, COALESCE(?, date('now')), ?, ?, datetime('now'), datetime('now'))`,
    [id, p.doctor_name, p.patient_name, p.date || null, p.status || 'active', String(p.created_by)],
    function(err) {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      res.status(201).json({ ok: true, data: { id, ...p } });
    }
  );
});

app.post('/api/prescriptions/:id/medications', (req, res) => {
  const prescription_id = req.params.id;
  const meds = Array.isArray(req.body) ? req.body : (req.body?.medications || []);
  if (!meds.length) return res.status(400).json({ ok: false, error: 'Medications tidak boleh kosong' });
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO prescription_medications (id, prescription_id, product_id, quantity, dosage, instructions, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
  );
  db.serialize(() => {
    meds.forEach(m => {
      stmt.run([
        genId(), prescription_id, m.product_id, Number(m.quantity), m.dosage || '', m.instructions || ''
      ]);
    });
  });
  stmt.finalize(err => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.status(201).json({ ok: true });
  });
});

app.put('/api/prescriptions/:id/status', (req, res) => {
  const id = req.params.id;
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ ok: false, error: 'status wajib diisi' });
  const db = getDb();
  db.run(
    `UPDATE prescriptions SET status = ?, updated_at = datetime('now') WHERE id = ?`,
    [status, id],
    function(err) {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      res.json({ ok: true });
    }
  );
});

// --- Transactions ---
app.get('/api/transactions', (req, res) => {
  const { from, to, status } = req.query;
  const db = getDb();
  const where = [];
  const params = [];
  if (typeof status !== 'undefined') { where.push('status = ?'); params.push(String(status)); }
  if (from) { where.push(`date >= ?`); params.push(from); }
  if (to) { where.push(`date <= ?`); params.push(to + 'T23:59:59'); }
  const sql = `SELECT * FROM transactions ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY date DESC`;
  db.all(sql, params, (err, txs) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    if (!txs.length) return res.json({ ok: true, data: [] });
    const ids = txs.map(t => t.id);
    const qMarks = ids.map(() => '?').join(',');
    db.all(
      `SELECT * FROM transaction_items WHERE transaction_id IN (${qMarks}) ORDER BY created_at ASC`,
      ids,
      (err2, items) => {
        if (err2) return res.status(500).json({ ok: false, error: err2.message });
        const grouped = {};
        items.forEach(it => {
          const tid = it.transaction_id;
          if (!grouped[tid]) grouped[tid] = [];
          grouped[tid].push(it);
        });
        const result = txs.map(t => ({ ...t, transaction_items: grouped[t.id] || [] }));
        res.json({ ok: true, data: result });
      }
    );
  });
});

app.post('/api/transactions', (req, res) => {
  const t = req.body || {};
  if (typeof t.subtotal === 'undefined' || typeof t.total === 'undefined' || !t.cashier_id) {
    return res.status(400).json({ ok: false, error: 'subtotal, total, cashier_id wajib diisi' });
  }
  const id = genId();
  const db = getDb();
  db.run(
    `INSERT INTO transactions (id, date, cashier_id, subtotal, total, payment_method, prescription_id, status, created_at)
     VALUES (?, strftime('%Y-%m-%dT%H:%M:%S','now'), ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [id, t.cashier_id, Number(t.subtotal), Number(t.total), t.payment_method || 'cash', t.prescription_id || null, t.status || 'completed'],
    function(err) {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      // Kembalikan data transaksi lengkap untuk dipakai UI (struk, dsb.)
      db.get(
        `SELECT id, date, cashier_id, subtotal, total, payment_method, prescription_id, status FROM transactions WHERE id = ?`,
        [id],
        (err2, row) => {
          if (err2) return res.status(500).json({ ok: false, error: err2.message });
          if (!row) return res.status(500).json({ ok: false, error: 'Transaksi tidak ditemukan setelah insert' });
          res.status(201).json({ ok: true, data: row });
        }
      );
    }
  );
});

app.post('/api/transactions/:id/items', (req, res) => {
  const transaction_id = req.params.id;
  const items = Array.isArray(req.body) ? req.body : (req.body?.items || []);
  if (!items.length) return res.status(400).json({ ok: false, error: 'Items tidak boleh kosong' });
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO transaction_items (id, transaction_id, product_id, product_name, quantity, price, total, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  );
  db.serialize(() => {
    items.forEach(it => {
      stmt.run([
        genId(), transaction_id, it.product_id, it.product_name, Number(it.quantity), Number(it.price), Number(it.total)
      ]);
    });
  });
  stmt.finalize(err => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.status(201).json({ ok: true });
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../../dist');
  app.use(express.static(distPath));
  
  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Jika dijalankan langsung (bukan sebagai modul)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`HanumFarma backend berjalan di http://localhost:${PORT}`);
  });
}

module.exports = app;