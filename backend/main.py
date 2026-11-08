from fastapi import FastAPI

app = FastAPI(title="LIMS-BioPuna API")


@app.get("/health")
def health():
    return {"status": "ok"}