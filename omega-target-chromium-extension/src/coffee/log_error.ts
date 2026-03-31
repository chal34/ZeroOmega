;(globalThis as any).onerror = function (
  message: any,
  url: any,
  line: any,
  col: any,
  err: any
) {
  console.log('globalThis onerror', arguments)
  if (!(globalThis as any).localStorage) return
  let log = (globalThis as any).localStorage['log'] || ''
  if (err?.stack) {
    log += err.stack + '\n\n'
  } else {
    log += `${url}:${line}:${col}:\t${message}\n\n`
  }
  ;(globalThis as any).localStorage['log'] = log
}
