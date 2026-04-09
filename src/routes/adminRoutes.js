const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const adminController = require('../controllers/adminController');
const adminAuth = require('../middlewares/adminAuthMiddleware');
const validate = require('../middlewares/validateRequest');

// Auth
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], validate, adminController.login);

// Protect routes
router.use(adminAuth);

/*
========================
OTP MANAGEMENT
========================
*/

router.post('/otp/generate', [
  body('mobile_no').isMobilePhone().withMessage('Valid mobile number is required'),
], validate, adminController.generateOtp);

router.post('/otp/verify', adminController.verifyOtp)
// router.post('/otp/verify', [
//   body('mobile_no').isMobilePhone().withMessage('Valid mobile number is required'),
//   body('otp').isLength({ min: 4, max: 6 }).isNumeric(),
// ], validate, adminController.verifyOtp);

router.get('/otp/status/:requestId', adminController.getOtpStatus);

/*
========================
MERCHANT MANAGEMENT
========================
*/

router.post('/merchants', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail(),
  body('mobile_no').isMobilePhone().withMessage('Valid mobile number is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('webhook_url').optional().isURL().withMessage('Invalid webhook URL'),
  body('otp').isLength({ min: 4, max: 6 }).isNumeric().withMessage('Valid OTP is required'),
], validate, adminController.createMerchant);

router.get('/merchants', adminController.getMerchants);
router.get('/merchants/:id', adminController.getMerchant);
router.patch('/merchants/:id/status', adminController.updateMerchantStatus);

// Assign MID
router.post('/merchants/:id/mids', adminController.assignMidsToMerchant);

/*
========================
MID MANAGEMENT
========================
*/

router.post('/mids', [
  body('mid_code').trim().notEmpty().withMessage('MID code is required'),
  body('provider')
    .isIn(['rupeeflow', 'razorpay', 'paytm', 'phonepe', 'cgpey', 'dummy'])
    .withMessage('Invalid provider'),
  body('api_key').notEmpty().withMessage('API key is required'),
  body('api_secret').optional(),
  body('webhook_secret').optional(),
], validate, adminController.createMid);

router.get('/mids', adminController.getMids);
router.get('/mids/performance', adminController.getMidPerformance);
router.patch('/mids/:id/status', adminController.updateMidStatus);

/*
========================
MONITORING
========================
*/

router.get('/transactions', adminController.getAllTransactions);
router.get('/webhook-logs', adminController.getWebhookLogs);

module.exports = router;