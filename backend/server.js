// IMPORTANT: Load .env FIRST, before any module that reads process.env
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { authLimiter } = require('./middleware/rateLimiter');
const { initDb } = require('./database');
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const appointmentRoutes = require('./routes/appointments');
const consultationRoutes = require('./routes/consultations');
const pharmacyRoutes = require('./routes/pharmacy');
const laboratoryRoutes = require('./routes/laboratory');
const financialsRoutes = require('./routes/financials');
const settingsRoutes = require('./routes/settings');
const depositsRoutes = require('./routes/deposits');
const webhooksRoutes = require('./routes/webhooks');
const platformRoutes = require('./routes/platform');
const cronRoutes = require('./routes/cron');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust the platform proxy (Vercel) so req.ip reflects the real client IP
// from X-Forwarded-For instead of the proxy's address.
app.set('trust proxy', 1);

// Security Middlewares
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS configuration - Restrict to frontend origin
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.indexOf(origin) !== -1 || 
      process.env.NODE_ENV !== 'production' || 
      origin.includes('vercel.app')
    ) {
      return callback(null, true);
    }
    return callback(new Error('CORS Policy: Request from origin not allowed.'));
  },
  credentials: true
}));

// Capture the raw request body bytes for payment webhook signature verification
// (Bictorys HMAC, PayTech dual signature). PayTech IPNs ship form-encoded by
// default, Bictorys ships JSON — both parsers need the same `verify` hook so
// req.rawBody is populated whichever content-type actually matches.
const captureRawBody = (req, _res, buf) => { req.rawBody = buf; };
app.use(express.json({ verify: captureRawBody }));
app.use(express.urlencoded({ extended: false, verify: captureRawBody }));

// Anti Brute-force rate limiting on auth routes (Upstash Redis-backed when configured, see middleware/rateLimiter.js)
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/google', authLimiter);

// Payment provider webhooks — public, no `auth` middleware (server-to-server
// calls verified by provider signature, not a MediClinic user session).
app.use('/api/webhooks', webhooksRoutes);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/laboratory', laboratoryRoutes);
app.use('/api/financials', financialsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/deposits', depositsRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/cron', cronRoutes);
// (webhooksRoutes is mounted earlier, before auth-adjacent middleware)

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled Server Error:", err);
  res.status(500).json({ error: "Une erreur interne du serveur est survenue." });
});

// Initialize database and start server
async function startServer() {
  try {
    await initDb();
    console.log("Database initialized successfully.");
    
    app.listen(PORT, () => {
      console.log(`MediClinic REST API Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start MediClinic server:", error);
    process.exit(1);
  }
}

if (!process.env.VERCEL) {
  startServer();
} else {
  // On Vercel, initialize database asynchronously without starting a port listener
  initDb()
    .then(() => console.log("Database initialized successfully in Vercel Serverless environment."))
    .catch(err => console.error("Failed to initialize database in Vercel Serverless environment:", err));
}

module.exports = app;
