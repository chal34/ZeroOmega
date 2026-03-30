class TrackedEvent {
  event: any
  callbacks: any[] | null

  constructor(event: any) {
    this.event = event
    this.callbacks = []
    const mes = ['hasListener', 'hasListeners', 'addRules', 'getRules', 'removeRules']
    for (const methodName of mes) {
      const method = this.event[methodName]
      if (method != null) {
        ;(this as any)[methodName] = method.bind(this.event)
      }
    }
  }

  addListener(callback: any) {
    this.event.addListener(callback)
    this.callbacks!.push(callback)
    return this
  }

  removeListener(callback: any) {
    this.event.removeListener(callback)
    const i = this.callbacks!.indexOf(callback)
    if (i >= 0) this.callbacks!.splice(i, 1)
    return this
  }

  removeAllListeners() {
    for (const callback of this.callbacks!) {
      this.event.removeListener(callback)
    }
    this.callbacks = []
    return this
  }

  dispose() {
    this.removeAllListeners()
    if (this.event.hasListeners?.()) {
      throw new Error('Underlying Event still has listeners!')
    }
    this.event = null
    this.callbacks = null
  }
}

class ChromePort {
  name: any
  sender: any
  disconnect: any
  postMessage: any
  onMessage: TrackedEvent
  onDisconnect: TrackedEvent
  private port: any

  constructor(port: any) {
    this.port = port
    this.name = this.port.name
    this.sender = this.port.sender

    this.disconnect = this.port.disconnect.bind(this.port)
    this.postMessage = (...args: any[]) => {
      try {
        this.port.postMessage(...args)
      } catch (_) {
        return
      }
    }

    this.onMessage = new TrackedEvent(this.port.onMessage)
    this.onDisconnect = new TrackedEvent(this.port.onDisconnect)
    this.onDisconnect.addListener(this.dispose.bind(this))
  }

  dispose() {
    this.onMessage.dispose()
    this.onDisconnect.dispose()
  }
}

export = ChromePort
