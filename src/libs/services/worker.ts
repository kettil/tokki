import Service from './service';

import { objectType, publishOptionsType } from '../types';

export default class Worker<PayloadType extends {} = objectType> extends Service<PayloadType> {
  /**
   *
   */
  async initializeGlobal() {
    await this.channel.assertExchange(this.name, 'direct', { durable: true });
    await this.channel.assertQueue(this.name, { durable: true, maxPriority: 10 });
    await this.channel.bindQueue(this.name, this.name, '', {});
  }

  /**
   *
   * @param payload
   * @param options
   */
  async send(payload: PayloadType, options: Pick<publishOptionsType, 'priority'> = {}) {
    if (typeof options.priority !== 'number') {
      // priority is not undefined
      options.priority = 1;
    }

    if (!(options.priority >= 1 && options.priority <= 10)) {
      throw new Error(`Priority "${options.priority}" is outside the number range [1-10].`);
    }

    await super.send(payload, options);
  }
}
