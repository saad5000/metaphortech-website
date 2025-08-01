const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'"],
    },
  },
}));

// Compression middleware
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
    initDatabase();
  }
});

// Initialize database tables
function initDatabase() {
  db.serialize(() => {
    // Contacts table
    db.run(`CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Newsletter subscribers table
    db.run(`CREATE TABLE IF NOT EXISTS subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Demo requests table
    db.run(`CREATE TABLE IF NOT EXISTS demo_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT,
      industry TEXT,
      phone TEXT,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Analytics table
    db.run(`CREATE TABLE IF NOT EXISTS analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  });
}

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Routes
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, company, message } = req.body;

    // Validation
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Save to database
    const stmt = db.prepare('INSERT INTO contacts (name, email, company, message) VALUES (?, ?, ?, ?)');
    stmt.run([name, email, company, message], function(err) {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Failed to save contact form' });
      }

      // Check if this is a demo request
      const isDemoRequest = message.toLowerCase().includes('demo') || 
                           message.toLowerCase().includes('demonstration') ||
                           message.toLowerCase().includes('show me') ||
                           message.toLowerCase().includes('presentation');

      // Send email notification
      const mailOptions = {
        from: process.env.EMAIL_USER || 'your-email@gmail.com',
        to: isDemoRequest ? 'sales@metaphortech.com' : 'info@metaphortech.com',
        subject: isDemoRequest ? 'New Demo Request - Metaphortech' : 'New Contact Form Submission - Metaphortech',
        html: `
          <h2>${isDemoRequest ? 'New Demo Request' : 'New Contact Form Submission'}</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Company:</strong> ${company || 'Not provided'}</p>
          <p><strong>Message:</strong></p>
          <p>${message}</p>
          ${isDemoRequest ? '<p><strong>⚠️ This appears to be a demo request - please prioritize follow-up!</strong></p>' : ''}
          <hr>
          <p><small>Submitted on: ${new Date().toLocaleString()}</small></p>
        `
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Email error:', error);
        } else {
          console.log('Email sent:', info.response);
        }
      });

      res.json({ success: true, message: 'Thank you for your message! We\'ll get back to you soon.' });
    });
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/newsletter', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if already subscribed
    db.get('SELECT id FROM subscribers WHERE email = ?', [email], (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (row) {
        return res.status(400).json({ error: 'Email already subscribed' });
      }

      // Add to database
      const stmt = db.prepare('INSERT INTO subscribers (email) VALUES (?)');
      stmt.run([email], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to subscribe' });
        }

        res.json({ success: true, message: 'Successfully subscribed to newsletter!' });
      });
    });
  } catch (error) {
    console.error('Newsletter error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Demo requests are now handled through the contact form
// Removed separate demo-request endpoint to consolidate all requests

// Analytics tracking
app.post('/api/analytics', (req, res) => {
  try {
    const { page } = req.body;
    const ip = req.ip;
    const userAgent = req.get('User-Agent');

    const stmt = db.prepare('INSERT INTO analytics (page, ip_address, user_agent) VALUES (?, ?, ?)');
    stmt.run([page, ip, userAgent], function(err) {
      if (err) {
        console.error('Analytics error:', err);
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Analytics error' });
  }
});

// Admin routes (basic stats)
app.get('/api/admin/stats', (req, res) => {
  try {
    db.all('SELECT COUNT(*) as count FROM contacts', (err, contacts) => {
      if (err) return res.status(500).json({ error: 'Database error' });

      db.all('SELECT COUNT(*) as count FROM subscribers', (err, subscribers) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        res.json({
          contacts: contacts[0].count,
          subscribers: subscribers[0].count
        });
      });
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

 // Support page routes
 app.get('/support', (req, res) => {
   res.sendFile(path.join(__dirname, 'public', 'support', 'index.html'));
 });
 
 app.get('/docs', (req, res) => {
   res.sendFile(path.join(__dirname, 'public', 'docs', 'index.html'));
 });
 
 app.get('/api', (req, res) => {
   res.sendFile(path.join(__dirname, 'public', 'api', 'index.html'));
 });
 
 app.get('/status', (req, res) => {
   res.sendFile(path.join(__dirname, 'public', 'status', 'index.html'));
 });
 
 // Company page routes
 app.get('/about', (req, res) => {
   res.sendFile(path.join(__dirname, 'public', 'about.html'));
 });
 
 app.get('/careers', (req, res) => {
   res.sendFile(path.join(__dirname, 'public', 'careers.html'));
 });
 
 app.get('/blog', (req, res) => {
   res.sendFile(path.join(__dirname, 'public', 'blog.html'));
 });

 // Legal page routes
 app.get('/legal/privacy', (req, res) => {
   res.sendFile(path.join(__dirname, 'public', 'legal', 'privacy.html'));
 });
 
 app.get('/legal/terms', (req, res) => {
   res.sendFile(path.join(__dirname, 'public', 'legal', 'terms.html'));
 });
 
 app.get('/legal/cookies', (req, res) => {
   res.sendFile(path.join(__dirname, 'public', 'legal', 'cookies.html'));
 });

 // Solution page routes
 app.get('/solutions', (req, res) => {
   res.sendFile(path.join(__dirname, 'public', 'solutions', 'index.html'));
 });
 
 app.get('/solutions/automotive', (req, res) => {
   res.sendFile(path.join(__dirname, 'public', 'solutions', 'automotive.html'));
 });
 
 app.get('/solutions/food-restaurant', (req, res) => {
   res.sendFile(path.join(__dirname, 'public', 'solutions', 'food-restaurant.html'));
 });
 
 app.get('/solutions/education', (req, res) => {
   res.sendFile(path.join(__dirname, 'public', 'solutions', 'education.html'));
 });
 
 app.get('/solutions/real-estate', (req, res) => {
   res.sendFile(path.join(__dirname, 'public', 'solutions', 'real-estate.html'));
 });

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Metaphortech server running on port ${PORT}`);
  console.log(`🌐 Access locally: http://localhost:${PORT}`);
  console.log(`🌐 Access from network: http://192.168.2.13:${PORT}`);
  console.log(`📧 Email notifications: ${process.env.EMAIL_USER ? 'Configured' : 'Not configured'}`);
  console.log(`💾 Database: SQLite (./database.sqlite)`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('✅ Database connection closed.');
    }
    process.exit(0);
  });
}); 