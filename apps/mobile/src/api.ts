import {
  File,
  UploadType,
} from "expo-file-system";

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
  subcategory?: string | null,
): Promise<UploadItem[]> {
  const params = new URLSearchParams({
    category,
    limit: String(limit),
  });

  if (subcategory?.trim()) {
    params.set("subcategory", subcategory.trim());
  }

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

  const upload = data.upload;

  if (upload.url?.startsWith("/")) {
    upload.url = `${API_BASE_URL}${upload.url}`;
  }

  return upload;
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
export type ProfileParticipation = {
  fecha: string;
  nombre: string;
  miniatura: string;
  ruta: string;
};

export type UserProfile = {
  user_id: string;
  name: string;
  email?: string | null;
  role?: CurrentUser["role"];
  generacion?: string | null;
  facultad?: string | null;
  descripcion?: string | null;
  avatar_url?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  whatsapp?: string | null;
  participaciones: ProfileParticipation[];
};

export async function getUserProfile(
  authToken: string,
  userId: string,
): Promise<UserProfile> {
  const response = await fetch(
    `${API_BASE_URL}/api/perfiles/${encodeURIComponent(userId)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    },
  );

  const data = (await response.json()) as UserProfile & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(
      data.error || `No se pudo cargar el perfil (${response.status})`,
    );
  }

  return {
    ...data,
    participaciones: Array.isArray(data.participaciones)
      ? data.participaciones
      : [],
    avatar_url: data.avatar_url?.startsWith("/")
      ? `${API_BASE_URL}${data.avatar_url}`
      : data.avatar_url,
  };
}

export type UpdateProfileInput = {
  nombre: string;
  email: string;
  generacion: string;
  facultad: string;
  descripcion: string;
  instagram: string;
  facebook: string;
  whatsapp: string;
  participaciones: ProfileParticipation[];
  avatar?: {
    uri: string;
    name?: string;
    type?: string;
  } | null;
};

export async function updateProfile(
  authToken: string,
  input: UpdateProfileInput,
): Promise<UserProfile> {
  const formData = new FormData();

  formData.append("nombre", input.nombre);
  formData.append("email", input.email);
  formData.append("generacion", input.generacion);
  formData.append("facultad", input.facultad);
  formData.append("descripcion", input.descripcion);
  formData.append("instagram", input.instagram);
  formData.append("facebook", input.facebook);
  formData.append("whatsapp", input.whatsapp);
  formData.append(
    "participaciones",
    JSON.stringify(input.participaciones),
  );

  if (input.avatar?.uri) {
    formData.append(
      "avatar",
      {
        uri: input.avatar.uri,
        name: input.avatar.name || "avatar.jpg",
        type: input.avatar.type || "image/jpeg",
      } as any,
    );
  }

  const response = await fetch(`${API_BASE_URL}/api/perfil`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: formData,
  });

  const data = (await response.json()) as UserProfile & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(
      data.error || `No se pudo guardar el perfil (${response.status})`,
    );
  }

  return {
    ...data,
    participaciones: Array.isArray(data.participaciones)
      ? data.participaciones
      : [],
    avatar_url: data.avatar_url?.startsWith("/")
      ? `${API_BASE_URL}${data.avatar_url}`
      : data.avatar_url,
  };
}

export type TwoFactorStatus = {
  success: boolean;
  enabled: boolean;
  enabledAt?: string | null;
};

export async function getTwoFactorStatus(
  authToken: string,
): Promise<TwoFactorStatus> {
  const response = await fetch(`${API_BASE_URL}/api/2fa/status`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${authToken}`,
    },
  });

  const data = (await response.json()) as TwoFactorStatus & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(
      data.error || `No se pudo consultar 2FA (${response.status})`,
    );
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

export type DocumentText = {
  id?: string | null;
  upload_id: string;
  tipo?: string | null;
  texto?: string | null;
  video_id?: string | null;
  file_name?: string | null;
  texto_extraido?: string | null;
  creado_en?: string | null;
  num_paginas?: number | null;
  num_lineas?: number | null;
  num_palabras?: number | null;
  num_frases?: number | null;
  resumen?: string | null;
  posiciones?: unknown;
};

export async function getDocumentText(
  authToken: string,
  uploadId: string,
): Promise<DocumentText | null> {
  const response = await fetch(
    `${API_BASE_URL}/api/documento/${encodeURIComponent(uploadId)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    },
  );

  const data = (await response.json()) as {
    documento?: DocumentText | null;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(
      data.error ||
        `No se pudo cargar el contenido del documento (${response.status})`,
    );
  }

  return data.documento ?? null;
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
export type UploadVisibility = "PUBLIC" | "RESTRICTED";

export type ThumbnailCandidate = {
  timeSec: number;
  r2Uri: string;
  url: string;
};

export async function updateUploadVisibility(
  authToken: string,
  uploadId: string,
  visibility: UploadVisibility,
): Promise<UploadVisibility> {
  const response = await fetch(
    `${API_BASE_URL}/api/uploads/${encodeURIComponent(uploadId)}`,
    {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ visibility }),
    },
  );

  const data = (await response.json().catch(() => ({}))) as {
    visibility?: UploadVisibility;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(
      data.error || `No se pudo cambiar la privacidad (${response.status})`,
    );
  }

  return data.visibility || visibility;
}

export async function moveUpload(
  authToken: string,
  uploadId: string,
  category: string,
  subcategory?: string | null,
): Promise<{
  id: string;
  file_name?: string | null;
  category?: string | null;
  subcategory?: string | null;
}> {
  const response = await fetch(
    `${API_BASE_URL}/api/uploads/${encodeURIComponent(uploadId)}/category`,
    {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        category: category.trim(),
        subcategory: subcategory?.trim() || "",
      }),
    },
  );

  const data = (await response.json().catch(() => ({}))) as {
    upload?: {
      id: string;
      file_name?: string | null;
      category?: string | null;
      subcategory?: string | null;
    };
    error?: string;
  };

  if (!response.ok || !data.upload) {
    throw new Error(
      data.error || `No se pudo mover el archivo (${response.status})`,
    );
  }

  return data.upload;
}

export async function createUploadShareLink(
  authToken: string,
  uploadId: string,
  expiresInHours: number,
): Promise<string> {
  const response = await fetch(
    `${API_BASE_URL}/api/uploads/${encodeURIComponent(uploadId)}/share-link`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ expiresInHours }),
    },
  );

  const data = (await response.json().catch(() => ({}))) as {
    shareUrl?: string;
    error?: string;
  };

  if (!response.ok || !data.shareUrl) {
    throw new Error(
      data.error || `No se pudo generar el enlace (${response.status})`,
    );
  }

  return data.shareUrl;
}

export async function getThumbnailCandidates(
  authToken: string,
  uploadId: string,
): Promise<ThumbnailCandidate[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/uploads/${encodeURIComponent(uploadId)}/thumbnail-candidates`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    },
  );

  const data = (await response.json().catch(() => ({}))) as {
    candidates?: ThumbnailCandidate[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(
      data.error || `No se pudieron generar las portadas (${response.status})`,
    );
  }

  return Array.isArray(data.candidates)
    ? data.candidates.map((candidate) => ({
        ...candidate,
        url: candidate.url.startsWith("http")
          ? candidate.url
          : `${API_BASE_URL}${candidate.url}`,
      }))
    : [];
}

export function getUploadDownloadUrl(uploadId: string): string {
  return `${API_BASE_URL}/api/uploads/${encodeURIComponent(uploadId)}/download`;
}
export async function selectUploadThumbnail(
  authToken: string,
  uploadId: string,
  thumbnailUrl: string,
): Promise<string> {
  const response = await fetch(
    `${API_BASE_URL}/api/uploads/${encodeURIComponent(uploadId)}/thumbnail-select`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        thumbnail_url: thumbnailUrl,
      }),
    },
  );

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    thumbnail_url?: string;
    error?: string;
  };

  if (!response.ok || !data.thumbnail_url) {
    throw new Error(
      data.error ||
        `No se pudo seleccionar la portada (${response.status})`,
    );
  }

  return data.thumbnail_url;
}
export async function uploadCustomThumbnail(
  authToken: string,
  uploadId: string,
  image: {
    uri: string;
    fileName?: string | null;
    mimeType?: string | null;
  },
): Promise<string> {
  const formData = new FormData();

  formData.append(
    "file",
    {
      uri: image.uri,
      name: image.fileName || "thumbnail.jpg",
      type: image.mimeType || "image/jpeg",
    } as any,
  );

  const response = await fetch(
    `${API_BASE_URL}/api/uploads/${encodeURIComponent(uploadId)}/thumbnail`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: formData,
    },
  );

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    thumbnail_url?: string;
    error?: string;
  };

  if (!response.ok || !data.thumbnail_url) {
    throw new Error(
      data.error ||
        `No se pudo subir la portada (${response.status})`,
    );
  }

  return data.thumbnail_url;
}
export type UploadAccessLevel =
  | "VIEWER"
  | "APPROVER"
  | "EDITOR";

export type UploadPermissionUser = {
  permissionId: string;
  userId: string;
  name: string | null;
  email: string | null;
  accessLevel: UploadAccessLevel;
};

export type UploadPermissionGroup = {
  permissionId: string;
  groupId: string;
  name: string;
  color: string | null;
  memberCount: number;
  accessLevel: UploadAccessLevel;
};

export type UploadPermissions = {
  visibility: "PUBLIC" | "RESTRICTED";
  canManage: boolean;
  users: UploadPermissionUser[];
  groups: UploadPermissionGroup[];
  total: number;
};

export async function getUploadPermissions(
  authToken: string,
  uploadId: string,
): Promise<UploadPermissions> {
  const response = await fetch(
    `${API_BASE_URL}/api/uploads/${encodeURIComponent(uploadId)}/permissions`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    },
  );

  const data = (await response.json().catch(() => ({}))) as
    Partial<UploadPermissions> & {
      error?: string;
    };

  if (!response.ok) {
    throw new Error(
      data.error ||
        `No se pudieron cargar los permisos (${response.status})`,
    );
  }

  return {
    visibility:
      data.visibility === "RESTRICTED"
        ? "RESTRICTED"
        : "PUBLIC",
    canManage: data.canManage === true,
    users: Array.isArray(data.users) ? data.users : [],
    groups: Array.isArray(data.groups) ? data.groups : [],
    total:
      typeof data.total === "number"
        ? data.total
        : (data.users?.length ?? 0) +
          (data.groups?.length ?? 0),
  };
}
export type MobileUploadFile = {
  uri: string;
  name: string;
  size: number;
  mimeType?: string | null;
};

export type UploadFicha = {
  titulo?: string;
  marca?: string;
  agencia?: string;
  productora?: string;
  contacto?: string;
  oficina?: "Chile" | "Mexico" | "";
  tipo?: string[];
  estudio?: string;
  director?: string;
  productor?: string;
  produccion?: string;
  corporativo?: string;
  nuevosNegocios?: string;
  otros?: string;
  duracion?: string | null;
  formato?: string | null;
  version?: string | null;
  fecha?: string | null;
};

export type UploadAssignment = {
  userId: string;
  accessLevel: UploadAccessLevel;
};

export type UploadGroupAssignment = {
  groupId: string;
  accessLevel: UploadAccessLevel;
};

export type CreateUploadInput = {
  file: MobileUploadFile;
  category: string;
  subcategory?: string;
  ficha: UploadFicha;
  visibility: UploadVisibility;
  requiresApproval: boolean;
  assignedUsers: UploadAssignment[];
  assignedGroups: UploadGroupAssignment[];
};

export type MultipartUploadInit = {
  uploadId: string;
  finalizeToken: string;
  partSize: number;
  totalParts: number;
};

export type CompletedMultipartPart = {
  partNumber: number;
  etag: string;
};

type UploadResponse = {
  id?: string;
  upload?: { id?: string };
  file?: { id?: string };
  record?: { id?: string };
  error?: string;
};

function getCreatedUploadId(data: UploadResponse): string | null {
  return (
    data.id ||
    data.upload?.id ||
    data.file?.id ||
    data.record?.id ||
    null
  );
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T;
}

function bearerHeaders(authToken: string) {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${authToken}`,
  };
}

export async function createSmallUpload(
  authToken: string,
  input: CreateUploadInput,
): Promise<string> {
  const nativeFile = new File(input.file.uri);

  if (!nativeFile.exists) {
    throw new Error(
      "El archivo seleccionado ya no está disponible.",
    );
  }

  const result = await nativeFile.upload(
    `${API_BASE_URL}/api/upload-minio`,
    {
      httpMethod: "POST",
      uploadType: UploadType.MULTIPART,
      fieldName: "file",
      mimeType:
        input.file.mimeType || "application/octet-stream",
      headers: {
        Authorization: `Bearer ${authToken}`,
        Accept: "application/json",
      },
      parameters: {
        category: input.category,
        subcategory: input.subcategory || "",
        ficha: JSON.stringify(input.ficha),
        visibility: input.visibility,
        requiresApproval: String(input.requiresApproval),
        assignedUsers: JSON.stringify(input.assignedUsers),
        assignedGroups: JSON.stringify(input.assignedGroups),
      },
    },
  );

  let data: UploadResponse;

  try {
    data = JSON.parse(result.body) as UploadResponse;
  } catch {
    throw new Error(
      `El servidor devolvió una respuesta no válida (${result.status}).`,
    );
  }

  if (result.status < 200 || result.status >= 300) {
    throw new Error(
      data.error ||
        `No se pudo subir el archivo (${result.status})`,
    );
  }

  const uploadId = getCreatedUploadId(data);

  if (!uploadId) {
    throw new Error(
      "La subida terminó, pero el servidor no devolvió el ID del archivo.",
    );
  }

  return uploadId;
}

export async function initMultipartUpload(
  authToken: string,
  input: CreateUploadInput,
): Promise<MultipartUploadInit> {
  const response = await fetch(`${API_BASE_URL}/api/upload-minio`, {
    method: "POST",
    headers: {
      ...bearerHeaders(authToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: "multipart-r2-init",
      fileName: input.file.name,
      contentType:
        input.file.mimeType || "application/octet-stream",
      size: input.file.size,
      category: input.category,
      subcategory: input.subcategory || "",
      ficha: input.ficha,
      visibility: input.visibility,
      requiresApproval: input.requiresApproval,
      assignedUsers: input.assignedUsers,
      assignedGroups: input.assignedGroups,
    }),
  });

  const data = await readJsonResponse<
    Partial<MultipartUploadInit> & { error?: string }
  >(response);

  if (
    !response.ok ||
    !data.uploadId ||
    !data.finalizeToken ||
    typeof data.partSize !== "number" ||
    typeof data.totalParts !== "number"
  ) {
    throw new Error(
      data.error ||
        `No se pudo iniciar la subida multipart (${response.status})`,
    );
  }

  return {
    uploadId: data.uploadId,
    finalizeToken: data.finalizeToken,
    partSize: data.partSize,
    totalParts: data.totalParts,
  };
}

export async function signMultipartPart(
  authToken: string,
  uploadId: string,
  finalizeToken: string,
  partNumber: number,
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/upload-minio`, {
    method: "POST",
    headers: {
      ...bearerHeaders(authToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: "multipart-r2-sign-part",
      uploadId,
      finalizeToken,
      partNumber,
    }),
  });

  const data = await readJsonResponse<{
    uploadUrl?: string;
    error?: string;
  }>(response);

  if (!response.ok || !data.uploadUrl) {
    throw new Error(
      data.error ||
        `No se pudo preparar la parte ${partNumber} (${response.status})`,
    );
  }

  return data.uploadUrl;
}

export async function completeMultipartUpload(
  authToken: string,
  uploadId: string,
  finalizeToken: string,
  parts: CompletedMultipartPart[],
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/upload-minio`, {
    method: "POST",
    headers: {
      ...bearerHeaders(authToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: "multipart-r2-complete",
      uploadId,
      finalizeToken,
      parts,
    }),
  });

  const data = await readJsonResponse<{ error?: string }>(response);

  if (!response.ok) {
    throw new Error(
      data.error ||
        `No se pudo completar la subida (${response.status})`,
    );
  }
}

export async function finalizeMultipartUpload(
  authToken: string,
  finalizeToken: string,
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/upload-minio`, {
    method: "POST",
    headers: {
      ...bearerHeaders(authToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: "finalize-direct-r2",
      finalizeToken,
    }),
  });

  const data = await readJsonResponse<UploadResponse>(response);

  if (!response.ok) {
    throw new Error(
      data.error ||
        `No se pudo finalizar el archivo (${response.status})`,
    );
  }

  const createdUploadId = getCreatedUploadId(data);

  if (!createdUploadId) {
    throw new Error(
      "El servidor finalizó la subida, pero no devolvió el ID del archivo.",
    );
  }

  return createdUploadId;
}

export async function abortMultipartUpload(
  authToken: string,
  uploadId: string,
  finalizeToken: string,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/upload-minio`, {
    method: "POST",
    headers: {
      ...bearerHeaders(authToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: "multipart-r2-abort",
      uploadId,
      finalizeToken,
    }),
  });

  if (!response.ok) {
    const data = await readJsonResponse<{ error?: string }>(response);

    throw new Error(
      data.error ||
        `No se pudo cancelar la subida (${response.status})`,
    );
  }
}
export type AvailableUploadUser = {
  id: string;
  name: string | null;
  email: string | null;
  role?: string | null;
  is_active?: boolean;
};

export type AvailableUploadGroup = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  color?: string | null;
  is_active: boolean;
  member_count: number;
};

export async function getAvailableUploadUsers(
  authToken: string,
): Promise<AvailableUploadUser[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/users?page=1&limit=50`,
    {
      method: "GET",
      headers: bearerHeaders(authToken),
    },
  );

  const data = (await readJsonResponse(response)) as {
    rows?: AvailableUploadUser[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(
      data.error ||
        `No se pudieron cargar los usuarios (${response.status})`,
    );
  }

  const rows = Array.isArray(data.rows) ? data.rows : [];

  return rows.filter((user) => user.is_active !== false);
}

export async function getAvailableUploadGroups(
  authToken: string,
): Promise<AvailableUploadGroup[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/user-groups`,
    {
      method: "GET",
      headers: bearerHeaders(authToken),
    },
  );

  const data = (await readJsonResponse(response)) as {
    rows?: AvailableUploadGroup[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(
      data.error ||
        `No se pudieron cargar los grupos (${response.status})`,
    );
  }

  const rows = Array.isArray(data.rows) ? data.rows : [];

  return rows.filter((group) => group.is_active !== false);
}
export type ControlCargaStatus =
  | "COMPLETE"
  | "INCOMPLETE"
  | "EMPTY"
  | "WITHOUT_FICHA";

export type ControlCargaUpload = {
  id: string;
  fileName: string;
  uploadedAt: string;
  tipo: string | null;
  category: string | null;
  subcategory: string | null;
  createdById: string | null;
  uploadedBy: {
    id: string | null;
    name: string | null;
    email: string | null;
  };
  ficha: {
    exists: boolean;
    status: ControlCargaStatus;
    completion: number;
    completedFields: number;
    totalFields: number;
    missingFields: string[];
  };
};

export type ControlCargaRankingItem = {
  userId: string | null;
  name: string;
  email: string | null;
  uploads: number;
  complete: number;
  pending: number;
  compliance: number;
};

export type ControlCargasResponse = {
  summary: {
    total: number;
    complete: number;
    incomplete: number;
    empty: number;
    withoutFicha: number;
    pending: number;
    averageCompletion: number;
    usersWithUploads: number;
  };
  filters: {
    search: string;
    userId: string;
    status: string;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  ranking: ControlCargaRankingItem[];
  uploads: ControlCargaUpload[];
  error?: string;
};

export type ControlCargasFilters = {
  search?: string;
  status?:
    | "ALL"
    | "COMPLETE"
    | "INCOMPLETE"
    | "EMPTY"
    | "WITHOUT_FICHA";
  userId?: string;
  page?: number;
  limit?: number;
};

export async function getControlCargas(
  authToken: string,
  filters: ControlCargasFilters = {},
): Promise<ControlCargasResponse> {
  const params = new URLSearchParams();

  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  if (filters.status && filters.status !== "ALL") {
    params.set("status", filters.status);
  }

  if (filters.userId) {
    params.set("userId", filters.userId);
  }

  params.set("page", String(filters.page ?? 1));
  params.set("limit", String(filters.limit ?? 20));

  const response = await fetch(
    `${API_BASE_URL}/api/admin/control-cargas?${params.toString()}`,
    {
      method: "GET",
      headers: bearerHeaders(authToken),
    },
  );

  const data =
    await readJsonResponse<ControlCargasResponse>(response);

  if (!response.ok) {
    throw new Error(
      data.error ||
        `No se pudo cargar el control de cargas (${response.status})`,
    );
  }

  return data;
}
export type ManagedUserRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "USUARIO";

export type ManagedUser = {
  id: string;
  name: string | null;
  email: string;
  role: ManagedUserRole;
  is_active: boolean;
  created_at: string;
  total_uploads: number;
  public_uploads: number;
  restricted_uploads: number;
  private_access_count: number;
  shared_people_count: number;
};

export type ManagedUsersResponse = {
  rows: ManagedUser[];
  total: number;
};

export async function getManagedUsers(
  authToken: string,
  options: {
    q?: string;
    page?: number;
    limit?: number;
  } = {},
): Promise<ManagedUsersResponse> {
  const params = new URLSearchParams();

  if (options.q?.trim()) {
    params.set("q", options.q.trim());
  }

  params.set("page", String(options.page ?? 1));
  params.set("limit", String(options.limit ?? 10));

  const response = await fetch(
    `${API_BASE_URL}/api/users?${params.toString()}`,
    {
      method: "GET",
      headers: bearerHeaders(authToken),
    },
  );

  const data = await readJsonResponse<
    Partial<ManagedUsersResponse> & { error?: string }
  >(response);

  if (!response.ok) {
    throw new Error(
      data.error ||
        `No se pudieron cargar los usuarios (${response.status})`,
    );
  }

  return {
    rows: Array.isArray(data.rows) ? data.rows : [],
    total:
      typeof data.total === "number"
        ? data.total
        : 0,
  };
}

export async function updateManagedUser(
  authToken: string,
  userId: string,
  changes: {
    role?: ManagedUserRole;
    is_active?: boolean;
  },
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/users/${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: {
        ...bearerHeaders(authToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(changes),
    },
  );

  const data = await readJsonResponse<{ error?: string }>(response);

  if (!response.ok) {
    throw new Error(
      data.error ||
        `No se pudo actualizar el usuario (${response.status})`,
    );
  }
}

export async function resetManagedUser2FA(
  authToken: string,
  userId: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/users/${encodeURIComponent(userId)}/reset-2fa`,
    {
      method: "POST",
      headers: bearerHeaders(authToken),
    },
  );

  const data = await readJsonResponse<{ error?: string }>(response);

  if (!response.ok) {
    throw new Error(
      data.error ||
        `No se pudo restablecer el 2FA (${response.status})`,
    );
  }
}

export type ManagedUserGroup = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  is_active: boolean;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
  member_count: number;
};

export type ManagedGroupMember = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

export type ManagedGroupMembersResponse = {
  group: ManagedUserGroup;
  members: ManagedGroupMember[];
  availableUsers: ManagedGroupMember[];
};

export async function getManagedUserGroups(
  authToken: string,
): Promise<ManagedUserGroup[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/user-groups`,
    {
      method: "GET",
      headers: bearerHeaders(authToken),
    },
  );

  const data = await readJsonResponse<{
    rows?: ManagedUserGroup[];
    error?: string;
  }>(response);

  if (!response.ok) {
    throw new Error(
      data.error ||
        `No se pudieron cargar los grupos (${response.status})`,
    );
  }

  return Array.isArray(data.rows) ? data.rows : [];
}

export async function createManagedUserGroup(
  authToken: string,
  input: {
    name: string;
    description?: string;
    color?: string;
  },
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/user-groups`,
    {
      method: "POST",
      headers: {
        ...bearerHeaders(authToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );

  const data = await readJsonResponse<{ error?: string }>(response);

  if (!response.ok) {
    throw new Error(
      data.error ||
        `No se pudo crear el grupo (${response.status})`,
    );
  }
}

export async function deleteManagedUserGroup(
  authToken: string,
  groupId: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/user-groups`,
    {
      method: "DELETE",
      headers: {
        ...bearerHeaders(authToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ groupId }),
    },
  );

  const data = await readJsonResponse<{ error?: string }>(response);

  if (!response.ok) {
    throw new Error(
      data.error ||
        `No se pudo eliminar el grupo (${response.status})`,
    );
  }
}

export async function getManagedGroupMembers(
  authToken: string,
  groupId: string,
): Promise<ManagedGroupMembersResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/user-groups/${encodeURIComponent(groupId)}/members`,
    {
      method: "GET",
      headers: bearerHeaders(authToken),
    },
  );

  const data = await readJsonResponse<
    Partial<ManagedGroupMembersResponse> & { error?: string }
  >(response);

  if (
    !response.ok ||
    !data.group
  ) {
    throw new Error(
      data.error ||
        `No se pudieron cargar los miembros (${response.status})`,
    );
  }

  return {
    group: data.group,
    members: Array.isArray(data.members) ? data.members : [],
    availableUsers: Array.isArray(data.availableUsers)
      ? data.availableUsers
      : [],
  };
}

export async function addManagedGroupMembers(
  authToken: string,
  groupId: string,
  userIds: string[],
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/user-groups/${encodeURIComponent(groupId)}/members`,
    {
      method: "POST",
      headers: {
        ...bearerHeaders(authToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userIds }),
    },
  );

  const data = await readJsonResponse<{ error?: string }>(response);

  if (!response.ok) {
    throw new Error(
      data.error ||
        `No se pudieron agregar los miembros (${response.status})`,
    );
  }
}

export async function removeManagedGroupMember(
  authToken: string,
  groupId: string,
  userId: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/user-groups/${encodeURIComponent(groupId)}/members`,
    {
      method: "DELETE",
      headers: {
        ...bearerHeaders(authToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    },
  );

  const data = await readJsonResponse<{ error?: string }>(response);

  if (!response.ok) {
    throw new Error(
      data.error ||
        `No se pudo quitar el miembro (${response.status})`,
    );
  }
}

export type ManagedPermissionResourceType =
  | "CATEGORY"
  | "SUBCATEGORY"
  | "UPLOAD";

export type ManagedPermissionAccessLevel =
  | "VIEWER"
  | "APPROVER"
  | "EDITOR";

export type ManagedGroupPermission = {
  resourceType: ManagedPermissionResourceType;
  resourceId: string;
  accessLevel: ManagedPermissionAccessLevel;
};

export async function getManagedGroupPermissions(
  authToken: string,
  groupId: string,
): Promise<ManagedGroupPermission[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/user-groups/${encodeURIComponent(groupId)}/permissions`,
    {
      method: "GET",
      headers: bearerHeaders(authToken),
    },
  );

  const data = await readJsonResponse<{
    permissions?: ManagedGroupPermission[];
    rows?: ManagedGroupPermission[];
    error?: string;
  }>(response);

  if (!response.ok) {
    throw new Error(
      data.error ||
        `No se pudieron cargar los permisos (${response.status})`,
    );
  }

  return Array.isArray(data.permissions)
    ? data.permissions
    : Array.isArray(data.rows)
      ? data.rows
      : [];
}

export async function saveManagedGroupPermission(
  authToken: string,
  groupId: string,
  permission: ManagedGroupPermission,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/user-groups/${encodeURIComponent(groupId)}/permissions`,
    {
      method: "POST",
      headers: {
        ...bearerHeaders(authToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(permission),
    },
  );

  const data = await readJsonResponse<{ error?: string }>(response);

  if (!response.ok) {
    throw new Error(
      data.error ||
        `No se pudo guardar el permiso (${response.status})`,
    );
  }
}

export async function removeManagedGroupPermission(
  authToken: string,
  groupId: string,
  resourceType: ManagedPermissionResourceType,
  resourceId: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/user-groups/${encodeURIComponent(groupId)}/permissions`,
    {
      method: "DELETE",
      headers: {
        ...bearerHeaders(authToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        resourceType,
        resourceId,
      }),
    },
  );

  const data = await readJsonResponse<{ error?: string }>(response);

  if (!response.ok) {
    throw new Error(
      data.error ||
        `No se pudo eliminar el permiso (${response.status})`,
    );
  }
}

export type ManagedRegistrationInvite = {
  id: string;
  email: string | null;
  expires_at: string;
  created_at: string;
  revoked_at?: string | null;
  used_at?: string | null;
};

export async function getManagedRegistrationInvites(
  authToken: string,
): Promise<ManagedRegistrationInvite[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/registration-invites`,
    {
      method: "GET",
      headers: bearerHeaders(authToken),
    },
  );

  const data = await readJsonResponse<{
    rows?: ManagedRegistrationInvite[];
    invites?: ManagedRegistrationInvite[];
    error?: string;
  }>(response);

  if (!response.ok) {
    throw new Error(
      data.error ||
        `No se pudieron cargar las invitaciones (${response.status})`,
    );
  }

  return Array.isArray(data.invites)
    ? data.invites
    : Array.isArray(data.rows)
      ? data.rows
      : [];
}

export async function createManagedRegistrationInvite(
  authToken: string,
  input: {
    email?: string;
    expiresInHours?: number;
  },
): Promise<string> {
  const response = await fetch(
    `${API_BASE_URL}/api/registration-invites`,
    {
      method: "POST",
      headers: {
        ...bearerHeaders(authToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );

  const data = await readJsonResponse<{
    inviteUrl?: string;
    url?: string;
    error?: string;
  }>(response);

  if (!response.ok) {
    throw new Error(
      data.error ||
        `No se pudo crear la invitación (${response.status})`,
    );
  }

  const inviteUrl = data.inviteUrl || data.url;

  if (!inviteUrl) {
    throw new Error(
      "La invitación fue creada, pero el servidor no devolvió el enlace.",
    );
  }

  return inviteUrl;
}

export async function revokeManagedRegistrationInvite(
  authToken: string,
  inviteId: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/registration-invites`,
    {
      method: "PATCH",
      headers: {
        ...bearerHeaders(authToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inviteId }),
    },
  );

  const data = await readJsonResponse<{ error?: string }>(response);

  if (!response.ok) {
    throw new Error(
      data.error ||
        `No se pudo revocar la invitación (${response.status})`,
    );
  }
}

export type ManagedUserDetailGroup = {
  id: string;
  name: string;
  slug?: string;
  color?: string | null;
};

export type ManagedUserDetailUpload = {
  id: string;
  file_name?: string | null;
  display_name?: string | null;
  category?: string | null;
  subcategory?: string | null;
  visibility?: string | null;
  uploaded_at?: string | null;
};

export type ManagedUserReceivedAccess = {
  id?: string;
  upload_id?: string;
  file_name?: string | null;
  display_name?: string | null;
  access_level?: string | null;
};

export type ManagedUserDetail = {
  user: ManagedUser;
  groups: ManagedUserDetailGroup[];
  uploads: ManagedUserDetailUpload[];
  receivedAccess: ManagedUserReceivedAccess[];
};

export async function getManagedUserDetail(
  authToken: string,
  userId: string,
): Promise<ManagedUserDetail> {
  const response = await fetch(
    `${API_BASE_URL}/api/users/${encodeURIComponent(userId)}`,
    {
      method: "GET",
      headers: bearerHeaders(authToken),
    },
  );

  const data = await readJsonResponse<
    Partial<ManagedUserDetail> & { error?: string }
  >(response);

  if (!response.ok || !data.user) {
    throw new Error(
      data.error ||
        `No se pudo cargar el detalle del usuario (${response.status})`,
    );
  }

  return {
    user: data.user,
    groups: Array.isArray(data.groups) ? data.groups : [],
    uploads: Array.isArray(data.uploads) ? data.uploads : [],
    receivedAccess: Array.isArray(data.receivedAccess)
      ? data.receivedAccess
      : [],
  };
}

export type ManagedSubcategory = {
  id: string;
  label: string;
  is_active: boolean;
  sort_order: number;
};

export type ManagedCategory = {
  id: string;
  slug: string;
  label: string;
  description: string;
  cover: string | null;
  is_active: boolean;
  sort_order: number;
  subcategories: ManagedSubcategory[];
};

export type ManagedCategoryInput = {
  label: string;
  slug: string;
  description: string;
  cover: string;
};

export async function createManagedCategory(
  authToken: string,
  input: ManagedCategoryInput,
): Promise<ManagedCategory> {
  const response = await fetch(`${API_BASE_URL}/api/categories`, {
    method: "POST",
    headers: {
      ...bearerHeaders(authToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const data = await readJsonResponse<{
    category?: ManagedCategory;
    error?: string;
  }>(response);

  if (!response.ok || !data.category) {
    throw new Error(
      data.error ||
        `No se pudo crear la categoría (${response.status})`,
    );
  }

  return {
    ...data.category,
    subcategories: Array.isArray(data.category.subcategories)
      ? data.category.subcategories
      : [],
  };
}

export async function updateManagedCategory(
  authToken: string,
  categoryId: string,
  input: ManagedCategoryInput,
): Promise<ManagedCategory> {
  const response = await fetch(
    `${API_BASE_URL}/api/categories/${encodeURIComponent(categoryId)}`,
    {
      method: "PATCH",
      headers: {
        ...bearerHeaders(authToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );

  const data = await readJsonResponse<{
    category?: ManagedCategory;
    error?: string;
  }>(response);

  if (!response.ok || !data.category) {
    throw new Error(
      data.error ||
        `No se pudo actualizar la categoría (${response.status})`,
    );
  }

  return {
    ...data.category,
    subcategories: Array.isArray(data.category.subcategories)
      ? data.category.subcategories
      : [],
  };
}

export async function deleteManagedCategory(
  authToken: string,
  categoryId: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/categories/${encodeURIComponent(categoryId)}`,
    {
      method: "DELETE",
      headers: bearerHeaders(authToken),
    },
  );

  const data = await readJsonResponse<{ error?: string }>(response);

  if (!response.ok) {
    throw new Error(
      data.error ||
        `No se pudo eliminar la categoría (${response.status})`,
    );
  }
}

export async function createManagedSubcategory(
  authToken: string,
  categoryId: string,
  label: string,
): Promise<ManagedSubcategory> {
  const response = await fetch(
    `${API_BASE_URL}/api/categories/${encodeURIComponent(categoryId)}/subcategories`,
    {
      method: "POST",
      headers: {
        ...bearerHeaders(authToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ label }),
    },
  );

  const data = await readJsonResponse<{
    subcategory?: ManagedSubcategory;
    error?: string;
  }>(response);

  if (!response.ok || !data.subcategory) {
    throw new Error(
      data.error ||
        `No se pudo crear la subcategoría (${response.status})`,
    );
  }

  return data.subcategory;
}

export async function updateManagedSubcategory(
  authToken: string,
  subcategoryId: string,
  label: string,
): Promise<ManagedSubcategory> {
  const response = await fetch(
    `${API_BASE_URL}/api/subcategories/${encodeURIComponent(subcategoryId)}`,
    {
      method: "PATCH",
      headers: {
        ...bearerHeaders(authToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ label }),
    },
  );

  const data = await readJsonResponse<{
    subcategory?: ManagedSubcategory;
    error?: string;
  }>(response);

  if (!response.ok || !data.subcategory) {
    throw new Error(
      data.error ||
        `No se pudo actualizar la subcategoría (${response.status})`,
    );
  }

  return data.subcategory;
}

export async function deleteManagedSubcategory(
  authToken: string,
  subcategoryId: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/subcategories/${encodeURIComponent(subcategoryId)}`,
    {
      method: "DELETE",
      headers: bearerHeaders(authToken),
    },
  );

  const data = await readJsonResponse<{ error?: string }>(response);

  if (!response.ok) {
    throw new Error(
      data.error ||
        `No se pudo eliminar la subcategoría (${response.status})`,
    );
  }
}

export async function uploadManagedCategoryCover(
  authToken: string,
  fileUri: string,
): Promise<string> {
  const file = new File(fileUri);

  if (!file.exists) {
    throw new Error("No se encontró la imagen seleccionada.");
  }

  const response = await file.upload(
    `${API_BASE_URL}/api/categories/cover`,
    {
      httpMethod: "POST",
      uploadType: UploadType.MULTIPART,
      fieldName: "file",
      headers: bearerHeaders(authToken),
    },
  );

  let data: {
    cover?: string;
    error?: string;
  };

  try {
    data = JSON.parse(response.body);
  } catch {
    throw new Error(
      `El servidor devolvió una respuesta inválida (${response.status}).`,
    );
  }

  if (response.status < 200 || response.status >= 300 || !data.cover) {
    throw new Error(
      data.error ||
        `No se pudo subir la portada (${response.status}).`,
    );
  }

  return data.cover;
}
