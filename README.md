# CoRide

CoRide is a carpooling app prototype for coworkers.

The idea behind it is pretty simple. A lot of people commute to the same office from nearby neighborhoods at roughly the same time, but they still drive alone. That means more traffic, more money spent on gas and parking, and a routine that can feel more isolating than it needs to. CoRide tries to make shared commuting feel easier, more normal, and worth doing.

Instead of asking people to figure everything out on their own, the app collects a few basics like home area, office, work schedule, and vehicle details. From there, it suggests likely matches, lets people request rides, gives both sides a way to manage those requests, and shows the savings and environmental impact over time.

## What CoRide does

The current prototype supports:

- account creation and login
- onboarding with commute and vehicle details
- coworker match suggestions based on route overlap and schedule fit
- ride requests with pending, accepted, declined, cancelled, and completed states
- direct messages and group chat
- an activity view for upcoming and past rides
- impact tracking for money saved, rides shared, and CO2 avoided
- badges, weekly goals, and a leaderboard

## Why we built it

We wanted to build something that sits in the overlap between climate, cost of living, and everyday routine.

A lot of sustainability ideas ask people to make major lifestyle changes. CoRide takes a smaller and more practical approach. If coworkers are already going to the same place at the same time, sharing that trip is one of the easiest changes they can make. It saves money, reduces emissions, and can make commuting feel a little less like dead time.

We also wanted this to feel like an actual product, not just a matching algorithm with a UI on top. That is why the project includes onboarding, ride coordination, chat, and progress tracking instead of stopping at one recommendation screen.

## Project structure

- `mobile/` contains the Expo React Native app
- `backend/` contains the FastAPI API and local SQLite setup

## Tech stack

- Mobile: Expo, React Native, React 19
- Backend: FastAPI, SQLAlchemy, SQLite
- Auth: JWT bearer auth
- Maps: Google Maps APIs for route preview and address-related features

## How matching works

The backend ranks potential carpool partners using two signals:

- route overlap, weighted at 60%
- work start time proximity, weighted at 40%

The mobile app then shows practical ride details like estimated ride time, detour, cost share, and CO2 saved.

## Demo mode

The backend seeds demo data on startup by default so the app is easier to explore during local development and demos.

That seeded data can include:

- demo accounts
- profile photos
- sample rides
- sample chat threads

You can turn that off in `backend/.env`:

```env
SEED_DEMO_ACCOUNTS=false
```

## Prerequisites

You will need:

- Node.js and npm
- Python 3.10+
- Expo Go on a phone, or an iOS simulator / Android emulator

## Run the backend

From the repo root:

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:

```bash
# Windows PowerShell
.venv\Scripts\Activate.ps1

# macOS or Linux
source .venv/bin/activate
```

Install dependencies and start the API:

```bash
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Useful backend URLs:

- API root: `http://127.0.0.1:8000`
- Health check: `http://127.0.0.1:8000/health`
- Swagger docs: `http://127.0.0.1:8000/docs`

Notes:

- the default database is `backend/data/coride.db`
- `backend/.env` controls the secret key, token lifetime, database URL, and demo seeding behavior

## Run the mobile app

Open a second terminal from the repo root:

```bash
cd mobile
npm install
copy .env.example .env
npm start
```

You can also use:

```bash
npm run ios
npm run android
npm run web
```

The mobile app expects the backend to already be running.

## Mobile environment setup

The main mobile environment variable is:

```env
EXPO_PUBLIC_API_URL=http://your-backend-url:8000
```

If you do not set it, the app falls back to local defaults:

- iOS Simulator: `http://127.0.0.1:8000`
- Android Emulator: `http://10.0.2.2:8000`

If you are using a physical phone with Expo Go, set `EXPO_PUBLIC_API_URL` to your computer's local network IP, for example:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.10:8000
```

Your phone and computer need to be on the same Wi-Fi network.

For route previews in the rides screen, you can also set:

```env
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key
```

If that key is missing, the rest of the app still works. You just will not see the route preview image.

After changing `mobile/.env`, restart Expo completely.

## Typical local flow

1. Start the backend in `backend/`
2. Start the mobile app in `mobile/`
3. Register a new account or use demo data
4. Complete onboarding
5. Open Find to see ranked commute matches
6. Request a ride, message someone, and check Activity and Goals

## API overview

Some of the main routes are:

- `POST /auth/signup` to create an account
- `POST /auth/token` to log in and get a bearer token
- `GET /auth/me` to fetch the signed-in user
- `GET /profile` and `PUT /profile` for onboarding and profile updates
- `GET /matches` for ranked commute matches
- `GET /rides`, `POST /rides`, and `PATCH /rides/{ride_id}` for ride management
- `GET /impact` for savings and emissions data
- `GET /leaderboard` for rankings
- `/chats/*` routes for conversations and messages

If you want to explore the backend directly, `http://127.0.0.1:8000/docs` is the easiest place to start.

## Troubleshooting

If the mobile app shows `Network request failed`:

- make sure the backend is running on port `8000`
- make sure `EXPO_PUBLIC_API_URL` points to the right machine
- remember that `127.0.0.1` on a physical phone is the phone itself, not your computer

If Expo Go says the project is incompatible:

- update Expo Go on your device
- or run the app in a simulator or emulator instead

If SQLite reports a read-only database:

- check that `backend/data/` is writable
- make sure the database file is not locked or marked read-only by your system or sync tool

## Current state

CoRide is still a prototype, but it already covers the full loop we cared about:

- set up your commute
- find likely coworkers
- request and manage rides
- talk to people
- track whether shared commuting is actually making a difference

That is the core motivation of the project. Make carpooling feel less awkward to start, easier to coordinate, and more rewarding to keep doing.
