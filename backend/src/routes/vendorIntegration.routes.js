import express from 'express';
import vendorIntegrationController from '../controllers/vendorIntegration.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import { catchAsync } from '../middlewares/errorHandler.js';

const router = express.Router();

// Registry is public/auth-agnostic but keeping it protected since only users need it
router.use(authMiddleware);

router.get('/registry', vendorIntegrationController.getRegistry);
router.get('/integrations', catchAsync(vendorIntegrationController.getIntegrations));
router.post('/integrations/validate', catchAsync(vendorIntegrationController.validateAndSaveCredentials));
router.delete('/integrations/:vendorName', catchAsync(vendorIntegrationController.disconnectVendor));

export default router;
