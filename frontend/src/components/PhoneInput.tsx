import React from 'react';
import RPNInput, { type Value } from 'react-phone-number-input';
import fr from 'react-phone-number-input/locale/fr.json';
import 'react-phone-number-input/style.css';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

// Country/dial-code selector + per-country formatting + paste auto-detection,
// backed by libphonenumber-js. Always produces/accepts E.164 (e.g. +221771234567),
// which is what the backend's validateAndNormalizePhone() expects.
export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder = 'Numéro de téléphone'
}) => {
  return (
    <div className="phone-input-wrapper">
      <RPNInput
        international
        defaultCountry="CI"
        labels={fr}
        value={value as Value}
        onChange={(val) => onChange(val || '')}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
      />
    </div>
  );
};
