import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2BucketName, getR2Client } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const r2Client = getR2Client();
    const bucket = getR2BucketName();

    const key = `test/atomica-r2-test-${Date.now()}.txt`;

    await r2Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: "Prueba de conexión Atomica -> Cloudflare R2",
        ContentType: "text/plain",
      })
    );

    return NextResponse.json({
      ok: true,
      message: "Archivo de prueba subido a R2 correctamente",
      bucket,
      key,
    });
  } catch (error) {
    console.error("R2 test error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}