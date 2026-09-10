import shutil
from PIL import Image
import pytesseract
from pdf2image import convert_from_path


def _tesseract_available() -> bool:
    return shutil.which("tesseract") is not None


def extract_text_from_image(image_path: str) -> str:
    if not _tesseract_available():
        return "[OCR unavailable in this environment. Tesseract will be installed in the deployed Docker container.]"
    image = Image.open(image_path)
    return pytesseract.image_to_string(image)


def extract_text_from_pdf(pdf_path: str) -> str:
    if not _tesseract_available():
        return "[OCR unavailable in this environment. Tesseract will be installed in the deployed Docker container.]"
    pages = convert_from_path(pdf_path)
    full_text = []
    for page in pages:
        full_text.append(pytesseract.image_to_string(page))
    return "\n".join(full_text)


def extract_text(file_path: str, is_pdf: bool) -> str:
    if is_pdf:
        return extract_text_from_pdf(file_path)
    return extract_text_from_image(file_path)