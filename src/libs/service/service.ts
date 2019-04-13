import { Channel, ConsumeMessage } from 'amqplib';

import ShutdownHandler from '../helper/shutdownHandler';

import Instance from '../instance';

import { consumerDataType, consumerType, loggerType, objectType, servicesType } from '../types';

export default class Service<PayloadType extends {} = objectType> {
  protected isInitialized = { global: false, consumer: false, sender: false };

  protected consumerTag?: string;

  protected readonly channel: Channel;

  protected readonly services: servicesType;

  protected readonly shutdownHandler: ShutdownHandler;

  /**
   *
   * @param name
   * @param log
   * @param instance
   */
  constructor(readonly log: loggerType, instance: Instance, readonly name: string, readonly error?: Service) {
    this.channel = instance.channel;
    this.services = instance.services;
    this.shutdownHandler = instance.shutdownHandler;
  }

  /**
   *
   */
  async initializeGlobal() {}

  /**
   *
   */
  async initializeSender() {}

  /**
   *
   */
  async initializeConsumer() {}

  /**
   *
   * @param payload
   */
  async send(payload: PayloadType) {
    if (!this.isInitialized.global) {
      await this.initializeGlobal();
      this.isInitialized.global = true;
    }
    if (!this.isInitialized.sender) {
      await this.initializeSender();
      this.isInitialized.sender = true;
    }

    this.log.info({ payload }, `[AMQP] New payload for queue "${this.name}".`);

    this.channel.publish(this.name, '', Buffer.from(JSON.stringify(payload), 'utf8'), { persistent: true });
  }

  /**
   * Define a consumer.
   *
   * If a consumer already exists, it is replaced by the new consumer.
   *
   * @param consumer
   */
  async setConsumer(consumer: consumerType<PayloadType>) {
    if (!this.isInitialized.global) {
      await this.initializeGlobal();
      this.isInitialized.global = true;
    }
    if (!this.isInitialized.consumer) {
      await this.initializeConsumer();
      this.isInitialized.consumer = true;
    }

    this.log.info(`[AMQP] Set consumer on channel "${this.name}".`);

    // If a consumer exists, it is deactivated.
    await this.cancel();

    const { consumerTag } = await this.channel.consume(this.name, await this.createConsumer(consumer), {
      noAck: false,
    });

    this.consumerTag = consumerTag;
  }

  /**
   *
   * @param consumer
   */
  async createConsumer(consumer: consumerType<PayloadType>) {
    return async (message: ConsumeMessage | null) => {
      if (message) {
        const logChild = this.log.child({ id: message.properties.messageId });
        try {
          const payload = JSON.parse(message.content.toString('utf8'));

          logChild.info({ payload }, '[AMQP] New job is started.');

          let isFinalized = false;

          const parsedMessage: consumerDataType<PayloadType> = {
            log: logChild,
            payload,

            next: async () => {
              isFinalized = true;

              logChild.info({ payload }, '[AMQP] Job completed successfully.');

              await this.shutdownHandler.emit('finish', this.name);

              await this.channel.ack(message);
            },

            discard: async () => {
              isFinalized = true;

              logChild.info({ payload }, '[AMQP] Job has failed');

              await this.shutdownHandler.emit('finish', this.name);

              await this.channel.nack(message, false, false);
            },

            defer: async () => {
              isFinalized = true;

              logChild.info({ payload }, '[AMQP] Job is requeue.');

              await this.shutdownHandler.emit('finish', this.name);

              await this.channel.nack(message, false, true);
            },

            write: async (name: string, data: any) => {
              const service = this.services.get(name);

              if (!service) {
                throw new Error(`Service "${name}" is unknown`);
              }

              await service.send(data);
            },
          };

          await this.shutdownHandler.emit('start', this.name);

          await consumer(parsedMessage);

          if (!isFinalized) {
            throw new Error('Job was not marked as completed.');
          }
        } catch (err) {
          await this.shutdownHandler.emit('finish', this.name);

          await this.errorHandling(logChild, message, err);
        }
      } else {
        this.log.info('[AMQP] New job without consume message');
      }
    };
  }

  /**
   *
   * @param log
   * @param message
   * @param err
   */
  async errorHandling(log: loggerType, message: ConsumeMessage, err: any) {
    try {
      const error = err instanceof Error ? err : new Error(err || 'unknown error');

      log.error({ err }, '[AMQP] Job has an error.');

      await this.channel.nack(message, false, false);

      if (this.error) {
        await this.error.send({
          queue: this.name,
          payload: JSON.parse(message.content.toString('utf8')),
          name: error.name,
          message: error.message,
          stack: error.stack ? error.stack.split('\n') : [],
        });
      }
    } catch (e) {
      log.fatal({ err: e, errPrevent: err }, '[AMQP] Error handling from job is failed.');

      await this.channel.close();
    }
  }

  /**
   * Consumers do not accept new jobs.
   */
  async cancel() {
    if (this.consumerTag) {
      await this.channel.cancel(this.consumerTag);
    }
  }
}
