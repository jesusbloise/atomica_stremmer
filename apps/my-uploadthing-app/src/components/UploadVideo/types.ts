// Tipos compartidos entre los subcomponentes.

export type VideoInfo = {
  id: string;
  name: string;
  url: string;
  subtituloTexto?: string;
  mimeType?: string;
  sizeBytes?: number;
  created_at?: string;
  tipo?: "video" | "documento" | string;
};

export type FilterKey = "con_subtitulos" | "sin_subtitulos" | "hoy" | null;
