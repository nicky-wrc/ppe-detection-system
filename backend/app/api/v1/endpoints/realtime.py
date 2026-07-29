import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.database import SessionLocal
from app.core.security import decode_access_token
from app.services.websocket_manager import ws_manager

router = APIRouter()


@router.websocket("/events")
async def events_socket(websocket: WebSocket, token: str, room: str = "alerts"):
    if room not in {"alerts", "detections", "cameras"}:
        await websocket.close(code=1008)
        return
    db = SessionLocal()
    try:
        user = decode_access_token(token, db)
        if user is None:
            await websocket.close(code=1008)
            return
        client_id = uuid.uuid4().hex
        await ws_manager.connect(websocket, client_id, room=room, user_id=user.id)
        try:
            while True:
                message = await websocket.receive_text()
                if message == "ping":
                    await websocket.send_json({"type": "pong"})
        except WebSocketDisconnect:
            ws_manager.disconnect(client_id)
    finally:
        db.close()
