import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import config from './config/index.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import invoiceRoutes from './routes/invoice.routes.js';
import vendorRoutes from './routes/vendor.routes.js';
import vendorIntegrationRoutes from './routes/vendorIntegration.routes.js';
import configRoutes from './routes/config.routes.js';

const app = express();

// --------------- Middleware ---------------
app.use(cors({
  origin: [config.frontendUrl],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --------------- Health Check ---------------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --------------- Routes ---------------
app.use('/api/auth', authRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/vendors', vendorIntegrationRoutes); // Mounted on same path to keep URLs clean
app.use('/api/config', configRoutes);

// --------------- Error Handling ---------------
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

