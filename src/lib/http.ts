/** Parse a fetch body without throwing when the server returns empty or non-JSON. */
export async function parseResponseJson<T extends Record<string, unknown> = Record<string, unknown>>(
  response: Response,
): Promise<T> {
  const text = await response.text();
  if (!text.trim()) return {} as T;
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as T;
    }
  } catch {
    /* empty or HTML 500 */
  }
  return {} as T;
}
