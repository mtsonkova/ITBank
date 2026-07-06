// Shared error-extraction helpers for axios errors returned by the backend API.
// Field-level errors come from the 400 VALIDATION_ERROR response shape:
// { error: string, code: 'VALIDATION_ERROR', fields: Record<string, string> }

interface ApiErrorBody {
  error?: string;
  code?: string;
  fields?: Record<string, string>;
}

function responseData(err: unknown): ApiErrorBody | undefined {
  if (err && typeof err === 'object' && 'response' in err) {
    return (err as { response?: { data?: ApiErrorBody } }).response?.data;
  }
  return undefined;
}

export function apiError(err: unknown): string {
  return responseData(err)?.error ?? 'An error occurred';
}

export function apiFieldErrors(err: unknown): Record<string, string> {
  const data = responseData(err);
  if (data?.code === 'VALIDATION_ERROR' && data.fields) {
    return data.fields;
  }
  return {};
}
