"""Native, locator-preserving extraction. Invoked with a server-selected local path."""
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
if path.suffix.lower() == ".pdf":
    from pypdf import PdfReader
    reader = PdfReader(path)
    parts = []
    for page_number, page in enumerate(reader.pages, 1):
        text = page.extract_text() or ""
        parts.append({"locator": f"PDF page {page_number}", "text": text,
                      "status": "READY" if text.strip() else "OCR_REQUIRED"})
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
