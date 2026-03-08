import os
from flask import Flask
from flask_cors import CORS

app = Flask(__name__)

cors_origins = os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:8100").split(",")
CORS(app, origins=cors_origins)


@app.route("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8084))
    app.run(host="0.0.0.0", port=port, debug=True)
