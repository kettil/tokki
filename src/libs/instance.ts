import { Channel, Connection } from 'amqplib';

import EventEmitter from './eventEmitter';
import PublisherService from './services/publisher';
import AbstractService from './services/service';
import WorkerService from './services/worker';

import { InterfaceLogger, objectType, serviceArgsType, servicesType } from './types';

/**
 *
 */
export default class Instance extends EventEmitter<'close'> {
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
    this.connection.on('close', async () => {
      try {
        this.log.info({ lib: 'tokki' }, 'Connection is closed.');

        this.connection.removeAllListeners('close');

        this.isClosed = true;

        // call the close event from this class
        await this.emit('close');
      } catch (err) {
        process.emit('uncaughtException', err);
      }
    });

    this.connection.on('error', (err: any) => {
      this.log.fatal({ lib: 'tokki', err }, 'A connection error has occurred.');

      this.connection.removeAllListeners('error');
    });

    this.channel.on('close', () => {
      this.log.info({ lib: 'tokki' }, 'Channel is closed');

      this.channel.removeAllListeners('close');
    });

    this.channel.on('error', (err: any) => {
      this.log.fatal({ lib: 'tokki', err }, 'A channel error has occurred.');

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
   * @param param0
   */
  async worker<PayloadType extends {} = objectType>(param0: serviceArgsType): Promise<WorkerService<PayloadType>> {
    return this.createService({ ...param0, Service: WorkerService }) as any;
  }

  /**
   *
   * Create a publisher service
   *
   * The error queue must first be initialized.
   *
   * @param param0
   */
  async publisher<PayloadType extends {} = objectType>(
    param0: serviceArgsType,
  ): Promise<PublisherService<PayloadType>> {
    return this.createService<PayloadType>({ ...param0, Service: PublisherService }) as any;
  }

  /**
   *
   * @param param0
   */
  async createService<PayloadType extends {} = objectType>({
    Service,
    name,
    errorService,
    schema,
    closeConnectionByError = true,
    id = name,
  }: serviceArgsType & {
    Service: typeof AbstractService;
    id?: string;
  }): Promise<AbstractService<PayloadType>> {
    if (typeof name !== 'string' || name.trim() === '') {
      throw new Error('Queue name is missing');
    }

    let service = this.services.get(id) as AbstractService<PayloadType>;

    if (!service) {
      const logChild = this.log.child({ queue: name, type: Service.name.toLowerCase() });

      service = new Service<PayloadType>(logChild, this, name, errorService, schema);

      if (closeConnectionByError) {
        service.on('error', async () => {
          await this.connection.close();
        });
      }

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

    this.log.info({ lib: 'tokki' }, `Shutdown the services (count: ${this.services.size})`);
    this.services.forEach((service) => {
      promises.push(service.cancel());
    });

    await Promise.all(promises);

    this.log.info({ lib: 'tokki' }, 'Close the channel');
    await this.channel.close();

    this.log.info({ lib: 'tokki' }, 'Close the connection');
    await this.connection.close();
  }
}
