// Webhook client with retry logic and error handling

export interface WebhookPayload {
  alert: string;
  alertId?: string;
  timestamp: string;
  marketId?: string;
  conditions?: any;
  message?: string;
}

export interface WebhookResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  attempt?: number;
  retries?: number;
}

export interface WebhookOptions {
  maxRetries?: number;
  retryDelay?: number; // milliseconds
  timeout?: number; // milliseconds
}

const DEFAULT_OPTIONS: Required<WebhookOptions> = {
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  timeout: 10000, // 10 seconds
};

/**
 * Send webhook with retry logic and error handling
 */
export async function sendWebhook(
  url: string,
  payload: WebhookPayload,
  options: WebhookOptions = {}
): Promise<WebhookResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;
  let lastStatusCode: number | undefined;

  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), opts.timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Alithos Terminal/1.0',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      lastStatusCode = response.status;

      if (response.ok) {
        return {
          success: true,
          statusCode: response.status,
          attempt,
          retries: attempt - 1,
        };
      }

      // If status is 4xx (client error), don't retry
      if (response.status >= 400 && response.status < 500) {
        const errorText = await response.text().catch(() => 'Unknown error');
        return {
          success: false,
          statusCode: response.status,
          error: `Client error: ${response.status} ${errorText}`,
          attempt,
          retries: attempt - 1,
        };
      }

      // For 5xx errors or other errors, we'll retry
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        lastError = new Error('Request timeout');
      } else {
        lastError = error instanceof Error ? error : new Error('Unknown error');
      }
    }

    // If this isn't the last attempt, wait before retrying
    if (attempt < opts.maxRetries) {
      // Exponential backoff: delay increases with each retry
      const delay = opts.retryDelay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return {
    success: false,
    statusCode: lastStatusCode,
    error: lastError?.message || 'Unknown error',
    attempt: opts.maxRetries,
    retries: opts.maxRetries - 1,
  };
}

/**
 * Test webhook URL to verify it's accessible
 */
export async function testWebhook(url: string): Promise<{
  success: boolean;
  statusCode?: number;
  error?: string;
  responseTime?: number;
}> {
  const startTime = Date.now();
  
  try {
    const testPayload: WebhookPayload = {
      alert: 'Test Alert',
      timestamp: new Date().toISOString(),
      message: 'This is a test webhook from Alithos Terminal',
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Alithos Terminal/1.0',
      },
      body: JSON.stringify(testPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (response.ok) {
      return {
        success: true,
        statusCode: response.status,
        responseTime,
      };
    }

    const errorText = await response.text().catch(() => 'Unknown error');
    return {
      success: false,
      statusCode: response.status,
      error: `HTTP ${response.status}: ${errorText}`,
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: 'Request timeout (10s)',
        responseTime,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime,
    };
  }
}

