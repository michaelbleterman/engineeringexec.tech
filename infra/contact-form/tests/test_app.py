"""Unit tests for the contact form Lambda handler."""

import json
import os
from unittest import mock

import pytest

# Set env vars before importing app
os.environ["RECAPTCHA_SECRET"] = "test-secret"
os.environ["RECIPIENT_EMAIL"] = "recipient@example.com"
os.environ["SENDER_EMAIL"] = "EngineeringExec Contact <contact@engineeringexec.tech>"
os.environ["ALLOWED_ORIGINS"] = "https://engineeringexec.tech,http://localhost:4321"

from app import lambda_handler, ALLOWED_ORIGINS, _sanitize  # noqa: E402

# Reset cached origins so env var is picked up
ALLOWED_ORIGINS.clear()


def _event(
    method="POST",
    body=None,
    origin="https://engineeringexec.tech",
    base64=False,
):
    """Build a minimal Lambda Function URL event."""
    ev = {
        "requestContext": {"http": {"method": method}},
        "headers": {},
    }
    if origin:
        ev["headers"]["origin"] = origin
    if body is not None:
        if isinstance(body, dict):
            ev["body"] = json.dumps(body)
        else:
            ev["body"] = body
    else:
        ev["body"] = ""
    ev["isBase64Encoded"] = base64
    return ev


def _valid_body(**overrides):
    data = {
        "name": "Test User",
        "email": "test@example.com",
        "message": "Hello world",
        "recaptchaToken": "valid-token",
        "honeypot": "",
    }
    data.update(overrides)
    return data


@mock.patch("app.ses")
@mock.patch("app._verify_recaptcha", return_value=True)
class TestValidSubmission:
    def test_returns_200(self, mock_recaptcha, mock_ses):
        resp = lambda_handler(_event(body=_valid_body()), None)
        assert resp["statusCode"] == 200
        assert "Thank you" in json.loads(resp["body"])["message"]

    def test_sends_email(self, mock_recaptcha, mock_ses):
        lambda_handler(_event(body=_valid_body()), None)
        mock_ses.send_email.assert_called_once()
        call_kwargs = mock_ses.send_email.call_args[1]
        assert call_kwargs["Destination"]["ToAddresses"] == ["recipient@example.com"]
        assert call_kwargs["ReplyToAddresses"] == ["test@example.com"]

    def test_content_type_header(self, mock_recaptcha, mock_ses):
        resp = lambda_handler(_event(body=_valid_body()), None)
        assert resp["headers"]["Content-Type"] == "application/json"


class TestCORSPreflight:
    def test_options_returns_204(self):
        resp = lambda_handler(_event(method="OPTIONS"), None)
        assert resp["statusCode"] == 204


class TestDisallowedOrigin:
    def test_rejects_unknown_origin(self):
        resp = lambda_handler(
            _event(body=_valid_body(), origin="https://evil.com"), None
        )
        assert resp["statusCode"] == 403


class TestMethodValidation:
    def test_get_rejected(self):
        resp = lambda_handler(_event(method="GET"), None)
        assert resp["statusCode"] == 405

    def test_put_rejected(self):
        resp = lambda_handler(_event(method="PUT"), None)
        assert resp["statusCode"] == 405


class TestMissingFields:
    @mock.patch("app._verify_recaptcha", return_value=True)
    def test_missing_name(self, _):
        resp = lambda_handler(_event(body=_valid_body(name="")), None)
        assert resp["statusCode"] == 400
        assert "required" in json.loads(resp["body"])["error"].lower()

    @mock.patch("app._verify_recaptcha", return_value=True)
    def test_missing_email(self, _):
        resp = lambda_handler(_event(body=_valid_body(email="")), None)
        assert resp["statusCode"] == 400

    @mock.patch("app._verify_recaptcha", return_value=True)
    def test_missing_message(self, _):
        resp = lambda_handler(_event(body=_valid_body(message="")), None)
        assert resp["statusCode"] == 400


class TestInvalidEmail:
    @mock.patch("app._verify_recaptcha", return_value=True)
    def test_bad_email_format(self, _):
        resp = lambda_handler(_event(body=_valid_body(email="notanemail")), None)
        assert resp["statusCode"] == 400
        assert "email" in json.loads(resp["body"])["error"].lower()


class TestOversizedMessage:
    @mock.patch("app._verify_recaptcha", return_value=True)
    def test_message_too_long(self, _):
        resp = lambda_handler(
            _event(body=_valid_body(message="x" * 5001)), None
        )
        assert resp["statusCode"] == 400

    def test_body_too_large(self):
        resp = lambda_handler(_event(body="x" * 10001), None)
        assert resp["statusCode"] == 413


class TestHoneypot:
    @mock.patch("app.ses")
    def test_filled_honeypot_silent_reject(self, mock_ses):
        resp = lambda_handler(
            _event(body=_valid_body(honeypot="bot-value")), None
        )
        # Returns 200 to not alert bots, but doesn't send email
        assert resp["statusCode"] == 200
        mock_ses.send_email.assert_not_called()


class TestRecaptcha:
    def test_missing_token(self):
        resp = lambda_handler(
            _event(body=_valid_body(recaptchaToken="")), None
        )
        assert resp["statusCode"] == 400
        assert "recaptcha" in json.loads(resp["body"])["error"].lower()

    @mock.patch("app._verify_recaptcha", return_value=False)
    def test_failed_verification(self, _):
        resp = lambda_handler(_event(body=_valid_body()), None)
        assert resp["statusCode"] == 400
        assert "recaptcha" in json.loads(resp["body"])["error"].lower()


class TestSESFailure:
    @mock.patch("app._verify_recaptcha", return_value=True)
    @mock.patch("app.ses")
    def test_ses_error_returns_500(self, mock_ses, _):
        mock_ses.send_email.side_effect = Exception("SES error")
        resp = lambda_handler(_event(body=_valid_body()), None)
        assert resp["statusCode"] == 500
        assert "try again" in json.loads(resp["body"])["error"].lower()


class TestRecaptchaScore:
    """Test reCAPTCHA v3 score threshold enforcement."""

    @mock.patch("app.ses")
    @mock.patch("app.urllib.request.urlopen")
    def test_low_score_rejected(self, mock_urlopen, mock_ses):
        os.environ["RECAPTCHA_SCORE_THRESHOLD"] = "0.5"
        mock_resp = mock.MagicMock()
        mock_resp.read.return_value = json.dumps(
            {"success": True, "score": 0.2}
        ).encode()
        mock_resp.__enter__ = mock.Mock(return_value=mock_resp)
        mock_resp.__exit__ = mock.Mock(return_value=False)
        mock_urlopen.return_value = mock_resp

        resp = lambda_handler(_event(body=_valid_body()), None)
        assert resp["statusCode"] == 400
        assert "recaptcha" in json.loads(resp["body"])["error"].lower()
        mock_ses.send_email.assert_not_called()

    @mock.patch("app.ses")
    @mock.patch("app.urllib.request.urlopen")
    def test_high_score_accepted(self, mock_urlopen, mock_ses):
        os.environ["RECAPTCHA_SCORE_THRESHOLD"] = "0.5"
        mock_resp = mock.MagicMock()
        mock_resp.read.return_value = json.dumps(
            {"success": True, "score": 0.9}
        ).encode()
        mock_resp.__enter__ = mock.Mock(return_value=mock_resp)
        mock_resp.__exit__ = mock.Mock(return_value=False)
        mock_urlopen.return_value = mock_resp

        resp = lambda_handler(_event(body=_valid_body()), None)
        assert resp["statusCode"] == 200

    @mock.patch("app.ses")
    @mock.patch("app.urllib.request.urlopen")
    def test_v2_no_score_still_works(self, mock_urlopen, mock_ses):
        """reCAPTCHA v2 responses don't include score — should pass."""
        mock_resp = mock.MagicMock()
        mock_resp.read.return_value = json.dumps({"success": True}).encode()
        mock_resp.__enter__ = mock.Mock(return_value=mock_resp)
        mock_resp.__exit__ = mock.Mock(return_value=False)
        mock_urlopen.return_value = mock_resp

        resp = lambda_handler(_event(body=_valid_body()), None)
        assert resp["statusCode"] == 200


class TestSanitize:
    """Test input sanitization against header injection."""

    def test_strips_newlines(self):
        assert _sanitize("test\r\ninjection") == "testinjection"

    def test_strips_carriage_return(self):
        assert _sanitize("test\rinjection") == "testinjection"

    def test_strips_newline(self):
        assert _sanitize("test\ninjection") == "testinjection"

    def test_strips_whitespace(self):
        assert _sanitize("  hello  ") == "hello"

    def test_normal_input_unchanged(self):
        assert _sanitize("John Doe") == "John Doe"

    @mock.patch("app.ses")
    @mock.patch("app._verify_recaptcha", return_value=True)
    def test_injection_in_name_sanitized(self, _, mock_ses):
        resp = lambda_handler(
            _event(body=_valid_body(name="Evil\r\nBcc: spam@evil.com")), None
        )
        assert resp["statusCode"] == 200
        call_kwargs = mock_ses.send_email.call_args[1]
        subject = call_kwargs["Message"]["Subject"]["Data"]
        assert "\n" not in subject
        assert "\r" not in subject

    @mock.patch("app.ses")
    @mock.patch("app._verify_recaptcha", return_value=True)
    def test_injection_in_email_sanitized(self, _, mock_ses):
        resp = lambda_handler(
            _event(body=_valid_body(email="user@example.com\r\nBcc: spam@evil.com")), None
        )
        # After sanitization the email becomes invalid and should be rejected
        assert resp["statusCode"] == 400
