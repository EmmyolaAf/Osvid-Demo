// utils/text.ts
import { convert } from "html-to-text";

/**
 * Removes HTML tags from a given string.
 * Uses 'html-to-text' for robust and safe HTML parsing in both browser and Node.js environments.
 *
 * @param htmlString The string possibly containing HTML tags.
 * @returns The plain text content, or an empty string if input is null/undefined.
 */
export function stripHtmlTags(htmlString: string | null | undefined): string {
  // Handle null, undefined, or non-string inputs gracefully.
  if (typeof htmlString !== "string" || !htmlString) {
    return "";
  }

  try {
    // Use the 'html-to-text' library to convert HTML to plain text.
    // Configure it to remove links and other unnecessary elements if desired.
    return convert(htmlString, {
      wordwrap: false, // Prevents wrapping long lines
      // Optionally, you can configure further to remove specific elements or styles
      // For example, to remove links:
      // selectors: [
      //   { selector: 'a', options: { ignoreHref: true } },
      // ],
      // You can also add more options based on your needs:
      // https://www.npmjs.com/package/html-to-text#options
    });
  } catch (error) {
    // Log the error for debugging, but return empty string to prevent breaking.
    console.error("Failed to strip HTML tags:", error);
    return "";
  }
}

/**
 * Truncates a given text string to a specified maximum length.
 * Appends an ellipsis "..." if the text is truncated.
 *
 * @param text The input string to truncate.
 * @param maxLength The maximum desired length for the truncated string (excluding ellipsis).
 * @returns The truncated string with ellipsis, or the original string if within length.
 */
export function truncateText(
  text: string | null | undefined,
  maxLength: number
): string {
  // Handle null, undefined, or non-string inputs gracefully.
  if (typeof text !== "string" || !text) {
    return "";
  }

  // Ensure maxLength is a positive number.
  if (maxLength <= 0) {
    return "";
  }

  if (text.length <= maxLength) {
    return text;
  }

  // Trim to maxLength and add ellipsis.
  return text.slice(0, maxLength) + "...";
}
