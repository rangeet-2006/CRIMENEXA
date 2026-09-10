from app.models.anomaly_model import AnomalyModel
from app.services.alert_notifier_service import notify_alert


def detect_anomalies(case_id: str, records: list):
    if len(records) < 5:
        return {
            "case_id": case_id,
            "results": [
                {"record_id": r.get("id", "unknown"), "is_anomaly": False, "anomaly_score": 0.0}
                for r in records
            ]
        }

    feature_keys = [k for k in records[0].keys() if k != "id"]
    feature_matrix = [[r[k] for k in feature_keys] for r in records]

    model = AnomalyModel(contamination=0.15)
    model.fit(feature_matrix)
    predictions, scores = model.predict(feature_matrix)

    results = []
    for record, prediction, score in zip(records, predictions, scores):
        is_anomaly = bool(prediction == -1)
        results.append({
            "record_id": record.get("id", "unknown"),
            "is_anomaly": is_anomaly,
            "anomaly_score": round(float(score), 4)
        })

        if is_anomaly:
            notify_alert(
                case_id=case_id,
                severity="CRITICAL" if score < -0.3 else "HIGH",
                category="FINANCIAL",
                title=f"Unusual pattern detected — record {record.get('id', 'unknown')}",
                description=f"Anomaly score: {round(float(score), 4)}. This record deviates significantly from the case's normal pattern."
            )

    return {"case_id": case_id, "results": results}