const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const twilio = require('twilio');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// VAPI and Twilio configuration
const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// Initialize Twilio client only if credentials are provided
let twilioClient = null;
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  try {
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    console.log('✅ Twilio client initialized successfully');
  } catch (error) {
    console.error('❌ Twilio initialization error:', error.message);
  }
}

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

    // Call logs table
    db.run(`CREATE TABLE IF NOT EXISTS call_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      call_id TEXT UNIQUE,
      caller_number TEXT,
      call_status TEXT,
      call_duration INTEGER,
      transcript TEXT,
      ai_response TEXT,
      call_started_at DATETIME,
      call_ended_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

// VAPI Webhook endpoints
app.post('/api/vapi/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ error: 'No request body provided' });
    }

    let event;
    try {
      event = JSON.parse(req.body.toString());
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError.message);
      return res.status(400).json({ error: 'Invalid JSON in request body' });
    }

    console.log('VAPI Webhook Event:', event.type, event);

    switch (event.type) {
      case 'call-start':
        await handleCallStart(event);
        break;
      case 'call-end':
        await handleCallEnd(event);
        break;
      case 'transcript':
        await handleTranscript(event);
        break;
      case 'function-call':
        await handleFunctionCall(event);
        break;
      default:
        console.log('Unhandled VAPI event type:', event.type);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('VAPI Webhook Error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// VAPI call management endpoints
app.post('/api/vapi/call/start', async (req, res) => {
  try {
    const { phoneNumber, assistantId } = req.body;
    
    if (!VAPI_API_KEY) {
      return res.status(500).json({ error: 'VAPI not configured' });
    }

    const response = await axios.post('https://api.vapi.ai/call', {
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
      assistantId: assistantId || VAPI_ASSISTANT_ID,
      customer: {
        number: phoneNumber
      }
    }, {
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({ success: true, callId: response.data.id });
  } catch (error) {
    console.error('VAPI Call Start Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to start call' });
  }
});

app.get('/api/vapi/calls', async (req, res) => {
  try {
    if (!VAPI_API_KEY) {
      return res.status(500).json({ error: 'VAPI not configured' });
    }

    const response = await axios.get('https://api.vapi.ai/call', {
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('VAPI Get Calls Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch calls' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    integrations: {
      vapi: !!VAPI_API_KEY,
      twilio: !!TWILIO_ACCOUNT_SID,
      email: !!process.env.EMAIL_USER
    }
  });
});

// VAPI Webhook Handler Functions
async function handleCallStart(event) {
  try {
    const { call } = event;
    if (!call || !call.id) {
      console.error('Invalid call data in call start event');
      return;
    }
    
    console.log('Call started:', call.id);
    
    // Save call start to database
    const stmt = db.prepare(`
      INSERT INTO call_logs (call_id, caller_number, call_status, call_started_at) 
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run([
      call.id,
      call.customer?.number || 'Unknown',
      'started',
      new Date().toISOString()
    ], function(err) {
      if (err) {
        console.error('Database error in handleCallStart:', err);
      } else {
        console.log('Call start logged successfully:', call.id);
      }
    });
  } catch (error) {
    console.error('Error handling call start:', error);
  }
}

async function handleCallEnd(event) {
  try {
    const { call } = event;
    if (!call || !call.id) {
      console.error('Invalid call data in call end event');
      return;
    }
    
    console.log('Call ended:', call.id);
    
    // Update call end in database
    const stmt = db.prepare(`
      UPDATE call_logs 
      SET call_status = ?, call_ended_at = ?, call_duration = ?
      WHERE call_id = ?
    `);
    
    stmt.run([
      'ended',
      new Date().toISOString(),
      call.duration || 0,
      call.id
    ], function(err) {
      if (err) {
        console.error('Database error in handleCallEnd:', err);
        return;
      }
      console.log('Call end logged successfully:', call.id);
    });

    // Send email notification for important calls
    if (call.duration > 60) { // Calls longer than 1 minute
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: 'info@metaphortech.com',
        subject: 'AI Agent Call Summary - Metaphortech',
        html: `
          <h2>AI Agent Call Summary</h2>
          <p><strong>Call ID:</strong> ${call.id}</p>
          <p><strong>Caller:</strong> ${call.customer?.number || 'Unknown'}</p>
          <p><strong>Duration:</strong> ${Math.floor(call.duration / 60)} minutes</p>
          <p><strong>Status:</strong> ${call.status}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        `
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Email error:', error);
        } else {
          console.log('Call summary email sent:', info.response);
        }
      });
    }
  } catch (error) {
    console.error('Error handling call end:', error);
  }
}

async function handleTranscript(event) {
  try {
    const { transcript, call } = event;
    if (!call || !call.id || !transcript) {
      console.error('Invalid transcript data in event');
      return;
    }
    
    console.log('Transcript received for call:', call.id);
    
    // Update transcript in database
    const stmt = db.prepare(`
      UPDATE call_logs 
      SET transcript = ?
      WHERE call_id = ?
    `);
    
    stmt.run([transcript.text || transcript, call.id], function(err) {
      if (err) {
        console.error('Database error in handleTranscript:', err);
      } else {
        console.log('Transcript updated successfully for call:', call.id);
      }
    });
  } catch (error) {
    console.error('Error handling transcript:', error);
  }
}

async function handleFunctionCall(event) {
  try {
    const { functionCall, call } = event;
    if (!functionCall || !functionCall.name) {
      console.error('Invalid function call data in event');
      return { error: 'Invalid function call data' };
    }
    
    console.log('Function call received:', functionCall.name);
    
    // Handle different function calls
    switch (functionCall.name) {
      case 'schedule_demo':
        return await handleScheduleDemo(functionCall.parameters || {}, call);
      case 'transfer_to_human':
        return await handleTransferToHuman(functionCall.parameters || {}, call);
      case 'get_business_hours':
        return await handleGetBusinessHours();
      default:
        console.log('Unknown function call:', functionCall.name);
        return { error: 'Unknown function' };
    }
  } catch (error) {
    console.error('Error handling function call:', error);
    return { error: 'Function call failed' };
  }
}

async function handleScheduleDemo(parameters, call) {
  try {
    const { name, email, company, phone } = parameters;
    
    // Validate required fields
    if (!name || !email) {
      return { 
        error: 'Name and email are required to schedule a demo' 
      };
    }
    
    // Save demo request to database
    const stmt = db.prepare(`
      INSERT INTO demo_requests (name, email, company, phone, message) 
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run([
      name,
      email,
      company || '',
      phone || call?.customer?.number || 'Not provided',
      'Demo requested via AI agent call'
    ], function(err) {
      if (err) {
        console.error('Database error in handleScheduleDemo:', err);
      } else {
        console.log('Demo request saved successfully for:', email);
      }
    });

    // Send email notification if email is configured
    if (process.env.EMAIL_USER && transporter) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: 'sales@metaphortech.com',
        subject: 'Demo Request from AI Agent Call - Metaphortech',
        html: `
          <h2>Demo Request from AI Agent</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Company:</strong> ${company || 'Not provided'}</p>
          <p><strong>Phone:</strong> ${phone || call?.customer?.number || 'Not provided'}</p>
          <p><strong>Call ID:</strong> ${call?.id || 'Unknown'}</p>
          <p><strong>⚠️ This request came from an AI agent call - please prioritize follow-up!</strong></p>
        `
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Email error in demo scheduling:', error);
        } else {
          console.log('Demo request email sent:', info.response);
        }
      });
    } else {
      console.log('Email not configured - demo request saved to database only');
    }

    return { 
      success: true, 
      message: "Demo scheduled successfully. Our team will contact you within 24 hours." 
    };
  } catch (error) {
    console.error('Error scheduling demo:', error);
    return { error: 'Failed to schedule demo' };
  }
}

async function handleTransferToHuman(parameters, call) {
  try {
    // In a real implementation, you would transfer the call to a human agent
    // For now, we'll just log the request and provide a callback option
    console.log('Transfer to human requested for call:', call.id);
    
    return { 
      success: true, 
      message: "I'm transferring you to a human agent. Please hold while I connect you, or we can schedule a callback if no agents are available." 
    };
  } catch (error) {
    console.error('Error transferring to human:', error);
    return { error: 'Transfer failed' };
  }
}

async function handleGetBusinessHours() {
  return {
    success: true,
    message: "Our business hours are Monday to Friday, 9 AM to 6 PM Eastern Time. We're closed on weekends and major holidays."
  };
}

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
  console.log(`🤖 VAPI AI Agent: ${VAPI_API_KEY ? 'Configured' : 'Not configured'}`);
  console.log(`📞 Twilio Integration: ${TWILIO_ACCOUNT_SID ? 'Configured' : 'Not configured'}`);
  console.log(`💾 Database: SQLite (./database.sqlite)`);
  console.log(`🔗 VAPI Webhook: ${process.env.VAPI_WEBHOOK_URL || 'Not configured'}`);
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