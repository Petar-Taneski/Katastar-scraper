from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import base64
import io

# import your functions from scrape_katastar.py
# make sure scrape_katastar.py is importable (PYTHONPATH or same folder)
from scrape_katastar import scrape_katastar, write_results_to_excel

app = FastAPI()

# Allow local dev from Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Job(BaseModel):
    region: str
    parcel: str
    katastar_region: Optional[str] = None

class BatchRequest(BaseModel):
    jobs: List[Job]

class BatchResponse(BaseModel):
    filename: str
    file_b64: str  # base64-encoded xlsx

@app.post("/scrape", response_model=BatchResponse)
def scrape_endpoint(req: BatchRequest):
    all_results = []
    for j in req.jobs:
        batch = scrape_katastar(j.region, j.parcel, j.katastar_region)
        all_results.extend(batch)

    if not all_results:
        raise HTTPException(status_code=404, detail="No results found.")

    # write to in-memory xlsx
    buffer = io.BytesIO()
    # reuse your writer, but it expects a filename; add a variant that accepts a workbook?
    # simplest: temporarily write to disk, read back, then delete; or patch writer to accept a stream.
    # Here we quick-patch by writing to disk and reading into memory:

    temp_filename = "results.xlsx"
    write_results_to_excel(all_results, temp_filename)
    with open(temp_filename, "rb") as f:
        data = f.read()

    file_b64 = base64.b64encode(data).decode("utf-8")
    return BatchResponse(filename="results.xlsx", file_b64=file_b64)
