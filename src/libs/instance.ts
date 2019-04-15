import { Channel, Connection } from 'amqplib';

import EventAsyncEmitter from './helper/eventAsyncEmitter';
import CloseHandler from './helper/closeHandler';

import PublisherService from './service/publisher';
import AbstractService from './service/service';
import WorkerService from './service/worker';

import { loggerType, objectType, servicesType } from './types';

type Events = 'close';

export default class Instance extends EventAsyncEmitter<Events> {
  readonly log: loggerType;

  readonly closeHandler: CloseHandler;

  readonly services: servicesType = new Map();

  /**
   *
   * @param log
   * @param connection
   * @param channel
   */
  constructor(log: loggerType, readonly connection: Connection, readonly channel: Channel) {
    super();

    this.closeHandler = new CloseHandler();

    this.log = log.child({ lib: 'amqp' });
  }

  /**
   *
   */
  async initEvents() {
    this.connection.on('close', async () => {
      this.log.info('[AMQP] Connection is closed.');

      this.connection.removeAllListeners('close');
      // call the close event from this class
      await this.emit('close');
    });

    this.connection.on('error', async (err: any) => {
      this.log.fatal({ err }, '[AMQP] A connection error has occurred.');

      this.connection.removeAllListeners('error');
    });

    this.channel.on('close', async () => {
      this.log.info('[AMQP] Channel is closed');

      this.channel.removeAllListeners('close');
      // When the channel is closed, the connection is also closed.
      await this.connection.close();
    });

    this.channel.on('error', async (err: any) => {
      this.log.fatal({ err }, '[AMQP] A channel error has occurred.');

      this.channel.removeAllListeners('error');
      // The channel is closed.
      await this.channel.close();
    });

    this.closeHandler.on('close', () => {
      this.channel.close();
    });
  }

  /**
   * Create a worker service
   *
   * The error queue must first be initialized.
   *
   * @param name
   * @param errorService
   */
  async worker<PayloadType extends {} = objectType>(
    name: string,
    errorService?: AbstractService,
  ): Promise<WorkerService<PayloadType>> {
    return this.createService(WorkerService, name, errorService);
  }

  /**
   *
   * Create a publisher service
   *
   * The error queue must first be initialized.
   *
   * @param name
   * @param errorService
   */
  async publisher<PayloadType extends {} = objectType>(
    name: string,
    errorService?: AbstractService,
  ): Promise<PublisherService<PayloadType>> {
    return this.createService(PublisherService, name, errorService);
  }

  /**
   *
   * @param Service
   * @param name
   * @param errorService
   */
  async createService<PayloadType extends {} = objectType>(
    Service: typeof AbstractService,
    name: string,
    errorService?: AbstractService,
    id: string = name,
  ): Promise<AbstractService<PayloadType>> {
    if (typeof name !== 'string' || name.trim() === '') {
      throw new Error('Queue name is missing');
    }

    let service = this.services.get(id) as AbstractService<PayloadType>;

    if (!service) {
      const logChild = this.log.child({ queue: name, type: Service.name.toLowerCase() });

      service = new Service<PayloadType>(logChild, this, name, errorService);

      this.services.set(id, service);
    } else if (!(service instanceof Service)) {
      const serviceName1 = (service as AbstractService).constructor.name.toLowerCase();
      const serviceName2 = Service.name.toLowerCase();

      throw new Error(`Queue "${name}" is a "${serviceName1}" (deliver: ${serviceName2})`);
    }

    return service;
  }

  /**
   * Calls the cancel method for all services and when all the jobs are done,
   * the connection is closed..
   */
  async shutdown() {
    const promises: Array<Promise<void>> = [];

    this.services.forEach((service) => {
      promises.push(service.cancel());
    });

    await Promise.all(promises);

    this.closeHandler.close();
  }
}
