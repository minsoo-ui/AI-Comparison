# PaddleOCR-VL Setup

This project can call the Python PaddleOCR-VL pipeline from NestJS for image and PDF inputs.

## 1) Prerequisites
- Python installed and available in PATH as `python`.
- A virtual environment is recommended.

## 2) Install PaddleOCR-VL dependencies
From the repo root:

```cmd
python -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
python -m pip install paddleocr pymupdf
```

## 3) Run the PaddleOCR-VL pipeline
A pipeline script is provided:

```cmd
.venv\Scripts\activate
python scripts\paddleocr_vl_pipeline.py path\to\image.png output
python scripts\paddleocr_vl_pipeline.py path\to\file.pdf output
```

## 4) Output
The script writes:
- `output\output.json`
- `output\output.md`

## 5) Use in NestJS
Enable PaddleOCR-VL in `.env`:

```
USE_PADDLEOCR_VL=1
PADDLEOCR_PYTHON=python
PADDLEOCR_VL_SCRIPT=scripts/paddleocr_vl_pipeline.py
```

Notes:
- Image and PDF inputs will use PaddleOCR-VL when enabled.
- DOC/DOCX support will be added in a later update.

## 6) Notes
- If `python` is not recognized, install Python and reopen your terminal.
