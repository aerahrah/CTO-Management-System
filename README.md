# Employee Management System

Full-stack Employee Management System with a React + Vite frontend and an Express + MongoDB backend.

## Deployment-ready setup

## 1) Configure environment variables

### Server (`server/.env`)
Copy `server/.env.example` to `server/.env` and provide production values:

- `MONGO_URI`
- `PORT`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `EMAIL_USER`
- `EMAIL_PASS`
- `CORS_ORIGINS` (comma-separated frontend origins)

### Client (`client/.env`)
Copy `client/.env.example` to `client/.env`:

- `VITE_API_BASE_URL` (public backend base URL)

## 2) Install dependencies

```bash
cd server && npm ci
cd ../client && npm ci
```

## 3) Build frontend

```bash
cd client
npm run build
```

## 4) Run backend

```bash
cd server
npm start
```

## Notes

- Frontend API and memo file links are resolved from `VITE_API_BASE_URL`.
- Backend CORS is controlled by `CORS_ORIGINS`, supporting multiple origins.
