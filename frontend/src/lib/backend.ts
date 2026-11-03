// Where the backend (uvicorn src.api:app) listens. Server-side only: the browser talks to our own
// /api routes and server components, never to the backend directly (so no CORS setup is needed).
export const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
