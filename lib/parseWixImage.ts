export function parseWixImage(wixRef: string): string {
  if (!wixRef) return "";

  // Example: "wix:image://v1/520482_abc123~mv2.jpg/filename.jpg#originWidth=1000&originHeight=500"
  const match = wixRef.match(/^wix:image:\/\/v1\/([^/]+)/);
  if (!match) return wixRef; // fallback if it's already a full URL

  return `https://static.wixstatic.com/media/${match[1]}`;
}
