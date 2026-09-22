import { parsePhoneNumber, formatNumber } from "libphonenumber-js";

/**
 * Formats a phone number to an international standard,
 * attempting to detect the country or defaulting to Nigeria.
 *
 * @param {string | number} phoneNumber The phone number to format.
 * @param {string} [defaultCountryCode='NG'] The default country code to use if not detectable.
 * @returns {string | null} The formatted phone number, or null if invalid.
 */
import type { CountryCode } from "libphonenumber-js";

export function formatUniversalPhoneNumber(
  phoneNumber: string | number,
  defaultCountryCode: CountryCode = "NG"
) {
  if (!phoneNumber) {
    return null;
  }

  try {
    // Parse the number, allowing it to guess the country based on the number itself
    // Or providing a default country if it's a local number.
    const phoneNumberObject = parsePhoneNumber(String(phoneNumber), {
      defaultCallingCode: defaultCountryCode === "NG" ? "234" : undefined, // Provide default calling code if needed
      defaultCountry: defaultCountryCode, // Use default country for local numbers
    });

    if (phoneNumberObject && phoneNumberObject.isValid()) {
      // Format to international format with spaces (e.g., "+234 814 395 9711")
      return phoneNumberObject.formatInternational();
    }
    return null;
  } catch (error) {
    // Catch errors for invalid numbers that can't be parsed
    console.error("Error formatting phone number:", error);
    return null;
  }
}
