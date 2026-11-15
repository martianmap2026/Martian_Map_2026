import os
import pandas as pd
import requests
from dotenv import load_dotenv

# Cargar las variables del archivo .env
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("¡Error! No se encontraron SUPABASE_URL o SUPABASE_KEY en el archivo .env")
    exit(1)

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

def upload_csv_to_supabase(file_path, table_name, batch_size=500):
    print(f"\nLeyendo archivo: {file_path}...")
    df = pd.read_csv(file_path)
    
    # Normalizar nombres de columnas a minúsculas y sin caracteres especiales
    df.columns = [c.strip().lower().replace(" ", "_").replace("(", "").replace(")", "") for c in df.columns]
    
    # Reemplazar valores nulos (NaN) por None para que JSON los maneje como NULL
    df = df.where(pd.notnull(df), None)
    records = df.to_dict(orient="records")
    
    total = len(records)
    print(f"Subiendo {total} registros a la tabla '{table_name}'...")
    
    for i in range(0, total, batch_size):
        batch = records[i:i + batch_size]
        url = f"{SUPABASE_URL}/rest/v1/{table_name}"
        response = requests.post(url, json=batch, headers=headers)
        
        if response.status_code not in [200, 201]:
            print(f"Error en lote {i}-{i+len(batch)}: {response.text}")
        else:
            print(f"Lote {i} a {min(i+batch_size, total)} subido con éxito.")

if __name__ == "__main__":
    folder = r"data_raw\MolaPEDR_22N22N_342E342E"
    
    if os.path.exists(folder):
        for filename in os.listdir(folder):
            file_full_path = os.path.join(folder, filename)
            
            # Identificar si es archivo de puntos (_pts_csv) o topografía (_topo_csv)
            if "pts_csv" in filename and filename.endswith(".csv"):
                upload_csv_to_supabase(file_full_path, "mola_points")
            elif "topo_csv" in filename and filename.endswith(".csv"):
                upload_csv_to_supabase(file_full_path, "mola_topography")
        print("\n¡Proceso de carga MOLA finalizado exitosamente!")
    else:
        print(f"No se encontró la carpeta: {folder}")