import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { ProcessorService } from "./processorService";
import dotenv from "dotenv";

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || "";
const CONCURRENCY = parseInt(process.env.QUEUE_CONCURRENCY || "2", 10);

export class ImageQueue {
  private static useBullMQ = false;
  private static bullQueue: Queue | null = null;
  private static bullWorker: Worker | null = null;
  private static redisConnection: IORedis | null = null;

  // InMemory fallback queue state
  private static inMemoryQueue: string[] = [];
  private static activeJobsCount = 0;

  /**
   * Initializes the queue system. Attempts to connect to Redis.
   * Gracefully degrades to InMemory queue if Redis is not running.
   */
  static async initialize(): Promise<void> {
    if (!REDIS_URL) {
      console.warn("[Queue] No REDIS_URL configured. Using InMemory queue fallback.");
      this.useBullMQ = false;
      return;
    }

    try {
      console.log("[Queue] Connecting to Redis for BullMQ...");
      
      this.redisConnection = new IORedis(REDIS_URL, {
        maxRetriesPerRequest: null, // Required by BullMQ
        connectTimeout: 2000,       // Fast fail timeout
      });

      // Wrap Redis connection check in a Promise to allow grace fallback
      await new Promise<void>((resolve) => {
        let isSettled = false;

        this.redisConnection!.on("ready", () => {
          console.log("[Queue] Redis connected successfully. Initializing BullMQ...");
          this.useBullMQ = true;
          isSettled = true;
          resolve();
        });

        this.redisConnection!.on("error", (err) => {
          // Catch and suppress errors to prevent Node process from crashing
          if (!isSettled) {
            console.warn(`[Queue] Redis connection failed (${err.message}). Falling back to InMemory queue.`);
            this.useBullMQ = false;
            isSettled = true;
            resolve();
          }
        });
      });

      if (this.useBullMQ) {
        // Initialize Queue
        this.bullQueue = new Queue("image-processing", {
          connection: this.redisConnection as any,
        });

        // Initialize Worker
        this.bullWorker = new Worker(
          "image-processing",
          async (job) => {
            const { imageId } = job.data;
            await ProcessorService.processImage(imageId);
          },
          {
            connection: this.redisConnection as any,
            concurrency: CONCURRENCY,
          }
        );

        this.bullWorker.on("completed", (job) => {
          console.log(`[Queue] BullMQ Job ${job.id} completed.`);
        });

        this.bullWorker.on("failed", (job, err) => {
          console.error(`[Queue] BullMQ Job ${job?.id} failed:`, err);
        });
      }
    } catch (error: any) {
      console.error("[Queue] Initialization exception, falling back to InMemory:", error.message);
      this.useBullMQ = false;
    }
  }

  /**
   * Adds an image processing task to the queue.
   */
  static async addJob(imageId: string): Promise<void> {
    if (this.useBullMQ && this.bullQueue) {
      console.log(`[Queue] [BullMQ] Enqueuing job for image ${imageId}`);
      await this.bullQueue.add(
        `process-${imageId}`,
        { imageId },
        {
          attempts: 3, // Retry up to 3 times
          backoff: {
            type: "exponential",
            delay: 5000, // Delay 5 seconds between retries
          },
          removeOnComplete: true,
          removeOnFail: false, // Keep logs of failed jobs in Redis dashboard
        }
      );
    } else {
      console.log(`[Queue] [InMemory] Enqueuing job for image ${imageId}`);
      this.inMemoryQueue.push(imageId);
      // Run the processing loop asynchronously
      this.processNextInMemoryJob();
    }
  }

  /**
   * Processes the next job in the in-memory queue, respecting concurrency constraints.
   */
  private static async processNextInMemoryJob(): Promise<void> {
    if (this.activeJobsCount >= CONCURRENCY || this.inMemoryQueue.length === 0) {
      return;
    }

    const imageId = this.inMemoryQueue.shift();
    if (!imageId) return;

    this.activeJobsCount++;
    console.log(`[Queue] [InMemory] Running job: ${imageId} (Active jobs: ${this.activeJobsCount}/${CONCURRENCY})`);

    ProcessorService.processImage(imageId)
      .catch((err) => {
        console.error(`[Queue] [InMemory] Processing job ${imageId} uncaught failure:`, err);
      })
      .finally(() => {
        this.activeJobsCount--;
        // Process next available job
        this.processNextInMemoryJob();
      });

    // Keep filling concurrency slots if possible
    this.processNextInMemoryJob();
  }

  /**
   * Graceful cleanup for queue shutdown
   */
  static async shutdown(): Promise<void> {
    console.log("[Queue] Shutting down queue service...");
    if (this.bullWorker) {
      await this.bullWorker.close();
    }
    if (this.redisConnection) {
      await this.redisConnection.quit();
    }
    console.log("[Queue] Shutdown completed.");
  }
}
