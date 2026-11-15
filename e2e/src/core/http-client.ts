export type HttpResponse<T = unknown> = {
  status: number;
  headers: Headers;
  body: T;
};

export type RequestOptions = {
  body?: unknown;
  headers?: Record<string, string>;
  /** Access token de teste; vira `Authorization: Bearer <token>`. */
  token?: string;
};

/** Wrapper fino sobre o `fetch` nativo que já devolve o corpo interpretado. */
export class HttpClient {
  constructor(private readonly baseUrl: string) {}

  get<T = unknown>(path: string, options?: RequestOptions) {
    return this.request<T>('GET', path, options);
  }

  post<T = unknown>(path: string, options?: RequestOptions) {
    return this.request<T>('POST', path, options);
  }

  put<T = unknown>(path: string, options?: RequestOptions) {
    return this.request<T>('PUT', path, options);
  }

  patch<T = unknown>(path: string, options?: RequestOptions) {
    return this.request<T>('PATCH', path, options);
  }

  delete<T = unknown>(path: string, options?: RequestOptions) {
    return this.request<T>('DELETE', path, options);
  }

  async request<T = unknown>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<HttpResponse<T>> {
    const headers: Record<string, string> = { ...options.headers };
    if (options.token) {
      headers.authorization = `Bearer ${options.token}`;
    }
    if (options.body !== undefined) {
      headers['content-type'] ??= 'application/json';
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body:
        options.body === undefined
          ? undefined
          : typeof options.body === 'string'
            ? options.body
            : JSON.stringify(options.body),
    });

    const text = await response.text();
    const isJson = response.headers
      .get('content-type')
      ?.includes('application/json');

    return {
      status: response.status,
      headers: response.headers,
      body: (isJson && text ? JSON.parse(text) : text) as T,
    };
  }
}
