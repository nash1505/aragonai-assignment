import { prisma } from "../config/db";
import { ImageQueue } from "./queueService";
import { ProcessingStatus } from "@prisma/client";

export class RecoveryService {
  /**
   * Scans the database for any jobs stuck in PENDING or PROCESSING states
   * (typically due to a crash or restart) and re-enqueues them for processing.
   */
  static async recoverStuckJobs(): Promise<void> {
    console.log("[Recovery] Scanning for stuck image processing tasks...");
    try {
      const stuckImages = await prisma.image.findMany({
        where: {
          status: {
            in: [ProcessingStatus.PENDING, ProcessingStatus.PROCESSING],
          },
        },
        select: {
          id: true,
          originalName: true,
          status: true,
        },
      });

      if (stuckImages.length === 0) {
        console.log("[Recovery] No stuck tasks found. Database is clean.");
        return;
      }

      console.log(`[Recovery] Found ${stuckImages.length} stuck task(s). Re-enqueuing...`);
      
      for (const image of stuckImages) {
        console.log(
          `[Recovery] Re-enqueuing stuck image: "${image.originalName}" (ID: ${image.id}, Stuck in: ${image.status})`
        );
        // Force processing status change to PENDING if it was stuck in PROCESSING
        if (image.status === ProcessingStatus.PROCESSING) {
          await prisma.image.update({
            where: { id: image.id },
            data: { status: ProcessingStatus.PENDING },
          }).catch((err: any) => {
            console.error(`[Recovery] Failed to reset status for image ${image.id}:`, err.message);
          });
        }
        
        await ImageQueue.addJob(image.id);
      }

      console.log("[Recovery] Recovery scanning complete. All tasks re-enqueued.");
    } catch (error: any) {
      console.error(
        "[Recovery] Scanning failed. Database connection might not be initialized yet:",
        error.message
      );
    }
  }
}
