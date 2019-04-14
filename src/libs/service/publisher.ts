import Service from './service';

import { objectType } from '../types';

export default class Publisher<PayloadType extends {} = objectType> extends Service<PayloadType> {
  /**
   *
   */
  async initializeGlobal() {
    await this.channel.assertExchange(this.name, 'fanout', { durable: true });
  }

  /**
   *
   */
  async initializeConsumer() {
    const assertQueueMetadata = await this.channel.assertQueue('', { autoDelete: true, exclusive: true });

    // Replace default consumer queue name with the generated queue name
    this.consumerQueue = assertQueueMetadata.queue;

    await this.channel.bindQueue(this.consumerQueue, this.name, '', {});
  }
}
