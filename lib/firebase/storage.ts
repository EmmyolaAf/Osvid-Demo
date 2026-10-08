import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "./client";

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export type AllowedMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export interface UploadProgressCallback {
  (progressPercent: number): void;
}

export interface StorageUploadResult {
  success: boolean;
  downloadUrl?: string;
  storagePath?: string;
  error?: string;
}

/**
 * Validates file MIME type and file size before upload
 */
export function validateMediaFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: "No file provided for upload." };
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type as AllowedMimeType)) {
    return {
      valid: false,
      error: `Unsupported image format (${file.type || "unknown"}). Only JPEG, PNG, and WebP are permitted.`,
    };
  }

  if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File size (${sizeMb} MB) exceeds maximum allowed limit of 5 MB.`,
    };
  }

  return { valid: true };
}

/**
 * Generates a sanitized, collision-free storage path for catalogue assets.
 * Strictly prevents path traversal and user-controlled path injection.
 */
export function generateManagedStoragePath(
  category: "products" | "categories" | "blog" | "site",
  originalFileName: string
): string {
  // Strip any directory traversal attempts from filename
  const cleanBaseName = (originalFileName || "").replace(/^.*[\\/]/, "");
  const extMatch = cleanBaseName.match(/\.(jpe?g|png|webp)$/i);
  const ext = extMatch ? extMatch[1].toLowerCase().replace("jpeg", "jpg") : "webp";

  const randomSuffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 12);
  const timestamp = Date.now();

  return `${category}/${timestamp}-${randomSuffix}.${ext}`;
}

/**
 * Checks if a URL is an owned Firebase Storage URL for managed catalogue objects
 */
export function isOwnedStorageUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  return (
    url.includes("firebasestorage.googleapis.com") &&
    (url.includes("/o/products%2F") || url.includes("/o/categories%2F"))
  );
}

/**
 * Uploads a product or category image to Firebase Storage with progress tracking
 */
export async function uploadCatalogueImage(
  file: File,
  folder: "products" | "categories",
  onProgress?: UploadProgressCallback
): Promise<StorageUploadResult> {
  const validation = validateMediaFile(file);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  try {
    const storagePath = generateManagedStoragePath(folder, file.name);
    const storageRef = ref(storage, storagePath);

    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
      cacheControl: "public, max-age=31536000",
    });

    return new Promise((resolve) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          if (onProgress && snapshot.totalBytes > 0) {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            onProgress(Math.round(progress));
          }
        },
        (error) => {
          resolve({
            success: false,
            error: error.message || "Firebase Storage upload failed.",
          });
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            resolve({
              success: true,
              downloadUrl,
              storagePath,
            });
          } catch (urlErr: any) {
            resolve({
              success: false,
              error: urlErr.message || "Failed to retrieve uploaded image download URL.",
            });
          }
        }
      );
    });
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to initialize upload task.",
    };
  }
}

/**
 * Safely deletes an owned Firebase Storage image object.
 * Strictly ignores external URLs (e.g. Unsplash, Wix) to prevent unintended deletions.
 */
export async function deleteOwnedStorageImage(url?: string | null): Promise<boolean> {
  if (!isOwnedStorageUrl(url)) {
    return false;
  }

  try {
    const urlObj = new URL(url!);
    const pathMatch = urlObj.pathname.match(/\/o\/(.+)$/);
    if (!pathMatch || !pathMatch[1]) return false;

    const decodedPath = decodeURIComponent(pathMatch[1]);
    const fileRef = ref(storage, decodedPath);
    await deleteObject(fileRef);
    return true;
  } catch (err) {
    console.warn("Could not delete previous image asset from Firebase Storage:", err);
    return false;
  }
}
