import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from paddleocr import PaddleOCRVL


IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff"}


def convert_pdf_to_images(pdf_path: Path, out_dir: Path, dpi: int = 150) -> list[Path]:
    try:
        import fitz  # PyMuPDF
    except Exception as exc:
        raise RuntimeError("PyMuPDF (pymupdf) is required for PDF rendering") from exc

    doc = fitz.open(pdf_path)
    image_paths: list[Path] = []
    for i in range(len(doc)):
        page = doc.load_page(i)
        pix = page.get_pixmap(dpi=dpi)
        img_path = out_dir / f"page-{i+1:03d}.png"
        pix.save(str(img_path))
        image_paths.append(img_path)
    doc.close()
    return image_paths


def convert_office_to_pdf(input_path: Path, out_dir: Path) -> Path:
    soffice = shutil.which("soffice")
    if not soffice:
        raise RuntimeError("LibreOffice (soffice) not found in PATH")

    cmd = [soffice, "--headless", "--convert-to", "pdf", "--outdir", str(out_dir), str(input_path)]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"LibreOffice convert failed: {result.stderr.strip()}")

    pdf_path = out_dir / f"{input_path.stem}.pdf"
    if not pdf_path.exists():
        raise RuntimeError("Converted PDF not found")

    return pdf_path


def read_markdown(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except Exception:
        return ""


def main():
    if len(sys.argv) < 3:
        print("Usage: python scripts\\paddleocr_vl_pipeline.py <input_file> <output_dir>")
        sys.exit(1)

    input_path = Path(sys.argv[1]).resolve()
    output_dir = Path(sys.argv[2]).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    if not input_path.exists():
        print("Input file not found")
        sys.exit(1)

    ext = input_path.suffix.lower()
    temp_dir = Path(tempfile.mkdtemp(prefix="paddleocr-vl-"))

    try:
        if ext in IMAGE_EXTS:
            image_paths = [input_path]
        elif ext == ".pdf":
            image_paths = convert_pdf_to_images(input_path, temp_dir)
        elif ext in {".doc", ".docx"}:
            pdf_path = convert_office_to_pdf(input_path, temp_dir)
            image_paths = convert_pdf_to_images(pdf_path, temp_dir)
        else:
            raise RuntimeError(f"Unsupported file type: {ext}")

        pipeline = PaddleOCRVL(pipeline_version="v1.5")
        pages = []
        combined_markdown = []
        combined_text = []

        for idx, image_path in enumerate(image_paths):
            output = pipeline.predict(str(image_path))

            # Capture markdown/json from each result
            page_markdown = []
            page_json = []
            for res in output:
                md_path = temp_dir / f"page-{idx+1:03d}.md"
                json_path = temp_dir / f"page-{idx+1:03d}.json"
                try:
                    res.save_to_markdown(save_path=str(md_path))
                    res.save_to_json(save_path=str(json_path))
                except Exception:
                    pass

                page_markdown.append(read_markdown(md_path))
                try:
                    page_json.append(json.loads(json_path.read_text(encoding="utf-8")))
                except Exception:
                    page_json.append({})

            page_md = "\n".join([p for p in page_markdown if p])
            if page_md:
                combined_markdown.append(page_md)
                combined_text.append(page_md)

            pages.append({
                "page": idx + 1,
                "image": str(image_path),
                "markdown": page_md,
                "raw": page_json,
            })

        result = {
            "text": "\n".join(combined_text).strip(),
            "markdown": "\n\n".join(combined_markdown).strip(),
            "pages": pages,
        }

        (output_dir / "output.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        (output_dir / "output.md").write_text(result["markdown"], encoding="utf-8")
    finally:
        try:
            shutil.rmtree(temp_dir)
        except Exception:
            pass


if __name__ == "__main__":
    main()
