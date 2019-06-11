import { EventEmitter } from 'events';

import { Channel, Connection } from 'amqplib';

import PublisherService from './services/publisher';
import AbstractService from './services/service';
import WorkerService from './services/worker';

import { InterfaceLogger, objectType, servicesType } from './types';

export default class Instance extends EventEmitter {
  protected isClosed: boolean = false;

  protected services: servicesType = new Map();

  /**
   *
   * @param log
   * @param connection
   * @param channel
   */
  constructor(readonly log: InterfaceLogger, readonly connection: Connection, readonly channel: Channel) {
    super();
  }

  /**
   *
   */
  async initEvents() {
    this.connection.on('close', () => {
      this.log.info('[AMQP] Connection is closed.');

      this.connection.removeAllListeners('close');

      this.isClosed = true;
      // call the close event from this class
      this.emit('close');
    });

    this.connection.on('error', (err: any) => {
      this.log.fatal({ err }, '[AMQP] A connection error has occurred.');

      this.connection.removeAllListeners('error');
    });

    this.channel.on('close', () => {
      this.log.info('[AMQP] Channel is closed');

      this.channel.removeAllListeners('close');
    });

    this.channel.on('error', (err: any) => {
      this.log.fatal({ err }, '[AMQP] A channel error has occurred.');

      this.channel.removeAllListeners('error');

      // Close the connection.
      this.connection.close();
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
   * Calls the cancel method for all services and when all the tasks are done,
   * the connection is closed..
   */
  async close() {
    if (this.isClosed) {
      return;
    }

    const promises: Array<Promise<void>> = [];

    this.log.info(`[AMQP] Shutdown the service (count: ${this.services.size})`);
    this.services.forEach((service) => {
      promises.push(service.cancel());
    });

    await Promise.all(promises);

    this.log.info('[AMQP] Close the channel');
    await this.channel.close();

    this.log.info('[AMQP] Close the connection');
    await this.connection.close();
  }
}
