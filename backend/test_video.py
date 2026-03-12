import sqlite3
import cv2
import os

try:
    conn = sqlite3.connect('ppe_detection.db')
    cursor = conn.cursor()
    cursor.execute('SELECT id, original_image_path, result_image_path FROM detections ORDER BY id DESC LIMIT 1')
    row = cursor.fetchone()
    if row:
        print(f"Latest DB Row: {row}")
        orig = row[1]
        
        cap = cv2.VideoCapture(orig)
        print(f"IsOpened: {cap.isOpened()}")
        if cap.isOpened():
            ret, frame = cap.read()
            print(f"First Frame Read: {ret}, shape: {frame.shape if ret else None}")
            fps = cap.get(cv2.CAP_PROP_FPS)
            count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
            width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
            height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
            print(f"FPS: {fps}, Count: {count}, Size: {width}x{height}")
        cap.release()
    else:
        print("No rows in detections.")
    
except Exception as e:
    print(f"Error: {e}")
