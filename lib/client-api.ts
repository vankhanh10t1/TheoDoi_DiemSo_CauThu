type FetchDebugMeta = {
  caller: string;
  includeRequestBody?: boolean;
};

type FetchDebugDetails = {
  env: string | null;
  url: string | null;
  pathname: string | null;
  caller: string;
  requestUrl: string;
  method: string;
  status?: number;
  statusText?: string;
  responseText?: string;
  requestBody?: unknown;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
};

const REDACTED_BODY_KEYS = /password|token|secret|authorization|cookie|credential|key/i;

function getClientDebugContext() {
  if (typeof window === 'undefined') {
    return {
      env: process.env.NODE_ENV ?? null,
      url: null,
      pathname: null
    };
  }

  return {
    env: process.env.NODE_ENV ?? null,
    url: window.location.href,
    pathname: window.location.pathname
  };
}

export async function fetchWithDebug(input: RequestInfo | URL, init: RequestInit | undefined, meta: FetchDebugMeta) {
  const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const method = init?.method ?? 'GET';

  function getRequestBodyForDebug(): unknown {
    if (!meta.includeRequestBody || typeof init?.body !== 'string') {
      return undefined;
    }

    try {
      const parsedBody = JSON.parse(init.body) as unknown;
      return redactRequestBody(parsedBody);
    } catch {
      return init.body.length > 2000 ? `${init.body.slice(0, 2000)}...` : init.body;
    }
  }

  function logFetchFailure(label: string, details: FetchDebugDetails) {
    const normalizedDetails = {
      ...details,
      responseText: details.responseText
        ? details.responseText.slice(0, 4000)
        : details.responseText
    };

    console.error(`${label}\n${JSON.stringify(normalizedDetails, null, 2)}`);
  }

  try {
    const response = await fetch(input, init);

    if (!response.ok) {
      const clonedResponse = response.clone();
      const responseText = await clonedResponse.text().catch(() => '');

      logFetchFailure('[api-fetch] request failed', {
        ...getClientDebugContext(),
        caller: meta.caller,
        requestUrl,
        method,
        status: response.status,
        statusText: response.statusText,
        responseText,
        requestBody: getRequestBodyForDebug()
      });
    }

    return response;
  } catch (error) {
    logFetchFailure('[api-fetch] network error', {
      ...getClientDebugContext(),
      caller: meta.caller,
      requestUrl,
      method,
      requestBody: getRequestBodyForDebug(),
      error: serializeError(error)
    });
    throw error;
  }
}

function serializeError(error: unknown): FetchDebugDetails['error'] {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return {
    name: 'UnknownError',
    message: String(error)
  };
}

function redactRequestBody(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactRequestBody);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
      key,
      REDACTED_BODY_KEYS.test(key) ? '[redacted]' : redactRequestBody(entryValue)
    ])
  );
}
