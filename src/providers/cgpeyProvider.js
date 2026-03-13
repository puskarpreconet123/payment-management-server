const axios = require('axios');

/**
 * CGPEY Provider Adapter
 */
const createPayment = async (options) => {
    const {
        amount,
        payment_id,
        customer_name,
        customer_mobile,
        api_key,    // x-api-key
        api_secret, // x-secret-key
    } = options;

    console.log("CGPEY Provider: Creating order...");

    try {
        const response = await axios.post(
            "https://merchant.cgpey.com/api/v2/makepayment",
            {
                user_id: "G2TEQk", // From user spec, might need to be dynamic later
                name: customer_name,
                mobile_number: customer_mobile,
                amount: amount,
                transaction_id: payment_id,
                return_url: process.env.FRONTEND_URL 
                    ? `${process.env.FRONTEND_URL}/checkout/${payment_id}/status`
                    : `http://localhost:5173/checkout/${payment_id}/status`
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": api_key,
                    "x-secret-key": api_secret,
                    "ip-address": process.env.CGPEY_WHITELISTED_IP || "127.0.0.1" // Whitelisted IP
                },
                timeout: 10000
            }
        );

        const data = response.data;

        if (!data.status) {
            throw new Error(data.message || "CGPEY API error");
        }

        return {
            success: true,
            provider_payment_id: data.data?.txnId,
            qr_string: data.data?.intentData || data.data?.qrData,
            upi_link: data.data?.intentData || data.data?.qrData,
            raw_response: data
        };
    } catch (error) {
        console.error("CGPEY Create Payment Error:", error.response?.data || error.message);
        throw new Error(error.response?.data?.message || "CGPEY connection failed");
    }
};

/**
 * Check payment status via CGPEY check-status API
 */
const checkPaymentStatus = async (provider_payment_id, api_key, api_secret, extras = {}) => {
    const { payment_id } = extras;

    console.log(`CGPEY Provider: Checking status for ${payment_id}...`);

    try {
        const response = await axios.post(
            "https://merchant.cgpey.com/api/v2/payment-check-status",
            {
                transaction_id: payment_id
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": api_key,
                    "x-secret-key": api_secret,
                    "ip-address": process.env.CGPEY_WHITELISTED_IP || "127.0.0.1"
                },
                timeout: 8000
            }
        );

        const data = response.data;

        // CGPEY status mapping
        let status = 'PENDING';
        if (data.status === 'success') {
            status = 'SUCCESS';
        } else if (data.status === 'failed') {
            status = 'FAILED';
        }

        return {
            provider_payment_id,
            status,
            utr: data.utr || null,
            raw_response: data
        };
    } catch (error) {
        console.error("CGPEY Status Check Error:", error.response?.data || error.message);
        // If error, assume pending to avoid accidental failures
        return { status: 'PENDING', utr: null, raw_response: error.response?.data || { error: error.message } };
    }
};

module.exports = {
    createPayment,
    checkPaymentStatus,
};
