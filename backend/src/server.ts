import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import imageRoutes from "./routes/imageRoutes";
import { ImageQueue } from "./services/queueService";
import { RecoveryService } from "./services/recoveryService";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 1. Configure CORS
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173", // React app default Vite port
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Serve static local uploads folder with robust security headers
// CSP and nosniff protect against script execution vulnerabilities (e.g. if someone uploads a malicious SVG/HTML containing JavaScript)
const uploadsDir = path.resolve(process.env.LOCAL_STORAGE_DIR || "uploads");
app.use(
  "/uploads",
  express.static(uploadsDir, {
    setHeaders: (res) => {
      res.setHeader("Content-Security-Policy", "default-src 'none'");
      res.setHeader("X-Content-Type-Options", "nosniff");
      // Cache-control optimization for static optimized images
      res.setHeader("Cache-Control", "public, max-age=31536000"); // 1 year cache
    },
  })
);

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "OK", time: new Date() });
});

// 3. Register image API routes
app.use("/api/images", imageRoutes);

// 4. Global Error Handler Middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Uncaught Server Error:", err);
  
  // Clean up multer temporary file if an error occurred during request pipeline
  if (req.file) {
    fsUnlinkSafe(req.file.path);
  }
  if (req.files && Array.isArray(req.files)) {
    for (const file of req.files) {
      fsUnlinkSafe(file.path);
    }
  }

  res.status(err.status || 500).json({
    error: err.message || "An unexpected internal server error occurred.",
  });
});

// Safe helper for global error file cleanup
import fs from "fs";
function fsUnlinkSafe(filePath: string) {
  fs.unlink(filePath, (error) => {
    if (error && error.code !== "ENOENT") {
      console.error(`Failed to delete temporary file ${filePath}:`, error);
    }
  });
}

// 5. App Startup Sequencing
async function startServer() {
  try {
    // A. Initialize background processing queue
    await ImageQueue.initialize();

    // B. Recover stuck jobs from database (runs asynchronously so boot isn't blocked)
    RecoveryService.recoverStuckJobs();

    // C. Start server
    const server = app.listen(PORT, () => {
      console.log(`===================================================`);
      console.log(`🚀 Aragon API Server running on port http://localhost:${PORT}`);
      console.log(`📂 Static files directory: ${uploadsDir}`);
      console.log(`===================================================`);
    });

    // D. Graceful Shutdown handlers
    const gracefulShutdown = async () => {
      console.log("\n[Server] SIGINT/SIGTERM received. Starting graceful shutdown...");
      server.close(async () => {
        console.log("[Server] HTTP server closed.");
        await ImageQueue.shutdown();
        console.log("[Server] Shutdown complete. Exiting.");
        process.exit(0);
      });

      // Force quit after 10s if connections hang
      setTimeout(() => {
        console.error("[Server] Forcefully shutting down after timeout.");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGINT", gracefulShutdown);
    process.on("SIGTERM", gracefulShutdown);
  } catch (error) {
    console.error("[Server] Fatal error during start sequence:", error);
    process.exit(1);
  }
}

startServer();
