type LogFields = Readonly<Record<string, boolean | number | string | null | undefined>>;

type StructuredError = Error & {
  readonly code?: unknown;
  readonly state?: unknown;
};

function errorFields(error: unknown): LogFields {
  if (!(error instanceof Error)) return { errorType: typeof error };
  const structured = error as StructuredError;
  const code: unknown = structured.code;
  const state: unknown = structured.state;
  return {
    errorType: error.name,
    message: error.message,
    ...(typeof code === 'string' ? { code } : {}),
    ...(typeof state === 'string' ? { state } : {}),
  };
}

function record(event: string, fields: LogFields): string {
  return JSON.stringify({ service: 'shalobby', event, ...fields });
}

export function logInfo(event: string, fields: LogFields = {}): void {
  console.info(record(event, fields));
}

export function logError(event: string, error: unknown, fields: LogFields = {}): void {
  console.error(record(event, { ...fields, ...errorFields(error) }));
}
