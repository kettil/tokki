import EventAsyncEmitter from './eventAsyncEmitter';

type Events = 'start' | 'finish' | 'shutdown' | 'check';

export default class ShutdownHandler extends EventAsyncEmitter<Events> {
  protected readonly jobCounter: Map<string, number> = new Map();

  protected isActive = false;

  /**
   *
   */
  initEvents() {
    this.on('start', async (name: string) => {
      await this.updateJobCounter(name, +1);
    });

    this.on('finish', async (name: string) => {
      await this.updateJobCounter(name, -1);

      await this.emit('check');
    });

    this.on('check', async () => {
      if (await this.isShutdown()) {
        await this.emit('shutdown');
      }
    });
  }

  /**
   *
   * @param name
   * @param n
   */
  async updateJobCounter(name: string, n: number) {
    const count = this.jobCounter.get(name) || 0;

    this.jobCounter.set(name, Math.max(count + n, 0));
  }

  /**
   * Checks whether the number of running jobs is 0.
   */
  async isShutdown() {
    if (!this.isActive) {
      return false;
    }

    let sum = 0;

    this.jobCounter.forEach((count) => {
      sum += count;
    });

    return sum === 0;
  }

  /**
   * Activates the Cancel Handler.
   */
  async activation() {
    this.isActive = true;

    await this.emit('check');
  }
}
