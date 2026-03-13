// controllers/callbackController.js
const Payment = require('../models/Payment');
const { updatePaymentStatus } = require('../services/paymentService');
const TransactionLog = require('../models/TransactionLog');
const axios = require('axios');

// RupeeFlow calls this endpoint
exports.rupeeFlowCallback = async (req, res) => {
  try {
    const { status, amount, client_id, order_id, utr } = req.body;

    console.log('RupeeFlow Callback:', req.body);

    // Find payment record
    const payment = await Payment.findOne({ payment_id:client_id });

    if (!payment) {
      return res.json({ status: 'error', message: 'Order not found' });
    }

    // Log raw callback payload
    await TransactionLog.create({
      payment_id: payment.payment_id,
      merchant_id: payment.merchant_id,
      event_type: 'CALLBACK_RECEIVED',
      status_from: payment.status,
      status_to: 'RECEIVED',
      raw_data: req.body
    });

    // Prevent duplicate callback processing
    if (payment.status === 'SUCCESS') {
      if (utr && !payment.utr) {
        payment.utr = utr;
        await payment.save();
        console.log(`Updated missing UTR for already processed payment ${order_id}: ${utr}`);
      }
      return res.json({ status: 'success', message: 'Already processed' });
    }

    // Update status based on callback
    const newStatus = status === 'credit' ? 'SUCCESS' : 'FAILED';

    await updatePaymentStatus(payment, newStatus, { utr, provider_response: req.body });

    // Use centralized webhook service for merchant notification
    const { sendWebhook, sendRawCallback } = require('../services/webhookService');
    setImmediate(() => {
      sendWebhook(payment, 1);
      sendRawCallback(payment, req.body);
    });

    res.json({ status: 'success', message: 'Callback processed' });

  } catch (error) {
    console.error('Callback error', error);
    res.json({ status: 'error', message: 'Failed to process callback' });
  }
};

// CGPEY calls this endpoint
exports.cgpeyCallback = async (req, res) => {
  try {
    const { status, order_id, utr, amount } = req.body;

    console.log('CGPEY Callback:', req.body);

    // Find payment record (CGPEY order_id is our payment_id)
    const payment = await Payment.findOne({ payment_id: order_id });

    if (!payment) {
      return res.json({ status: 'error', message: 'Payment not found' });
    }

    // Log raw callback payload
    await TransactionLog.create({
      payment_id: payment.payment_id,
      merchant_id: payment.merchant_id,
      event_type: 'CALLBACK_RECEIVED',
      status_from: payment.status,
      status_to: 'RECEIVED',
      raw_data: req.body
    });

    if (payment.status === 'SUCCESS') {
      return res.json({ status: 'success', message: 'Already processed' });
    }

    const newStatus = status === 'SUCCESS' ? 'SUCCESS' : 'FAILED';
    await updatePaymentStatus(payment, newStatus, { utr, provider_response: req.body });

    // Trigger merchant notifications
    const { sendWebhook, sendRawCallback } = require('../services/webhookService');
    setImmediate(() => {
      sendWebhook(payment, 1);
      sendRawCallback(payment, req.body);
    });

    res.json({ status: 'success', message: 'Callback processed' });

  } catch (error) {
    console.error('CGPEY Callback error', error);
    res.json({ status: 'error', message: 'Failed to process callback' });
  }
};