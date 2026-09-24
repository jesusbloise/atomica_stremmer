const API_BASE_URL =
  "https://atomica-stremmer-web-23864640850.us-central1.run.app";

export type LoginResponse = {
  success: boolean;
  requiresTwoFactor?: boolean;
  requiresTwoFactorSetup?: boolean;
  challengeToken?: string;
  message?: string;
  error?: string;
};

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/api/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
    }),
  });

  const data = (await response.json()) as LoginResponse;

  if (!response.ok) {
    throw new Error(data.error || "No se pudo iniciar sesión");
  }

  return data;
}

export { API_BASE_URL };

export type TwoFactorLoginResponse = {
  success: boolean;
  id?: string;
  name?: string;
  role?: string;
  authToken?: string;
  error?: string;
};

export async function verifyTwoFactorLogin(
  challengeToken: string,
  code: string,
): Promise<TwoFactorLoginResponse> {
  const response = await fetch(`${API_BASE_URL}/api/login/2fa`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      challengeToken,
      code: code.replace(/\D/g, ""),
    }),
  });

  const data = (await response.json()) as TwoFactorLoginResponse;

  if (!response.ok) {
    throw new Error(data.error || "No se pudo completar la verificación");
  }

  return data;
}

export type VideoItem = {
  id: string;
  url?: string | null;
  file_path?: string | null;
  r2_path?: string | null;
  file_name?: string;
  display_name?: string | null;
  titulo?: string | null;
  tipo?: string;
  thumbnail_url?: string | null;
  cf_stream_playback_url?: string | null;
  using_cloudflare_stream?: boolean;
  uploaded_at?: string | null;
  created_at?: string | null;
  views?: number | null;
  category?: string | null;
  subcategory?: string | null;
  contentType?: string | null;
  mimeType?: string | null;
};

export async function getVideos(authToken: string): Promise<VideoItem[]> {
  const response = await fetch(`${API_BASE_URL}/api/videos`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`No se pudieron cargar los videos (${response.status})`);
  }

  const data = (await response.json()) as VideoItem[];

  if (!Array.isArray(data)) {
    throw new Error("La respuesta de videos no es válida");
  }

  return data;
}

export type SubcategoryItem = {
  id: string;
  label: string;
  is_active: boolean;
  sort_order: number;
};

export type CategoryItem = {
  id: string;
  slug: string;
  label: string;
  description?: string | null;
  cover?: string | null;
  is_active: boolean;
  sort_order: number;
  subcategories: SubcategoryItem[];
};

type CategoriesResponse = {
  categories: CategoryItem[];
  error?: string;
};

export async function getCategories(
  authToken?: string,
): Promise<CategoryItem[]> {
  const response = await fetch(`${API_BASE_URL}/api/categories`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  });

  const data = (await response.json()) as CategoriesResponse;

  if (!response.ok) {
    throw new Error(data.error || "No se pudieron cargar las categorías");
  }

  if (!Array.isArray(data.categories)) {
    throw new Error("La respuesta de categorías no es válida");
  }

  return data.categories;
}

export type UploadItem = {
  id: string;
  file_name?: string | null;
  display_name?: string | null;
  titulo?: string | null;
  file_key?: string | null;
  file_path?: string | null;
  r2_path?: string | null;
  size_in_bytes?: number | null;
  uploaded_at?: string | null;
  tipo?: string | null;
  category?: string | null;
  subcategory?: string | null;
  thumbnail_url?: string | null;
  cf_stream_uid?: string | null;
  cf_stream_status?: string | null;
  cf_stream_ready?: boolean | null;
  cf_stream_playback_url?: string | null;
  visibility?: "PUBLIC" | "RESTRICTED" | null;
  requires_approval?: boolean | null;
  approval_status?: string | null;
  created_by_id?: string | null;
  url?: string | null;
  using_cloudflare_stream?: boolean;
  using_r2?: boolean;
};

export async function getCategoryUploads(
  authToken: string,
  category: string,
  limit = 80,
): Promise<UploadItem[]> {
  const params = new URLSearchParams({
    category,
    limit: String(limit),
  });

  const response = await fetch(
    `${API_BASE_URL}/api/uploads?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`No se pudieron cargar los archivos (${response.status})`);
  }

  const data = (await response.json()) as UploadItem[];

  if (!Array.isArray(data)) {
    throw new Error("La respuesta de archivos no es válida");
  }

  return data;
}
export type UploadDetail = {
  id: string;
  tipo?: string | null;
  titulo?: string | null;
  display_name?: string | null;
  file_name?: string | null;
  ext?: string | null;
  content_type?: string | null;
  url?: string | null;
  uploaded_at?: string | null;
  views?: number;
  category?: string | null;
  subcategory?: string | null;

  visibility?: "PUBLIC" | "RESTRICTED" | null;
  created_by_id?: string | null;
  can_manage_privacy?: boolean;

  ficha?: Record<string, unknown> | null;

  vimeo_id?: string | null;
  duration_sec?: number | null;
  thumbnail_url?: string | null;

  file_path?: string | null;
  r2_path?: string | null;
  streaming_path?: string | null;
  playback_path?: string | null;
  using_streaming?: boolean;
  using_r2?: boolean;

  cf_stream_uid?: string | null;
  cf_stream_status?: string | null;
  cf_stream_ready?: boolean;
  cf_stream_playback_url?: string | null;
  cf_stream_hls_url?: string | null;
  using_cloudflare_stream?: boolean;
};

type UploadDetailResponse = {
  upload?: UploadDetail;
  error?: string;
};

export async function getUploadById(
  authToken: string,
  id: string,
): Promise<UploadDetail> {
  const response = await fetch(
    `${API_BASE_URL}/api/uploads/${encodeURIComponent(id)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    },
  );

  const data = (await response.json()) as UploadDetailResponse;

  if (!response.ok) {
    throw new Error(
      data.error || `No se pudo cargar el archivo (${response.status})`,
    );
  }

  if (!data.upload?.id) {
    throw new Error("La respuesta del archivo no es válida");
  }

  return data.upload;
}
export type CurrentUser = {
  id?: string;
  sub?: string;
  name: string;
  email?: string | null;
  role:
    | "SUPER_ADMIN"
    | "ADMIN"
    | "USUARIO"
    | "PROFESOR"
    | "ESTUDIANTE";
  avatarUrl?: string | null;
};

export async function getMe(
  authToken: string,
): Promise<CurrentUser> {
  const response = await fetch(`${API_BASE_URL}/api/me`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${authToken}`,
    },
  });

  const data = (await response.json()) as CurrentUser & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(
      data.error || `No se pudo validar la sesión (${response.status})`,
    );
  }

  if (!data?.name || !data?.role) {
    throw new Error("La respuesta de sesión no es válida");
  }

  return data;
}
export type SearchResultItem = {
  id: string;
  file_name?: string | null;
  display_name?: string | null;
  titulo?: string | null;
  tipo?: string | null;

  url?: string | null;
  file_path?: string | null;
  r2_path?: string | null;

  thumbnail_url?: string | null;

  uploaded_at?: string | null;
  created_at?: string | null;
  views?: number | null;

  category?: string | null;
  subcategory?: string | null;

  contentType?: string | null;
  mimeType?: string | null;

  ficha?: {
    titulo?: string | null;
    [key: string]: unknown;
  } | null;
};

type SearchResponse = {
  results?: SearchResultItem[];
  error?: string;
};

export async function searchUploads(
  authToken: string,
  query: string,
): Promise<SearchResultItem[]> {
  const q = query.trim();

  if (!q) {
    return [];
  }

  const response = await fetch(
    `${API_BASE_URL}/api/buscar?q=${encodeURIComponent(q)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    },
  );

  const data = (await response.json()) as SearchResponse;

  if (!response.ok) {
    throw new Error(
      data.error || `No se pudo realizar la búsqueda (${response.status})`,
    );
  }

  if (!Array.isArray(data.results)) {
    throw new Error("La respuesta de búsqueda no es válida");
  }

  return data.results;
}
export type TechnicalSheet = {
  upload_id?: string | null;
  titulo?: string | null;

  marca?: string | null;
  agencia?: string | null;
  productora?: string | null;
  contacto?: string | null;

  oficina?: string | null;
  tipo?: string[];

  estudio?: string | null;
  director?: string | null;
  productor?: string | null;

  produccion?: string | null;
  corporativo?: string | null;
  nuevosNegocios?: string | null;
  otros?: string | null;

  duracion?: string | null;
  formato?: string | null;
  version?: string | null;
  fecha?: string | null;
};

type TechnicalSheetResponse = {
  ficha?: TechnicalSheet | null;
  error?: string;
};

export async function getTechnicalSheet(
  authToken: string,
  uploadId: string,
): Promise<TechnicalSheet | null> {
  const response = await fetch(
    `${API_BASE_URL}/api/fichas/${encodeURIComponent(uploadId)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    },
  );

  const data = (await response.json()) as TechnicalSheetResponse;

  if (!response.ok) {
    throw new Error(
      data.error || `No se pudo cargar la ficha técnica (${response.status})`,
    );
  }

  return data.ficha ?? null;
}

export type TranscriptLine = {
  id: number;
  video_id: string | null;
  time_start: number | null;
  time_end: number | null;
  text: string | null;
};

export async function getTranscript(
  authToken: string,
  uploadId: string,
): Promise<TranscriptLine[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/subtitulos/${encodeURIComponent(uploadId)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    },
  );

  const data = (await response.json()) as TranscriptLine[] | {
    error?: string;
  };

  if (!response.ok) {
    const errorData = data as { error?: string };

    throw new Error(
      errorData.error ||
        `No se pudo cargar la transcripción (${response.status})`,
    );
  }

  if (!Array.isArray(data)) {
    throw new Error("La respuesta de transcripción no es válida");
  }

  return data;
}

export type StreamCaption = {
  language?: string | null;
  label?: string | null;
  status?: string | null;
  generated?: boolean | null;
  [key: string]: unknown;
};

type StreamCaptionsResponse = {
  ok?: boolean;
  captions?: StreamCaption[];
  error?: string;
};

export async function getStreamCaptions(
  authToken: string,
  uploadId: string,
): Promise<StreamCaption[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/uploads/${encodeURIComponent(uploadId)}/captions`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    },
  );

  const data = (await response.json()) as StreamCaptionsResponse;

  if (!response.ok) {
    // Un video que todavía no está en Cloudflare Stream no debe
    // romper por completo su pantalla de detalle.
    if (response.status === 400) {
      return [];
    }

    throw new Error(
      data.error || `No se pudieron cargar los subtítulos (${response.status})`,
    );
  }

  return Array.isArray(data.captions) ? data.captions : [];
}
export async function updateTechnicalSheet(
  authToken: string,
  uploadId: string,
  ficha: TechnicalSheet,
): Promise<TechnicalSheet | null> {
  const response = await fetch(
    `${API_BASE_URL}/api/fichas/${encodeURIComponent(uploadId)}`,
    {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        titulo: ficha.titulo?.trim() || null,
        marca: ficha.marca?.trim() || null,
        agencia: ficha.agencia?.trim() || null,
        productora: ficha.productora?.trim() || null,
        contacto: ficha.contacto?.trim() || null,
        oficina: ficha.oficina?.trim() || null,
        tipo: Array.isArray(ficha.tipo) ? ficha.tipo : [],
        estudio: ficha.estudio?.trim() || null,
        director: ficha.director?.trim() || null,
        productor: ficha.productor?.trim() || null,
        produccion: ficha.produccion?.trim() || null,
        corporativo: ficha.corporativo?.trim() || null,
        nuevosNegocios: ficha.nuevosNegocios?.trim() || null,
        otros: ficha.otros?.trim() || null,
        duracion: ficha.duracion?.trim() || null,
        formato: ficha.formato?.trim() || null,
        version: ficha.version?.trim() || null,
        fecha: ficha.fecha?.trim() || null,
      }),
    },
  );

  const data = (await response.json().catch(() => ({}))) as
    TechnicalSheetResponse & {
      ok?: boolean;
    };

  if (!response.ok) {
    throw new Error(
      data.error || `No se pudo guardar la ficha técnica (${response.status})`,
    );
  }

  // Igual que el ORIGINAL: refrescamos la ficha desde el backend
  // después de guardar para quedarnos con el estado real persistido.
  return getTechnicalSheet(authToken, uploadId);
}

type UpdateTranscriptResponse = {
  subtitle?: {
    id?: number;
    text?: string | null;
  };
  error?: string;
};

export async function updateTranscriptLine(
  authToken: string,
  videoId: string,
  subtitleId: number,
  text: string,
): Promise<string> {
  const cleanText = text.trim();

  if (!Number.isInteger(subtitleId) || subtitleId <= 0) {
    throw new Error("Esta línea no tiene un identificador válido.");
  }

  if (!videoId.trim()) {
    throw new Error("No se pudo identificar el video.");
  }

  if (!cleanText) {
    throw new Error("La línea no puede quedar vacía.");
  }

  const response = await fetch(
    `${API_BASE_URL}/api/subtitulos/${encodeURIComponent(videoId)}`,
    {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        subtitleId,
        text: cleanText,
      }),
    },
  );

  const data = (await response.json().catch(() => ({}))) as
    UpdateTranscriptResponse;

  if (!response.ok) {
    throw new Error(
      data.error || `No se pudo guardar la corrección (${response.status})`,
    );
  }

  return data.subtitle?.text?.trim() || cleanText;
}