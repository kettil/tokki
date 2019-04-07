import { Channel, ConsumeMessage } from 'amqplib';

import EventAsyncEmitter from '../helper/eventAsyncEmitter';
import ShutdownHandler from '../helper/shutdownHandler';

import Instance from '../instance';

import { consumerDataType, loggerType, objectType, servicesType } from '../types';

type Events = 'write' | 'data';

export default class Service<PayloadType extends {} = objectType> extends EventAsyncEmitter<Events> {
  protected readonly channel: Channel;

  protected readonly services: servicesType;

  protected readonly shutdownHandler: ShutdownHandler;

  protected readonly consumerTags: string[] = [];

  /**
   *
   * @param name
   * @param log
   * @param instance
   */
  constructor(readonly log: loggerType, instance: Instance, readonly name: string, readonly error?: Service) {
    super();

    this.channel = instance.channel;
    this.services = instance.services;
    this.shutdownHandler = instance.shutdownHandler;
  }

  /**
   * Initializes the settings for the queue.
   */
  async init() {
    throw new Error('Initialization is not implemented.');
  }

  /**
   *
   */
  async registerPublishEvent() {
    this.log.info(`[AMQP] Create publish event "${this.name}".`);

    this.on('write', async (payload: PayloadType) => {
      this.log.debug({ payload }, `[AMQP] New payload for queue "${this.name}".`);

      this.channel.publish(this.name, '', Buffer.from(JSON.stringify(payload), 'utf8'), { persistent: true });
    });
  }

  /**
   *
   */
  async registerConsumeEvent() {
    this.log.info(`[AMQP] Create consumer on channel "${this.name}".`);

    const { consumerTag } = await this.channel.consume(this.name, await this.createConsumer(), {
      noAck: false,
    });

    this.consumerTags.push(consumerTag);
  }

  /**
   *
   */
  async createConsumer() {
    return async (message: ConsumeMessage | null) => {
      if (message) {
        const logChild = this.log.child({ id: message.properties.messageId });
        try {
          const payload = JSON.parse(message.content.toString('utf8'));

          logChild.info({ payload }, '[AMQP] New job is started.');

          const parsedMessage: consumerDataType<PayloadType> = {
            log: logChild,
            payload,

            next: async () => {
              logChild.info({ payload }, '[AMQP] Job completed successfully.');

              await this.shutdownHandler.emit('finish', this.name);

              await this.channel.ack(message);
            },

            discard: async () => {
              logChild.info({ payload }, '[AMQP] Job has failed');

              await this.shutdownHandler.emit('finish', this.name);

              await this.channel.nack(message, false, false);
            },

            defer: async () => {
              logChild.info({ payload }, '[AMQP] Job is requeue.');

              await this.shutdownHandler.emit('finish', this.name);

              await this.channel.nack(message, false, true);
            },

            write: async (name: string, data: any) => {
              const service = this.services.get(name);

              if (!service) {
                throw new Error(`Service "${name}" is unknown`);
              }

              await service.emit('write', data);
            },
          };

          await this.shutdownHandler.emit('start', this.name);

          await this.emit('data', parsedMessage);
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
        await this.error.emit('write', {
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
    const promises = this.consumerTags.map((consumerTag) => this.channel.cancel(consumerTag));

    await Promise.all(promises);
  }
}

/**
 * weg von event handler
 *
 * write function
 * setConsumer function
 *
 */
