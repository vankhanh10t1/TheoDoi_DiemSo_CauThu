type FetchDebugMeta = {
  caller: string;
};

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

  try {
    const response = await fetch(input, init);

    if (!response.ok) {
      const clonedResponse = response.clone();
      const responseText = await clonedResponse.text().catch(() => '');

      console.error('[api-fetch] request failed', {
        ...getClientDebugContext(),
        caller: meta.caller,
        requestUrl,
        method: init?.method ?? 'GET',
        status: response.status,
        statusText: response.statusText,
        responseText
      });
    }

    return response;
  } catch (error) {
    console.error('[api-fetch] network error', {
      ...getClientDebugContext(),
      caller: meta.caller,
      requestUrl,
      method: init?.method ?? 'GET',
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
