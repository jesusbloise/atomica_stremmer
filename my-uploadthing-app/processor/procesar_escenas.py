import os
import sys
import requests
import psycopg2
from scenedetect import SceneManager, open_video, ContentDetector

# Configuración de la base de datos
conn = psycopg2.connect(
    host="localhost",
    database="Prueba-atomica-gratis",
    user="postgres",
    password="atomica"
)
cur = conn.cursor()

# Obtener el ID del video desde argumentos
if len(sys.argv) < 2:
    print("Debes pasar el ID del video como argumento.")
    sys.exit(1)

video_id = sys.argv[1]
print("Obteniendo info del video...")

# Obtener la URL del video desde la tabla uploads
cur.execute("SELECT file_key FROM uploads WHERE id = %s", (video_id,))
row = cur.fetchone()
if not row:
    print("Video no encontrado en la base de datos.")
    sys.exit(1)

file_key = row[0]
video_url = f"https://utfs.io/f/{file_key}"

# Descargar el video
print("Descargando video...")
temp_video = f"temp_{video_id}.mp4"
response = requests.get(video_url)
with open(temp_video, "wb") as f:
    f.write(response.content)

# Detectar escenas
print("Detectando escenas...")
video = open_video(temp_video)
scene_manager = SceneManager()
scene_manager.add_detector(ContentDetector())
scene_manager.detect_scenes(video)
scene_list = scene_manager.get_scene_list()

del video  # libera el archivo correctamente en PySceneDetect

# Eliminar escenas anteriores
cur.execute("DELETE FROM scene_segments WHERE video_id = %s", (video_id,))
for idx, (start, end) in enumerate(scene_list):
    cur.execute("""
        INSERT INTO scene_segments (video_id, scene_index, start_time, end_time)
        VALUES (%s, %s, %s, %s)
    """, (
        video_id,
        idx + 1,
        round(start.get_seconds(), 2),
        round(end.get_seconds(), 2)
    ))
conn.commit()

# Limpiar el video temporal
try:
    os.remove(temp_video)
    print(f"Se detectaron y guardaron {len(scene_list)} escenas para el video {video_id}.")
except PermissionError:
    print("No se pudo borrar el archivo de video, está en uso.")
