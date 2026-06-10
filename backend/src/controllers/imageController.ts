import { Request, Response } from "express";
import fs from "fs/promises";
import path from "path";
import { prisma } from "../config/db";
import { StorageService } from "../services/storageService";
import { ImageQueue } from "../services/queueService";
import { ProcessingStatus } from "@prisma/client";

// Maximum upload file size (120MB)
const MAX_FILE_SIZE = 120 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".heic"];
const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/heic",
  "image/heif",
];

export class ImageController {
  /**
   * Uploads multiple files.
   * Performs validation, uploads originals, and queues them for processing.
   */
  static async uploadImages(req: Request, res: Response): Promise<void> {
    const files = req.files as Express.Multer.File[] | undefined;

    if (!files || files.length === 0) {
      res.status(400).json({ error: "No files uploaded" });
      return;
    }

    const createdImages = [];
    const errors: { filename: string; error: string }[] = [];

    // Process files sequentially or in parallel safely
    for (const file of files) {
      const fileExt = path.extname(file.originalname).toLowerCase();
      
      // 1. Strict Validation checks
      if (file.size > MAX_FILE_SIZE) {
        errors.push({
          filename: file.originalname,
          error: "File size exceeds 120MB limit.",
        });
        await fs.unlink(file.path).catch(() => {}); // Clean up temp file
        continue;
      }

      const isMimeValid = ALLOWED_MIME_TYPES.includes(file.mimetype);
      const isExtValid = ALLOWED_EXTENSIONS.includes(fileExt);

      if (!isMimeValid || !isExtValid) {
        errors.push({
          filename: file.originalname,
          error: "Unsupported format. Only PNG, JPEG, and HEIC are allowed.",
        });
        await fs.unlink(file.path).catch(() => {}); // Clean up temp file
        continue;
      }

      try {
        // 2. Upload original image to S3 or local directory
        const storageResult = await StorageService.uploadFile(
          file.path, // Temporary location
          file.originalname,
          file.mimetype
        );

        // 3. Create database record
        const newImage = await prisma.image.create({
          data: {
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            status: ProcessingStatus.PENDING,
            originalUrl: storageResult.url,
          },
          select: {
            id: true,
            originalName: true,
            mimeType: true,
            size: true,
            status: true,
            originalUrl: true,
            createdAt: true,
          },
        });

        // 4. Dispatch background job for conversion & thumbnailing
        await ImageQueue.addJob(newImage.id);

        createdImages.push(newImage);
      } catch (err: any) {
        console.error(`Failed to handle upload for ${file.originalname}:`, err);
        errors.push({
          filename: file.originalname,
          error: err.message || "Failed to save file.",
        });
        await fs.unlink(file.path).catch(() => {}); // Clean up temp file if still present
      }
    }

    if (createdImages.length === 0 && errors.length > 0) {
      res.status(400).json({ error: "All uploads failed validation", details: errors });
      return;
    }

    res.status(201).json({
      message: `${createdImages.length} file(s) uploaded successfully.`,
      images: createdImages,
      errors: errors.length > 0 ? errors : undefined,
    });
  }

  /**
   * Retrieves a paginated list of images.
   * Optimized using cursor-based pagination and selective fields query projection.
   */
  static async getImages(req: Request, res: Response): Promise<void> {
    try {
      const limit = Math.min(parseInt(req.query.limit as string || "20", 10), 100);
      const cursor = req.query.cursor as string | undefined;
      const statusStr = req.query.status as string | undefined;

      // Typecheck status if provided
      let status: ProcessingStatus | undefined;
      if (statusStr && Object.values(ProcessingStatus).includes(statusStr as ProcessingStatus)) {
        status = statusStr as ProcessingStatus;
      }

      const queryOptions: any = {
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          size: true,
          status: true,
          originalUrl: true,
          processedUrl: true,
          thumbnailUrl: true,
          errorMessage: true,
          createdAt: true,
        },
      };

      const whereClause: any = {};
      if (status) {
        whereClause.status = status;
      }
      queryOptions.where = whereClause;

      if (cursor) {
        queryOptions.cursor = { id: cursor };
        queryOptions.skip = 1; // Skip the cursor item itself
      }

      const images = await prisma.image.findMany(queryOptions);

      // Determine the next cursor if we retrieved the full limit page size
      const nextCursor = images.length === limit ? images[images.length - 1].id : null;

      res.json({
        images,
        nextCursor,
      });
    } catch (err: any) {
      console.error("Failed to query images:", err);
      res.status(500).json({ error: "Failed to query database." });
    }
  }

  /**
   * Retrieves status metadata of a single image.
   */
  static async getImageById(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;

      const image = await prisma.image.findUnique({
        where: { id },
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          size: true,
          status: true,
          originalUrl: true,
          processedUrl: true,
          thumbnailUrl: true,
          errorMessage: true,
          createdAt: true,
        },
      });

      if (!image) {
        res.status(404).json({ error: "Image not found." });
        return;
      }

      res.json(image);
    } catch (err: any) {
      console.error(`Failed to find image ${req.params.id}:`, err);
      res.status(500).json({ error: "Failed to search database." });
    }
  }

  /**
   * Deletes an image record and removes physical files from S3/local storage.
   */
  static async deleteImage(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id as string;

      const image = await prisma.image.findUnique({
        where: { id },
      });

      if (!image) {
        res.status(404).json({ error: "Image not found." });
        return;
      }

      // 1. Delete associated physical files in background or parallel
      const fileDeletions = [
        StorageService.deleteFile(image.originalUrl),
      ];

      if (image.processedUrl) {
        fileDeletions.push(StorageService.deleteFile(image.processedUrl));
      }
      if (image.thumbnailUrl) {
        fileDeletions.push(StorageService.deleteFile(image.thumbnailUrl));
      }

      await Promise.all(fileDeletions).catch((err) => {
        console.error(`Warning: Failed to delete some files from storage for image ${id}:`, err);
      });

      // 2. Delete database row
      await prisma.image.delete({
        where: { id },
      });

      res.json({
        message: "Image and associated files deleted successfully.",
        id,
      });
    } catch (err: any) {
      console.error(`Failed to delete image ${req.params.id}:`, err);
      res.status(500).json({ error: "Failed to delete record." });
    }
  }
}
