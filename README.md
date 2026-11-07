# Tracking Fleet Driver (Mobile)

Expo Go + React Native driver device app. Drivers sign in, view their assigned vehicle, and report GPS positions to the backend. The backend broadcasts each recorded location over WebSocket (`/ws`, STOMP topic `/topic/vehicles/live`) so the web dashboard/live map updates.

## Prerequisites
- Node.js + npm
- Expo Go on your phone (or Android/iOS emulator)
- Backend running and reachable from the device

## Setup
```bash
cd mobile
cp .env.example .env
# edit EXPO_PUBLIC_API_BASE_URL to your machine LAN IP, e.g. http://192.168.1.20:8081
npm install
npx expo start
```
Scan the QR code with Expo Go.

## Local dev credentials (backend `local` profile)
- Driver: `driver` / `driver123` (assigned to `TF-1001` by local seed)
- Admin (web): `admin` / `admin123`

## Driver API (JWT `ROLE_DRIVER`)
- `POST /api/v1/auth/login`
- `GET /api/v1/driver/me/vehicle`
- `POST /api/v1/driver/me/location` body:
  ```json
  { "latitude": 52.3676, "longitude": 4.9041, "speedKph": 42.5, "heading": 90, "accuracyMeters": 4.0, "recordedAt": "2026-11-07T18:00:00Z" }
  ```

## Live tracking
- Mobile posts location reports via REST (Expo Go friendly).
- Backend persists and broadcasts `VehicleLocationResponse` to STOMP `/topic/vehicles/live`.
- Web frontend subscribes to `/ws` and updates the OpenStreetMap fleet view.
