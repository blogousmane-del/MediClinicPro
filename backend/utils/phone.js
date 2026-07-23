const { parsePhoneNumberFromString } = require('libphonenumber-js');

// Validates a phone number for any country and normalizes it to E.164 (e.g. +221771234567).
// Returns { valid: true, e164 } or { valid: false, error }.
function validateAndNormalizePhone(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return { valid: false, error: "Numéro de téléphone requis." };
  }

  const phoneNumber = parsePhoneNumberFromString(rawPhone);

  if (!phoneNumber || !phoneNumber.isValid()) {
    return { valid: false, error: "Numéro de téléphone invalide pour le pays sélectionné." };
  }

  return { valid: true, e164: phoneNumber.number };
}

module.exports = { validateAndNormalizePhone };
