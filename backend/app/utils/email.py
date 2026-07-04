import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from html import escape

from app.core.config import settings

logger = logging.getLogger(__name__)


def _build_html(title: str, message: str, link: str | None = None) -> str:
    app_name = escape(settings.APP_NAME)
    safe_title = escape(title)
    safe_message = escape(message)
    link_url = f"{settings.FRONTEND_URL.rstrip('/')}{link}" if link else settings.FRONTEND_URL
    link_html = (
        f'<a href="{link_url}" style="display:inline-block;margin-top:16px;padding:10px 18px;'
        f'background:#1a1a2e;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;">'
        f'Open in {app_name}</a>'
        if link
        else ""
    )
    return f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; margin: 0; padding: 24px; background: #f4f5f7;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #e5e7eb;">
            <div style="padding: 20px 24px; background: #111827; color: #ffffff;">
                <p style="margin: 0; font-size: 12px; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.08em;">{app_name}</p>
                <h1 style="margin: 8px 0 0; font-size: 20px; font-weight: 600; line-height: 1.3;">{safe_title}</h1>
            </div>
            <div style="padding: 24px;">
                <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">{safe_message}</p>
                {link_html}
            </div>
            <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; background: #f9fafb;">
                <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                    You received this because email notifications are enabled on your account.
                    Manage preferences in Settings.
                </p>
            </div>
        </div>
    </body>
    </html>
    """


def send_email_sync(to: str, subject: str, html_body: str) -> bool:
    if not settings.EMAIL_ENABLED or not settings.SMTP_USER:
        logger.info("Email disabled. Would send to %s: %s", to, subject)
        return False

    try:
        message = MIMEMultipart("alternative")
        message["From"] = settings.SMTP_FROM
        message["To"] = to
        message["Subject"] = subject
        message.attach(MIMEText(html_body, "html"))

        if settings.SMTP_TLS:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30) as server:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM, [to], message.as_string())
        else:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30) as server:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.SMTP_FROM, [to], message.as_string())
        return True
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to, exc)
        return False


def send_notification_email(to: str, title: str, message: str, link: str | None = None) -> bool:
    html = _build_html(title, message, link)
    return send_email_sync(to, title, html)
