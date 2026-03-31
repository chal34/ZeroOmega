// PO to Chrome messages.json converter
// Converts gettext .po files to Chrome extension _locales messages.json format.
import { readFileSync } from 'fs'

export function po2messages(poContent) {
  const messages = {}
  const lines = poContent.split('\n')
  let currentMsgId = null
  let currentMsgStr = null
  let readingMsgId = false
  let readingMsgStr = false

  const flushEntry = () => {
    if (currentMsgId && currentMsgStr) {
      messages[currentMsgId] = { message: currentMsgStr }
    }
    currentMsgId = null
    currentMsgStr = null
    readingMsgId = false
    readingMsgStr = false
  }

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip comments and empty lines
    if (trimmed.startsWith('#') || trimmed === '') {
      if (currentMsgId !== null || currentMsgStr !== null) {
        flushEntry()
      }
      continue
    }

    if (trimmed.startsWith('msgid ')) {
      if (currentMsgId !== null) {
        flushEntry()
      }
      currentMsgId = extractQuoted(trimmed.slice(6))
      readingMsgId = true
      readingMsgStr = false
    } else if (trimmed.startsWith('msgstr ')) {
      currentMsgStr = extractQuoted(trimmed.slice(7))
      readingMsgId = false
      readingMsgStr = true
    } else if (trimmed.startsWith('"')) {
      // Continuation line
      const continued = extractQuoted(trimmed)
      if (readingMsgStr) {
        currentMsgStr += continued
      } else if (readingMsgId) {
        currentMsgId += continued
      }
    }
  }

  // Flush last entry
  flushEntry()

  return messages
}

function extractQuoted(str) {
  const trimmed = str.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed
      .slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
  }
  return trimmed
}

export function convertPoFile(poFilePath) {
  const content = readFileSync(poFilePath, 'utf-8')
  return po2messages(content)
}
