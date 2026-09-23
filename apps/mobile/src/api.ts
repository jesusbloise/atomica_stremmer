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
  password: string
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
    throw new Error(
      data.error || "No se pudo iniciar sesión"
    );
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
  code: string
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
    throw new Error(
      data.error || "No se pudo completar la verificación"
    );
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
};

export async function getVideos(
  authToken: string
): Promise<VideoItem[]> {
  const response = await fetch(`${API_BASE_URL}/api/videos`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${authToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `No se pudieron cargar los videos (${response.status})`
    );
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
  authToken?: string
): Promise<CategoryItem[]> {
  const response = await fetch(`${API_BASE_URL}/api/categories`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(authToken
        ? { Authorization: `Bearer ${authToken}` }
        : {}),
    },
  });

  const data = (await response.json()) as CategoriesResponse;

  if (!response.ok) {
    throw new Error(
      data.error || "No se pudieron cargar las categorías"
    );
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
  limit = 80
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
    }
  );

  if (!response.ok) {
    throw new Error(
      `No se pudieron cargar los archivos (${response.status})`
    );
  }

  const data = (await response.json()) as UploadItem[];

  if (!Array.isArray(data)) {
    throw new Error("La respuesta de archivos no es válida");
  }

  return data;
}
