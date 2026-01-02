import os
import sys
import requests
import cv2
import mediapipe as mp
import psycopg2
import io
import numpy as np

if len(sys.argv) < 2:
    print("Debes pasar el ID del video como argumento.")
    sys.exit(1)

video_id = sys.argv[1]

conn = psycopg2.connect(
    host="localhost",
    database="Prueba-atomica-gratis",
    user="postgres",
    password="atomica"
)
cur = conn.cursor()

cur.execute("SELECT file_key FROM uploads WHERE id = %s", (video_id,))
row = cur.fetchone()
if not row:
    print("Video no encontrado.")
    sys.exit(1)

file_key = row[0]
video_url = f"https://utfs.io/f/{file_key}"

print(" Descargando video...")
temp_video = f"temp_{video_id}.mp4"
response = requests.get(video_url)
with open(temp_video, "wb") as f:
    f.write(response.content)

mp_pose = mp.solutions.pose
mp_face = mp.solutions.face_detection
pose = mp_pose.Pose(static_image_mode=False)
face = mp_face.FaceDetection(model_selection=1, min_detection_confidence=0.5)

cap = cv2.VideoCapture(temp_video)
fps = cap.get(cv2.CAP_PROP_FPS)
frame_index = 0
# output_dir = os.path.join("frames", video_id)
# os.makedirs(output_dir, exist_ok=True)

cur.execute("DELETE FROM video_poses WHERE video_id = %s", (video_id,))

while cap.isOpened():
    success, frame = cap.read()
    if not success:
        break

    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    result_pose = pose.process(frame_rgb)
    result_face = face.process(frame_rgb)

    rostro = result_face.detections is not None and len(result_face.detections) > 0
    mano_izq_arriba = False
    frame_path = None

    l_shoulder_x = l_shoulder_y = l_shoulder_z = None
    l_wrist_x = l_wrist_y = l_wrist_z = None

    if result_pose.pose_landmarks:
        l_shoulder = result_pose.pose_landmarks.landmark[mp_pose.PoseLandmark.LEFT_SHOULDER]
        l_wrist = result_pose.pose_landmarks.landmark[mp_pose.PoseLandmark.LEFT_WRIST]

        l_shoulder_x, l_shoulder_y, l_shoulder_z = l_shoulder.x, l_shoulder.y, l_shoulder.z
        l_wrist_x, l_wrist_y, l_wrist_z = l_wrist.x, l_wrist.y, l_wrist.z
        mano_izq_arriba = l_wrist_y < l_shoulder_y

    if rostro or mano_izq_arriba:
        time_sec = round(frame_index / fps, 2)

        # ✅ NUEVO: convertir imagen a JPEG binario sin guardarla en disco
        _, buffer = cv2.imencode('.jpg', frame)
        image_bytes = buffer.tobytes()

        # 🔁 Seguimos insertando en video_poses (como antes)
        cur.execute("""
            INSERT INTO video_poses (
                video_id, frame, time_sec, rostro_detectado, mano_izq_arriba,
                l_shoulder_x, l_shoulder_y, l_shoulder_z,
                l_wrist_x, l_wrist_y, l_wrist_z,
                frame_path
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            video_id, frame_index, time_sec, rostro, mano_izq_arriba,
            l_shoulder_x, l_shoulder_y, l_shoulder_z,
            l_wrist_x, l_wrist_y, l_wrist_z,
            f"[BLOB en video_frames]"
        ))

        # ✅ NUEVO: guardar imagen binaria en video_frames
        cur.execute("""
            INSERT INTO video_frames (
                video_id, frame_number, time_sec, image_data
            ) VALUES (%s, %s, %s, %s)
        """, (
            video_id, frame_index, time_sec, psycopg2.Binary(image_bytes)
        ))

        print(f"Frame {frame_index} - rostro={rostro}, mano_izq_arriba={mano_izq_arriba}, tiempo={time_sec}s")

    frame_index += 1
    
    # if rostro or mano_izq_arriba:
    #     time_sec = round(frame_index / fps, 2)
    #     frame_filename = f"{video_id}_frame_{frame_index}.jpg"
    #     frame_path = os.path.join(output_dir, frame_filename)
    #     cv2.imwrite(frame_path, frame)

    #     cur.execute("""
    #         INSERT INTO video_poses (
    #             video_id, frame, time_sec, rostro_detectado, mano_izq_arriba,
    #             l_shoulder_x, l_shoulder_y, l_shoulder_z,
    #             l_wrist_x, l_wrist_y, l_wrist_z,
    #             frame_path
    #         )
    #         VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    #     """, (
    #         video_id, frame_index, time_sec, rostro, mano_izq_arriba,
    #         l_shoulder_x, l_shoulder_y, l_shoulder_z,
    #         l_wrist_x, l_wrist_y, l_wrist_z,
    #         frame_path
    #     ))

    #     print(f"Frame {frame_index} - rostro={rostro}, mano_izq_arriba={mano_izq_arriba}, tiempo={time_sec}s")

    # frame_index += 1

cap.release()
pose.close()
face.close()
conn.commit()
cur.close()
conn.close()

try:
    os.remove(temp_video)
except:
    pass

print(f"Guardado completado para {video_id}")

