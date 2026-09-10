import os
import tempfile

from app.services.vision_service import analyze_image

# Safely handle the absence of OpenCV (cv2) for free-tier deployments
try:
    import cv2
except ImportError:
    cv2 = None


def parse_cctv_image(image_path: str, filename: str, case_id: str):
    return analyze_image(image_path, filename, case_id)


def parse_cctv_video(video_path: str, filename: str, case_id: str, frame_interval_seconds: float = 2.0):
    if cv2 is None:
        raise RuntimeError(
            "CCTV video parsing is disabled because OpenCV (cv2) is not installed in this environment."
        )

    capture = cv2.VideoCapture(video_path)
    fps = capture.get(cv2.CAP_PROP_FPS) or 25
    frame_interval = int(fps * frame_interval_seconds)

    frame_results = []
    frame_number = 0
    extracted_count = 0

    while True:
        success, frame = capture.read()
        if not success:
            break

        if frame_number % frame_interval == 0:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
                cv2.imwrite(tmp.name, frame)
                tmp_frame_path = tmp.name

            try:
                timestamp_seconds = round(frame_number / fps, 2)
                result = analyze_image(tmp_frame_path, f"{filename}_frame_{extracted_count}", case_id)
                frame_results.append({
                    "timestamp_seconds": timestamp_seconds,
                    "detections": result["detections"],
                    "person_count": result["person_count"],
                    "vehicle_count": result["vehicle_count"]
                })
                extracted_count += 1
            finally:
                os.remove(tmp_frame_path)

        frame_number += 1

    capture.release()

    return {
        "case_id": case_id,
        "filename": filename,
        "total_frames_analyzed": extracted_count,
        "frame_results": frame_results
    }