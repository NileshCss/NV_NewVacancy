'use strict';

/**
 * email.service.js
 * Sends daily/weekly digest emails using Nodemailer + Gmail SMTP (free).
 *
 * Config (.env):
 *   SMTP_HOST  = smtp.gmail.com
 *   SMTP_PORT  = 587
 *   SMTP_USER  = your_email@gmail.com
 *   SMTP_PASS  = your_app_password (Gmail App Password, not account password)
 *   EMAIL_FROM = NewVacancy <noreply@newvacancy.live>
 *
 * NOTE: For Gmail, enable 2FA and create an App Password at:
 *   https://myaccount.google.com/apppasswords
 */

const nodemailer = require('nodemailer');

const SITE_URL = process.env.SITE_URL || 'https://www.newvacancy.live';

// Lazy-initialize transporter
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[Email] SMTP not configured — emails disabled (set SMTP_USER and SMTP_PASS)');
    return null;
  }

  _transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return _transporter;
}

/**
 * Generate HTML for the daily digest email.
 */
function buildDigestHtml(jobs, type = 'daily') {
  const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const title   = type === 'weekly' ? '📊 Weekly Job Digest' : '📢 Daily Job Digest';

  const jobRows = jobs.slice(0, 15).map(job => {
    const jobUrl = job.slug ? `${SITE_URL}/jobs/${job.slug}` : (job.apply_url || SITE_URL);
    return `
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:12px 8px">
          <a href="${jobUrl}" style="color:#6366f1;font-weight:bold;text-decoration:none">${job.title || ''}</a><br>
          <span style="color:#6b7280;font-size:13px">${job.organization || ''} · ${job.location || ''}</span>
        </td>
        <td style="padding:12px 8px;color:#374151;font-size:13px">${job.salary_range || 'Not disclosed'}</td>
        <td style="padding:12px 8px">
          <a href="${jobUrl}" style="background:#6366f1;color:#fff;padding:6px 14px;border-radius:6px;text-decoration:none;font-size:13px">Apply</a>
        </td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:20px">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:24px">${title}</h1>
      <p style="color:rgba(255,255,255,.85);margin:8px 0 0">${dateStr} · ${jobs.length} New Jobs</p>
    </div>
    <div style="padding:24px">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#f3f4f6">
            <th style="padding:10px 8px;text-align:left;color:#374151;font-size:13px">Role</th>
            <th style="padding:10px 8px;text-align:left;color:#374151;font-size:13px">Salary</th>
            <th style="padding:10px 8px;text-align:left;color:#374151;font-size:13px"></th>
          </tr>
        </thead>
        <tbody>${jobRows}</tbody>
      </table>
      ${jobs.length > 15 ? `<p style="text-align:center;color:#6b7280;margin-top:16px">...and ${jobs.length - 15} more jobs!</p>` : ''}
      <div style="text-align:center;margin-top:24px">
        <a href="${SITE_URL}" style="background:#6366f1;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:bold">View All Jobs →</a>
      </div>
    </div>
    <div style="background:#f3f4f6;padding:16px;text-align:center;color:#9ca3af;font-size:12px">
      <a href="${SITE_URL}" style="color:#6366f1;text-decoration:none">NewVacancy.live</a> — India's AI-powered fresher job portal<br>
      You received this because you subscribed to job alerts.
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send a digest email to one or more recipients.
 * @param {string[]} recipients  - Array of email addresses
 * @param {object[]} jobs        - Job records
 * @param {'daily'|'weekly'} [type]
 * @returns {Promise<boolean>}
 */
async function sendDigestEmail(recipients, jobs, type = 'daily') {
  const transporter = getTransporter();
  if (!transporter || !recipients?.length) return false;

  const subject = type === 'weekly'
    ? `📊 Weekly Digest: ${jobs.length} New Jobs This Week | NewVacancy`
    : `📢 ${jobs.length} New Jobs Today | NewVacancy Daily Digest`;

  try {
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM || `NewVacancy <${process.env.SMTP_USER}>`,
      to:      recipients.join(', '),
      subject,
      html:    buildDigestHtml(jobs, type),
    });

    console.log(`[Email] ${type} digest sent to ${recipients.length} recipients`);
    return true;

  } catch (err) {
    console.error('[Email] Send failed:', err.message);
    return false;
  }
}

module.exports = { sendDigestEmail, buildDigestHtml };
