import pandas as pd

from app.ingestion.column_mapping import (
    CDR_ALIASES,
    apply_aliases,
    parse_duration_seconds,
    require_columns,
)

REQUIRED_COLUMNS = {"caller", "receiver", "call_time", "duration_seconds"}


def parse_cdr(file_path: str, is_excel: bool = False):
    if is_excel:
        df = pd.read_excel(file_path)
    else:
        df = pd.read_csv(file_path)

    # Accept the header names real exports actually use, not just ours.
    apply_aliases(df, CDR_ALIASES)
    require_columns(df, REQUIRED_COLUMNS, "CDR")

    # errors="coerce" so one unparseable timestamp drops a row instead of
    # failing the whole file.
    df["call_time"] = pd.to_datetime(df["call_time"], errors="coerce")
    dropped = int(df["call_time"].isna().sum())
    if dropped:
        df = df[df["call_time"].notna()]

    records = []
    for _, row in df.iterrows():
        records.append({
            "caller": str(row["caller"]).strip(),
            "receiver": str(row["receiver"]).strip(),
            "call_time": row["call_time"].isoformat(),
            "duration_seconds": parse_duration_seconds(row["duration_seconds"]),
            "call_type": str(row["call_type"]) if "call_type" in df.columns else None,
            "tower_id": str(row["tower_id"]).strip() if "tower_id" in df.columns else None,
        })

    return records
