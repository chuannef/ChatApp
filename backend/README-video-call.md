# Video calling (Stream)

Video calls use Stream Video SDK.

## Requirements
- Backend must be running and able to generate a Stream token at `GET /api/chat/token`.
- Frontend must have `VITE_STREAM_API_KEY` configured.

## Local setup
1. Create `backend/.env` from `backend/.env.example` and fill:
   - `JWT_SECRET_KEY`
   - `STREAM_API_KEY`
   - `STREAM_API_SECRET`

2. Create `frontend/.env` from `frontend/.env.example` and fill:
   - `VITE_STREAM_API_KEY` (same as backend `STREAM_API_KEY`)

3. Start servers:
   - Backend: `cd backend; npm run dev`
   - Frontend: `cd frontend; npm run dev`

## Common issues
- If Call page shows `Stream token generation failed`: backend is missing `STREAM_API_KEY/STREAM_API_SECRET`.
- If Call page shows `Missing Stream API key (VITE_STREAM_API_KEY)`: frontend env var is missing.
- If backend fails with `EADDRINUSE :5001`: another process is already using port 5001.
