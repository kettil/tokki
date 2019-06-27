/**
 *
 */
export default class EventEmitter<Events extends string = string> {
  private listeners = new Map<Events, Array<(...args: any[]) => Promise<void>>>();

  /**
   *
   * @param event
   * @param listener
   */
  on(event: Events, listener: (...args: any[]) => Promise<void>) {
    const listeners = this.listeners.get(event) || [];

    listeners.push(listener);

    this.listeners.set(event, listeners);
  }

  /**
   *
   * @param event
   * @param args
   */
  async emit(event: Events, ...args: any[]) {
    const listeners = this.listeners.get(event) || [];

    if (listeners.length > 0) {
      await Promise.all(listeners.map((listener) => listener(...args)));
    }
  }
}
