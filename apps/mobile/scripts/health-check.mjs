const API =
  "https://atomica-stremmer-web-23864640850.us-central1.run.app";

const token = process.env.ATOMICA_TOKEN?.trim();

if (!token) {
  console.error("");
  console.error("ATOMICA MOBILE HEALTH CHECK");
  console.error("======================================");
  console.error("[ERROR] Falta ATOMICA_TOKEN en esta terminal.");
  console.error("");
  console.error("Carga temporalmente tu token antes de ejecutar el test.");
  console.error("El token no se guarda en este archivo.");
  process.exit(1);
}

const authHeaders = {
  Authorization: `Bearer ${token}`,
};

const results = [];

function ok(name, detail = "") {
  results.push({ status: "OK", name, detail });
  console.log(`[OK]    ${name}${detail ? ` - ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ status: "ERROR", name, detail });
  console.log(`[ERROR] ${name}${detail ? ` - ${detail}` : ""}`);
}

function skip(name, detail = "") {
  results.push({ status: "SKIP", name, detail });
  console.log(`[SKIP]  ${name}${detail ? ` - ${detail}` : ""}`);
}

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...authHeaders,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();

  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  return {
    response,
    data,
  };
}

async function check(name, fn) {
  try {
    await fn();
  } catch (error) {
    fail(
      name,
      error instanceof Error ? error.message : String(error),
    );
  }
}

console.log("");
console.log("ATOMICA MOBILE HEALTH CHECK");
console.log("======================================");
console.log(`API: ${API}`);
console.log("Modo: READ ONLY");
console.log("");

let me = null;
let videos = [];
let categories = [];
let selectedVideo = null;

await check("API producción + autenticación Bearer", async () => {
  const { response, data } = await request("/api/me");

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  me = data;

  ok(
    "API producción + autenticación Bearer",
    `${data?.email || data?.name || "sesión válida"} | ${data?.role || "rol desconocido"}`,
  );
});

await check("Listado de videos", async () => {
  const { response, data } = await request("/api/videos");

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  videos = Array.isArray(data)
    ? data
    : Array.isArray(data?.videos)
      ? data.videos
      : Array.isArray(data?.uploads)
        ? data.uploads
        : [];

  if (!videos.length) {
    throw new Error("La API respondió pero no devolvió videos.");
  }

  selectedVideo = videos[0];

  ok(
    "Listado de videos",
    `${videos.length} archivo(s) accesibles`,
  );
});

await check("Categorías y subcategorías", async () => {
  const { response, data } = await request("/api/categories");

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  categories = Array.isArray(data)
    ? data
    : Array.isArray(data?.categories)
      ? data.categories
      : [];

  if (!categories.length) {
    throw new Error("No se encontraron categorías.");
  }

  const subcategoryCount = categories.reduce(
    (total, category) =>
      total +
      (Array.isArray(category.subcategories)
        ? category.subcategories.length
        : 0),
    0,
  );

  ok(
    "Categorías y subcategorías",
    `${categories.length} categoría(s), ${subcategoryCount} subcategoría(s)`,
  );
});

await check("Detalle de archivo", async () => {
  if (!selectedVideo?.id) {
    skip("Detalle de archivo", "No hay video disponible");
    return;
  }

  const { response, data } = await request(
    `/api/uploads/${encodeURIComponent(selectedVideo.id)}`,
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  ok(
    "Detalle de archivo",
    data?.display_name ||
      data?.file_name ||
      selectedVideo?.display_name ||
      selectedVideo?.file_name ||
      selectedVideo.id,
  );
});

await check("Ficha técnica", async () => {
  if (!selectedVideo?.id) {
    skip("Ficha técnica", "No hay video disponible");
    return;
  }

  const { response } = await request(
    `/api/fichas/${encodeURIComponent(selectedVideo.id)}`,
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  ok("Ficha técnica");
});

await check("Transcripción", async () => {
  if (!selectedVideo?.id) {
    skip("Transcripción", "No hay video disponible");
    return;
  }

  const { response } = await request(
    `/api/subtitulos/${encodeURIComponent(selectedVideo.id)}`,
  );

  if (response.status === 404) {
    skip("Transcripción", "El archivo de prueba no tiene transcripción");
    return;
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  ok("Transcripción");
});

await check("Captions / subtítulos Stream", async () => {
  if (!selectedVideo?.id) {
    skip("Captions / subtítulos Stream", "No hay video disponible");
    return;
  }

  const { response } = await request(
    `/api/uploads/${encodeURIComponent(selectedVideo.id)}/captions`,
  );

  if (response.status === 404) {
    skip(
      "Captions / subtítulos Stream",
      "El archivo de prueba no tiene captions",
    );
    return;
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  ok("Captions / subtítulos Stream");
});

await check("Búsqueda", async () => {
  const candidate =
    selectedVideo?.display_name ||
    selectedVideo?.file_name ||
    selectedVideo?.title;

  if (!candidate) {
    skip("Búsqueda", "No hay texto de referencia");
    return;
  }

  const query = String(candidate)
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0];

  if (!query) {
    skip("Búsqueda", "No hay texto de referencia");
    return;
  }

  const { response, data } = await request(
    `/api/buscar?q=${encodeURIComponent(query)}`,
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const count = Array.isArray(data)
    ? data.length
    : Array.isArray(data?.results)
      ? data.results.length
      : Array.isArray(data?.uploads)
        ? data.uploads.length
        : null;

  ok(
    "Búsqueda",
    count === null
      ? `consulta "${query}" respondió correctamente`
      : `"${query}" → ${count} resultado(s)`,
  );
});

if (me?.role === "SUPER_ADMIN" || me?.role === "ADMIN") {
  await check("Control de cargas", async () => {
    const { response } = await request("/api/admin/control-cargas");

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    ok("Control de cargas");
  });
} else {
  skip(
    "Control de cargas",
    `No corresponde al rol ${me?.role || "actual"}`,
  );
}

if (me?.role === "SUPER_ADMIN") {
  await check("Gestión de usuarios", async () => {
    const { response, data } = await request(
      "/api/users?page=1&limit=1",
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const count =
      data?.pagination?.total ??
      data?.total ??
      (Array.isArray(data?.users) ? data.users.length : null);

    ok(
      "Gestión de usuarios",
      count !== null ? `${count} usuario(s)` : "endpoint disponible",
    );
  });

  await check("Grupos de usuarios", async () => {
    const { response, data } = await request("/api/user-groups");

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const groups = Array.isArray(data)
      ? data
      : Array.isArray(data?.groups)
        ? data.groups
        : [];

    ok("Grupos de usuarios", `${groups.length} grupo(s)`);
  });

  await check("Invitaciones de registro", async () => {
    const { response, data } = await request(
      "/api/registration-invites",
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const invites = Array.isArray(data)
      ? data
      : Array.isArray(data?.invites)
        ? data.invites
        : [];

    ok(
      "Invitaciones de registro",
      `${invites.length} invitación(es)`,
    );
  });
} else {
  skip(
    "Administración SUPER_ADMIN",
    `No corresponde al rol ${me?.role || "actual"}`,
  );
}

console.log("");
console.log("======================================");

const passed = results.filter((item) => item.status === "OK").length;
const failed = results.filter((item) => item.status === "ERROR").length;
const skipped = results.filter((item) => item.status === "SKIP").length;

console.log(
  `RESULTADO: ${passed} OK | ${failed} ERROR | ${skipped} SKIP`,
);
console.log("======================================");
console.log("");

if (failed > 0) {
  process.exitCode = 1;
}
