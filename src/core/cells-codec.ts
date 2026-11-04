/**
 * マスデータの圧縮とエンコード。正解図コードと進捗コードで共有する。
 * 1マス1バイトの列 → raw deflate(RFC 1951)→ base64url(RFC 4648 §5、パディングなし)。
 */

export class CellsDecodeError extends Error {
  override readonly name = 'CellsDecodeError'
}

export async function encodeCells(bytes: Uint8Array): Promise<string> {
  return toBase64Url(await transform(bytes, new CompressionStream('deflate-raw')))
}

/** base64url として不正、または deflate として展開できなければ CellsDecodeError。 */
export async function decodeCells(text: string): Promise<Uint8Array> {
  const compressed = fromBase64Url(text)
  try {
    return await transform(compressed, new DecompressionStream('deflate-raw'))
  } catch (cause) {
    throw new CellsDecodeError('cells are not valid raw deflate data', { cause })
  }
}

async function transform(
  input: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const output = new Blob([input as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(output).arrayBuffer())
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const LOOKUP = new Map([...ALPHABET].map((c, i) => [c, i]))

export function toBase64Url(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] as number
    const b1 = bytes[i + 1]
    const b2 = bytes[i + 2]
    out += ALPHABET[b0 >> 2]
    out += ALPHABET[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)]
    if (b1 !== undefined) out += ALPHABET[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)]
    if (b2 !== undefined) out += ALPHABET[b2 & 0x3f]
  }
  return out
}

/** パディング(`=`)は付いていても受け付ける。 */
export function fromBase64Url(text: string): Uint8Array {
  const body = text.replace(/={1,2}$/, '')
  if (body.length % 4 === 1) throw new CellsDecodeError('invalid base64url length')
  const bytes: number[] = []
  let buffer = 0
  let bits = 0
  for (const c of body) {
    const v = LOOKUP.get(c)
    if (v === undefined) throw new CellsDecodeError(`invalid base64url character "${c}"`)
    buffer = (buffer << 6) | v
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 0xff)
    }
  }
  return new Uint8Array(bytes)
}
