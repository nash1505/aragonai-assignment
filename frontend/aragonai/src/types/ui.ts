export interface UploadProgressItem {
  id: string;
  name: string;
  progress: number;
  size: string;
  status: "uploading" | "success" | "failed" | "rejected";
  error?: string;
}
