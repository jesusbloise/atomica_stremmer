import os
import sys
import math
import tempfile
import subprocess
import requests
import psycopg2
import whisper
from typing import Optional

DB_CONFIG = {
    "dbname": os.getenv("PGDATABASE", "atomica"),
    "user": os.getenv("PGUSER", "postgres"),
    "password": os.getenv("PGPASSWORD", ""),
    "host": os.getenv("PGHOST", "localhost"),
    "port": os.getenv("PGPORT", "5432"),
}

CHUNK_DURATION_MS = 15 * 1000

def download_to_temp(url: str, suffix: str = ".mp4") -> str:
    print(" Descargando el archivo del servidor...", flush=True)
    with requests.get(url, stream=True, timeout=300) as r:
        r.raise_for_status()
        fd, tmp_path = tempfile.mkstemp(suffix=suffix)
        with os.fdopen(fd, "wb") as f:
            for chunk in r.iter_content(1024 * 1024):
                if chunk:
                    f.write(chunk)
    print(f" Archivo guardado temporalmente en: {tmp_path}", flush=True)
    return tmp_path

def convert_to_wav(input_path: str) -> str:
    base, _ = os.path.splitext(input_path)
    wav_path = base + ".wav"
    print(" Convirtiendo a WAV...", flush=True)

    subprocess.run(
        ["ffmpeg", "-y", "-i", input_path, "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", wav_path],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    print(f" Archivo WAV listo: {wav_path}", flush=True)
    return wav_path

def get_duration(file_path: str) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file_path],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return float(result.stdout.strip() or 0)

def main(video_id: str, video_url: str):
    print(f" Iniciando proceso de subtítulos para video_id={video_id}", flush=True)
    print(" Conectando a la base de datos...", flush=True)
    print(f"  -> {DB_CONFIG['dbname']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}", flush=True)

    conn = None
    cur = None
    video_path = None
    wav_path = None

    model_name = os.getenv("WHISPER_MODEL", "small")
    print(f" Cargando modelo Whisper: {model_name}", flush=True)
    model = whisper.load_model(model_name)

    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()

        # Evitar duplicados si lo llamas 2 veces
        cur.execute("SELECT 1 FROM video_subtitulos WHERE video_id = %s LIMIT 1", (video_id,))
        if cur.fetchone():
            print(" Ya existen subtítulos. Saliendo.", flush=True)
            return 0

        # Descargar
        ext = ".mp4"
        video_path = download_to_temp(video_url, suffix=ext)

        # Convertir a wav
        wav_path = convert_to_wav(video_path)

        # Duración
        print(" Obteniendo duración del audio...", flush=True)
        duration_sec = get_duration(wav_path)
        if duration_sec <= 0:
            print(" ❌ Duración del audio inválida", flush=True)
            return 1

        total_chunks = math.ceil((duration_sec * 1000) / CHUNK_DURATION_MS)
        print(f" Duración: {duration_sec:.2f} seg. Total fragmentos: {total_chunks}", flush=True)

        insert_sql = """
            INSERT INTO video_subtitulos (video_id, time_start, time_end, text)
            VALUES (%s, %s, %s, %s)
        """
        total_inserted = 0

        for i in range(total_chunks):
            start_sec = (i * CHUNK_DURATION_MS) / 1000.0
            duration = CHUNK_DURATION_MS / 1000.0
            base, _ = os.path.splitext(wav_path)
            chunk_path = f"{base}_chunk{i}.wav"

            print(f" Fragmento {i+1}/{total_chunks} (inicio: {start_sec:.1f}s)", flush=True)

            subprocess.run(
                ["ffmpeg", "-y", "-i", wav_path, "-ss", str(start_sec), "-t", str(duration), "-acodec", "copy", chunk_path],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

            print("  Transcribiendo...", flush=True)
            result = model.transcribe(chunk_path,fp16=False,task="transcribe",language="es",)

            for seg in result.get("segments", []):
                abs_start = float(seg["start"]) + start_sec
                abs_end = float(seg["end"]) + start_sec
                text = (seg.get("text") or "").strip()
                if text:
                    cur.execute(insert_sql, (video_id, abs_start, abs_end, text))
                    total_inserted += 1

            try:
                os.remove(chunk_path)
            except OSError:
                pass

        conn.commit()
        print(f" ✅ Proceso completado. Total subtítulos guardados: {total_inserted}", flush=True)
        return 0

    except Exception as e:
        print("❌ ERROR GENERAL:", e, flush=True)
        return 1

    finally:
        print(" Limpiando temporales...", flush=True)
        if cur:
            try: cur.close()
            except: pass
        if conn:
            try: conn.close()
            except: pass
        for p in (video_path, wav_path):
            if p and os.path.exists(p):
                try: os.remove(p)
                except: pass

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(" Uso: python procesar_subtitulos.py <video_id> <video_url>", flush=True)
        sys.exit(1)

    vid = sys.argv[1]
    url = sys.argv[2]
    sys.exit(main(vid, url))

# import os
# import sys
# import math
# import tempfile
# import subprocess
# import re

# import requests
# import psycopg2
# import whisper
# from google.cloud import storage  # <- NUEVO (para gs://)

# # ===================== Config DB =====================
# DB_CONFIG = {
#     "dbname": os.getenv("PGDATABASE", "atomica"),   # <-- mejor default
#     "user": os.getenv("PGUSER", "postgres"),
#     "password": os.getenv("PGPASSWORD", "atomica"),
#     "host": os.getenv("PGHOST", "localhost"),
#     "port": os.getenv("PGPORT", "5432"),
# }

# CHUNK_DURATION_MS = 15 * 1000  # 15 segundos por fragmento


# def infer_suffix_from_path(p: str, fallback: str = ".mp4") -> str:
#     """
#     Intenta inferir extensión para el archivo temporal, por ej:
#     gs://bucket/video.mp4 -> .mp4
#     https://.../video.mov -> .mov
#     """
#     try:
#         if p.startswith("gs://"):
#             m = re.match(r"^gs://[^/]+/(.+)$", p)
#             name = m.group(1) if m else ""
#         else:
#             name = p.split("?")[0].split("#")[0]
#             name = name.rsplit("/", 1)[-1]
#         if "." in name:
#             ext = "." + name.rsplit(".", 1)[-1].lower()
#             if len(ext) <= 8:
#                 return ext
#     except Exception:
#         pass
#     return fallback


# def download_gcs_to_file(gcs_uri: str, local_path: str) -> None:
#     """
#     Descarga desde gs://bucket/blob a local_path
#     """
#     m = re.match(r"^gs://([^/]+)/(.+)$", gcs_uri)
#     if not m:
#         raise ValueError(f"Invalid GCS URI: {gcs_uri}")
#     bucket_name, blob_name = m.group(1), m.group(2)

#     client = storage.Client()
#     bucket = client.bucket(bucket_name)
#     blob = bucket.blob(blob_name)

#     blob.download_to_filename(local_path)


# def download_to_temp(path_or_url: str) -> str:
#     """
#     Soporta:
#       - gs://bucket/blob
#       - https://storage.googleapis.com/bucket/blob
#       - https://bucket.storage.googleapis.com/blob
#       - http(s) normal
#     """
#     print(" Descargando el archivo del servidor...")

#     suffix = infer_suffix_from_path(path_or_url, fallback=".mp4")
#     fd, tmp_path = tempfile.mkstemp(suffix=suffix)
#     os.close(fd)  # cerramos el fd; luego escribimos por nuestra cuenta

#     # 1) gs://
#     if path_or_url.startswith("gs://"):
#         download_gcs_to_file(path_or_url, tmp_path)
#         print(f" Archivo guardado temporalmente en: {tmp_path}")
#         return tmp_path

#     # 2) https://storage.googleapis.com/bucket/blob
#     if path_or_url.startswith("https://storage.googleapis.com/"):
#         rest = path_or_url.replace("https://storage.googleapis.com/", "", 1)
#         bucket_name, blob_name = rest.split("/", 1)
#         client = storage.Client()
#         bucket = client.bucket(bucket_name)
#         blob = bucket.blob(blob_name)
#         blob.download_to_filename(tmp_path)
#         print(f" Archivo guardado temporalmente en: {tmp_path}")
#         return tmp_path

#     # 3) https://bucket.storage.googleapis.com/blob
#     m = re.match(r"^https://([^.]+)\.storage\.googleapis\.com/(.+)$", path_or_url)
#     if m:
#         bucket_name, blob_name = m.group(1), m.group(2)
#         client = storage.Client()
#         bucket = client.bucket(bucket_name)
#         blob = bucket.blob(blob_name)
#         blob.download_to_filename(tmp_path)
#         print(f" Archivo guardado temporalmente en: {tmp_path}")
#         return tmp_path

#     # 4) http(s) normal (fallback)
#     with requests.get(path_or_url, stream=True, timeout=180) as r:
#         r.raise_for_status()
#         with open(tmp_path, "wb") as f:
#             for chunk in r.iter_content(1024 * 64):
#                 if chunk:
#                     f.write(chunk)

#     print(f" Archivo guardado temporalmente en: {tmp_path}")
#     return tmp_path


# def convert_to_wav(input_path: str) -> str:
#     base, _ = os.path.splitext(input_path)
#     wav_path = base + ".wav"
#     print(" Convirtiendo a WAV...")
#     subprocess.run(
#         [
#             "ffmpeg",
#             "-y",
#             "-i",
#             input_path,
#             "-vn",
#             "-acodec",
#             "pcm_s16le",
#             "-ar",
#             "16000",
#             "-ac",
#             "1",
#             wav_path,
#         ],
#         check=True,
#         stdout=subprocess.DEVNULL,
#         stderr=subprocess.DEVNULL,
#     )
#     print(f" Archivo WAV listo: {wav_path}")
#     return wav_path


# def get_duration(file_path: str) -> float:
#     result = subprocess.run(
#         [
#             "ffprobe",
#             "-v",
#             "error",
#             "-show_entries",
#             "format=duration",
#             "-of",
#             "default=noprint_wrappers=1:nokey=1",
#             file_path,
#         ],
#         stdout=subprocess.PIPE,
#         stderr=subprocess.PIPE,
#         text=True,
#     )
#     return float(result.stdout.strip() or 0)


# def main(video_id: str):
#     print(f" Iniciando proceso de subtítulos para video_id={video_id}")
#     conn = None
#     cur = None
#     video_path = None
#     wav_path = None

#     # Modelo (ojo: medium consume mucha RAM)
#     model = whisper.load_model("medium")

#     try:
#         print(" Conectando a la base de datos...")
#         print(f"  -> {DB_CONFIG['dbname']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}")
#         conn = psycopg2.connect(**DB_CONFIG)
#         cur = conn.cursor()

#         print(" Buscando el video en la tabla uploads...")
#         cur.execute("SELECT file_path FROM uploads WHERE id = %s", (video_id,))
#         row = cur.fetchone()
#         if not row:
#             print(f" ❌ No se encontró video con id {video_id} en uploads")
#             return

#         file_path = row[0]
#         if not file_path:
#             print(" ❌ El campo file_path está vacío")
#             return

#         # ✅ AHORA soporta gs://
#         video_path = download_to_temp(file_path)
#         wav_path = convert_to_wav(video_path)

#         print(" Obteniendo duración del audio para dividir en fragmentos...")
#         duration_sec = get_duration(wav_path)
#         if duration_sec <= 0:
#             print(" ❌ Duración del audio inválida")
#             return

#         total_chunks = math.ceil((duration_sec * 1000) / CHUNK_DURATION_MS)
#         print(f" Duración: {duration_sec:.2f} seg. Total fragmentos: {total_chunks}")

#         insert_sql = """
#             INSERT INTO video_subtitulos (video_id, time_start, time_end, text)
#             VALUES (%s, %s, %s, %s)
#         """
#         total_inserted = 0

#         for i in range(total_chunks):
#             start_sec = (i * CHUNK_DURATION_MS) / 1000
#             duration = CHUNK_DURATION_MS / 1000
#             base, _ = os.path.splitext(wav_path)
#             chunk_path = f"{base}_chunk{i}.wav"

#             print(f" Fragmento {i+1}/{total_chunks} (inicio: {start_sec:.1f}s)")

#             subprocess.run(
#                 [
#                     "ffmpeg",
#                     "-y",
#                     "-i",
#                     wav_path,
#                     "-ss",
#                     str(start_sec),
#                     "-t",
#                     str(duration),
#                     "-acodec",
#                     "copy",
#                     chunk_path,
#                 ],
#                 check=True,
#                 stdout=subprocess.DEVNULL,
#                 stderr=subprocess.DEVNULL,
#             )

#             print("  Transcribiendo fragmento...")
#             result = model.transcribe(
#                 chunk_path,
#                 fp16=False,
#                 task="transcribe",
#                 language=None,
#             )

#             print("  Guardando resultados en la base de datos...")
#             for seg in result.get("segments", []):
#                 abs_start = seg["start"] + start_sec
#                 abs_end = seg["end"] + start_sec
#                 text = (seg.get("text") or "").strip()
#                 if text:
#                     cur.execute(insert_sql, (video_id, abs_start, abs_end, text))
#                     total_inserted += 1

#             try:
#                 os.remove(chunk_path)
#             except OSError:
#                 pass

#         conn.commit()
#         print(f" ✅ Proceso completado. Total subtítulos guardados: {total_inserted}")

#     except Exception as e:
#         print("❌ ERROR GENERAL:", e)

#     finally:
#         print(" Limpiando archivos temporales y cerrando conexiones...")
#         if cur:
#             try:
#                 cur.close()
#             except Exception:
#                 pass
#         if conn:
#             try:
#                 conn.close()
#             except Exception:
#                 pass
#         for p in (video_path, wav_path):
#             if p and os.path.exists(p):
#                 try:
#                     os.remove(p)
#                 except Exception:
#                     pass


# if __name__ == "__main__":
#     if len(sys.argv) < 2:
#         print(" Uso: python procesar_subtitulos.py <video_id>")
#         sys.exit(1)
#     main(sys.argv[1])

# -------------------------------------------------------------------
# import os
# import sys
# import math
# import tempfile
# import subprocess
# import requests
# import psycopg2
# import whisper

# # ===================== Config DB (nueva) =====================
# # Usa variables de entorno si existen, si no, usa los defaults
# DB_CONFIG = {
#     "dbname": os.getenv("PGDATABASE", "atomica_stremmer"),
#     "user": os.getenv("PGUSER", "postgres"),
#     "password": os.getenv("PGPASSWORD", "atomica"),
#     "host": os.getenv("PGHOST", "localhost"),
#     "port": os.getenv("PGPORT", "5432"),
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
#     # soporta .mkv, .mp4, etc.
#     base, _ = os.path.splitext(input_path)
#     wav_path = base + ".wav"
#     print(" Convirtiendo a WAV...")
#     subprocess.run(
#         [
#             "ffmpeg",
#             "-y",
#             "-i",
#             input_path,
#             "-vn",
#             "-acodec",
#             "pcm_s16le",
#             "-ar",
#             "16000",
#             "-ac",
#             "1",
#             wav_path,
#         ],
#         check=True,
#         stdout=subprocess.DEVNULL,
#         stderr=subprocess.DEVNULL,
#     )
#     print(f" Archivo WAV listo: {wav_path}")
#     return wav_path


# def main(video_id: str):
#     print(f" Iniciando proceso de subtítulos para video_id={video_id}")
#     conn = None
#     cur = None
#     video_path = None
#     wav_path = None

#     # 🔹 Modelo "medium" para mejor precisión
#     model = whisper.load_model("medium")

#     try:
#         print(" Conectando a la base de datos...")
#         print(f"  -> {DB_CONFIG['dbname']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}")
#         conn = psycopg2.connect(**DB_CONFIG)
#         cur = conn.cursor()

#         print(" Buscando el video en la tabla uploads...")
#         cur.execute("SELECT file_path FROM uploads WHERE id = %s", (video_id,))
#         row = cur.fetchone()
#         if not row:
#             print(f" ❌ No se encontró video con id {video_id} en uploads")
#             return

#         url = row[0]
#         if not url:
#             print(" ❌ El campo file_path está vacío")
#             return

#         video_path = download_to_temp(url)
#         wav_path = convert_to_wav(video_path)

#         print(" Obteniendo duración del audio para dividir en fragmentos...")

#         def get_duration(file_path: str) -> float:
#             result = subprocess.run(
#                 [
#                     "ffprobe",
#                     "-v",
#                     "error",
#                     "-show_entries",
#                     "format=duration",
#                     "-of",
#                     "default=noprint_wrappers=1:nokey=1",
#                     file_path,
#                 ],
#                 stdout=subprocess.PIPE,
#                 stderr=subprocess.PIPE,
#                 text=True,
#             )
#             return float(result.stdout.strip() or 0)

#         duration_sec = get_duration(wav_path)
#         if duration_sec <= 0:
#             print(" ❌ Duración del audio inválida")
#             return

#         total_chunks = math.ceil((duration_sec * 1000) / CHUNK_DURATION_MS)
#         print(f" Duración: {duration_sec:.2f} seg. Total fragmentos: {total_chunks}")

#         insert_sql = """
#             INSERT INTO video_subtitulos (video_id, time_start, time_end, text)
#             VALUES (%s, %s, %s, %s)
#         """
#         total_inserted = 0

#         for i in range(total_chunks):
#             start_sec = (i * CHUNK_DURATION_MS) / 1000
#             duration = CHUNK_DURATION_MS / 1000
#             base, _ = os.path.splitext(wav_path)
#             chunk_path = f"{base}_chunk{i}.wav"

#             print(f" Fragmento {i+1}/{total_chunks} (inicio: {start_sec:.1f}s)")

#             subprocess.run(
#                 [
#                     "ffmpeg",
#                     "-y",
#                     "-i",
#                     wav_path,
#                     "-ss",
#                     str(start_sec),
#                     "-t",
#                     str(duration),
#                     "-acodec",
#                     "copy",
#                     chunk_path,
#                 ],
#                 check=True,
#                 stdout=subprocess.DEVNULL,
#                 stderr=subprocess.DEVNULL,
#             )

#             print("  Transcribiendo fragmento...")
#             result = model.transcribe(
#                 chunk_path,
#                 fp16=False,
#                 task="transcribe",  # 🔹 Solo transcribir, sin traducir
#                 language=None,      # 🔹 Auto-detectar idioma
#             )

#             print("  Guardando resultados en la base de datos...")
#             for seg in result.get("segments", []):
#                 abs_start = seg["start"] + start_sec
#                 abs_end = seg["end"] + start_sec
#                 text = (seg.get("text") or "").strip()
#                 if text:
#                     cur.execute(insert_sql, (video_id, abs_start, abs_end, text))
#                     total_inserted += 1

#             # borrar chunk
#             try:
#                 os.remove(chunk_path)
#             except OSError:
#                 pass

#         conn.commit()
#         print(f" ✅ Proceso completado. Total subtítulos guardados: {total_inserted}")

#     except Exception as e:
#         print("❌ ERROR GENERAL:", e)

#     finally:
#         print(" Limpiando archivos temporales y cerrando conexiones...")
#         if cur:
#             try:
#                 cur.close()
#             except Exception:
#                 pass
#         if conn:
#             try:
#                 conn.close()
#             except Exception:
#                 pass
#         for p in (video_path, wav_path):
#             if p and os.path.exists(p):
#                 try:
#                     os.remove(p)
#                 except Exception:
#                     pass


# if __name__ == "__main__":
#     if len(sys.argv) < 2:
#         print(" Uso: python procesar_subtitulos.py <video_id>")
#         sys.exit(1)
#     main(sys.argv[1])

