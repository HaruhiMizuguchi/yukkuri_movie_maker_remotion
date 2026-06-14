export const fetchJson = async <T,>(input: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init);
  const body = await response.json();
  if (!response.ok) {
    throw new Error((body as { error?: string }).error ?? "request_failed");
  }
  return body as T;
};
