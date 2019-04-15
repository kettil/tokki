import { EventEmitter } from 'events';

export default class CloseHandler extends EventEmitter {
  protected readonly counter: Map<string, number> = new Map();

  protected isClosed = false;

  /**
   *
   * @param name
   */
  start(name: string) {
    this.updateCounter(name, +1);
  }

  /**
   *
   * @param name
   */
  finish(name: string) {
    this.updateCounter(name, -1);
    this.check();
  }

  /**
   *
   * @param name
   * @param n
   */
  updateCounter(name: string, n: number) {
    const count = this.counter.get(name) || 0;

    this.counter.set(name, Math.max(count + n, 0));
  }

  /**
   * Checks whether the number of running jobs is 0.
   */
  check() {
    if (!this.isClosed) {
      return;
    }

    let sum = 0;

    this.counter.forEach((count) => {
      sum += count;
    });

    if (sum === 0) {
      this.emit('close');
    }
  }

  /**
   * Marked to end the process
   */
  close() {
    this.isClosed = true;

    this.check();
  }
}

/**
 *
 *
 * Alle bis auf das shutdown event werden in Funktrionen umgewandelt
 *
 * das Wording shutdown wird durch "close" ersetzt -> einheitliche bennenung
 *
 */
