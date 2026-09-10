import hashlib


def compute_file_hash(file_path: str) -> str:
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def verify_file_integrity(file_path: str, original_hash: str) -> dict:
    current_hash = compute_file_hash(file_path)
    is_unchanged = current_hash == original_hash

    return {
        "original_hash": original_hash,
        "current_hash": current_hash,
        "is_unchanged": is_unchanged,
        "status": "MATCH" if is_unchanged else "TAMPERING_DETECTED"
    }