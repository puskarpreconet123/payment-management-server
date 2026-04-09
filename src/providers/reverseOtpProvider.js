const axios = require('axios');

class ReverseOtpProvider {
  constructor() {
    this.baseUrl = process.env.REVERSE_OTP_BASEURL;
    this.apiKey = process.env.REVERSE_OTP_API_KEY;
    this.apiSecret = process.env.REVERSE_OTP_API_SECRET;
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
  }

  async generateOtp(mobileNo, name) {
    try {
      // Clean mobile number and extract country code if present (e.g. +91)
      let cleanMobile = mobileNo.replace(/\D/g, '');
      let countryCode = '91'; // default
      if (cleanMobile.length > 10) {
        countryCode = cleanMobile.substring(0, cleanMobile.length - 10);
        cleanMobile = cleanMobile.substring(cleanMobile.length - 10);
      }

      const response = await this.client.post('/create_otp_session', {
        mobile_no: cleanMobile,
        country_code: countryCode,
        api_key: this.apiKey,
        secret: this.apiSecret,
        user_name: name || "Merchant"
      });
      console.log("reverseotp:",response.data)
      // Handle variations where data might not be nested in 'data' object
      const payloadData = response.data?.data || response.data;
      
      return {
        success: true,
        requestId: payloadData?.otp_session_id || payloadData?.id || payloadData?.request_id,
        intent: payloadData?.primary?.intent || payloadData?.intent,
        qr: payloadData?.primary?.qr || payloadData?.qr
      };
    } catch (error) {
      console.error('ReverseOTP generate error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to generate OTP'
      };
    }
  }

  async verifyOtp(mobileNo, otp) {
    try {
      const response = await this.client.post('/check_otp_session', {
        api_key: this.apiKey,
        secret: this.apiSecret,
        otp_session_id: otp
      });
      console.log("reverseotp verification:",response.data)      
      const isSuccess = response.data?.status === 'success' || response.data?.success;
      const sessionStatus = response.data?.data?.status;
      const isVerified = isSuccess && sessionStatus && sessionStatus !== 'pending';

      return {
        success: isVerified,
        message: isVerified ? 'OTP verified' : response.data?.message || 'OTP session is still pending'
      };
    } catch (error) {
      console.error('ReverseOTP verify error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || 'Failed to verify OTP'
      };
    }
  }
}

module.exports = new ReverseOtpProvider();