import { apiRequest } from "./api";
import type { Job, Paper } from "./types";

export type PaperListResponse = {
  papers: Paper[];
};

export type PaperResponse = {
  paper: Paper;
};

export type PaperUploadResponse = {
  paper: Paper;
  job: Job | null;
};

export function listPapers(): Promise<PaperListResponse> {
  return apiRequest<PaperListResponse>("/api/papers");
}

export function getPaper(paperId: string): Promise<PaperResponse> {
  return apiRequest<PaperResponse>(`/api/papers/${encodeURIComponent(paperId)}`);
}

export function uploadPaper(file: File): Promise<PaperUploadResponse> {
  const body = new FormData();
  body.append("file", file);

  return apiRequest<PaperUploadResponse>("/api/papers", {
    method: "POST",
    body
  });
}

export function retryPaper(paperId: string): Promise<PaperUploadResponse> {
  return apiRequest<PaperUploadResponse>(`/api/papers/${encodeURIComponent(paperId)}/retry`, {
    method: "POST"
  });
}
