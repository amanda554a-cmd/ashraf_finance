# Ashraf Finance — Biometric ID Verification & Image Forensics

An automated identity verification and digital image forensics platform built with **InsightFace (ArcFace)**, **OpenCV**, and **FastAPI**.

It automatically compares identity cards and selfie photos to determine biometric identity matching, detects image manipulation (Photoshop, Generative AI, face-swapping), and extracts over 75+ camera, optical, GPS, and EXIF metadata parameters.

---

## ✨ Features

- **Biometric Face Verification (ArcFace):**
  - High-precision facial representation matching using deep embedding vectors (ArcFace `buffalo_l`).
  - Calibrated similarity scoring with clear match / mismatch classification.

- **Dual Mode Biometric Detection:**
  - **Single-Image Mode (Selfie Holding ID):** Multi-scale face detection (640px and 1600px) locates both the user's face and tiny ID card portrait in a single photo, crops the ID badge photo, and verifies identity.
  - **Dual-Image Mode (ID Card + Selfie):** Compares an ID card photo and selfie photo side-by-side.

- **Digital Forensics & Tamper Detection:**
  - Detects editing software tags (e.g. `Adobe Photoshop 27.1`, GIMP, Canva, Adobe Firefly).
  - Inspects Adobe Photoshop IRB (8BIM) blocks and XMP Core history.
  - Generative AI & Content Credentials (C2PA) marker detection.
  - Date consistency audit (flags discrepancy between camera capture date and file modification date).

- **Complete EXIF & File Metadata Inspection (75+ Fields):**
  - Camera & Device: Make, Model, Host Computer/OS, Lens Model & Specification.
  - Optical & Shot Parameters: Exposure Time, Aperture (F-number), ISO, Focal Length, 35mm Equivalent, Metering Mode, Flash, White Balance, Brightness.
  - Geolocation: GPS Latitude, Longitude, Altitude, UTC Timestamp.
  - Technical: Dimensions, Color Space (sRGB / Display P3), DPI, Orientation, Format.
  - Live metadata search box to instantly filter any field or value.

- **Clean Fintech UI:**
  - Stripe/Fintech-grade visual design.
  - Unified drag & drop zone for 1 or 2 images.
  - Live thumbnail previews before verification.
  - Fast response times running completely on local hardware.

---

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.10+
- (Optional) NVIDIA GPU with CUDA for ultra-fast ONNX inference

### 2. Installation
Clone the repository:
```bash
git clone https://github.com/ashifashrafdip/ashraf_finance.git
cd ashraf_finance
```

Install dependencies:
```bash
python -m pip install -r requirements.txt
```

### 3. Run the Server
On Windows, you can double-click **`Run_KYC_Verifier.bat`** or execute:
```bash
python kyc_verifier.py
```

Open your browser and navigate to:
```
http://127.0.0.1:8000
```

---

## 🛠️ API Reference

### `POST /api/verify`
Accepts `multipart/form-data`:
- `mode`: `"single"` or `"dual"`
- `image1`: Source image file (Selfie holding ID, or Selfie photo)
- `image2`: (Optional in dual mode) ID card image file

**Response JSON:**
```json
{
  "mode": "single",
  "similarity_pct": "80.6%",
  "similarity_label": "Strong similarity",
  "is_match": true,
  "card_id": { ... },
  "card_selfie": { ... },
  "table": {
    "col_id_title": "ID CARD",
    "col_selfie_title": "SELFIE HOLDING ID",
    "rows": [ ... ]
  }
}
```

### `GET /api/health`
Returns system status and active biometric model:
```json
{
  "status": "ok",
  "brand": "Ashraf Finance",
  "model": "ArcFace buffalo_l"
}
```

---

## 📄 License
MIT License.
