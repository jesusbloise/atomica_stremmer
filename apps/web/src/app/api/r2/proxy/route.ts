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

export async function GET(req: NextRequest) {
  try {
    const rawUrl = req.nextUrl.searchParams.get("url");
    const parsed = parseR2Url(rawUrl);

    if (!parsed) {
      return NextResponse.json({ error: "URL R2 inválida" }, { status: 400 });
    }

    const r2Client = getR2Client();

    const result = await r2Client.send(
      new GetObjectCommand({
        Bucket: parsed.bucket,
        Key: parsed.objectPath,
      })
    );

    if (!result.Body) {
      return NextResponse.json({ error: "Archivo sin contenido" }, { status: 404 });
    }

    const body = result.Body as Readable;

    return new NextResponse(nodeReadableToWeb(body), {
      status: 200,
      headers: {
        "Content-Type": result.ContentType || "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
        "Accept-Ranges": "bytes",
      },
    });
  } catch (error) {
    console.error("R2_PROXY_ERROR", error);
    return NextResponse.json({ error: "Error leyendo archivo desde R2" }, { status: 500 });
  }
}