import Service from './service';

import { objectType } from '../types';

export default class Publisher<PayloadType extends {} = objectType> extends Service<PayloadType> {
  /**
   *
   */
  async initializeGlobal() {
    await this.instance.channel.assertExchange(this.name, 'fanout', { durable: true });
  }

  /**
   *
   */
  async initializeConsumer() {
    const assertQueueMetadata = await this.instance.channel.assertQueue('', { autoDelete: true, exclusive: true });

    // Replace default consumer queue name with the generated queue name
    this.consumerQueue = assertQueueMetadata.queue;

    await this.instance.channel.bindQueue(this.consumerQueue, this.name, '', {});
  }

  /**
   *
   * @param payload
   * @param options
   */
  async send(payload: PayloadType) {
    await super.send(payload);
  }
}
