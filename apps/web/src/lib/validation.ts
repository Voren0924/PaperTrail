export const DEFAULT_MAX_UPLOAD_MB = 50;

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();

  if (!trimmed) {
    return "Email is required.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return "Enter a valid email address.";
  }

  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) {
    return "Password is required.";
  }

  if (value.length < 8) {
    return "Password must be at least 8 characters.";
  }

  return null;
}

export function validatePdfFile(file: File | null, maxUploadMb = DEFAULT_MAX_UPLOAD_MB): string | null {
  if (!file) {
    return "Choose a PDF file.";
  }

  if (file.size <= 0) {
    return "The selected file is empty.";
  }

  const hasPdfName = file.name.toLowerCase().endsWith(".pdf");
  const hasPdfMime = !file.type || file.type === "application/pdf";

  if (!hasPdfName && !hasPdfMime) {
    return "Only PDF files can be uploaded.";
  }

  const maxBytes = maxUploadMb * 1024 * 1024;

  if (file.size > maxBytes) {
    return `PDF must be ${maxUploadMb} MB or smaller.`;
  }

  return null;
}
