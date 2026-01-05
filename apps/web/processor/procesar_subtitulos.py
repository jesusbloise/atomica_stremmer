import os
import sys
import math
import tempfile
import subprocess
import requests
import psycopg2
import whisper

# ===================== Config DB (nueva) =====================
# Usa variables de entorno si existen, si no, usa los defaults
DB_CONFIG = {
    "dbname": os.getenv("PGDATABASE", "atomica_stremmer"),
    "user": os.getenv("PGUSER", "postgres"),
    "password": os.getenv("PGPASSWORD", "atomica"),
    "host": os.getenv("PGHOST", "localhost"),
    "port": os.getenv("PGPORT", "5432"),
}

CHUNK_DURATION_MS = 15 * 1000  # 15 segundos por fragmento


def download_to_temp(url: str, suffix: str = ".mkv") -> str:
    print(" Descargando el archivo del servidor...")
    with requests.get(url, stream=True, timeout=60) as r:
        r.raise_for_status()
        fd, tmp_path = tempfile.mkstemp(suffix=suffix)
        with os.fdopen(fd, "wb") as f:
            for chunk in r.iter_content(1024 * 64):
                f.write(chunk)
    print(f" Archivo guardado temporalmente en: {tmp_path}")
    return tmp_path


def convert_to_wav(input_path: str) -> str:
    # soporta .mkv, .mp4, etc.
    base, _ = os.path.splitext(input_path)
    wav_path = base + ".wav"
    print(" Convirtiendo a WAV...")
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            input_path,
            "-vn",
            "-acodec",
            "pcm_s16le",
            "-ar",
            "16000",
            "-ac",
            "1",
            wav_path,
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    print(f" Archivo WAV listo: {wav_path}")
    return wav_path


def main(video_id: str):
    print(f" Iniciando proceso de subtítulos para video_id={video_id}")
    conn = None
    cur = None
    video_path = None
    wav_path = None

    # 🔹 Modelo "medium" para mejor precisión
    model = whisper.load_model("medium")

    try:
        print(" Conectando a la base de datos...")
        print(f"  -> {DB_CONFIG['dbname']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}")
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()

        print(" Buscando el video en la tabla uploads...")
        cur.execute("SELECT file_path FROM uploads WHERE id = %s", (video_id,))
        row = cur.fetchone()
        if not row:
            print(f" ❌ No se encontró video con id {video_id} en uploads")
            return

        url = row[0]
        if not url:
            print(" ❌ El campo file_path está vacío")
            return

        video_path = download_to_temp(url)
        wav_path = convert_to_wav(video_path)

        print(" Obteniendo duración del audio para dividir en fragmentos...")

        def get_duration(file_path: str) -> float:
            result = subprocess.run(
                [
                    "ffprobe",
                    "-v",
                    "error",
                    "-show_entries",
                    "format=duration",
                    "-of",
                    "default=noprint_wrappers=1:nokey=1",
                    file_path,
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            return float(result.stdout.strip() or 0)

        duration_sec = get_duration(wav_path)
        if duration_sec <= 0:
            print(" ❌ Duración del audio inválida")
            return

        total_chunks = math.ceil((duration_sec * 1000) / CHUNK_DURATION_MS)
        print(f" Duración: {duration_sec:.2f} seg. Total fragmentos: {total_chunks}")

        insert_sql = """
            INSERT INTO video_subtitulos (video_id, time_start, time_end, text)
            VALUES (%s, %s, %s, %s)
        """
        total_inserted = 0

        for i in range(total_chunks):
            start_sec = (i * CHUNK_DURATION_MS) / 1000
            duration = CHUNK_DURATION_MS / 1000
            base, _ = os.path.splitext(wav_path)
            chunk_path = f"{base}_chunk{i}.wav"

            print(f" Fragmento {i+1}/{total_chunks} (inicio: {start_sec:.1f}s)")

            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-i",
                    wav_path,
                    "-ss",
                    str(start_sec),
                    "-t",
                    str(duration),
                    "-acodec",
                    "copy",
                    chunk_path,
                ],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

            print("  Transcribiendo fragmento...")
            result = model.transcribe(
                chunk_path,
                fp16=False,
                task="transcribe",  # 🔹 Solo transcribir, sin traducir
                language=None,      # 🔹 Auto-detectar idioma
            )

            print("  Guardando resultados en la base de datos...")
            for seg in result.get("segments", []):
                abs_start = seg["start"] + start_sec
                abs_end = seg["end"] + start_sec
                text = (seg.get("text") or "").strip()
                if text:
                    cur.execute(insert_sql, (video_id, abs_start, abs_end, text))
                    total_inserted += 1

            # borrar chunk
            try:
                os.remove(chunk_path)
            except OSError:
                pass

        conn.commit()
        print(f" ✅ Proceso completado. Total subtítulos guardados: {total_inserted}")

    except Exception as e:
        print("❌ ERROR GENERAL:", e)

    finally:
        print(" Limpiando archivos temporales y cerrando conexiones...")
        if cur:
            try:
                cur.close()
            except Exception:
                pass
        if conn:
            try:
                conn.close()
            except Exception:
                pass
        for p in (video_path, wav_path):
            if p and os.path.exists(p):
                try:
                    os.remove(p)
                except Exception:
                    pass


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(" Uso: python procesar_subtitulos.py <video_id>")
        sys.exit(1)
    main(sys.argv[1])



# import os
# import sys
# import math
# import tempfile
# import subprocess
# import requests
# import psycopg2
# import whisper

# DB_CONFIG = {
#     "dbname": "Prueba-atomica-gratis",
#     "user": "postgres",
#     "password": "atomica",
#     "host": "prueba-db-1",
#     "port": "5432",
# }

# CHUNK_DURATION_MS = 15 * 1000  # 15 segundos por fragmento

# def download_to_temp(url: str, suffix: str = ".mkv") -> str:
#     print(" Descargando el archivo del servidor...")
#     with requests.get(url, stream=True, timeout=60) as r:
#         r.raise_for_status()
#         fd, tmp_path = tempfile.mkstemp(suffix=suffix)
#         with os.fdopen(fd, "wb") as f:
#             for chunk in r.iter_content(1024 * 64):
#                 f.write(chunk)
#     print(f" Archivo guardado temporalmente en: {tmp_path}")
#     return tmp_path

# def convert_to_wav(input_path: str) -> str:
#     wav_path = input_path.replace(".mkv", ".wav").replace(".mp4", ".wav")
#     print(" Convirtiendo a WAV...")
#     subprocess.run([
#         "ffmpeg", "-y", "-i", input_path,
#         "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
#         wav_path
#     ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
#     print(f"Archivo WAV listo: {wav_path}")
#     return wav_path

# def main(video_id: str):
#     print(f" Iniciando proceso de subtítulos para video_id={video_id}")
#     conn = None
#     cur = None

#     # 🔹 Modelo "medium" para mejor precisión
#     model = whisper.load_model("medium")

#     try:
#         conn = psycopg2.connect(**DB_CONFIG)
#         cur = conn.cursor()

#         print("Buscando el video en la base de datos...")
#         cur.execute("SELECT file_path FROM uploads WHERE id = %s", (video_id,))
#         row = cur.fetchone()
#         if not row:
#             print(f" No se encontró video con id {video_id}")
#             return

#         url = row[0]
#         video_path = download_to_temp(url)
#         wav_path = convert_to_wav(video_path)

#         print("Obteniendo duración del audio para dividir en fragmentos...")

#         def get_duration(file_path: str) -> float:
#             result = subprocess.run(
#                 ["ffprobe", "-v", "error", "-show_entries",
#                  "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file_path],
#                 stdout=subprocess.PIPE, stderr=subprocess.PIPE
#             )
#             return float(result.stdout)

#         duration_sec = get_duration(wav_path)
#         total_chunks = math.ceil((duration_sec * 1000) / CHUNK_DURATION_MS)
#         print(f"Duración: {duration_sec:.2f} seg. Total fragmentos: {total_chunks}")

#         insert_sql = """
#             INSERT INTO video_subtitulos (video_id, time_start, time_end, text)
#             VALUES (%s, %s, %s, %s)
#         """
#         total_inserted = 0

#         for i in range(total_chunks):
#             start_sec = (i * CHUNK_DURATION_MS) / 1000
#             duration = CHUNK_DURATION_MS / 1000
#             chunk_path = wav_path.replace(".wav", f"_chunk{i}.wav")

#             print(f" Fragmento {i+1}/{total_chunks} (inicio: {start_sec:.1f}s)")

#             subprocess.run([
#                 "ffmpeg", "-y", "-i", wav_path, "-ss", str(start_sec), "-t", str(duration),
#                 "-acodec", "copy", chunk_path
#             ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

#             print("Transcribiendo fragmento...")
#             result = model.transcribe(
#                 chunk_path,
#                 fp16=False,
#                 task="transcribe",  # 🔹 Solo transcribir, sin traducir
#                 language=None       # 🔹 Auto-detectar idioma
#             )

#             print("Guardando resultados en la base de datos...")
#             for seg in result.get("segments", []):
#                 abs_start = seg["start"] + start_sec
#                 abs_end = seg["end"] + start_sec
#                 text = (seg.get("text") or "").strip()
#                 if text:
#                     cur.execute(insert_sql, (video_id, abs_start, abs_end, text))
#                     total_inserted += 1

#             os.remove(chunk_path)

#         conn.commit()
#         print(f"Proceso completado. Total subtítulos guardados: {total_inserted}")

#     except Exception as e:
#         print("ERROR GENERAL:", e)

#     finally:
#         print(" Limpiando archivos temporales y cerrando conexiones...")
#         if cur:
#             try: cur.close()
#             except: pass
#         if conn:
#             try: conn.close()
#             except: pass
#         for path in [video_path, wav_path]:
#             if path and os.path.exists(path):
#                 try: os.remove(path)
#                 except: pass

# if __name__ == "__main__":
#     if len(sys.argv) < 2:
#         print(" Uso: python procesar_subtitulos.py <video_id>")
#         sys.exit(1)
#     main(sys.argv[1])
