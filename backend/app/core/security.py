import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.core.database import get_db

reusable_oauth2 = HTTPBearer(auto_error=False)


class UserTokenPayload(BaseModel):
    sub: str  # User UUID in Supabase auth.users / public.profiles
    email: str
    role: str


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(reusable_oauth2)
) -> str:
    """
    Decodes and validates the Supabase Auth JWT token.
    Returns the user's UUID (sub claim).
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    try:
        # Supabase JWTs are signed with the HS256 algorithm using the JWT Secret
        # Note: 'aud' (audience) in Supabase is usually set to 'authenticated'
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False}  # Can enable custom aud checking if needed
        )
        
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token payload is missing 'sub' claim",
            )
        return user_id
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
        )
