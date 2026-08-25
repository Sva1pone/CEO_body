export async function api(url, options = {}) {
  const response = await fetch(url, {
    headers:
      options.body instanceof FormData
        ? undefined
        : { "Content-Type": "application/json" },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Что-то пошло не так.");
  return payload;
}
