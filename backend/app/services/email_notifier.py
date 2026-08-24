import smtplib
from email.message import EmailMessage

from app.core.config import settings


class EmailNotifier:
    @property
    def configured(self) -> bool:
        return bool(settings.SMTP_HOST and settings.SMTP_FROM_EMAIL and settings.alert_recipients_list)

    def send_violation(self, camera_name: str, violation_type: str, event_id: int) -> bool:
        if not self.configured:
            return False

        message = EmailMessage()
        message["Subject"] = f"[PPE Detection System] {violation_type} at {camera_name}"
        message["From"] = settings.SMTP_FROM_EMAIL
        message["To"] = ", ".join(settings.alert_recipients_list)
        message.set_content(
            f"A PPE violation was confirmed.\n\n"
            f"Camera: {camera_name}\nViolation: {violation_type}\nEvent ID: {event_id}\n\n"
            "Open the PPE Detection System dashboard to review and acknowledge the evidence."
        )

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(message)
        return True

    def send_password_reset(self, recipient: str, token: str) -> bool:
        if not settings.SMTP_HOST or not settings.SMTP_FROM_EMAIL:
            return False
        message = EmailMessage()
        message["Subject"] = "PPE Detection System password reset code"
        message["From"] = settings.SMTP_FROM_EMAIL
        message["To"] = recipient
        message.set_content(
            "A password reset was requested for your PPE Detection System account.\n\n"
            f"Reset code: {token}\n\nThis code expires in 15 minutes."
        )
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(message)
        return True


email_notifier = EmailNotifier()
