import sys
import os
import requests
import cv2
from ultralytics import YOLO
import psycopg2
import json

video_id = sys.argv[1]
print(f" Iniciando procesamiento de objetos para video: {video_id}")
#  Ruta base
base_path = os.path.dirname(os.path.abspath(__file__))
video_path = os.path.join(base_path, f"temp_{video_id}.mp4")

#  Conexión a la base de datos PostgreSQL
conn = psycopg2.connect(
    dbname="Prueba-atomica-gratis",
    user="postgres",
    password="atomica",
    host="localhost",  # O IP pública si estás en Cloud
    port=5432
)
cursor = conn.cursor()

#  Obtener file_key desde API
try:
    res = requests.get(f"http://localhost:3000/api/videos/{video_id}")
    res.raise_for_status()
    video_info = res.json()
    file_key = video_info.get("file_key")

    if not file_key:
        print(" file_key no encontrado.")
        exit(1)
except Exception as e:
    print(f" Error al obtener file_key: {e}")
    exit(1)

#  Descargar video si no existe
if not os.path.exists(video_path):
    print(f"Descargando video: https://utfs.io/f/{file_key}")
    try:
        r = requests.get(f"https://utfs.io/f/{file_key}", stream=True)
        r.raise_for_status()
        with open(video_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)
    except Exception as e:
        print(f" Error al descargar video: {e}")
        exit(1)
else:
    print(" Video ya descargado")

#  Cargar video en OpenCV
cap = cv2.VideoCapture(video_path)
if not cap.isOpened():
    print(f" No se pudo abrir el video: {video_path}")
    exit(1)

#  Inicializar modelo YOLO
model = YOLO("yolov8n.pt")

fps = cap.get(cv2.CAP_PROP_FPS)
frame_interval = int(fps * 2)
print(f" Procesando 1 frame cada {frame_interval} frames (fps={fps})")

frame_idx = 0
insertados = 0

while True:
    ret, frame = cap.read()
    if not ret:
        break

    if frame_idx % frame_interval == 0:
        time_sec = round(frame_idx / fps, 2)
        print(f"➡ Frame {frame_idx} (seg {time_sec})")

        results = model(frame)
        labels = results[0].boxes.cls.tolist() if results[0].boxes.cls is not None else []
        names = [results[0].names[int(i)] for i in labels]

        #  Insertar directamente en la base de datos
        cursor.execute("""
            INSERT INTO video_objects (video_id, frame, time_sec, objects, created_at)
            VALUES (%s, %s, %s, %s, NOW())
        """, (video_id, frame_idx, time_sec, names))
        insertados += 1

    frame_idx += 1

conn.commit()
cap.release()
os.remove(video_path)

print(f"Se insertaron {insertados} registros en la tabla video_objects.")

