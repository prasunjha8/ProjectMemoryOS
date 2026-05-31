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
        # Supabase JWT secrets are base64-encoded. We attempt to base64-decode the secret first.
        # If decoding fails, we fall back to using the raw string.
        import base64
        
        decoded_secret = None
        try:
            # Handle missing padding for base64 if necessary
            padded_secret = settings.SUPABASE_JWT_SECRET
            missing_padding = len(padded_secret) % 4
            if missing_padding:
                padded_secret += "=" * (4 - missing_padding)
            decoded_secret = base64.b64decode(padded_secret)
        except Exception:
            pass

        payload = None
        last_error = None
        
        # Test both base64-decoded bytes and raw string secret
        for key in [decoded_secret, settings.SUPABASE_JWT_SECRET]:
            if not key:
                continue
            try:
                payload = jwt.decode(
                    token,
                    key,
                    algorithms=["HS256"],
                    options={"verify_aud": False}
                )
                last_error = None
                break
            except jwt.InvalidTokenError as e:
                last_error = e

        if last_error:
            raise last_error

        if not payload:
            raise jwt.InvalidTokenError("Failed to decode token with configured secrets")
        
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
