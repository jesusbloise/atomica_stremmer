import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

export async function POST(
  req: Request,
  contextPromise: Promise<{ params: { id: string } }>
) {
  const { params } = await contextPromise;
  const videoId = params.id;

  // Ruta real del archivo actual
  const __dirname = dirname(fileURLToPath(import.meta.url));

  // Ruta completa del script de Python
  const scriptPath = join(__dirname, "../../../../../processor/procesar_posturas.py");

  //  Usa la ruta absoluta del Python donde tienes mediapipe instalado
  const pythonPath = "C:\\Users\\ALLINONE06\\AppData\\Local\\Programs\\Python\\Python310\\python.exe";

  console.log("Ejecutando script de posturas (asíncrono):", videoId);

  return new Promise((resolve) => {
    const process = spawn(pythonPath, [scriptPath, videoId], {
      cwd: __dirname,
      shell: true,
    });

    let output = "";
    let errorOutput = "";

    process.stdout.on("data", (data) => {
      output += data.toString();
    });

    process.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    process.on("close", (code) => {
      if (code === 0) {
        console.log("Script ejecutado con éxito.");
        return resolve(
          new Response(JSON.stringify({ success: true, output }), {
            status: 200,
          })
        );
      } else {
        console.error("Error en el script:", errorOutput);
        return resolve(
          new Response(
            JSON.stringify({ success: false, message: errorOutput }),
            { status: 500 }
          )
        );
      }
    });
  });
}
