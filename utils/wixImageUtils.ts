// utils/wixImageUtils.ts

export function getWixStaticImageUrl(
  wixImageUrl: string | undefined
): string | undefined {
  if (!wixImageUrl || !wixImageUrl.startsWith("wix:image://")) {
    return wixImageUrl; // Return as is if not a wix image URL or undefined
  }

  try {
    // Expected format: 'wix:image://v1/<file_id>/<file_name>#params'
    // Split by '/' will give:
    // parts[0] = 'wix:image:'
    // parts[1] = '' (due to //)
    // parts[2] = 'v1'
    // parts[3] = '<file_id>'
    // parts[4] = '<file_name_with_params>'
    const parts = wixImageUrl.split("/");
    const fileId = parts[3]; // <--- CORRECTED: Now parts[3] to get the fileId

    if (!fileId) {
      console.warn("Could not extract fileId from Wix image URL:", wixImageUrl);
      return undefined; // Or return a default image URL
    }

    // Construct the static Wix URL
    // The format is typically: https://static.wixstatic.com/media/<file_id>
    return `https://static.wixstatic.com/media/${fileId}`;
  } catch (error) {
    console.error("Error processing Wix image URL:", wixImageUrl, error);
    return undefined; // Or return a default image URL
  }
}
