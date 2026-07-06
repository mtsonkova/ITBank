import type { ZodError } from 'zod';

export function zodFieldErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    fields[issue.path.join('.') || '_root'] = issue.message;
  }
  return fields;
}
