# CoRide

## Prerequisites

- **Node.js** (LTS) and **npm**
- **Python 3.10+** (for the backend)
- **iOS:** Xcode (Simulator) or a physical iPhone with the [Expo Go](https://expo.dev/go) app
- **Android:** Android Studio / emulator, or a physical Android device with Expo Go

## Run the mobile app (Expo / React Native)

From the repo root:

```bash
cd mobile
npm install
npm start
```

This opens the Expo dev tools in the terminal and browser. From there you can:

- Press **`i`** to open the **iOS Simulator** (macOS with Xcode)
- Press **`a`** to open an **Android emulator** (with Android Studio set up)
- Scan the QR code with **Expo Go** on a physical device (same Wi‑Fi as your computer)

Other scripts:

```bash
npm run ios      # start and target iOS
npm run android  # start and target Android
npm run web      # run in the browser via Expo web
```

## Run the backend (FastAPI)

From the repo root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- API: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- Health check: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)
- Interactive docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

Stop the server with **Ctrl+C**.

## Troubleshooting (Expo Go)

If you see **“Project is incompatible with this version of Expo Go”**, the app’s **Expo SDK** (this repo uses **SDK 54**) is newer than the **Expo Go** build on your phone.

1. Update **Expo Go** from the [App Store](https://apps.apple.com/app/expo-go/id982107779) (iOS) or [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent) (Android), then try again.
2. If you cannot update the device, use the **iOS Simulator** or **Android emulator** (`npm run ios` / `npm run android`), or downgrade the project’s Expo SDK to match [Expo Go’s supported SDK](https://expo.dev/go).
