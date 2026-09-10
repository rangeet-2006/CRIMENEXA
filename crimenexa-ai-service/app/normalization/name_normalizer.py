import re


def normalize_name(raw_name: str) -> str:
    cleaned = re.sub(r"\s+", " ", raw_name.strip())
    cleaned = re.sub(r"[.,]", "", cleaned)
    return cleaned.title()


def generate_name_variants(raw_name: str) -> list:
    normalized = normalize_name(raw_name)
    parts = normalized.split()

    variants = {normalized}
    if len(parts) >= 2:
        first, last = parts[0], parts[-1]
        variants.add(f"{first[0]}. {last}")
        variants.add(f"{first} {last[0]}.")
        variants.add(last)

    return list(variants)