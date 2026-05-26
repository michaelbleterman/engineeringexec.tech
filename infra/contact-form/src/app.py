"""Contact form Lambda handler — validates input, verifies reCAPTCHA, sends email via SES."""

import json
import logging
import os
import re
import urllib.request
import urllib.parse

logger = logging.getLogger()
logger.setLevel(logging.INFO)

import boto3

ses = boto3.client("ses", region_name="us-east-1")
ssm = boto3.client("ssm", region_name="us-east-1")

MAX_FIELD_LEN = 1000
MAX_MESSAGE_LEN = 5000
MAX_BODY_BYTES = 10_000
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

ALLOWED_ORIGINS: set[str] = set()

# Cache for SSM parameters (loaded once per cold start)
_ssm_cache: dict[str, str] = {}


def _get_ssm(name: str) -> str:
    """Read an SSM parameter, falling back to env var for local testing."""
    if name in _ssm_cache:
        return _ssm_cache[name]
    # Env vars take precedence (for sam local invoke / unit tests)
    env_val = os.environ.get(name, "")
    if env_val:
        _ssm_cache[name] = env_val
        return env_val
    # In production, read from SSM using the parameter path in SSM_PARAM_PREFIX
    param_map = {
        "RECAPTCHA_SECRET": "/engineeringexec/contact/recaptcha_secret",
        "RECIPIENT_EMAIL": "/engineeringexec/contact/recipient_email",
        "SENDER_EMAIL": "/engineeringexec/contact/sender_email",
    }
    ssm_path = param_map.get(name, "")
    if not ssm_path:
        return ""
    try:
        resp = ssm.get_parameter(Name=ssm_path, WithDecryption=True)
        val = resp["Parameter"]["Value"]
        _ssm_cache[name] = val
        return val
    except Exception:
        return ""


def _allowed_origins() -> set[str]:
    global ALLOWED_ORIGINS
    if not ALLOWED_ORIGINS:
        raw = os.environ.get("ALLOWED_ORIGINS", "")
        ALLOWED_ORIGINS = {o.strip() for o in raw.split(",") if o.strip()}
    return ALLOWED_ORIGINS


def _response_headers() -> dict[str, str]:
    """Return standard response headers. CORS is handled by Function URL config."""
    return {"Content-Type": "application/json"}


def _error(status: int, msg: str) -> dict:
    return {
        "statusCode": status,
        "headers": _response_headers(),
        "body": json.dumps({"error": msg}),
    }


def _verify_recaptcha(token: str) -> bool:
    """Verify reCAPTCHA token server-side, including v3 score check."""
    secret = _get_ssm("RECAPTCHA_SECRET")
    if not secret:
        return False
    data = urllib.parse.urlencode({"secret": secret, "response": token}).encode()
    req = urllib.request.Request(
        "https://www.google.com/recaptcha/api/siteverify",
        data=data,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            result = json.loads(resp.read())
    except Exception:
        return False

    if not result.get("success", False):
        return False

    # reCAPTCHA v3 returns a score (0.0–1.0); v2 does not include it.
    if "score" in result:
        threshold = float(os.environ.get("RECAPTCHA_SCORE_THRESHOLD", "0.5"))
        if result["score"] < threshold:
            return False

    return True


def _sanitize(value: str) -> str:
    """Strip characters that could be used for email header injection."""
    return value.replace("\r", "").replace("\n", "").strip()


def lambda_handler(event: dict, context) -> dict:
    method = event.get("requestContext", {}).get("http", {}).get("method", "")
    origin = event.get("headers", {}).get("origin")

    # --- CORS preflight is handled by Function URL config ---
    if method == "OPTIONS":
        return {"statusCode": 204, "headers": _response_headers(), "body": ""}

    if method != "POST":
        return _error(405, "Method not allowed.")

    # --- Origin check ---
    if origin and origin not in _allowed_origins():
        return _error(403, "Origin not allowed.")

    # --- Parse body ---
    raw_body = event.get("body", "")
    if event.get("isBase64Encoded"):
        import base64
        raw_body = base64.b64decode(raw_body).decode("utf-8")

    if len(raw_body) > MAX_BODY_BYTES:
        return _error(413, "Request too large.")

    try:
        body = json.loads(raw_body)
    except (json.JSONDecodeError, TypeError):
        return _error(400, "Invalid JSON.")

    # --- Honeypot ---
    if body.get("honeypot", ""):
        return _error(200, "Thank you for your message.")  # silent reject

    # --- Validate fields ---
    name = _sanitize(body.get("name") or "")
    email = _sanitize(body.get("email") or "")
    message = (body.get("message") or "").strip()
    recaptcha_token = (body.get("recaptchaToken") or "").strip()

    if not name or not email or not message:
        return _error(400, "All fields are required.")

    if len(name) > MAX_FIELD_LEN or len(email) > MAX_FIELD_LEN:
        return _error(400, "Field value too long.")

    if len(message) > MAX_MESSAGE_LEN:
        return _error(400, "Message too long.")

    if not EMAIL_RE.match(email):
        return _error(400, "Invalid email address.")

    if not recaptcha_token:
        return _error(400, "reCAPTCHA verification required.")

    # --- Verify reCAPTCHA ---
    if not _verify_recaptcha(recaptcha_token):
        return _error(400, "reCAPTCHA verification failed.")

    # --- Send email via SES ---
    sender = _get_ssm("SENDER_EMAIL")
    recipient = _get_ssm("RECIPIENT_EMAIL")

    if not sender or not recipient:
        return _error(500, "Server configuration error.")

    page = (body.get("page") or "unknown").strip()

    try:
        ses.send_email(
            Source=sender,
            Destination={"ToAddresses": [recipient]},
            ReplyToAddresses=[email],
            Message={
                "Subject": {
                    "Data": f"Contact form: {name}",
                    "Charset": "UTF-8",
                },
                "Body": {
                    "Text": {
                        "Data": (
                            f"Name: {name}\n"
                            f"Email: {email}\n"
                            f"Page: {page}\n\n"
                            f"{message}"
                        ),
                        "Charset": "UTF-8",
                    }
                },
            },
        )
    except Exception as exc:
        logger.error("SES send_email failed: %s", exc)
        return _error(500, "Failed to send message. Please try again later.")

    return {
        "statusCode": 200,
        "headers": _response_headers(),
        "body": json.dumps({"message": "Thank you for your message."}),
    }
