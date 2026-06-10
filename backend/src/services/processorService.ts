import fs from "fs/promises";
import path from "path";
import os from "os";
import convert from "heic-convert";
import sharp from "sharp";
import { prisma } from "../config/db";
import { StorageService } from "./storageService";

export class ProcessorService {
  /**
   * Main entry point to process an image.
   * Updates database status to PROCESSING, converts/optimizes the image, and uploads the results.
   */
  static async processImage(imageId: string): Promise<void> {
    const image = await prisma.image.findUnique({
      where: { id: imageId },
    });

    if (!image) {
      console.error(`[Processor] Image not found in database: ${imageId}`);
      return;
    }

    if (image.status === "COMPLETED" || image.status === "FAILED") {
      console.log(`[Processor] Image ${imageId} is already in state: ${image.status}`);
      return;
    }

    // Update state to PROCESSING
    await prisma.image.update({
      where: { id: imageId },
      data: { status: "PROCESSING", errorMessage: null },
    });

    console.log(`[Processor] Starting processing for image: ${image.originalName} (${image.id})`);

    const tempFilesToClean: string[] = [];

    try {
      // 1. Retrieve the file buffer
      const fileBuffer = await StorageService.downloadBuffer(image.originalUrl);

      // 2. Format checks and conversions (HEIC -> JPEG/PNG)
      const isHeic =
        image.mimeType.toLowerCase().includes("heic") ||
        image.mimeType.toLowerCase().includes("heif") ||
        image.originalName.toLowerCase().endsWith(".heic") ||
        image.originalName.toLowerCase().endsWith(".heif");

      let processedBuffer: Buffer;
      let targetMimeType = image.mimeType;

      if (isHeic) {
        console.log(`[Processor] HEIC format detected. Converting to JPEG...`);
        // heic-convert converts the HEIC buffer into a standard image buffer
        processedBuffer = Buffer.from(
          await convert({
            buffer: fileBuffer,
            format: "JPEG",
            quality: 0.9,
          })
        );
        targetMimeType = "image/jpeg";
      } else {
        processedBuffer = fileBuffer;
      }

      // Create a local temp directory for processing assets
      const tempDir = os.tmpdir();
      const baseTempName = `${image.id}-${Date.now()}`;
      
      const tempProcessedPath = path.join(tempDir, `${baseTempName}-optimized.jpg`);
      const tempThumbnailPath = path.join(tempDir, `${baseTempName}-thumb.jpg`);

      tempFilesToClean.push(tempProcessedPath, tempThumbnailPath);

      // 3. Optimize primary image via sharp (Limit max dimension to 1920px to reduce size)
      await sharp(processedBuffer)
        .rotate() // Auto-rotate based on EXIF data
        .resize({
          width: 1920,
          height: 1920,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80, progressive: true })
        .toFile(tempProcessedPath);

      // 4. Generate 200x200 Square Thumbnail via sharp
      await sharp(processedBuffer)
        .rotate()
        .resize(200, 200, {
          fit: "cover", // Crop into a square center-cover thumbnail
        })
        .jpeg({ quality: 75 })
        .toFile(tempThumbnailPath);

      // 5. Upload files using StorageService
      const processedUpload = await StorageService.uploadFile(
        tempProcessedPath,
        `optimized-${image.originalName.replace(/\.[^/.]+$/, "")}.jpg`,
        "image/jpeg"
      );

      const thumbnailUpload = await StorageService.uploadFile(
        tempThumbnailPath,
        `thumb-${image.originalName.replace(/\.[^/.]+$/, "")}.jpg`,
        "image/jpeg"
      );

      // 6. Update database record with success status
      await prisma.image.update({
        where: { id: imageId },
        data: {
          status: "COMPLETED",
          processedUrl: processedUpload.url,
          thumbnailUrl: thumbnailUpload.url,
        },
      });

      console.log(`[Processor] Image processing completed successfully: ${image.id}`);
    } catch (error: any) {
      console.error(`[Processor] Error processing image ${imageId}:`, error);

      // Update database status to FAILED
      await prisma.image.update({
        where: { id: imageId },
        data: {
          status: "FAILED",
          errorMessage: error.message || "Unknown error during image processing",
        },
      });
    } finally {
      // 7. Cleanup generated temp files
      for (const tempPath of tempFilesToClean) {
        try {
          await fs.unlink(tempPath);
        } catch (unlinkError: any) {
          if (unlinkError.code !== "ENOENT") {
            console.error(`[Processor] Temporary file cleanup failed for ${tempPath}:`, unlinkError);
          }
        }
      }
    }
  }
}
