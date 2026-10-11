export function isConnectionFailure(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current = error;
  while (current instanceof Error && !seen.has(current)) {
    seen.add(current);
    const code = (current as Error & { code?: string }).code;
    if (code && (/^08/.test(code) || ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE", "57P01", "57P02", "57P03"].includes(code))) return true;
    if (/connection terminated|connection timeout|timeout exceeded when trying to connect/i.test(current.message)) return true;
    current = current.cause;
  }
  return false;
}

export async function retryBillingConnection<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (!isConnectionFailure(error)) throw error;
    return load();
  }
}
