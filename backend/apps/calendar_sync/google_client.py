"""
Thin Google OAuth 2.0 + Calendar v3 REST client.

Uses only the standard library so the integration adds no dependencies. Every
network failure surfaces as GoogleCalendarError so callers have one thing to
catch.
"""

import base64
import json
from datetime import timedelta
from urllib import error, parse, request

from django.conf import settings
from django.utils import timezone

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
REVOKE_URL = "https://oauth2.googleapis.com/revoke"
CALENDAR_API = "https://www.googleapis.com/calendar/v3"
SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.events"]
TIMEOUT_SECONDS = 10


class GoogleCalendarError(Exception):
    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status


def is_configured():
    return bool(settings.GOOGLE_OAUTH_CLIENT_ID and settings.GOOGLE_OAUTH_CLIENT_SECRET)


def _http(method, url, *, data=None, json_body=None, headers=None):
    headers = dict(headers or {})
    body = None
    if json_body is not None:
        body = json.dumps(json_body).encode()
        headers["Content-Type"] = "application/json"
    elif data is not None:
        body = parse.urlencode(data).encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    req = request.Request(url, data=body, method=method, headers=headers)
    try:
        with request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
            raw = resp.read()
    except error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:500]
        raise GoogleCalendarError(f"Google API {exc.code}: {detail}", status=exc.code) from exc
    except (error.URLError, TimeoutError, OSError) as exc:
        raise GoogleCalendarError(f"Could not reach Google: {exc}") from exc
    return json.loads(raw) if raw else None


def authorization_url(state):
    query = parse.urlencode({
        "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        # offline + consent guarantees a refresh token even on re-connect.
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": state,
    })
    return f"{AUTH_URL}?{query}"


def exchange_code(code):
    """Trade an authorization code for tokens. Returns the raw token response."""
    return _http("POST", TOKEN_URL, data={
        "code": code,
        "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
        "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
        "redirect_uri": settings.GOOGLE_OAUTH_REDIRECT_URI,
        "grant_type": "authorization_code",
    })


def email_from_id_token(id_token):
    """
    Read the email claim from the id_token. The token came straight from
    Google's token endpoint over TLS, so the signature isn't re-verified.
    """
    try:
        payload = id_token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        return json.loads(base64.urlsafe_b64decode(payload)).get("email", "")
    except (IndexError, ValueError, AttributeError):
        return ""


def revoke(token):
    try:
        _http("POST", REVOKE_URL, data={"token": token})
    except GoogleCalendarError:
        pass  # Already revoked/expired — disconnecting locally is what matters.


class CalendarClient:
    """Calendar API calls on behalf of a GoogleCalendarConnection."""

    def __init__(self, connection):
        self.connection = connection

    def _access_token(self):
        conn = self.connection
        expires_at = conn.access_token_expires_at
        if conn.access_token and expires_at and expires_at - timedelta(seconds=60) > timezone.now():
            return conn.access_token
        tokens = _http("POST", TOKEN_URL, data={
            "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
            "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
            "refresh_token": conn.refresh_token,
            "grant_type": "refresh_token",
        })
        conn.access_token = tokens["access_token"]
        conn.access_token_expires_at = timezone.now() + timedelta(seconds=tokens.get("expires_in", 3600))
        conn.save(update_fields=["access_token", "access_token_expires_at"])
        return conn.access_token

    def _call(self, method, path, json_body=None):
        calendar = parse.quote(self.connection.calendar_id, safe="")
        return _http(
            method,
            f"{CALENDAR_API}/calendars/{calendar}/events{path}",
            json_body=json_body,
            headers={"Authorization": f"Bearer {self._access_token()}"},
        )

    def insert_event(self, body):
        return self._call("POST", "", body)

    def update_event(self, event_id, body):
        return self._call("PUT", f"/{parse.quote(event_id, safe='')}", body)

    def delete_event(self, event_id):
        try:
            self._call("DELETE", f"/{parse.quote(event_id, safe='')}")
        except GoogleCalendarError as exc:
            if exc.status not in (404, 410):  # Already gone is success.
                raise
