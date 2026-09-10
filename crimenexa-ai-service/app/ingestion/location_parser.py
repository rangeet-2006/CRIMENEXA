import pandas as pd
import json


REQUIRED_COLUMNS = {"entity_name", "latitude", "longitude", "timestamp"}


def parse_location_csv(file_path: str):
    df = pd.read_csv(file_path)
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f"Location file is missing required columns: {missing}")

    df["timestamp"] = pd.to_datetime(df["timestamp"])

    points = []
    for _, row in df.iterrows():
        points.append({
            "entity_name": str(row["entity_name"]).strip(),
            "latitude": float(row["latitude"]),
            "longitude": float(row["longitude"]),
            "timestamp": row["timestamp"].isoformat(),
            "source": str(row.get("source", "")) if "source" in df.columns else None
        })

    return points


def parse_location_json(file_path: str):
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    points = []
    for item in data:
        points.append({
            "entity_name": item["entity_name"],
            "latitude": float(item["latitude"]),
            "longitude": float(item["longitude"]),
            "timestamp": item["timestamp"],
            "source": item.get("source")
        })

    return points