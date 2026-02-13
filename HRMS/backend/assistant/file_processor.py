import io
import logging

logger = logging.getLogger(__name__)

# MIME type mappings
DATA_MIMES = {
    'text/csv', 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}
IMAGE_MIMES = {
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
}
DOCUMENT_MIMES = {
    'application/pdf',
}


class FileProcessor:
    """Parses uploaded files and generates structured summaries for LLM context."""

    def process(self, file_data: bytes, file_name: str, mime_type: str) -> dict:
        """
        Parse a file and return structured analysis.
        Returns: {file_type, parsed_summary, parsed_metadata}
        """
        lower_name = file_name.lower()

        if mime_type in DATA_MIMES or lower_name.endswith(('.csv', '.xlsx', '.xls')):
            return self._process_csv_excel(file_data, file_name)
        elif mime_type in DOCUMENT_MIMES or lower_name.endswith('.pdf'):
            return self._process_pdf(file_data, file_name)
        elif mime_type in IMAGE_MIMES or lower_name.endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
            return self._process_image(file_data, file_name, mime_type)
        else:
            return {
                'file_type': 'DOCUMENT',
                'parsed_summary': f"File: {file_name} ({len(file_data)} bytes). Unsupported format for preview.",
                'parsed_metadata': {'file_size': len(file_data)},
            }

    def _process_csv_excel(self, file_data: bytes, file_name: str) -> dict:
        """Process CSV or Excel files with pandas."""
        import pandas as pd

        try:
            buffer = io.BytesIO(file_data)
            if file_name.lower().endswith('.csv'):
                df = pd.read_csv(buffer, nrows=10000)
            else:
                df = pd.read_excel(buffer, nrows=10000)

            rows, cols = df.shape

            # Column info
            col_info = []
            for col in df.columns:
                dtype = str(df[col].dtype)
                nulls = int(df[col].isnull().sum())
                col_info.append(f"  - {col} ({dtype}, {nulls} nulls)")

            # Numeric stats
            numeric_stats = ""
            numeric_cols = df.select_dtypes(include='number')
            if not numeric_cols.empty:
                stats_df = numeric_cols.describe().round(2)
                numeric_stats = f"\nNumeric Statistics:\n{stats_df.to_string()}"

            # Sample rows
            sample = df.head(5).to_string(index=False)

            summary = (
                f"Data File: {file_name}\n"
                f"Shape: {rows} rows x {cols} columns\n\n"
                f"Columns:\n" + "\n".join(col_info) +
                f"{numeric_stats}\n\n"
                f"Sample Data (first 5 rows):\n{sample}"
            )

            metadata = {
                'rows': rows,
                'columns': cols,
                'column_names': list(df.columns),
                'dtypes': {col: str(df[col].dtype) for col in df.columns},
                'null_counts': {col: int(df[col].isnull().sum()) for col in df.columns},
            }

            return {
                'file_type': 'DATA',
                'parsed_summary': summary,
                'parsed_metadata': metadata,
            }

        except Exception as e:
            logger.error(f"Error processing data file {file_name}: {e}")
            return {
                'file_type': 'DATA',
                'parsed_summary': f"Data File: {file_name} (Error parsing: {e})",
                'parsed_metadata': {'error': str(e)},
            }

    def _process_pdf(self, file_data: bytes, file_name: str) -> dict:
        """Process PDF files with pdfplumber."""
        import pdfplumber

        try:
            buffer = io.BytesIO(file_data)
            with pdfplumber.open(buffer) as pdf:
                page_count = len(pdf.pages)
                text_parts = []
                tables_found = 0

                for i, page in enumerate(pdf.pages[:20]):  # Limit to 20 pages
                    page_text = page.extract_text() or ''
                    if page_text:
                        text_parts.append(f"[Page {i + 1}]\n{page_text}")

                    page_tables = page.extract_tables() or []
                    tables_found += len(page_tables)
                    for table in page_tables:
                        if table:
                            formatted = "\n".join(
                                " | ".join(str(cell or '') for cell in row)
                                for row in table
                            )
                            text_parts.append(f"[Table on Page {i + 1}]\n{formatted}")

                full_text = "\n\n".join(text_parts)
                # Truncate to ~4000 chars for LLM context
                if len(full_text) > 4000:
                    full_text = full_text[:4000] + "\n\n... [truncated]"

                summary = (
                    f"PDF Document: {file_name}\n"
                    f"Pages: {page_count}, Tables found: {tables_found}\n\n"
                    f"Content:\n{full_text}"
                )

                metadata = {
                    'page_count': page_count,
                    'tables_found': tables_found,
                    'character_count': len(full_text),
                }

                return {
                    'file_type': 'DOCUMENT',
                    'parsed_summary': summary,
                    'parsed_metadata': metadata,
                }

        except Exception as e:
            logger.error(f"Error processing PDF {file_name}: {e}")
            return {
                'file_type': 'DOCUMENT',
                'parsed_summary': f"PDF Document: {file_name} (Error parsing: {e})",
                'parsed_metadata': {'error': str(e)},
            }

    def _process_image(self, file_data: bytes, file_name: str, mime_type: str) -> dict:
        """Process image files — get dimensions. Vision analysis happens at chat time."""
        try:
            from PIL import Image
            buffer = io.BytesIO(file_data)
            img = Image.open(buffer)
            width, height = img.size
            mode = img.mode

            size_kb = len(file_data) / 1024
            summary = (
                f"Image: {file_name}\n"
                f"Dimensions: {width}x{height}, Mode: {mode}\n"
                f"Size: {size_kb:.1f} KB, Type: {mime_type}"
            )

            metadata = {
                'width': width,
                'height': height,
                'mode': mode,
                'size_kb': round(size_kb, 1),
            }

            return {
                'file_type': 'IMAGE',
                'parsed_summary': summary,
                'parsed_metadata': metadata,
            }

        except Exception as e:
            logger.error(f"Error processing image {file_name}: {e}")
            return {
                'file_type': 'IMAGE',
                'parsed_summary': f"Image: {file_name} ({len(file_data)} bytes)",
                'parsed_metadata': {'error': str(e)},
            }
