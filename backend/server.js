const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initDb } = require('./database');
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const appointmentRoutes = require('./routes/appointments');
const consultationRoutes = require('./routes/consultations');
const pharmacyRoutes = require('./routes/pharmacy');
const laboratoryRoutes = require('./routes/laboratory');
const financialsRoutes = require('./routes/financials');
const settingsRoutes = require('./routes/settings');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/laboratory', laboratoryRoutes);
app.use('/api/financials', financialsRoutes);
app.use('/api/settings', settingsRoutes);

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

startServer();
