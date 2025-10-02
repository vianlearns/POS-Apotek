const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

function createStaticServer(port = 8081) {
  const app = express();
  
  // Logging middleware untuk debug
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  // Proxy untuk API requests ke backend server - HARUS SEBELUM static middleware
  const apiProxy = createProxyMiddleware({
    target: 'http://localhost:3001',
    changeOrigin: true,
    logLevel: 'debug',
    onProxyReq: (proxyReq, req, res) => {
      console.log('Proxying request:', req.method, req.url, '-> http://localhost:3001' + req.url);
    },
    onProxyRes: (proxyRes, req, res) => {
      console.log('Proxy response:', proxyRes.statusCode, req.method, req.url);
    },
    onError: (err, req, res) => {
      console.error('Proxy error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Backend server tidak tersedia' });
      }
    }
  });
  
  // Gunakan proxy untuk semua request yang dimulai dengan /api
  app.use('/api', apiProxy);
  
  // Serve static files dari folder dist - SETELAH proxy
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));
  
  // Fallback untuk SPA routing - semua route yang tidak ditemukan akan diarahkan ke index.html
  app.get('*', (req, res) => {
    console.log('Fallback route hit for:', req.url);
    res.sendFile(path.join(distPath, 'index.html'));
  });
  
  return new Promise((resolve, reject) => {
    const server = app.listen(port, 'localhost', (err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`Static server berjalan di http://localhost:${port}`);
        resolve(server);
      }
    });
  });
}

module.exports = { createStaticServer };