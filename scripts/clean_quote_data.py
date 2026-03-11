import sys
import json
import re
import pandas as pd
from io import StringIO

def extract_markdown_tables(text):
    """Find all markdown tables in the text using line-by-line grouping."""
    lines = text.split('\n')
    tables = []
    current_table = []
    
    for line in lines:
        # A markdown table line usually has at least two |
        if line.count('|') >= 2:
            current_table.append(line)
        else:
            if current_table:
                # Check if the block looks like a table (contains a separator row)
                has_separator = False
                for row in current_table:
                    # Markdown separator rows look like |---| or |:---| etc.
                    if re.search(r'\|[ :%-]*\|', row) and ('---' in row or '-|-' in row):
                        has_separator = True
                        break
                
                if has_separator:
                    tables.append('\n'.join(current_table))
                current_table = []
    
    # Final check
    if current_table:
        if any(re.match(r'^\|[\s:-|]+\|$', l.strip()) for l in current_table):
            tables.append('\n'.join(current_table))
            
    return tables

def normalize_table(df):
    """Normalize common logistics headers."""
    column_mapping = {
        r'ocean.*': 'Ocean Freight',
        r'pol|origin': 'POL',
        r'pod|destination': 'POD',
        r'transit.*': 'Transit Time',
        r'valid.*': 'Validity',
        r'carrier|agent|line': 'Carrier',
        r'currency|unit': 'Currency',
        r'total.*': 'Total Amount'
    }
    
    new_cols = []
    for col in df.columns:
        col_lower = str(col).lower().strip()
        matched = False
        for pattern, replacement in column_mapping.items():
            if re.search(pattern, col_lower):
                new_cols.append(replacement)
                matched = True
                break
        if not matched:
            new_cols.append(col)
    
    df.columns = new_cols
    return df

def clean_data(raw_text):
    tables = extract_markdown_tables(raw_text)
    cleaned_tables = []
    
    for table_str in tables:
        try:
            table_str = table_str.strip()
            if not table_str: continue
            
            lines = [l.strip() for l in table_str.split('\n') if l.strip()]
            if len(lines) < 3: continue
            
            # Find separator line (|---|---|)
            sep_idx = -1
            for i, line in enumerate(lines):
                if i > 0 and re.match(r'^\|[\s:-|]+\|$', line):
                    sep_idx = i
                    break
            
            if sep_idx == -1: continue
            
            # Header is immediately above separator
            header_line = lines[sep_idx - 1]
            headers = [h.strip() for h in header_line.split('|') if h.strip()]
            
            rows = []
            for i in range(sep_idx + 1, len(lines)):
                line = lines[i]
                if not line.startswith('|') or not line.endswith('|'): continue
                
                # Split and handle empty cells if needed
                cells = [c.strip() for c in line.split('|')]
                # Remove first and last empty cells from split
                if line.startswith('|'): cells = cells[1:]
                if line.endswith('|'): cells = cells[:-1]
                
                if len(cells) >= len(headers):
                    row_dict = {headers[j]: cells[j] for j in range(len(headers))}
                    rows.append(row_dict)
            
            if not rows: continue
            
            df = pd.DataFrame(rows)
            # Remove any row that looks like a separator just in case
            df = df[~df.iloc[:, 0].str.contains(r'^-+$', na=False)]
            
            df = normalize_table(df)
            cleaned_tables.append(df.to_dict(orient='records'))
        except Exception as e:
            continue
            
    return cleaned_tables

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No input provided"}))
        sys.exit(1)
        
    input_text = sys.argv[1]
    if input_text.endswith('.md') or input_text.endswith('.txt'):
        try:
            with open(input_text, 'r', encoding='utf-8') as f:
                input_text = f.read()
        except:
            pass

    try:
        result = clean_data(input_text)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
