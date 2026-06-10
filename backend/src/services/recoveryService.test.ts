import { describe, it, expect, vi, beforeEach } from "vitest";
import { RecoveryService } from "./recoveryService";
import { prisma } from "../config/db";
import { ImageQueue } from "./queueService";
import { ProcessingStatus } from "@prisma/client";

// Mock dependencies
vi.mock("../config/db", () => {
  return {
    prisma: {
      image: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
    },
  };
});

vi.mock("./queueService", () => {
  return {
    ImageQueue: {
      addJob: vi.fn(),
    },
  };
});

describe("RecoveryService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when no stuck jobs are found", async () => {
    vi.mocked(prisma.image.findMany).mockResolvedValueOnce([]);

    await RecoveryService.recoverStuckJobs();

    expect(prisma.image.findMany).toHaveBeenCalled();
    expect(prisma.image.update).not.toHaveBeenCalled();
    expect(ImageQueue.addJob).not.toHaveBeenCalled();
  });

  it("re-enqueues PENDING stuck jobs without updating their status", async () => {
    const mockStuckImages = [
      { id: "img-1", originalName: "test1.jpg", status: ProcessingStatus.PENDING },
    ];
    vi.mocked(prisma.image.findMany).mockResolvedValueOnce(mockStuckImages as any);

    await RecoveryService.recoverStuckJobs();

    expect(prisma.image.findMany).toHaveBeenCalled();
    expect(prisma.image.update).not.toHaveBeenCalled();
    expect(ImageQueue.addJob).toHaveBeenCalledWith("img-1");
  });

  it("resets status to PENDING and re-enqueues PROCESSING stuck jobs", async () => {
    const mockStuckImages = [
      { id: "img-2", originalName: "test2.jpg", status: ProcessingStatus.PROCESSING },
    ];
    vi.mocked(prisma.image.findMany).mockResolvedValueOnce(mockStuckImages as any);
    vi.mocked(prisma.image.update).mockResolvedValueOnce({} as any);

    await RecoveryService.recoverStuckJobs();

    expect(prisma.image.findMany).toHaveBeenCalled();
    expect(prisma.image.update).toHaveBeenCalledWith({
      where: { id: "img-2" },
      data: { status: ProcessingStatus.PENDING },
    });
    expect(ImageQueue.addJob).toHaveBeenCalledWith("img-2");
  });

  it("gracefully catches and logs errors when database query fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.image.findMany).mockRejectedValueOnce(new Error("DB Connection Error"));

    await expect(RecoveryService.recoverStuckJobs()).resolves.not.toThrow();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[Recovery] Scanning failed. Database connection might not be initialized yet:",
      "DB Connection Error"
    );
    consoleErrorSpy.mockRestore();
  });
});
