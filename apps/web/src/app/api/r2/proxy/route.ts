import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client } from "@/lib/r2";
import { Readable } from "stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseR2Url(raw?: string | null) {
  if (!raw || !raw.startsWith("r2://")) return null;

  const withoutScheme = raw.slice(5);
  const firstSlash = withoutScheme.indexOf("/");
  if (firstSlash === -1) return null;

  const bucket = withoutScheme.slice(0, firstSlash);
  const objectPath = withoutScheme.slice(firstSlash + 1);

  if (!bucket || !objectPath) return null;
  return { bucket, objectPath };
}

function nodeReadableToWeb(readable: Readable): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      readable.on("data", (chunk) => {
        controller.enqueue(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      readable.on("end", () => controller.close());
      readable.on("error", (err) => controller.error(err));
    },
    cancel() {
      readable.destroy();
    },
  });
}

function safeFilename(objectPath: string) {
  const name = objectPath.split("/").pop() || "archivo";
  try {
    return decodeURIComponent(name).replace(/[\\"]/g, "_");
  } catch {
    return name.replace(/[\\"]/g, "_");
  }
}

export async function GET(req: NextRequest) {
  try {
    const rawUrl = req.nextUrl.searchParams.get("url");
    const parsed = parseR2Url(rawUrl);

    if (!parsed) {
      return NextResponse.json({ error: "URL R2 inválida" }, { status: 400 });
    }

    const range = req.headers.get("range") || undefined;
    const r2Client = getR2Client();

    const result = await r2Client.send(
      new GetObjectCommand({
        Bucket: parsed.bucket,
        Key: parsed.objectPath,
        Range: range,
      })
    );

    if (!result.Body) {
      return NextResponse.json({ error: "Archivo sin contenido" }, { status: 404 });
    }

    const filename = safeFilename(parsed.objectPath);
    const body = result.Body as Readable;

    const headers = new Headers();
    headers.set("Content-Type", result.ContentType || "application/octet-stream");
    headers.set("Cache-Control", "public, max-age=3600");
    headers.set("Accept-Ranges", "bytes");
    headers.set("Content-Disposition", `inline; filename="${filename}"`);

    if (result.ContentLength !== undefined) {
      headers.set("Content-Length", String(result.ContentLength));
    }

    if (result.ContentRange) {
      headers.set("Content-Range", result.ContentRange);
    }

    return new NextResponse(nodeReadableToWeb(body), {
      status: range ? 206 : 200,
      headers,
    });
    } catch (error: any) {
    console.error("R2_PROXY_ERROR", {
      name: error?.name,
      code: error?.Code || error?.code,
      message: error?.message,
      statusCode: error?.$metadata?.httpStatusCode,
    });

    const code = error?.Code || error?.code || error?.name;
    const statusCode = error?.$metadata?.httpStatusCode;

    if (
      code === "NoSuchKey" ||
      code === "NotFound" ||
      statusCode === 404
    ) {
      return NextResponse.json(
        { error: "Archivo no existe en R2" },
        { status: 404 }
      );
    }

    if (
      code === "InvalidRange" ||
      statusCode === 416
    ) {
      return NextResponse.json(
        { error: "Rango inválido para este archivo" },
        {
          status: 416,
          headers: {
            "Accept-Ranges": "bytes",
          },
        }
      );
    }

    return NextResponse.json(
      { error: "Error leyendo archivo desde R2" },
      { status: 500 }
    );
  }
}