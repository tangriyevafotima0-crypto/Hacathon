"""Native, locator-preserving extraction. Invoked with a server-selected local path."""
import json
import base64
import io
import sys
from pathlib import Path

path = Path(sys.argv[1])
if path.suffix.lower() == ".pdf":
    from pypdf import PdfReader
    reader = PdfReader(path)
    parts = []
    image_count = 0
    for page_number, page in enumerate(reader.pages, 1):
        text = page.extract_text() or ""
        parts.append({"locator": f"PDF page {page_number}", "text": text,
                      "status": "READY" if text.strip() else "OCR_REQUIRED"})
        try:
            images = list(page.images)
            for image_id, image in enumerate(images, 1):
                if image_count >= 3:
                    parts.append({"locator": f"PDF page {page_number} image {image_id}", "text": "", "status": "VISUAL_LIMIT_3_IMAGES"})
                    break
                from PIL import Image
                picture = Image.open(io.BytesIO(image.data)).convert("RGB")
                picture.thumbnail((1400, 1400))
                output = io.BytesIO()
                picture.save(output, format="JPEG", quality=80)
                parts.append({"locator": f"PDF page {page_number} image {image_id}", "text": "", "status": "VISION_PENDING",
                              "image": "data:image/jpeg;base64," + base64.b64encode(output.getvalue()).decode("ascii")})
                image_count += 1
        except Exception:
            parts.append({"locator": f"PDF page {page_number} visuals", "text": "", "status": "VISUAL_EXTRACTION_UNAVAILABLE"})

elif path.suffix.lower() == ".docx":
    from docx import Document
    document = Document(path)
    parts = [{"locator": f"Paragraph {i}", "text": p.text, "status": "READY"}
             for i, p in enumerate(document.paragraphs, 1) if p.text.strip()]
    for table_id, table in enumerate(document.tables, 1):
        for row_id, row in enumerate(table.rows, 1):
            parts.append({"locator": f"Table {table_id} row {row_id}",
                          "text": " | ".join(cell.text for cell in row.cells), "status": "READY"})
else:
    raise ValueError("Unsupported native extraction format")
sys.stdout.reconfigure(encoding="utf-8")
print(json.dumps(parts, ensure_ascii=False))
