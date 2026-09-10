import pandas as pd

from app.ingestion.column_mapping import (
    TRANSACTION_ALIASES,
    apply_aliases,
    normalise,
    parse_amount,
    require_columns,
)

REQUIRED_COLUMNS = {"sender", "receiver", "amount", "transaction_time"}


def _resolve_bank_statement_shape(df):
    """
    Adapt a single-account bank statement to sender/receiver/amount.

    A statement has no sender column: every row is relative to the account it
    belongs to, with a Debit or Credit column giving direction and a Beneficiary
    naming the counterparty. Without this, such a file fails on a missing
    "sender" even though the information is all present.

    Debit  -> money left this account: sender = account holder, receiver = beneficiary
    Credit -> money arrived:           sender = beneficiary,    receiver = account holder
    """
    columns = set(df.columns)
    has_debit = "debit" in columns
    has_credit = "credit" in columns

    if "sender" in columns or not (has_debit or has_credit):
        return df

    holder = "Account Holder"

    amounts = []
    senders = []
    receivers = []
    for _, row in df.iterrows():
        debit = parse_amount(row["debit"]) if has_debit else 0.0
        credit = parse_amount(row["credit"]) if has_credit else 0.0
        counterparty = str(row["receiver"]).strip() if "receiver" in columns else "Unknown"

        if debit > 0:
            senders.append(holder)
            receivers.append(counterparty)
            amounts.append(debit)
        else:
            senders.append(counterparty)
            receivers.append(holder)
            amounts.append(credit)

    df = df.copy()
    df["sender"] = senders
    df["receiver"] = receivers
    df["amount"] = amounts
    return df


def parse_transactions(file_path: str, is_excel: bool = False):
    if is_excel:
        df = pd.read_excel(file_path)
    else:
        df = pd.read_csv(file_path)

    # A CSV pasted into a spreadsheet arrives as one column whose header is the
    # entire comma-joined header row. Split it back out rather than failing.
    if len(df.columns) == 1 and "," in str(df.columns[0]):
        header = [h.strip() for h in str(df.columns[0]).split(",")]
        rows = [str(v).split(",") for v in df.iloc[:, 0].astype(str)]
        rows = [r for r in rows if len(r) == len(header)]
        if rows:
            df = pd.DataFrame(rows, columns=header)

    apply_aliases(df, TRANSACTION_ALIASES)

    # "amount" may have been aliased from debit; keep the raw columns available
    # so direction can still be worked out below.
    df.columns = [normalise(c) for c in df.columns]
    df = _resolve_bank_statement_shape(df)

    require_columns(df, REQUIRED_COLUMNS, "Transaction")

    df["transaction_time"] = pd.to_datetime(df["transaction_time"], errors="coerce")
    df = df[df["transaction_time"].notna()]

    records = []
    for _, row in df.iterrows():
        records.append({
            "sender": str(row["sender"]).strip(),
            "receiver": str(row["receiver"]).strip(),
            "amount": parse_amount(row["amount"]),
            "transaction_time": row["transaction_time"].isoformat(),
            "transaction_type": str(row["transaction_type"]) if "transaction_type" in df.columns else None,
            "account_number": str(row["account_number"]) if "account_number" in df.columns else None,
        })

    return records
