import { EventEmitter } from 'events';

export default class EventAsyncEmitter<Events extends string | symbol = string | symbol> {
  private readonly handler: EventEmitter;

  constructor() {
    this.handler = new EventEmitter();
  }

  /**
   *
   * @param event
   * @param listener
   */
  on(event: Events, listener: (...args: any[]) => Promise<void>) {
    this.handler.on(event, listener);

    return this;
  }

  /**
   *
   * @param event
   * @param args
   */
  async emit(event: Events, ...args: any[]): Promise<void> {
    const promises: Array<Promise<void>> = [];

    this.handler.rawListeners(event).forEach((listener) => {
      promises.push(listener(...args));
    });

    await Promise.all(promises);
  }
}
