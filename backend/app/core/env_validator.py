import os
import sys
import logging
from urllib.parse import urlparse

logger = logging.getLogger("app.diagnostics")

def validate_environment() -> None:
    """
    Validates that the production environment is properly configured.
    Checks for placeholders, missing secrets, and structural correctness.
    Fails hard with SystemExit if configuration is critically broken.
    """
    is_production = os.getenv("ENVIRONMENT", "development").lower() == "production"
    
    # 1. Critical variables list
    critical_vars = {
        "DATABASE_URL": "Connection string for your Supabase PostgreSQL instance",
        "SUPABASE_URL": "Your Supabase project URL",
        "SUPABASE_JWT_SECRET": "Your Supabase API JWT Settings secret key",
    }
    
    missing_vars = []
    placeholders = []
    
    for var, desc in critical_vars.items():
        val = os.getenv(var)
        if not val:
            missing_vars.append((var, desc))
        elif val in ["placeholder_secret", "https://example.supabase.co", "your-supabase-jwt-secret"]:
            placeholders.append(var)
            
    # 2. Check Database URL format
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        try:
            # Clean up the protocol for standard urlparse compatibility
            parsed = urlparse(db_url.replace("postgresql+asyncpg://", "http://").replace("postgresql://", "http://"))
            if is_production and ("localhost" in parsed.netloc or "127.0.0.1" in parsed.netloc):
                logger.error("PRODUCTION CRITICAL: DATABASE_URL is pointing to localhost.")
                sys.exit(1)
        except Exception as e:
            logger.error(f"PRODUCTION CRITICAL: DATABASE_URL is malformed: {str(e)}")
            sys.exit(1)

    # 3. Report failures
    if missing_vars or placeholders:
        print("\n" + "="*80)
        print("!!! ENVIRONMENT CONFIGURATION ERROR !!!")
        print("="*80)
        
        if missing_vars:
            print("\nThe following critical environment variables are missing:")
            for var, desc in missing_vars:
                print(f"  - {var}: {desc}")
                
        if placeholders:
            print("\nThe following environment variables are still using default placeholders:")
            for var in placeholders:
                print(f"  - {var}")
                
        print("\nPlease configure these variables in your deployment settings (Railway/Render/etc.)")
        print("="*80 + "\n")
        
        # SystemExit if in production, warning in development
        if is_production:
            logger.critical("Failed environment validation. Shutting down service.")
            sys.exit(1)
        else:
            logger.warning("Development environment validation check failed (continuing in mock/fallback mode).")
            
    # 4. Warn if OpenRouter key is missing (optional but highly recommended feature)
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    if not openrouter_key:
        logger.warning(
            "OPENROUTER_API_KEY is not configured. "
            "All LLM operations (summaries, task extraction, relationship detection) will fall back to local mock responses."
        )
    else:
        logger.info("Environment validated successfully. All systems ready.")
