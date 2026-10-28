import { Router } from 'express';
import { superAdminController } from '../controllers/superAdminController.ts';
import { requireAuthentication } from '../middleware/auth.ts';

const router = Router();

// Routes for Super Admin SQL customer and family tree management
router.get('/customers', requireAuthentication, (req, res, next) => {
  superAdminController.getCustomers(req, res, next);
});

router.post('/customers', requireAuthentication, (req, res, next) => {
  superAdminController.createCustomer(req, res, next);
});

router.delete('/customers/:customerId', requireAuthentication, (req, res, next) => {
  superAdminController.deleteCustomer(req, res, next);
});

router.get('/stats', requireAuthentication, (req, res, next) => {
  superAdminController.getStats(req, res, next);
});

router.get('/account', requireAuthentication, (req, res, next) => {
  superAdminController.getAccount(req, res, next);
});

router.put('/account', requireAuthentication, (req, res, next) => {
  superAdminController.updateAccount(req, res, next);
});

export const superAdminRoutes = router;
