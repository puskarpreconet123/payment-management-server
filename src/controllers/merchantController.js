const Merchant = require('../models/Merchant');
const Payment = require('../models/Payment');
const { generateJWT } = require('../utils/generateToken');
const { successResponse, errorResponse } = require('../utils/response');
const { validationResult } = require('express-validator');

/*
──────────────────────────────────────────────
AUTH
──────────────────────────────────────────────
*/

exports.login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 'Validation failed', 422, errors.array());
    }

    const { email, password } = req.body;

    const merchant = await Merchant.findOne({ email })
      .select('+password')
      .lean(false);

    if (!merchant || !(await merchant.comparePassword(password))) {
      return errorResponse(res, 'Invalid email or password', 401);
    }

    if (merchant.status !== 'active') {
      return errorResponse(res, `Account is ${merchant.status}`, 403);
    }

    const token = generateJWT({
      id: merchant._id,
      type: 'merchant',
    });

    return successResponse(res, {
      token,
      merchant: {
        id: merchant._id,
        name: merchant.name,
        email: merchant.email,
        api_token: merchant.api_token,
        is_mobile_verified: merchant.is_mobile_verified,
        mobile_no: merchant.mobile_no,
      },
    }, 'Login successful');

  } catch (err) {
    console.error('Merchant login error:', err);
    return errorResponse(res, 'Login failed');
  }
};


/*
──────────────────────────────────────────────
API TOKEN MANAGEMENT
──────────────────────────────────────────────
*/

exports.generateToken = async (req, res) => {
  try {
    const merchant = req.merchant;

    const newToken = merchant.generateApiToken();
    await merchant.save();

    return successResponse(res, {
      api_token: newToken,
    }, 'API token generated');

  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to generate token');
  }
};

exports.regenerateToken = async (req, res) => {
  try {
    const merchant = req.merchant;

    const newToken = merchant.generateApiToken();
    await merchant.save();

    return successResponse(res, {
      api_token: newToken,
    }, 'API token regenerated. Previous token invalidated');

  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to regenerate token');
  }
};


/*
──────────────────────────────────────────────
PROFILE
──────────────────────────────────────────────
*/

exports.getProfile = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.merchant._id)
      .populate('mids', 'mid_code provider status upi_id merchant_name')
      .lean();

    if (!merchant) {
      return errorResponse(res, 'Merchant not found', 404);
    }

    return successResponse(res, {
      id: merchant._id,
      name: merchant.name,
      email: merchant.email,
      api_token: merchant.api_token,
      webhook_url: merchant.webhook_url,
      status: merchant.status,
      mids: merchant.mids || [],
    });

  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to fetch profile');
  }
};


exports.updateWebhookUrl = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 'Validation failed', 422, errors.array());
    }

    const { webhook_url } = req.body;

    await Merchant.updateOne(
      { _id: req.merchant._id },
      { webhook_url }
    );

    return successResponse(res, {
      webhook_url,
    }, 'Webhook URL updated');

  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to update webhook');
  }
};


exports.getAssignedMids = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.merchant._id)
      .populate('mids', 'mid_code provider status upi_id merchant_name')
      .lean();

    return successResponse(res, merchant.mids || []);

  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to fetch MIDs');
  }
};


/*
──────────────────────────────────────────────
TRANSACTIONS
──────────────────────────────────────────────
*/

exports.getTransactions = async (req, res) => {
  try {

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const { status, order_id } = req.query;

    const filter = {
      merchant_id: req.merchant._id,
    };

    if (status) filter.status = status;
    if (order_id) filter.order_id = order_id;

    const payments = await Payment.find(filter)
      .select('-provider_response -customer_email -customer_mobile')
      .populate('mid_id', 'mid_code provider')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await Payment.countDocuments(filter);
    const successCount = await Payment.countDocuments({
      ...filter,
      status: 'SUCCESS',
    });
    const failedCount = await Payment.countDocuments({
      ...filter,
      status: 'FAILED',
    });
    const pendingCount = await Payment.countDocuments({
      ...filter,
      status: { $in: ['PENDING', 'CREATED'] },
    });

    const successRate =
      total > 0 ? ((successCount / total) * 100).toFixed(2) : 0;

    return successResponse(res, {
      payments,
      total,
      success_count: successCount,
      failed_count: failedCount,
      pending_count: pendingCount,
      page,
      limit,
      success_rate: `${successRate}%`,
    });

  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to fetch transactions');
  }
};


exports.getTransaction = async (req, res) => {
  try {

    const payment = await Payment.findOne({
      payment_id: req.params.payment_id,
      merchant_id: req.merchant._id,
    })
      .populate('mid_id', 'mid_code provider')
      .lean();

    if (!payment) {
      return errorResponse(res, 'Payment not found', 404);
    }

    return successResponse(res, payment);

  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to fetch transaction');
  }
};

const OtpSession = require('../models/OtpSession');
const { getProvider } = require('../providers');

exports.generateOnboardingOtp = async (req, res) => {
  try {
    const { mobile_no } = req.body;
    const name = req.merchant.name;

    if (!mobile_no) {
      return errorResponse(res, 'Mobile number is required', 400);
    }

    const otpProvider = getProvider('reverseotp');
    const result = await otpProvider.generateOtp(mobile_no, name);

    if (!result.success) {
      return errorResponse(res, result.error, 500);
    }

    // Save the pending session to DB for webhook updates and frontend polling
    await OtpSession.create({
      request_id: result.requestId.toString(),
      mobile_no: mobile_no,
      status: 'pending'
    });

    return successResponse(res, { 
      requestId: result.requestId,
      intent: result.intent,
      qr: result.qr 
    }, 'Verification session created');
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

exports.verifyAndLinkMobile = async (req, res) => {
  try {
    const { requestId, mobile_no } = req.body;
    
    if (!requestId || !mobile_no) {
       return errorResponse(res, 'Request ID and mobile number are required', 400);
    }
    
    const session = await OtpSession.findOne({ request_id: requestId.toString() });
    
    if (!session) {
       return errorResponse(res, 'Verification session not found', 404);
    }

    if (session.status !== 'verified') {
       return errorResponse(res, 'Mobile number not yet verified by provider', 400);
    }

    // Link mobile to merchant
    const merchant = await Merchant.findById(req.merchant._id);
    merchant.mobile_no = mobile_no;
    merchant.is_mobile_verified = true;
    await merchant.save();

    return successResponse(res, {
       mobile_no: merchant.mobile_no,
       is_mobile_verified: true
    }, 'Mobile number verified and linked successfully');
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

exports.getOnboardingStatus = async (req, res) => {
  try {
    const { requestId } = req.params;
    const session = await OtpSession.findOne({ request_id: requestId.toString() });
    
    if (!session) {
       return errorResponse(res, 'Session not found', 404);
    }
    
    return successResponse(res, { status: session.status }, 'Status retrieved');
  } catch (err) {
    return errorResponse(res, err.message);
  }
};