import Joi from '@hapi/joi';
import { Channel, Connection, ConsumeMessage } from 'amqplib';

import { delay } from '../helper';
import Instance from '../instance';

import { consumerDataType, consumerType, InterfaceLogger, objectType, publishOptionsType } from '../types';

/**
 *
 */
export default class Service<PayloadType extends {} = objectType> {
  protected countTasks: number = 0;

  protected isInitialized = { global: false, consumer: false, sender: false };

  protected consumerTag?: string;

  protected consumerQueue: string;

  protected readonly connection: Connection;

  protected readonly channel: Channel;

  /**
   *
   * @param name
   * @param log
   * @param instance
   */
  constructor(readonly log: InterfaceLogger, instance: Instance, readonly name: string, readonly error?: Service) {
    this.connection = instance.connection;
    this.channel = instance.channel;

    this.consumerQueue = name;
  }

  /**
   *
   */
  async initializeGlobal() {
    // dummy
  }

  /**
   *
   */
  async initializeSender() {
    // dummy
  }

  /**
   *
   */
  async initializeConsumer() {
    // dummy
  }

  /**
   *
   * @param payload
   * @param options
   */
  async send(payload: PayloadType, { priority }: publishOptionsType = {}) {
    if (!this.isInitialized.global) {
      await this.initializeGlobal();
      this.isInitialized.global = true;
    }
    if (!this.isInitialized.sender) {
      await this.initializeSender();
      this.isInitialized.sender = true;
    }

    this.log.info(
      {
        lib: 'tokki',
        consumerQueue: this.name,
        consumerName: this.name,
        payload,
      },
      `New payload for queue "${this.name}".`,
    );

    this.channel.publish(this.name, '', Buffer.from(JSON.stringify(payload), 'utf8'), {
      priority,
      persistent: true,
      timestamp: Date.now(),
    });
  }

  /**
   * Define a consumer.
   *
   * If a consumer already exists, it is replaced by the new consumer.
   *
   * @param consumer
   * @param schema
   */
  async setConsumer(consumer: consumerType<PayloadType>, schema?: Joi.ObjectSchema) {
    if (!this.isInitialized.global) {
      await this.initializeGlobal();
      this.isInitialized.global = true;
    }
    if (!this.isInitialized.consumer) {
      await this.initializeConsumer();
      this.isInitialized.consumer = true;
    }

    this.log.info(
      { lib: 'tokki', consumerQueue: this.consumerQueue, consumerName: this.name },
      `Set consumer on channel "${this.name}" (queue: ${this.consumerQueue}).`,
    );

    // If a consumer exists, it is deactivated.
    await this.cancel();

    const { consumerTag } = await this.channel.consume(
      this.consumerQueue,
      await this.createConsumer(consumer, schema),
      { noAck: false },
    );

    this.consumerTag = consumerTag;
  }

  /**
   * Do not call this function,
   * but you call the function setConsumer().
   *
   * @param consumer
   */
  async createConsumer(consumer: consumerType<PayloadType>, schema?: Joi.ObjectSchema) {
    return async (message: ConsumeMessage | null) => {
      if (message) {
        const timestamp = message.properties.timestamp ? new Date(message.properties.timestamp) : undefined;
        const logChild = this.log.child({
          consumerQueue: this.consumerQueue,
          consumerName: this.name,
          messageId: message.properties.messageId,
        });

        try {
          this.taskCreated();

          const content: PayloadType = JSON.parse(message.content.toString('utf8'));
          const payload = schema ? await schema.validate(content, { stripUnknown: true, abortEarly: false }) : content;

          logChild.info({ lib: 'tokki', payload: content, taskCreated: timestamp }, 'New task is started.');

          let isFinalized = false;

          const parsedMessage: consumerDataType<PayloadType> = {
            log: logChild,
            created: timestamp,
            payload,

            next: async () => {
              isFinalized = true;

              logChild.info({ lib: 'tokki', payload }, 'Task completed successfully.');

              await this.channel.ack(message);

              this.taskCompleted();
            },

            discard: async () => {
              isFinalized = true;

              logChild.info({ lib: 'tokki', payload }, 'Task has failed');

              await this.channel.nack(message, false, false);

              this.taskCompleted();
            },

            defer: async () => {
              isFinalized = true;

              logChild.info({ lib: 'tokki', payload }, 'Task is requeue.');

              await this.channel.nack(message, false, true);

              this.taskCompleted();
            },
          };

          await consumer(parsedMessage);

          if (!isFinalized) {
            throw new Error('Task was not marked as completed.');
          }
        } catch (err) {
          await this.errorHandling(logChild, message, err);
        }
      } else {
        this.log.info({ lib: 'tokki' }, 'New task without consume message');
      }
    };
  }

  /**
   *
   * @param log
   * @param message
   * @param err
   */
  async errorHandling(log: InterfaceLogger, message: ConsumeMessage, err: any) {
    try {
      const content = message.content.toString('utf8');
      const error = err instanceof Error ? err : new Error(err || 'unknown error');
      let payload: string;

      try {
        payload = JSON.parse(content);
      } catch (err) {
        // Message is not a valid JSON string
        payload = content;
      }

      log.error({ lib: 'tokki', err, messageContent: payload }, 'Task has an error.');

      await this.channel.nack(message, false, false);

      this.taskCompleted();

      if (this.error) {
        await this.error.send({
          queue: this.name,
          payload,
          name: error.name,
          message: error.message,
          stack: error.stack ? error.stack.split('\n') : [],
        });
      }
    } catch (e) {
      log.fatal({ lib: 'tokki', err: e, errPrevent: err }, 'Error handling from task is failed.');

      await this.connection.close();
    }
  }

  /**
   * Consumers do not accept new Tasks.
   */
  async cancel() {
    if (this.consumerTag) {
      // Does not accept a new task
      await this.channel.cancel(this.consumerTag);
    }

    // Wait for all tasks to be completed
    while (this.countTasks > 0) {
      await delay(100);
    }
  }

  /**
   *
   */
  protected taskCreated() {
    this.countTasks += 1;
  }

  /**
   *
   */
  protected taskCompleted() {
    this.countTasks = Math.max(0, this.countTasks - 1);
  }
}
