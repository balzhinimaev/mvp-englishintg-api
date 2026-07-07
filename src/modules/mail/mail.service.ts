import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Отправка транзакционных писем через SMTP (Яндекс, no-reply@englishintg.ru).
 * Если SMTP не сконфигурирован (dev без .env) — сервис деградирует в no-op с warn-логом,
 * чтобы регистрация не падала из-за почты.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter?: nodemailer.Transporter;
  private readonly from: string;
  private readonly webappUrl: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('app.mail.host');
    const user = config.get<string>('app.mail.user');
    const pass = config.get<string>('app.mail.pass');
    this.from = config.get<string>('app.mail.from') || user || '';
    this.webappUrl = config.get<string>('app.mail.webappUrl') || 'https://englishintg.ru/webapp/';

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: config.get<number>('app.mail.port') ?? 465,
        secure: config.get<boolean>('app.mail.secure') ?? true,
        auth: { user, pass },
      });
    } else {
      this.logger.warn('SMTP не сконфигурирован (SMTP_HOST/SMTP_USER/SMTP_PASS) — письма отправляться не будут');
    }
  }

  get isEnabled(): boolean {
    return Boolean(this.transporter);
  }

  private async send(to: string, subject: string, html: string): Promise<boolean> {
    if (!this.transporter) return false;
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
      return true;
    } catch (e: any) {
      // Письмо не должно ронять основной флоу; email в лог не пишем целиком (PII)
      this.logger.error(`Mail send failed (${subject}): ${e?.message}`);
      return false;
    }
  }

  /** Общий каркас письма: минимальный inline-HTML в палитре продукта. */
  private layout(title: string, bodyHtml: string, ctaText: string, ctaUrl: string): string {
    return `<!doctype html><html lang="ru"><body style="margin:0;padding:0;background:#F3F5F4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F5F4;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#FFFFFF;border:1px solid #DFE4E2;border-radius:14px;padding:32px 28px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1C2321;">
<tr><td style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#C7431D;font-weight:700;padding-bottom:14px;">Инглиш в ТГ</td></tr>
<tr><td style="font-size:22px;font-weight:700;padding-bottom:12px;">${title}</td></tr>
<tr><td style="font-size:15px;line-height:1.6;color:#46514D;padding-bottom:24px;">${bodyHtml}</td></tr>
<tr><td align="center" style="padding-bottom:24px;">
<a href="${ctaUrl}" style="display:inline-block;background:#C7431D;color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:12px;">${ctaText}</a>
</td></tr>
<tr><td style="font-size:12.5px;line-height:1.5;color:#5C6864;border-top:1px solid #DFE4E2;padding-top:16px;">
Если кнопка не работает, скопируйте ссылку в браузер:<br>
<a href="${ctaUrl}" style="color:#C7431D;word-break:break-all;">${ctaUrl}</a><br><br>
Если вы не запрашивали это письмо — просто проигнорируйте его.
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
  }

  async sendEmailVerification(to: string, token: string): Promise<boolean> {
    const url = `${this.webappUrl}?verifyEmail=${encodeURIComponent(token)}`;
    return this.send(
      to,
      'Подтвердите email — Инглиш в ТГ',
      this.layout(
        'Подтвердите ваш email',
        'Вы зарегистрировались в приложении «Инглиш в ТГ». Нажмите кнопку, чтобы подтвердить адрес почты. Ссылка действует 24 часа.',
        'Подтвердить email',
        url,
      ),
    );
  }

  async sendPasswordReset(to: string, token: string): Promise<boolean> {
    const url = `${this.webappUrl}?resetPassword=${encodeURIComponent(token)}`;
    return this.send(
      to,
      'Сброс пароля — Инглиш в ТГ',
      this.layout(
        'Сброс пароля',
        'Мы получили запрос на смену пароля для вашего аккаунта. Нажмите кнопку и задайте новый пароль. Ссылка действует 1 час.',
        'Задать новый пароль',
        url,
      ),
    );
  }
}
