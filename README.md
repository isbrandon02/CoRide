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

The app includes **login** and **register** screens (`POST /auth/signup` then `POST /auth/token`). Start the backend first.

**API URL:** the app defaults to **iOS Simulator → `http://127.0.0.1:8000`** and **Android Emulator → `http://10.0.2.2:8000`**. On a **physical phone** (Expo Go), `127.0.0.1` is the phone itself, so you must set `EXPO_PUBLIC_API_URL` to your **computer’s LAN IP** (same Wi‑Fi), e.g. `http://192.168.1.10:8000`, in `mobile/.env`, then **restart Expo** after any `.env` change.

If you see **“Network request failed”**, the app cannot reach the backend: confirm `uvicorn` is running with `--host 0.0.0.0 --port 8000`, fix the URL above, and on macOS check the firewall is not blocking Python.

## Run the backend (FastAPI)

From the repo root:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env         # optional: set SECRET_KEY
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- API: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- Health check: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)
- Interactive docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

Stop the server with **Ctrl+C**.

### Authentication (signup + JWT / OAuth2)

The API stores users in **SQLite** under **`backend/data/coride.db`** by default. There is **no email verification** — after sign up you can sign in immediately. Configure secrets via **`backend/.env`** (see **`backend/.env.example`**).

| Endpoint | Description |
|----------|-------------|
| `POST /auth/signup` | JSON body: `{ "email", "password" }` (password min 8 chars). Creates the account; you can sign in immediately. |
| `POST /auth/token` | **OAuth2 password flow**: form fields `username` (your **email**) and `password`. Returns `{ "access_token", "token_type": "bearer" }`. |
| `GET /auth/me` | Requires header `Authorization: Bearer <access_token>`. |

In **Swagger UI** ([`/docs`](http://127.0.0.1:8000/docs)), use **Authorize** with the token from `/auth/token`, or call **POST /auth/token** with `application/x-www-form-urlencoded` (`username` + `password`).

If you see **`attempt to write a readonly database`**: ensure **`backend/data/`** and **`backend/data/coride.db`** are writable (not read-only on disk, not stuck in a read-only sync folder). Stop uvicorn, remove any **`coride.db-wal`** / **`coride.db-shm`** next to the DB if present, run **`chmod -R u+rwX backend/data`**, then start the server again. Or set **`DATABASE_URL`** to a path under **`/tmp`** for local dev.

## Troubleshooting (Expo Go)

If you see **“Project is incompatible with this version of Expo Go”**, the app’s **Expo SDK** (this repo uses **SDK 54**) is newer than the **Expo Go** build on your phone.

1. Update **Expo Go** from the [App Store](https://apps.apple.com/app/expo-go/id982107779) (iOS) or [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent) (Android), then try again.
2. If you cannot update the device, use the **iOS Simulator** or **Android emulator** (`npm run ios` / `npm run android`), or downgrade the project’s Expo SDK to match [Expo Go’s supported SDK](https://expo.dev/go).
