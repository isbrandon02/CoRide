# CoRide

CoRide is a carpooling app prototype built around one main idea: making everyday commuting more sustainable in a way that people can actually feel and track.

Many coworkers travel from nearby areas to the same office around the same time, yet they still drive alone. That means more traffic, more fuel burned, more money spent, and more emissions than necessary. CoRide is meant to turn that into a practical sustainability habit by helping people share rides with coworkers who already have similar routes and schedules.

Rather than stopping at ride matching, the app also makes the impact visible. CoRide tracks money saved, rides shared, and CO2 avoided, then reinforces that progress with badges, weekly goals, and a leaderboard. The goal is to make sustainability feel personal, measurable, and motivating instead of abstract.

## What CoRide does

The current app supports:

- account creation and login
- onboarding with commute and vehicle details
- coworker match suggestions based on route overlap and schedule fit
- ride requests with pending, accepted, declined, cancelled, and completed states
- direct messages and group chat
- an activity view for upcoming and past rides
- impact tracking for money saved, rides shared, and CO2 avoided
- badges, weekly goals, and a leaderboard

## Why we built it

We wanted CoRide to focus on a sustainability problem that already exists inside everyday routine instead of asking people to completely change how they live.

Work commutes are repeated, predictable, and often shared by people going to the same office. That made them a good place to design something practical. We built the project around reducing friction: helping people find likely matches, coordinate rides more easily, and stay motivated by seeing their progress over time.

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

~~~env
SEED_DEMO_ACCOUNTS=false
~~~

## Prerequisites

You will need:

- Node.js and npm
- Python 3.10+
- Expo Go on a phone, or an iOS simulator / Android emulator

## Run the backend

From the repo root:

~~~bash
cd backend
python -m venv .venv
~~~

Activate the virtual environment:

~~~bash
# Windows PowerShell
.venv\Scripts\Activate.ps1

# macOS or Linux
source .venv/bin/activate
~~~

Install dependencies and start the API:

~~~bash
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --reload --host 0.0.0.0 --port 8000
~~~

Useful backend URLs:

- API root: `http://127.0.0.1:8000`
- Health check: `http://127.0.0.1:8000/health`
- Swagger docs: `http://127.0.0.1:8000/docs`

Notes:

- the default database is `backend/data/coride.db`
- `backend/.env` controls the secret key, token lifetime, database URL, and demo seeding behavior

## Run the mobile app

Open a second terminal from the repo root:

~~~bash
cd mobile
npm install
copy .env.example .env
npm start
~~~

You can also use:

~~~bash
npm run ios
npm run android
npm run web
~~~

The mobile app expects the backend to already be running.

## Mobile environment setup

The main mobile environment variable is:

~~~env
EXPO_PUBLIC_API_URL=http://your-backend-url:8000
~~~

If you do not set it, the app falls back to local defaults:

- iOS Simulator: `http://127.0.0.1:8000`
- Android Emulator: `http://10.0.2.2:8000`

If you are using a physical phone with Expo Go, set `EXPO_PUBLIC_API_URL` to your computer's local network IP, for example:

~~~env
EXPO_PUBLIC_API_URL=http://192.168.1.10:8000
~~~

Your phone and computer need to be on the same Wi-Fi network.

For route previews in the rides screen, you can also set:

~~~env
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key
~~~

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

That is the core motivation behind the project. The goal is to make carpooling feel less awkward to start, easier to coordinate, and more rewarding to keep doing.
