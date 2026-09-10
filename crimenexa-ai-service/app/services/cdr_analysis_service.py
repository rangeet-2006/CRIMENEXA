from collections import defaultdict


def analyze_cdr(records: list):
    call_frequency = defaultdict(int)
    duration_by_pair = defaultdict(int)

    for record in records:
        pair_key = f"{record['caller']} -> {record['receiver']}"
        call_frequency[pair_key] += 1
        duration_by_pair[pair_key] += record["duration_seconds"]

    sorted_pairs = sorted(call_frequency.items(), key=lambda x: x[1], reverse=True)
    most_frequent_pairs = [
        {"pair": pair, "call_count": count} for pair, count in sorted_pairs[:10]
    ]

    avg_frequency = sum(call_frequency.values()) / len(call_frequency) if call_frequency else 0
    unusual_flags = [
        {"pair": pair, "call_count": count, "reason": "Significantly above average call frequency"}
        for pair, count in call_frequency.items()
        if count > avg_frequency * 2 and count >= 5
    ]

    return {
        "call_frequency": dict(call_frequency),
        "total_duration_by_pair": dict(duration_by_pair),
        "most_frequent_pairs": most_frequent_pairs,
        "unusual_frequency_flags": unusual_flags
    }