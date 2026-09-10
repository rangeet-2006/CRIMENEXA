# Sample case data

Three CSVs describing one fictional case — a set of calls, money movements and
GPS pings that reference the same cast, so the downstream analysis endpoints
have something coherent to work with.

Upload each to its matching endpoint with the same `case_id`:

| File | Endpoint |
| --- | --- |
| `cdr.csv` | `POST /api/ingestion/cdr` |
| `transactions.csv` | `POST /api/ingestion/transactions` |
| `location.csv` | `POST /api/ingestion/location` |

```bash
CASE=CAS-2024-0045
for f in cdr transactions location; do
  curl -X POST -F "file=@sample-data/$f.csv" -F "case_id=$CASE" \
    https://crimenexa-ai-service.onrender.com/api/ingestion/$f
done
```

## Column schemas

These are **not documented anywhere** — they were recovered by probing the live
service. A wrong column name returns `500 Internal Server Error`, not a
validation message, so there is no feedback to guide you.

| File | Required | Optional |
| --- | --- | --- |
| `cdr.csv` | `caller`, `receiver`, `call_time`, `duration_seconds` | `tower_id`, `latitude`, `longitude` |
| `transactions.csv` | `sender`, `receiver`, `amount`, `transaction_time` | `transaction_type` |
| `location.csv` | `entity_name`, `latitude`, `longitude`, `timestamp` | `source` |

The time column is named differently in all three: `call_time`, then
`transaction_time`, then `timestamp`. `timestamp` in a CDR file fails, and so
does `duration` in place of `duration_seconds`.

Timestamps are ISO-8601 with no timezone: `2026-04-12T21:05:00`.

## Why `caller`/`receiver` hold names, not phone numbers

Real CDR data carries numbers, and the parser accepts them. But the graph and
suspect ranking use these values verbatim as entity names, so a file of phone
numbers produces a graph of phone numbers and a suspect list ranking
`9812345678`. Names keep the demo readable. Swap in numbers for realism when
the ranking output no longer matters.

## What ingesting these produces

Verified against the live service on a scratch case:

- **Graph — 18 edges.** `cdr` and `transactions` auto-write into the graph
  (`CALLED` and `TRANSFERRED` respectively); `location` does not.
- **Influencers** — ranked by degree, Ahmed Khan highest at 9.
- **`priority/rank-suspects-for-case`** — 8 persons identified, ranked
  Ahmed Khan 41.2, Sara Malik 29.7, Tariq Mehmood 25.2, down to Shell Corp XYZ 4.2.
- **`timeline/build-for-case`** — 30 events interleaving COMMUNICATION and
  LOCATION, plus 2 detected gaps.
- **`cross-verification/verify-for-case`** — flags a `CONFLICT` on Ahmed Khan's
  location from two irreconcilable GPS points.

Ingesting into `CAS-2024-0045` will switch the app's network view from
`SAMPLE DATA` to `LIVE`, since that is the `ACTIVE_CASE_ID` in `src/App.tsx`.

## Known quirk

Entity types come from the identifier kind, not the entity. CDR rows label
everything `Phone`; transaction rows relabel the same names `BankAccount`. So
`CryptoFront LLC` and `Shell Corp XYZ` arrive typed as `BankAccount` and render
as person nodes rather than organisations. That is the service's typing, not the
frontend adapter's.
