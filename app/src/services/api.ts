// Mock transport. Replace `request` with a fetch-based client when the backend exists;
// service signatures stay the same.
const LATENCY = { min: 120, max: 320 }

export async function request<T>(producer: () => T): Promise<T> {
  const ms = LATENCY.min + Math.random() * (LATENCY.max - LATENCY.min)
  await new Promise((r) => setTimeout(r, ms))
  // structuredClone keeps callers from mutating the in-memory store by accident
  return structuredClone(producer())
}
