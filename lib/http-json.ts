/** Bound bytes even if Content-Length is missing or forged. */
export async function readJsonBody(request: Request, maxBytes = 12000): Promise<unknown> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new Error("INVALID_REQUEST");
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new Error("INVALID_REQUEST");
  return JSON.parse(await readBoundedText(request, maxBytes));
}

/** Webhook signatures must see the exact text, with a byte cap before parsing. */
export async function readBoundedText(request: Request, maxBytes: number): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_REQUEST");
  let size = 0;
  const parts: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new Error("INVALID_REQUEST"); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  return new TextDecoder().decode(bytes);
}
