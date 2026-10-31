from pathlib import Path
import fitz

ROOT = Path(".")
OUTPUT = ROOT / ".agents" / "outputs" / "invoice-po-comparison"
OUTPUT.mkdir(parents=True, exist_ok=True)

pdfs = {
    "invoice": ROOT / "attached_assets" / "Nido_Tech_Invoice_v2_1784983099144.pdf",
    "po": ROOT / "attached_assets" / "PO-00008_1783336109454.pdf",
}

for name, pdf_path in pdfs.items():
    doc = fitz.open(pdf_path)
    print(f"{name}: {len(doc)} page(s)")
    for page_index, page in enumerate(doc):
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        image_path = OUTPUT / f"{name}-page-{page_index + 1}.png"
        pix.save(image_path)
        print(f"  page {page_index + 1}: {page.rect.width:.1f}x{page.rect.height:.1f} -> {image_path}")
        for block in page.get_text("dict")["blocks"]:
            if block.get("type") != 0:
                continue
            text = " ".join(
                span["text"]
                for line in block.get("lines", [])
                for span in line.get("spans", [])
            ).strip()
            if any(term in text.lower() for term in ["item / description", "sub total", "gross subtotal", "total payable", "gst rate"]):
                print(f"    {text!r} bbox={block['bbox']}")