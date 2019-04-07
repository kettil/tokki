import Service from './service';

import { objectType } from '../types';

export default class Publisher<PayloadType extends {} = objectType> extends Service<PayloadType> {
  /**
   * Initializes the settings for the queue.
   */
  async init() {
    this.log.info(`[AMQP] Initialize channel ${this.name}.`);

    await this.channel.assertExchange(this.name, 'fanout', { durable: true });
  }

  /**
   *
   */
  async registerConsumeEvent() {
    const assertQueueMetadata = await this.channel.assertQueue('', { autoDelete: true, exclusive: true });
    const generatedQueueName = assertQueueMetadata.queue;

    await this.channel.bindQueue(generatedQueueName, this.name, '', {});

    // Calls the parent method.
    await super.registerConsumeEvent();
  }
}
