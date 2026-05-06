import { NextRequest } from "next/server";
import { Storage } from "@google-cloud/storage";
import { Readable } from "stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const storage = new Storage();

// Debe ser alcanzable desde donde corre Next (contenedor/host)
const DEFAULT_INTERNAL_MINIO = "http://192.168.5.12:9100";

function isPrivateIp(hostname: string) {
  if (/^10\.\d+\.\d+\.\d+$/.test(hostname)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(hostname)) return true;
  const m = hostname.match(/^172\.(\d+)\.\d+\.\d+$/);
  if (m) {
    const n = Number(m[1]);
    return n >= 16 && n <= 31;
  }
  return false;
}

function rewriteHttpUrl(raw: string): string | null {
  try {
    const u = new URL(raw);

    const isLocalhost = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    const isMinioPort = u.port === "9100" || u.port === "9000";
    const shouldRewrite =
      isMinioPort &&
      (isLocalhost || isPrivateIp(u.hostname) || u.hostname.includes("minio"));

    if (shouldRewrite) {
      const base = process.env.MINIO_INTERNAL_BASE || DEFAULT_INTERNAL_MINIO;
      const b = new URL(base);

      u.protocol = b.protocol;
      u.hostname = b.hostname;
      u.port = b.port;
    }

    return u.toString();
  } catch {
    return null;
  }
}

function parseGsUrl(raw: string) {
  if (!raw.startsWith("gs://")) return null;

  const withoutScheme = raw.slice(5);
  const firstSlash = withoutScheme.indexOf("/");
  if (firstSlash === -1) return null;

  const bucket = withoutScheme.slice(0, firstSlash);
  const objectPath = withoutScheme.slice(firstSlash + 1);

  if (!bucket || !objectPath) return null;

  return { bucket, objectPath };
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseRangeHeader(rangeHeader: string | null, totalSize: number) {
  if (!rangeHeader) return null;

  const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/i);
  if (!match) return null;

  const startRaw = match[1];
  const endRaw = match[2];

  let start: number;
  let end: number;

  if (startRaw === "" && endRaw === "") return null;

  if (startRaw === "") {
    const suffixLength = Number(endRaw);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(totalSize - suffixLength, 0);
    end = totalSize - 1;
  } else {
    start = Number(startRaw);
    end = endRaw === "" ? totalSize - 1 : Number(endRaw);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || end < 0 || start > end || start >= totalSize) return null;

  end = Math.min(end, totalSize - 1);

  return { start, end };
}

function nodeStreamToWebReadable(stream: Readable) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on("data", (chunk) => {
        controller.enqueue(
          chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)
        );
      });

      stream.on("end", () => {
        controller.close();
      });

      stream.on("error", (err) => {
        console.error("proxy node stream error:", err);
        controller.error(err);
      });
    },
    cancel() {
      stream.destroy();
    },
  });
}

async function resolveGcsFile(bucket: string, rawObjectPath: string) {
  const candidates = Array.from(
    new Set([rawObjectPath, safeDecodeURIComponent(rawObjectPath)])
  );

  for (const candidate of candidates) {
    const file = storage.bucket(bucket).file(candidate);
    try {
      const [meta] = await file.getMetadata();
      return { file, metadata: meta, objectPath: candidate };
    } catch {
      // probamos el siguiente candidato
    }
  }

  return null;
}

// async function handleGsRequest(rawUrl: string, req: NextRequest) {
//   const parsed = parseGsUrl(rawUrl);
//   if (!parsed) {
//     return new Response("bad gs url", { status: 400 });
//   }

//   const { bucket, objectPath } = parsed;

//   const resolved = await resolveGcsFile(bucket, objectPath);
//   if (!resolved) {
//     console.error("proxy gs file not found:", {
//       rawUrl,
//       bucket,
//       objectPath,
//       decodedObjectPath: safeDecodeURIComponent(objectPath),
//     });
//     return new Response("gcs file not found", { status: 404 });
//   }

//   const { file, metadata, objectPath: resolvedPath } = resolved;

//   const totalSize = Number(metadata.size || 0);
//   const contentType = metadata.contentType || "application/octet-stream";
//   const etag = metadata.etag || undefined;
//   const updated = metadata.updated || undefined;

//   const rangeHeader = req.headers.get("range");
//   const parsedRange = totalSize > 0 ? parseRangeHeader(rangeHeader, totalSize) : null;

//   const headers = new Headers();
//   headers.set("content-type", contentType);
//   headers.set("accept-ranges", "bytes");
//   headers.set("cache-control", "no-store");
//   if (etag) headers.set("etag", etag);
//   if (updated) headers.set("last-modified", new Date(updated).toUTCString());

//   try {
//     if (parsedRange) {
//       const { start, end } = parsedRange;
//       const nodeStream = file.createReadStream({ start, end });
//       const webStream = nodeStreamToWebReadable(nodeStream);

//       headers.set("content-range", `bytes ${start}-${end}/${totalSize}`);
//       headers.set("content-length", String(end - start + 1));

//       return new Response(webStream, {
//         status: 206,
//         headers,
//       });
//     }

//     const nodeStream = file.createReadStream();
//     const webStream = nodeStreamToWebReadable(nodeStream);

//     if (totalSize > 0) {
//       headers.set("content-length", String(totalSize));
//     }

//     return new Response(webStream, {
//       status: 200,
//       headers,
//     });
//   } catch (err: any) {
//     console.error("proxy gs stream failed:", {
//       rawUrl,
//       bucket,
//       objectPath,
//       resolvedPath,
//       message: err?.message,
//       code: err?.code,
//     });
//     return new Response("gcs stream failed", { status: 502 });
//   }
// }
async function handleGsRequest(rawUrl: string, req: NextRequest) {
  const parsed = parseGsUrl(rawUrl);
  if (!parsed) return new Response("bad gs url", { status: 400 });

  const { bucket, objectPath } = parsed;
  // IMPORTANTE: Decodificar el path por si viene con %20 u otros
  const decodedPath = decodeURIComponent(objectPath);
  const file = storage.bucket(bucket).file(decodedPath);

  try {
    // 1. Obtener metadatos para saber el tamaño y tipo
    const [metadata] = await file.getMetadata();
    const totalSize = parseInt(metadata.size as string, 10);
    const contentType = metadata.contentType || "video/mp4";

    // 2. Manejar el Range Header para streaming (Código 206)
    const rangeHeader = req.headers.get("range");
    const range = parseRangeHeader(rangeHeader, totalSize);

    let responseStream;
    let status = 200;
    const responseHeaders = new Headers({
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    });

    if (range) {
      status = 206;
      responseStream = file.createReadStream({ start: range.start, end: range.end });
      responseHeaders.set("Content-Range", `bytes ${range.start}-${range.end}/${totalSize}`);
      responseHeaders.set("Content-Length", (range.end - range.start + 1).toString());
    } else {
      responseStream = file.createReadStream();
      responseHeaders.set("Content-Length", totalSize.toString());
    }

    // 3. Convertir el stream de Node a Web Stream para Next.js
    const webStream = nodeStreamToWebReadable(responseStream);

    return new Response(webStream, {
      status,
      headers: responseHeaders,
    });

  } catch (err: any) {
    console.error("Error directo de GCS:", {
      path: decodedPath,
      message: err.message
    });
    return new Response("Archivo no encontrado o error de acceso", { status: 404 });
  }
}
async function handleGsHead(rawUrl: string) {
  const parsed = parseGsUrl(rawUrl);
  if (!parsed) {
    return new Response(null, { status: 400 });
  }

  const { bucket, objectPath } = parsed;

  const resolved = await resolveGcsFile(bucket, objectPath);
  if (!resolved) {
    console.error("proxy gs HEAD file not found:", {
      rawUrl,
      bucket,
      objectPath,
      decodedObjectPath: safeDecodeURIComponent(objectPath),
    });
    return new Response(null, { status: 404 });
  }

  const { metadata } = resolved;

  const headers = new Headers();
  headers.set("content-type", metadata.contentType || "application/octet-stream");
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "no-store");

  if (metadata.size) headers.set("content-length", String(metadata.size));
  if (metadata.etag) headers.set("etag", metadata.etag);
  if (metadata.updated) {
    headers.set("last-modified", new Date(metadata.updated).toUTCString());
  }

  return new Response(null, {
    status: 200,
    headers,
  });
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url");
  if (!rawUrl) return new Response("missing url", { status: 400 });

  if (rawUrl.startsWith("gs://")) {
    return handleGsRequest(rawUrl, req);
  }

  const target = rewriteHttpUrl(rawUrl);
  if (!target) return new Response("bad url", { status: 400 });

  const range = req.headers.get("range") || undefined;
  const ifRange = req.headers.get("if-range") || undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: "GET",
      headers: {
        ...(range ? { range } : {}),
        ...(ifRange ? { "if-range": ifRange } : {}),
      },
      cache: "no-store",
    });
  } catch (err: any) {
    console.error("proxy fetch failed:", {
      rawUrl,
      target,
      message: err?.message,
      cause: err?.cause?.message,
    });
    return new Response("proxy fetch failed", { status: 502 });
  }

  const headers = new Headers();
  for (const k of [
    "content-type",
    "content-length",
    "accept-ranges",
    "content-range",
    "etag",
    "last-modified",
    "cache-control",
    "content-disposition",
  ]) {
    const v = upstream.headers.get(k);
    if (v) headers.set(k, v);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

export async function HEAD(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url");
  if (!rawUrl) return new Response(null, { status: 400 });

  if (rawUrl.startsWith("gs://")) {
    return handleGsHead(rawUrl);
  }

  const target = rewriteHttpUrl(rawUrl);
  if (!target) return new Response(null, { status: 400 });

  try {
    const upstream = await fetch(target, {
      method: "HEAD",
      cache: "no-store",
    });

    const headers = new Headers();
    for (const k of [
      "content-type",
      "content-length",
      "accept-ranges",
      "content-range",
      "etag",
      "last-modified",
      "cache-control",
      "content-disposition",
    ]) {
      const v = upstream.headers.get(k);
      if (v) headers.set(k, v);
    }

    return new Response(null, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  } catch (err: any) {
    console.error("proxy HEAD failed:", {
      rawUrl,
      target,
      message: err?.message,
      cause: err?.cause?.message,
    });
    return new Response(null, { status: 502 });
  }
}
// // my-uploadthing-app/src/app/api/proxy/route.ts
// import { NextRequest } from "next/server";

// export const runtime = "nodejs";
// export const dynamic = "force-dynamic";

// // Debe ser alcanzable desde donde corre Next (contenedor/host)
// const DEFAULT_INTERNAL_MINIO = "http://192.168.5.12:9100";

// function isPrivateIp(hostname: string) {
//   if (/^10\.\d+\.\d+\.\d+$/.test(hostname)) return true;
//   if (/^192\.168\.\d+\.\d+$/.test(hostname)) return true;
//   const m = hostname.match(/^172\.(\d+)\.\d+\.\d+$/);
//   if (m) {
//     const n = Number(m[1]);
//     return n >= 16 && n <= 31;
//   }
//   return false;
// }

// function rewriteUrl(raw: string): string | null {
//   try {
//     const u = new URL(raw);

//     const isLocalhost = u.hostname === "localhost" || u.hostname === "127.0.0.1";
//     const isMinioPort = u.port === "9100" || u.port === "9000";
//     const shouldRewrite = isMinioPort && (isLocalhost || isPrivateIp(u.hostname) || u.hostname.includes("minio"));

//     if (shouldRewrite) {
//       const base = process.env.MINIO_INTERNAL_BASE || DEFAULT_INTERNAL_MINIO;
//       const b = new URL(base);

//       u.protocol = b.protocol;
//       u.hostname = b.hostname;
//       u.port = b.port;
//     }

//     return u.toString();
//   } catch {
//     return null;
//   }
// }

// export async function GET(req: NextRequest) {
//   const rawUrl = req.nextUrl.searchParams.get("url");
//   if (!rawUrl) return new Response("missing url", { status: 400 });

//   const target = rewriteUrl(rawUrl);
//   if (!target) return new Response("bad url", { status: 400 });

//   const range = req.headers.get("range") || undefined;
//   const ifRange = req.headers.get("if-range") || undefined;

//   let upstream: Response;
//   try {
//     upstream = await fetch(target, {
//       method: "GET",
//       headers: {
//         ...(range ? { range } : {}),
//         ...(ifRange ? { "if-range": ifRange } : {}),
//       },
//       cache: "no-store",
//     });
//   } catch (err: any) {
//     console.error("proxy fetch failed:", {
//       rawUrl,
//       target,
//       message: err?.message,
//       cause: err?.cause?.message,
//     });
//     return new Response("proxy fetch failed", { status: 502 });
//   }

//   const headers = new Headers();
//   for (const k of [
//     "content-type",
//     "content-length",
//     "accept-ranges",
//     "content-range",
//     "etag",
//     "last-modified",
//     "cache-control",
//     "content-disposition",
//   ]) {
//     const v = upstream.headers.get(k);
//     if (v) headers.set(k, v);
//   }

//   return new Response(upstream.body, {
//     status: upstream.status,
//     statusText: upstream.statusText,
//     headers,
//   });
// }

