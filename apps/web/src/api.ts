export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  const body = await response.text();
  if (!response.ok) {
    throw new ApiError(
      response.status,
      body.trim() || `Local API returned ${response.status}`,
    );
  }
  return JSON.parse(body) as T;
}
