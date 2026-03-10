import os
import sys
from paddleocr import PaddleOCRVL


def main():
    if len(sys.argv) < 3:
        print("Usage: python scripts\\paddleocr_vl_demo.py path\\to\\document_image.png output_dir")
        sys.exit(1)

    image_path = sys.argv[1]
    output_dir = sys.argv[2]

    os.makedirs(output_dir, exist_ok=True)

    pipeline = PaddleOCRVL(pipeline_version="v1.5")
    output = pipeline.predict(image_path)

    json_path = os.path.join(output_dir, "output.json")
    md_path = os.path.join(output_dir, "output.md")

    for res in output:
        res.print()
        res.save_to_json(save_path=json_path)
        res.save_to_markdown(save_path=md_path)


if __name__ == "__main__":
    main()
