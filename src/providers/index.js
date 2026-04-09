const rupeeFlowProvider = require('./rupeeFlowProvider');
const cgpeyProvider = require('./cgpeyProvider');
const reverseOtpProvider = require('./reverseOtpProvider');

const PROVIDERS = {
  rupeeflow: rupeeFlowProvider,
  cgpey: cgpeyProvider,
  reverseotp: reverseOtpProvider,
};

/**
 * Get provider adapter by name
 * @param {string} providerName
 * @returns {Object} Provider adapter
 */
const getProvider = (providerName) => {
  const provider = PROVIDERS[providerName.toLowerCase()];
  if (!provider) {
    throw new Error(`Unsupported payment provider: ${providerName}`);
  }
  return provider;
};

module.exports = { getProvider };
