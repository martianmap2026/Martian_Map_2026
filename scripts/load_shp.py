import os
import geopandas as gpd
import requests
from dotenv import load_dotenv

# Cargar variables del archivo .env
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

def upload_shapefile_to_supabase(shp_path):
    print(f"Leyendo Shapefile: {shp_path}...")
    
    # Geopandas lee automáticamente el .shp, .dbf y .shx juntos
    gdf = gpd.read_file(shp_path)
    print(f"¡Cargado con éxito! Total de geometrías: {len(gdf)}")
    
    records = []
    for idx, row in gdf.iterrows():
        # Convertir geometría a WKT (Well-Known Text) para guardarla fácilmente en texto o PostGIS
        geom_wkt = row.geometry.wkt if row.geometry else None
        
        # Extraer los atributos del .dbf (excluyendo la geometría)
        attributes = row.drop('geometry').to_dict()
        
        records.append({
            "geometry_wkt": geom_wkt,
            "attributes": attributes
        })
    
    # Subir a Supabase por lotes
    batch_size = 100
    total = len(records)
    print(f"Subiendo {total} registros a la tabla 'mola_footprints'...")
    
    for i in range(0, total, batch_size):
        batch = records[i:i + batch_size]
        url = f"{SUPABASE_URL}/rest/v1/mola_footprints"
        response = requests.post(url, json=batch, headers=headers)
        
        if response.status_code not in [200, 201]:
            print(f"Error en lote {i}-{i+len(batch)}: {response.text}")
        else:
            print(f"Lote {i} a {min(i+batch_size, total)} subido con éxito.")

if __name__ == "__main__":
    # Ruta al archivo .shp dentro de data_raw
    shapefile_path = r"data_raw\MolaPEDR_22N22N_342E342E\MolaPEDR_22N22N_342E342E_20261113T102834997_shp.shp"
    
    if os.path.exists(shapefile_path):
        upload_shapefile_to_supabase(shapefile_path)
        print("\n¡Proceso de carga del Shapefile finalizado exitosamente!")
    else:
        print(f"No se encontró el archivo .shp en la ruta: {shapefile_path}")