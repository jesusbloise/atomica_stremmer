// src/components/UploadVideo/helpers.ts
// Utilidades puras: NO JSX aquí.

export const getExt = (nameOrUrl: string = "") =>
  (nameOrUrl.split("?")[0].split("#")[0].split(".").pop() || "").toLowerCase();

export const isVideoExt = (ext: string) =>
  ["mp4", "mov", "mkv", "webm", "avi"].includes(ext);

export const isPdfExt = (ext: string) => ext === "pdf";
export const isDocxExt = (ext: string) => ext === "docx";

export const getKind = (mimeType?: string, name?: string, url?: string) => {
  const mt = (mimeType || "").toLowerCase();
  const ext = getExt(name || url || "");

  if (mt.startsWith("video/")) return "video";
  if (mt.startsWith("image/")) return "image";
  if (mt.startsWith("audio/")) return "audio";

  if (["mp4", "webm", "mov", "mkv"].includes(ext)) return "video";
  if (["jpg", "jpeg", "png", "gif", "webp", "avif"].includes(ext)) return "image";
  if (["mp3", "wav", "ogg", "m4a"].includes(ext)) return "audio";
  if (isPdfExt(ext)) return "pdf";
  if (isDocxExt(ext)) return "docx";

  return "doc";
};

