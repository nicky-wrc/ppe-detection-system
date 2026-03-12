"""
WebSocket Manager for Real-time Communication
- Handles multiple client connections
- Broadcasts detection events and alerts
"""

from typing import Dict, Set, Any
from fastapi import WebSocket
import json
import asyncio


class WebSocketManager:
    """Manages WebSocket connections for real-time updates"""
    
    def __init__(self):
        # Store active connections: {client_id: WebSocket}
        self.active_connections: Dict[str, WebSocket] = {}
        
        # Store connections by room/channel
        self.rooms: Dict[str, Set[str]] = {
            "alerts": set(),      # Alert notifications
            "detections": set(),  # Detection events
            "cameras": set(),     # Camera streams
        }
    
    async def connect(self, websocket: WebSocket, client_id: str, room: str = "detections"):
        """Accept and store new connection"""
        await websocket.accept()
        self.active_connections[client_id] = websocket
        
        if room in self.rooms:
            self.rooms[room].add(client_id)
        
        print(f"✅ Client {client_id} connected to {room}")
    
    def disconnect(self, client_id: str):
        """Remove connection"""
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        
        # Remove from all rooms
        for room in self.rooms.values():
            room.discard(client_id)
        
        print(f"❌ Client {client_id} disconnected")
    
    async def send_personal(self, client_id: str, message: Dict[str, Any]):
        """Send message to specific client"""
        if client_id in self.active_connections:
            websocket = self.active_connections[client_id]
            try:
                await websocket.send_json(message)
            except Exception as e:
                print(f"Error sending to {client_id}: {e}")
                self.disconnect(client_id)
    
    async def broadcast(self, message: Dict[str, Any], room: str = None):
        """Broadcast message to all clients or specific room"""
        if room and room in self.rooms:
            client_ids = self.rooms[room]
        else:
            client_ids = self.active_connections.keys()
        
        disconnected = []
        for client_id in client_ids:
            if client_id in self.active_connections:
                try:
                    await self.active_connections[client_id].send_json(message)
                except Exception:
                    disconnected.append(client_id)
        
        # Clean up disconnected clients
        for client_id in disconnected:
            self.disconnect(client_id)
    
    async def broadcast_alert(self, alert_data: Dict[str, Any]):
        """Broadcast alert to all subscribed clients"""
        message = {
            "type": "alert",
            "data": alert_data
        }
        await self.broadcast(message, room="alerts")
    
    async def broadcast_detection(self, detection_data: Dict[str, Any]):
        """Broadcast detection result to all subscribed clients"""
        message = {
            "type": "detection",
            "data": detection_data
        }
        await self.broadcast(message, room="detections")
    
    def get_connection_count(self) -> int:
        """Get total active connections"""
        return len(self.active_connections)
    
    def get_room_count(self, room: str) -> int:
        """Get connections in specific room"""
        return len(self.rooms.get(room, set()))


# Global instance
ws_manager = WebSocketManager()
