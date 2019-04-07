import Service from './service';

import { objectType } from '../types';

export default class Worker<PayloadType extends {} = objectType> extends Service<PayloadType> {
  /**
   * Initializes the settings for the queue.
   */
  async init() {
    this.log.info(`[AMQP] Initialize channel ${this.name}.`);

    await this.channel.assertExchange(this.name, 'direct', { durable: true });
    await this.channel.assertQueue(this.name, { durable: true });
    await this.channel.bindQueue(this.name, this.name, '', {});
  }
}
