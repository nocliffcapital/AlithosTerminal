// Email notification client
// Note: This requires an email service (SendGrid, Resend, AWS SES, etc.)

export interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

export interface EmailResult {
  success: boolean;
  error?: string;
}

/**
 * Send email notification
 * TODO: Integrate with email service (SendGrid, Resend, AWS SES, etc.)
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  try {
    // For now, send via API route which will handle the email service integration
    const response = await fetch('/api/notifications/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      return {
        success: false,
        error: error.error || `HTTP ${response.status}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

