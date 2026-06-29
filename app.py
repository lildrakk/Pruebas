import os
import uuid
import json
import requests
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from fastapi.staticfiles import StaticFiles

# ============================
# CARGAR .ENV
# ============================
load_dotenv()

app = FastAPI(title="Xtreme AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================
# MEMORIA PERSISTENTE
# ============================

def load_memory():
    try:
        with open("memory.json", "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {"history": [], "preferences": {}, "projects": []}

def save_memory(data):
    with open("memory.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)

memory = load_memory()

# ============================
# SYSTEM PROMPT AVANZADO
# ============================

SYSTEM_PROMPT = """
Eres XtremeAI, una IA que genera proyectos reales completos.
Nunca entregas ejemplos. Siempre generas código funcional.
Si faltan detalles, pide solo los necesarios.
Puedes crear archivos reales (.py, .js, .json, .zip, etc).
Cuando generes un archivo, usa el formato:

{
  "type": "file",
  "name": "NOMBRE",
  "url": "URL"
}

para que el frontend muestre un botón de descarga.

Usa la memoria para recordar:
- preferencias del usuario
- proyectos anteriores
- archivos generados
- contexto de la conversación

Tu objetivo es crear herramientas reales, completas y funcionales.
"""

# ============================
# GROQ CONFIG
# ============================

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "llama-3.3-70b-versatile"

class ChatRequest(BaseModel):
    prompt: str
    mode: str = "chat"   # chat / file / zip
    language: str | None = None

# ============================
# LLAMADA AL MODELO
# ============================

def llamar_al_modelo(prompt):
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    data = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2
    }

    response = requests.post(GROQ_URL, json=data, headers=headers)
    result = response.json()

    if "choices" not in result:
        error_msg = result.get("error", {}).get("message", "Error desconocido en la API de Groq.")
        return f"Error al generar respuesta: {error_msg}"

    return result["choices"][0]["message"]["content"]

# ============================
# RUTA PARA GENERAR ARCHIVOS REALES
# ============================

@app.post("/generate-file")
async def generate_file(data: dict):
    filename = data.get("filename", f"{uuid.uuid4()}.txt")
    content = data.get("content", "")

    os.makedirs("files", exist_ok=True)
    path = f"files/{filename}"

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

    return {
        "type": "file",
        "name": filename,
        "url": f"http://nc.lynxnodes.es:25677/files/{filename}"
    }

# ============================
# RUTA PRINCIPAL DE CHAT
# ============================

@app.post("/generate")
async def generate(req: ChatRequest):

    # Guardar memoria
    memory["history"].append(req.prompt)
    save_memory(memory)

    generated = llamar_al_modelo(req.prompt)

    # Si es chat normal
    if req.mode == "chat":
        return {"type": "chat", "content": generated}

    # Si es archivo
    file_id = str(uuid.uuid4())
    ext = "py" if (req.language or "").lower() == "python" else "txt"
    filename = f"{file_id}.{ext}"

    os.makedirs("files", exist_ok=True)
    filepath = f"files/{filename}"

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(generated)

    return {
        "type": "file",
        "name": filename,
        "url": f"http://nc.lynxnodes.es:25677/files/{filename}"
    }

# ============================
# MODELOS
# ============================

@app.get("/models")
def listar_modelos():
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    url = "https://api.groq.com/openai/v1/models"
    response = requests.get(url, headers=headers)
    return response.json()

# ============================
# ARCHIVOS ESTÁTICOS
# ============================

app.mount("/files", StaticFiles(directory="files"), name="files")
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")

# ============================
# RUN
# ============================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=25677)
