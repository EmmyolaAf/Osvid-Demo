import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "./client";
import { firebaseConfig } from "../firebase";

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
 * Returns the currently configured Firebase Storage bucket name.
 * Strictly aligned with the resolved client Firebase configuration.
 * Avoids independent fallback that could disagree with staging configuration.
 */
export function getConfiguredStorageBucket(): string {
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim()) {
    return process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET.trim();
  }
  return firebaseConfig?.storageBucket?.trim() || storage?.app?.options?.storageBucket?.trim() || "";
}

/**
 * Checks if a URL is an owned Firebase Storage URL for managed catalogue objects.
 * Strictly verifies:
 * 1. Firebase Storage hostname (firebasestorage.googleapis.com)
 * 2. Exact configured Firebase storage bucket
 * 3. Decoded object path begins with products/ or categories/
 * 4. No directory traversal attempts
 */
export function isOwnedStorageUrl(url?: string | null, expectedBucket: string = getConfiguredStorageBucket()): boolean {
  if (!url || typeof url !== "string") return false;

  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "firebasestorage.googleapis.com") {
      return false;
    }

    // Pattern: /v0/b/{bucket}/o/{encodedPath}
    const match = parsed.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
    if (!match) {
      return false;
    }

    const rawBucket = match[1];
    const rawPath = match[2];

    const decodedBucket = decodeURIComponent(rawBucket);
    if (decodedBucket !== expectedBucket) {
      return false;
    }

    const decodedPath = decodeURIComponent(rawPath);

    // Defense-in-depth: disallow path traversal sequences
    if (decodedPath.includes("..") || decodedPath.includes("\\")) {
      return false;
    }

    // Must strictly start with products/ or categories/
    if (
      !decodedPath.startsWith("products/") &&
      !decodedPath.startsWith("categories/")
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
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

  return new Promise((resolve) => {
    let settled = false;

    // Safety timeout: If Firebase Storage connection or CORS hangs for > 8s, fall back to Data URL
    const fallbackTimer = setTimeout(() => {
      if (!settled) {
        settled = true;
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({
            success: true,
            downloadUrl: reader.result as string,
            storagePath: `local-data/${file.name}`,
          });
        };
        reader.onerror = () => {
          resolve({
            success: false,
            error: "Image upload timed out. You can also paste an image URL directly.",
          });
        };
        reader.readAsDataURL(file);
      }
    }, 8000);

    try {
      const storagePath = generateManagedStoragePath(folder, file.name);
      const storageRef = ref(storage, storagePath);

      const uploadTask = uploadBytesResumable(storageRef, file, {
        contentType: file.type,
        cacheControl: "public, max-age=31536000",
      });

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          if (onProgress && snapshot.totalBytes > 0) {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            onProgress(Math.round(progress));
          }
        },
        (error) => {
          if (!settled) {
            settled = true;
            clearTimeout(fallbackTimer);
            // Fallback to data URL on network/storage rejection
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve({
                success: true,
                downloadUrl: reader.result as string,
                storagePath: `local-data/${file.name}`,
              });
            };
            reader.onerror = () => {
              resolve({
                success: false,
                error: error.message || "Storage upload failed. Please use the direct link option.",
              });
            };
            reader.readAsDataURL(file);
          }
        },
        async () => {
          if (!settled) {
            settled = true;
            clearTimeout(fallbackTimer);
            try {
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve({
                success: true,
                downloadUrl,
                storagePath,
              });
            } catch (urlErr: any) {
              // Fallback to data URL
              const reader = new FileReader();
              reader.onloadend = () => {
                resolve({
                  success: true,
                  downloadUrl: reader.result as string,
                  storagePath: `local-data/${file.name}`,
                });
              };
              reader.readAsDataURL(file);
            }
          }
        }
      );
    } catch (err: any) {
      if (!settled) {
        settled = true;
        clearTimeout(fallbackTimer);
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({
            success: true,
            downloadUrl: reader.result as string,
            storagePath: `local-data/${file.name}`,
          });
        };
        reader.onerror = () => {
          resolve({
            success: false,
            error: err.message || "Failed to initialize upload task.",
          });
        };
        reader.readAsDataURL(file);
      }
    }
  });
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
