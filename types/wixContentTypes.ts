// wixContentTypes.ts
// Type definitions for Wix rich content data structure

/**
 * Style properties that can be applied to text nodes
 */
export interface WixTextStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  textColor?: string;
  backgroundColor?: string;
  fontSize?: string;
  fontFamily?: string;
}

/**
 * Image data properties
 */
export interface WixImageData {
  src: string;
  width: number;
  height: number;
  alt?: string;
  caption?: string;
  link?: string;
}

/**
 * Video data properties
 */
export interface WixVideoData {
  src: string;
  title?: string;
  width?: number;
  height?: number;
  poster?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
}

/**
 * Gallery data properties
 */
export interface WixGalleryData {
  items: WixImageData[];
  layout?: "grid" | "carousel" | "masonry";
  columns?: number;
}

/**
 * Basic node structure for Wix rich content
 */
export interface WixRichTextNode {
  type: string;
  id?: string;
  text?: string;
  children?: WixRichTextNode[];
  url?: string;
  target?: string;
  rel?: string;
  textAlign?: "left" | "center" | "right" | "justify";
  level?: number;
  style?: WixTextStyle;
  imageData?: WixImageData;
  videoData?: WixVideoData;
  galleryData?: WixGalleryData;
  ordered?: boolean;
  columns?: number;
  // Add other properties as needed based on Wix's data structure
}

/**
 * Props for the WixRichTextRenderer component
 */
export interface WixRichTextRendererProps {
  content: WixRichTextNode[] | WixRichTextNode | null | undefined;
  className?: string;
}

/**
 * Utility type for Wix API response
 */
export interface WixContentResponse {
  data: {
    richText?: WixRichTextNode[] | WixRichTextNode;
    // Add other fields from Wix responses
  };
  metadata?: {
    id: string;
    slug?: string;
    // Add other metadata fields
  };
}

/**
 * Sample Wix API response parser
 *
 * @param response The raw response from Wix API
 * @returns Parsed rich text content
 */
export function parseWixContent(response: any): WixRichTextNode[] | null {
  if (!response || !response.data) {
    return null;
  }

  // Extract rich text content from the response
  // This may need to be adjusted based on the actual structure of your Wix API responses
  const richText =
    response.data.richText || response.data.content || response.data;

  if (!richText) {
    return null;
  }

  return Array.isArray(richText) ? richText : [richText];
}
