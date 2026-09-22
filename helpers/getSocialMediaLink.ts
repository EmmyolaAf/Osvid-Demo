// helpers/socialMedia.ts

import { Facebook, Instagram, Linkedin, Twitter } from "lucide-react";

/**
 * Generates a full social media URL from a username or a direct link.
 * Handles common social media platforms and their URL structures.
 *
 * @param platform The social media platform (e.g., "facebook", "instagram", "linkedin").
 * @param usernameOrLink The username (e.g., "osvidcompany", "@osvidcompany") or a full direct link.
 * @returns The complete URL for the social media profile, or null if platform is unknown/username is empty.
 */
export function getSocialMediaLink(
  platform: string,
  usernameOrLink: string | null | undefined
): string | null {
  if (!usernameOrLink) {
    return null; // Return null if no username/link is provided
  }

  // If it's already a full URL, return it directly
  if (
    usernameOrLink.startsWith("http://") ||
    usernameOrLink.startsWith("https://")
  ) {
    return usernameOrLink;
  }

  // Remove leading '@' for consistency when building URLs
  const cleanedUsername = usernameOrLink.startsWith("@")
    ? usernameOrLink.substring(1)
    : usernameOrLink;

  switch (platform.toLowerCase()) {
    case "facebook":
      return `https://www.facebook.com/${cleanedUsername}`;
    case "instagram":
      return `https://www.instagram.com/${cleanedUsername}`;
    case "linkedin":
      // LinkedIn can be company pages, personal profiles, or showcases.
      // This assumes a company page or profile URL. For personal profiles,
      // it might be 'in/username'. For company pages, it's 'company/companyname'.
      // You might need to adjust this based on your specific LinkedIn link type.
      return `https://www.linkedin.com/company/${cleanedUsername}`;
    case "twitter": // Example for future expansion
    case "x":
      return `https://x.com/${cleanedUsername}`;
    case "youtube":
      return `https://www.youtube.com/@${cleanedUsername}`;
    // Add more platforms as needed
    default:
      console.warn(`Unknown social media platform: ${platform}`);
      return null;
  }
}

// Helper to map platform names to Lucide icons
export const SocialIconMap: { [key: string]: React.ElementType } = {
  facebook: Facebook,
  instagram: Instagram,
  twitter: Twitter,
  linkedin: Linkedin,
  // Add other platforms here if you extend companyData.socialMedia
  // twitter: X, // Or TwitterIcon, if you prefer the old name
  // youtube: Youtube,
};
