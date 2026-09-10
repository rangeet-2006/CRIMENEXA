"""
Column-name tolerance for tabular ingestion.

Real exports do not use our field names. A CDR from one source says
Source/Destination/Time/Duration; a bank statement says Beneficiary Name and
Debit (INR). Previously any mismatch raised a bare ValueError, which the
endpoint turned into a 500 with no indication of which column was wrong - so an
upload looked like it had worked (the backend had already stored the file and
returned 200) while nothing was ever extracted.

This module normalises headers, accepts common aliases, and builds an error
message that names both what was wanted and what was actually present.
"""

import re


def normalise(name) -> str:
    """Header to a comparable key: 'Debit (INR)' -> 'debit'."""
    text = str(name).strip().lower()
    text = re.sub(r"\([^)]*\)", " ", text)          # drop parenthetical units
    text = re.sub(r"[^a-z0-9]+", "_", text)         # punctuation and spaces
    return text.strip("_")


def apply_aliases(df, aliases: dict):
    """
    Rename columns in place using an alias map of {canonical: [alternatives]}.

    Normalised headers are matched against normalised aliases, so 'Date & Time'
    and 'date_time' both resolve. The first alias present wins; a column already
    carrying the canonical name is left alone.
    """
    df.columns = [normalise(c) for c in df.columns]
    present = set(df.columns)

    for canonical, alternatives in aliases.items():
        if canonical in present:
            continue
        for alternative in alternatives:
            key = normalise(alternative)
            if key in present:
                df.rename(columns={key: canonical}, inplace=True)
                present = set(df.columns)
                break
    return df


def require_columns(df, required: set, file_kind: str):
    """
    Raise a message that is actually actionable if anything is missing.

    Names the missing canonical columns AND the headers the file does have, so
    whoever sees it can tell immediately whether it is a naming problem or the
    wrong file entirely.
    """
    missing = required - set(df.columns)
    if not missing:
        return
    raise ValueError(
        f"{file_kind} file is missing required column(s): {sorted(missing)}. "
        f"Columns found: {sorted(df.columns)}. "
        f"Rename the source columns, or add them to the alias map in "
        f"app/ingestion/column_mapping.py."
    )


def parse_duration_seconds(value) -> int:
    """
    Duration to whole seconds.

    Accepts 45, '45', '45 sec', '45s', '1:30' (mm:ss) and '2 min'. Exports
    rarely give a bare integer, and int('45 sec') raises.
    """
    if value is None:
        return 0
    if isinstance(value, (int, float)):
        return int(value)

    text = str(value).strip().lower()
    if not text:
        return 0

    # mm:ss or hh:mm:ss
    if ":" in text:
        parts = [p.strip() for p in text.split(":")]
        try:
            numbers = [int(float(p)) for p in parts]
        except ValueError:
            return 0
        seconds = 0
        for number in numbers:
            seconds = seconds * 60 + number
        return seconds

    match = re.search(r"(\d+(?:\.\d+)?)", text)
    if not match:
        return 0
    amount = float(match.group(1))
    if re.search(r"\b(min|minute|mins|m)\b", text):
        amount *= 60
    elif re.search(r"\b(hr|hour|hours|h)\b", text):
        amount *= 3600
    return int(amount)


def parse_amount(value) -> float:
    """
    Monetary value to float.

    Accepts 245200, '245200.0', '2,45,200.00' (Indian grouping) and '₹1,200'.
    float('2,45,200') raises, and a statement that fails on the thousands
    separator is a bad reason to lose a whole file.
    """
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = re.sub(r"[^0-9.\-]", "", str(value))
    if not text or text in {"-", ".", "-."}:
        return 0.0
    try:
        return float(text)
    except ValueError:
        return 0.0


# Aliases seen in real CDR exports.
CDR_ALIASES = {
    "caller": ["source", "a_party", "calling_number", "caller_number", "from", "originating_number"],
    "receiver": ["destination", "b_party", "called_number", "receiver_number", "to", "terminating_number"],
    "call_time": ["time", "timestamp", "date_time", "start_time", "call_date", "datetime"],
    "duration_seconds": ["duration", "call_duration", "duration_sec", "dur"],
    "tower_id": ["location", "cell_id", "tower", "cell_site", "site_id"],
}

# Aliases seen in bank statements.
#
# NOTE: debit and credit are deliberately NOT aliased to "amount". The
# transaction parser needs both columns intact to work out direction - aliasing
# debit to amount would consume the column and leave every row looking like a
# zero-value credit, i.e. the right figure lost and the direction reversed.
TRANSACTION_ALIASES = {
    "sender": ["from", "payer", "debit_account", "sender_name", "account_holder"],
    "receiver": ["beneficiary_name", "beneficiary", "to", "payee", "receiver_name", "credit_account"],
    "amount": ["amount_inr", "value", "transaction_amount", "txn_amount"],
    "transaction_time": ["date_time", "time", "timestamp", "value_date", "date", "txn_date"],
    "transaction_type": ["type", "txn_type", "mode", "payment_mode"],
    "account_number": ["beneficiary_account", "account", "acct_no", "account_no"],
}
