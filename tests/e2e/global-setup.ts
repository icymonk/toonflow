const P = 'demo-toonflow'
const FS = `http://127.0.0.1:8080/v1/projects/${P}/databases/(default)/documents`
export const E2E_EMAIL = 'e2e@example.com'

type V = string | number | boolean | null | V[] | { [k: string]: V }
const val = (v: V): unknown =>
  v === null ? { nullValue: null }
    : Array.isArray(v) ? { arrayValue: { values: v.map(val) } }
      : typeof v === 'string' ? { stringValue: v }
        : typeof v === 'boolean' ? { booleanValue: v }
          : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
            : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, val(x)])) } }

async function put(path: string, data: Record<string, V>) {
  const res = await fetch(`${FS}/${path}`, { method: 'PATCH', headers: { 'Authorization': 'Bearer owner', 'content-type': 'application/json' }, body: JSON.stringify({ fields: (val(data) as { mapValue: { fields: unknown } }).mapValue.fields }) })
  if (!res.ok) throw new Error(`seed ${path}: ${res.status}`)
}

async function ready(port: number) {
  for (let i = 0; i < 120; i++) {
    try {
      await fetch(`http://127.0.0.1:${port}/`)
      return
    }
    catch { await new Promise(r => setTimeout(r, 1000)) }
  }
  throw new Error(`emulator ${port} not ready`)
}

export default async function () {
  for (const port of [9099, 8080, 5001, 9199, 9499]) await ready(port)
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${P}/databases/(default)/documents`, { method: 'DELETE' })
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${P}/accounts`, { method: 'DELETE' })
  await put('config/access', { allowedEmails: [E2E_EMAIL] })
  await put('config/models', {
    models: [
      { id: 'fake-text', kind: 'text', provider: 'fake', label: 'Fake text', priceKrw: { perKTokensIn: 0, perKTokensOut: 0 }, enabled: true },
      { id: 'fake-image', kind: 'image', provider: 'fake', label: 'Fake image', priceKrw: { perImage: 0 }, enabled: true },
    ],
    defaults: { text: 'fake-text', image: 'fake-image' },
    usdToKrw: 1400,
  })
}
