import { describe, it, expect } from "vitest";
import { getFileExtension, validateFile, validateFiles } from "./fileValidation";
import { MAX_FILE_SIZE_BYTES, MAX_FILES_PER_UPLOAD } from "../constants/appConstants";

describe("getFileExtension", () => {
  it("returns lowercase extension from a filename", () => {
    expect(getFileExtension("image.png")).toBe("png");
    expect(getFileExtension("IMAGE.JPEG")).toBe("jpeg");
    expect(getFileExtension("nested.dir/my-image.HEIC")).toBe("heic");
  });

  it("returns empty string when there is no dot", () => {
    expect(getFileExtension("filename-no-extension")).toBe("");
  });

  it("returns empty string when the dot is at the start (hidden files)", () => {
    expect(getFileExtension(".gitignore")).toBe("");
  });
});

describe("validateFile", () => {
  it("accepts a valid file", () => {
    const file = {
      name: "avatar.png",
      size: 500 * 1024,
      type: "image/png",
    } as unknown as File;

    const result = validateFile(file);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("rejects an empty / 0-byte file", () => {
    const file = {
      name: "empty.png",
      size: 0,
      type: "image/png",
    } as unknown as File;

    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("empty");
  });

  it("rejects a file with missing extension", () => {
    const file = {
      name: "no-ext",
      size: 1024,
      type: "image/png",
    } as unknown as File;

    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("extension");
  });

  it("rejects unsupported extensions", () => {
    const file = {
      name: "virus.exe",
      size: 1024,
      type: "application/x-msdownload",
    } as unknown as File;

    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("supported format");
  });

  it("rejects mime type mismatches", () => {
    const file = {
      name: "test.png",
      size: 1024,
      type: "text/plain",
    } as unknown as File;

    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("does not match");
  });

  it("accepts HEIC with empty or application/octet-stream mime type", () => {
    const file1 = {
      name: "photo.heic",
      size: 1024,
      type: "",
    } as unknown as File;

    const file2 = {
      name: "photo.heic",
      size: 1024,
      type: "application/octet-stream",
    } as unknown as File;

    expect(validateFile(file1).valid).toBe(true);
    expect(validateFile(file2).valid).toBe(true);
  });

  it("rejects files exceeding max size limit", () => {
    const file = {
      name: "huge.png",
      size: MAX_FILE_SIZE_BYTES + 1,
      type: "image/png",
    } as unknown as File;

    const result = validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("exceeds");
  });
});

describe("validateFiles", () => {
  it("splits a batch of files into valid and rejected files", () => {
    const validFile = {
      name: "image1.png",
      size: 1024,
      type: "image/png",
    } as unknown as File;

    const invalidFile = {
      name: "invalid.txt",
      size: 1024,
      type: "text/plain",
    } as unknown as File;

    const result = validateFiles([validFile, invalidFile]);
    expect(result.validFiles).toHaveLength(1);
    expect(result.validFiles[0].name).toBe("image1.png");
    expect(result.rejectedFiles).toHaveLength(1);
    expect(result.rejectedFiles[0].file.name).toBe("invalid.txt");
  });

  it("enforces maximum file count limit per upload batch", () => {
    const files = Array.from({ length: MAX_FILES_PER_UPLOAD + 5 }, (_, i) => ({
      name: `image-${i}.png`,
      size: 1024,
      type: "image/png",
    })) as unknown as File[];

    const result = validateFiles(files);
    expect(result.validFiles).toHaveLength(MAX_FILES_PER_UPLOAD);
    expect(result.rejectedFiles).toHaveLength(5);
    expect(result.rejectedFiles[0].error).toContain(`maximum of ${MAX_FILES_PER_UPLOAD} files`);
  });
});
