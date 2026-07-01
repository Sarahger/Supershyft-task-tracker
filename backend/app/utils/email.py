import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_email(to: str, subject: str, html_body: str) -> bool:
    if not settings.EMAIL_ENABLED or not settings.SMTP_USER:
        logger.info(f"Email disabled. Would send to {to}: {subject}")
        return False

    try:
        import aiosmtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText

        message = MIMEMultipart("alternative")
        message["From"] = settings.SMTP_FROM
        message["To"] = to
        message["Subject"] = subject
        message.attach(MIMEText(html_body, "html"))

        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=settings.SMTP_TLS,
        )
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {e}")
        return False


def send_notification_email(to: str, title: str, message: str, link: str | None = None) -> None:
    import asyncio

    link_html = f'<p><a href="{settings.FRONTEND_URL}{link}">View in app</a></p>' if link else ""
    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
            <h2 style="color: #1a1a2e; margin-top: 0;">{title}</h2>
            <p style="color: #4a5568;">{message}</p>
            {link_html}
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="color: #a0aec0; font-size: 12px;">Internal Work Management System</p>
        </div>
    </body>
    </html>
    """
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(send_email(to, title, html))
        else:
            loop.run_until_complete(send_email(to, title, html))
    except RuntimeError:
        asyncio.run(send_email(to, title, html))
