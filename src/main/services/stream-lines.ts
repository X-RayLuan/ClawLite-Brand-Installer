import { StringDecoder } from 'string_decoder'

export interface DecodedLineCollector {
  push(chunk: Buffer): void
  end(): void
}

export const createDecodedLineCollector = (
  onLine: (line: string) => void,
  encoding: BufferEncoding = 'utf8'
): DecodedLineCollector => {
  const decoder = new StringDecoder(encoding)
  let pending = ''

  const emit = (text: string): void => {
    if (!text) return
    pending += text
    const lines = pending.split('\n')
    pending = lines.pop() ?? ''
    for (const line of lines) {
      if (line) onLine(line)
    }
  }

  return {
    push(chunk) {
      emit(decoder.write(chunk))
    },
    end() {
      emit(decoder.end())
      if (pending) {
        onLine(pending)
        pending = ''
      }
    }
  }
}
