import io
import os
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client

# Cargar las variables de entorno desde el archivo .env
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Columnas oficiales que SÍ existen actualmente en tu tabla 'mars_datasets' en Supabase
ALLOWED_COLUMNS = [
    "id",
    "instrument_host",
    "instrument_id",
    "product_id",
    "observation_time",
    "center_latitude",
    "center_longitude",
    "geom",
    "gcom",
    "product_link",
    "files_link",
    "pds_version",
    "created_at",
    "bundle_id_if_pds4",
    "collection_id_if_pds4",
    "product_lid_if_pds4",
    "product_title_if_pds4",
    "orbital_data_explorer_product_display_label",
    "center_latitude_if_available",
    "center_longitude_if_available",
]


def load_and_clean_search_results():
  file_path = os.path.join("data_raw", "SearchResults Final.txt")

  if not os.path.exists(file_path):
    raise FileNotFoundError(f"No se encontró el archivo en: {file_path}")

  print(f"Leyendo archivo desde: {file_path}...")

  with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

  comment_lines = []
  data_lines = []

  for line in lines:
    if line.startswith("#"):
      comment_lines.append(line.lstrip("#").strip())
    else:
      if line.strip():
        data_lines.append(line)

  if not comment_lines:
    raise ValueError("No se encontraron líneas de encabezado en el archivo.")

  header_line = comment_lines[-1]
  clean_data = header_line + "\n" + "".join(data_lines)

  # Leer el CSV usando delimitador automático
  df = pd.read_csv(
      io.StringIO(clean_data), sep=None, engine="python", on_bad_lines="skip"
  )

  # Limpiar nombres de columnas: espacios, minúsculas y estandarización
  df.columns = df.columns.str.strip()
  df = df.replace(r"\t", "", regex=True)
  df.columns = df.columns.str.lower().str.replace(" ", "_")
  df.columns = df.columns.str.replace(r"[()]", "", regex=True)

  # Filtrar únicamente las columnas que existen en ALLOWED_COLUMNS
  existing_allowed = [col for col in ALLOWED_COLUMNS if col in df.columns]
  df = df[existing_allowed]

  print(f"¡Procesado con éxito! Total de filas limpias: {len(df)}")
  return df


def upload_to_supabase_api(df):
  if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError(
        "Faltan SUPABASE_URL o SUPABASE_KEY en el archivo .env. Por favor"
        " revísalo."
    )

  print("Conectando a Supabase mediante la API nativa (HTTP)...")
  supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

  table_name = "mars_datasets"

  print(f"Subiendo {len(df)} registros a la tabla '{table_name}'...")

  # Reemplazar NaN de Pandas por None para que se mapeen como NULL en PostgreSQL
  df = df.where(pd.notnull(df), None)
  records = df.to_dict(orient="records")

  # Subir en lotes de 100 para evitar saturar la petición HTTP
  batch_size = 100
  for i in range(0, len(records), batch_size):
    batch = records[i : i + batch_size]
    response = supabase.table(table_name).upsert(batch).execute()
    print(f"Lote {i // batch_size + 1} subido con éxito.")

  print(
      "¡Todos los datos fueron sincronizados correctamente en"
      f" '{table_name}'!"
  )


if __name__ == "__main__":
  try:
    df_results = load_and_clean_search_results()
    upload_to_supabase_api(df_results)
  except Exception as e:
    print(f"Ocurrió un error: {e}")