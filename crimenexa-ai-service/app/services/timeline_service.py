from datetime import datetime


def build_timeline(cdr_records: list = None, location_points: list = None,
                    transaction_records: list = None, other_events: list = None):
    cdr_records = cdr_records or []
    location_points = location_points or []
    transaction_records = transaction_records or []
    other_events = other_events or []

    events = []

    for record in cdr_records:
        events.append({
            "timestamp": record["call_time"],
            "event_type": "COMMUNICATION",
            "description": f"Call from {record['caller']} to {record['receiver']} ({record['duration_seconds']}s)",
            "entities_involved": [record["caller"], record["receiver"]],
            "source": "CDR",
            "confidence": 1.0
        })

    for point in location_points:
        events.append({
            "timestamp": point["timestamp"],
            "event_type": "LOCATION",
            "description": f"{point['entity_name']} located at ({point['latitude']}, {point['longitude']})",
            "entities_involved": [point["entity_name"]],
            "source": point.get("source") or "GPS",
            "confidence": 1.0
        })

    for txn in transaction_records:
        events.append({
            "timestamp": txn["transaction_time"],
            "event_type": "FINANCIAL",
            "description": f"Transfer of {txn['amount']} from {txn['sender']} to {txn['receiver']}",
            "entities_involved": [txn["sender"], txn["receiver"]],
            "source": "TRANSACTION",
            "confidence": 1.0
        })

    for event in other_events:
        events.append(event)

    events.sort(key=lambda e: e["timestamp"])

    gaps = _detect_gaps(events)

    return {
        "events": events,
        "gaps_detected": gaps
    }


def _detect_gaps(events: list, gap_threshold_hours: float = 6.0):
    gaps = []
    for i in range(len(events) - 1):
        t1 = datetime.fromisoformat(str(events[i]["timestamp"]))
        t2 = datetime.fromisoformat(str(events[i + 1]["timestamp"]))
        gap_hours = (t2 - t1).total_seconds() / 3600.0

        if gap_hours >= gap_threshold_hours:
            gaps.append({
                "from": events[i]["timestamp"],
                "to": events[i + 1]["timestamp"],
                "gap_hours": round(gap_hours, 2)
            })

    return gaps