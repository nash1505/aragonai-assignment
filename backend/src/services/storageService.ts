import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";
import { supabase, SUPABASE_BUCKET } from "../config/supabase";

dotenv.config();

const LOCAL_DIR = process.env.LOCAL_STORAGE_DIR || "uploads";
const SERVER_URL = process.env.SERVER_URL || "http://localhost:3001";

/** True when Supabase credentials are present in the environment. */
const isSupabaseConfigured = (): boolean =>
  !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Ensures the local upload directory exists.
 * Used only when Supabase is not configured (local development fallback).
 */
async function ensureLocalDirectory(): Promise<void> {
  await fs.mkdir(LOCAL_DIR, { recursive: true });
}

export interface UploadResult {
  url: string;
  /** The storage key / filename that was actually persisted. */
  filename: string;
}

// Allowed extensions – must match the controller's validation list exactly
const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".heic"];

export class StorageService {
  /**
   * Uploads a file to Supabase Storage (preferred) or to the local `uploads/`
   * directory (fallback when Supabase credentials are absent).
   *
   * Security measures applied here:
   *  - Filename is replaced with a UUID to prevent directory traversal and name collisions.
   *  - Extension is validated against an allowlist before storage.
   */
  static async uploadFile(
    tempFilePath: string,
    originalName: string,
    mimeType: string
  ): Promise<UploadResult> {
    const fileExt = path.extname(originalName).toLowerCase();

    // Guard: reject disallowed extensions even if the controller somehow passed them through
    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
      throw new Error(`File extension "${fileExt}" is not allowed.`);
    }

    // Generate a cryptographically random filename – no original name leaks to storage
    const secureFilename = `${crypto.randomUUID()}${fileExt}`;

    // ── Supabase path ─────────────────────────────────────────────────────────
    if (isSupabaseConfigured()) {
      const fileBuffer = await fs.readFile(tempFilePath);

      const { error } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(secureFilename, fileBuffer, {
          contentType: mimeType,
          upsert: false, // Never silently overwrite – UUIDs should be unique anyway
        });

      if (error) {
        throw new Error(`Supabase Storage upload failed: ${error.message}`);
      }

      // Get the public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from(SUPABASE_BUCKET)
        .getPublicUrl(secureFilename);

      // Clean up the local temp file – it is no longer needed
      await fs.unlink(tempFilePath).catch(() => {});

      return { url: urlData.publicUrl, filename: secureFilename };
    }

    // ── Local fallback ────────────────────────────────────────────────────────
    await ensureLocalDirectory();

    // Move the temp file into the uploads directory atomically
    const destinationPath = path.join(LOCAL_DIR, secureFilename);
    await fs.rename(tempFilePath, destinationPath);

    const url = `${SERVER_URL}/${LOCAL_DIR}/${secureFilename}`;
    return { url, filename: secureFilename };
  }

  /**
   * Deletes a file from Supabase Storage or the local uploads directory.
   * Failures are logged but do not throw – a missing file should not block a delete request.
   */
  static async deleteFile(fileUrl: string): Promise<void> {
    if (!fileUrl) return;

    // ── Supabase path ─────────────────────────────────────────────────────────
    if (isSupabaseConfigured()) {
      // Extract the storage key from the public URL.
      // Supabase public URLs look like: <supabaseUrl>/storage/v1/object/public/<bucket>/<key>
      const bucketPrefix = `/object/public/${SUPABASE_BUCKET}/`;
      const bucketIndex = fileUrl.indexOf(bucketPrefix);

      if (bucketIndex !== -1) {
        const storageKey = fileUrl.substring(bucketIndex + bucketPrefix.length);

        const { error } = await supabase.storage
          .from(SUPABASE_BUCKET)
          .remove([storageKey]);

        if (error) {
          console.error(
            `[Storage] Supabase delete failed for key "${storageKey}":`,
            error.message
          );
        }
        return;
      }
    }

    // ── Local fallback ────────────────────────────────────────────────────────
    try {
      const urlParts = fileUrl.split(`/${LOCAL_DIR}/`);
      if (urlParts.length > 1) {
        // path.basename prevents any path traversal in the URL segment
        const safePath = path.join(LOCAL_DIR, path.basename(urlParts[1]));
        await fs.unlink(safePath);
      }
    } catch (err: any) {
      if (err.code !== "ENOENT") {
        console.error(`[Storage] Failed to delete local file "${fileUrl}":`, err);
      }
    }
  }

  /**
   * Downloads a file's raw buffer from Supabase Storage (used by the processor
   * service so it can run sharp/heic-convert without writing to disk first).
   */
  static async downloadBuffer(fileUrl: string): Promise<Buffer> {
    if (isSupabaseConfigured()) {
      const bucketPrefix = `/object/public/${SUPABASE_BUCKET}/`;
      const bucketIndex = fileUrl.indexOf(bucketPrefix);

      if (bucketIndex !== -1) {
        const storageKey = fileUrl.substring(bucketIndex + bucketPrefix.length);

        const { data, error } = await supabase.storage
          .from(SUPABASE_BUCKET)
          .download(storageKey);

        if (error || !data) {
          throw new Error(
            `Supabase Storage download failed for key "${storageKey}": ${error?.message}`
          );
        }

        // Blob → Buffer conversion
        return Buffer.from(await data.arrayBuffer());
      }
    }

    // ── Local fallback ────────────────────────────────────────────────────────
    const urlParts = fileUrl.split(`/${LOCAL_DIR}/`);
    if (urlParts.length <= 1) {
      throw new Error(`Cannot resolve local file from URL: ${fileUrl}`);
    }
    const safePath = path.join(LOCAL_DIR, path.basename(urlParts[1]));
    return fs.readFile(safePath);
  }
}
