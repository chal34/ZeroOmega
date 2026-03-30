/** @module omega-target/log */

const replacer = (key: string, value: unknown): unknown => {
  switch (key) {
    case 'username':
    case 'password':
    case 'host':
    case 'port':
    case 'token':
    case 'gistToken':
    case 'gistId':
      return '<secret>'
    default:
      return value
  }
}

const Log = {
  str(obj: unknown): string {
    if (typeof obj === 'object' && obj !== null) {
      const o = obj as Record<string, unknown>
      if (o['debugStr'] != null) {
        if (typeof o['debugStr'] === 'function') {
          return (o['debugStr'] as () => string)()
        } else {
          return o['debugStr'] as string
        }
      } else if (obj instanceof Error) {
        return obj.stack || obj.message
      } else {
        return JSON.stringify(obj, replacer, 4)
      }
    } else if (typeof obj === 'function') {
      const f = obj as Function
      if (f.name) {
        return `<f: ${f.name}>`
      } else {
        return f.toString()
      }
    } else {
      return '' + obj
    }
  },

  log: console.log.bind(console),
  error: console.error.bind(console),

  func(name: string, args: IArguments | unknown[]): void {
    this.log(name, '(', Array.prototype.slice.call(args), ')')
  },

  method(name: string, self: unknown, args: IArguments | unknown[]): void {
    this.log(this.str(self), '<<', name, Array.prototype.slice.call(args))
  },
}

export default Log
