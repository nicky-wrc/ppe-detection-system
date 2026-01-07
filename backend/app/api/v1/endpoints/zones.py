from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models import User, Zone
from app.schemas import ZoneResponse, ZoneCreate, ZoneUpdate

router = APIRouter()


@router.get("/", response_model=List[ZoneResponse])
async def get_zones(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    zones = db.query(Zone).filter(Zone.is_active == True).all()
    return zones


@router.post("/", response_model=ZoneResponse)
async def create_zone(
    zone_data: ZoneCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    zone = Zone(**zone_data.model_dump())
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone


@router.get("/{zone_id}", response_model=ZoneResponse)
async def get_zone(
    zone_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if zone is None:
        raise HTTPException(status_code=404, detail="ไม่พบโซน")
    return zone


@router.put("/{zone_id}", response_model=ZoneResponse)
async def update_zone(
    zone_id: int,
    zone_data: ZoneUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if zone is None:
        raise HTTPException(status_code=404, detail="ไม่พบโซน")
    
    update_data = zone_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(zone, field, value)
    
    db.commit()
    db.refresh(zone)
    return zone


@router.delete("/{zone_id}")
async def delete_zone(
    zone_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if zone is None:
        raise HTTPException(status_code=404, detail="ไม่พบโซน")
    
    zone.is_active = False
    db.commit()
    return {"message": "ลบโซนเรียบร้อย"}