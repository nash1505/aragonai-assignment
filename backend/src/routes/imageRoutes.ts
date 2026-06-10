import { Router } from "express";
import multer from "multer";
import os from "os";
import { ImageController } from "../controllers/imageController";

const router = Router();

// Configure Multer to upload to the system temporary directory.
// This is a crucial security and stability measure to avoid loading huge file buffers (e.g. 120MB) directly in RAM.
const upload = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 120 * 1024 * 1024, // 120MB maximum file size limit
  },
});

// Endpoint: Upload multiple images
router.post("/upload", upload.array("files", 15), ImageController.uploadImages);

// Endpoint: Retrieve paginated image list
router.get("/", ImageController.getImages);

// Endpoint: Retrieve metadata/status of a single image
router.get("/:id", ImageController.getImageById);

// Endpoint: Delete an image and its physical files
router.delete("/:id", ImageController.deleteImage);

export default router;
