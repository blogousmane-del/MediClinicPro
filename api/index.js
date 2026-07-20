// Vercel Serverless Function entry point.
// Wraps the Express app so every /api/* request is handled by the real backend.
module.exports = require('../backend/server.js');
