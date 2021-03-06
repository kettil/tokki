const mockProcessEmit = jest.spyOn(process, 'emit').mockImplementation();

const mockLogFatal = jest.fn();
const mockConnectionOn = jest.fn();
const mockConnectionClose = jest.fn();
const mockConnectionRemoveAllListeners = jest.fn();
const mockChannelOn = jest.fn();
const mockChannelClose = jest.fn();
const mockChannelRemoveAllListeners = jest.fn();
const mockServiceError = jest.fn();

jest.mock('./services/service');
jest.mock('./services/worker');
jest.mock('./services/publisher');

import Service from './services/service';

import PublisherService from './services/publisher';
import WorkerService from './services/worker';

import Instance from './instance';

import { SubType } from './types';

const log: any = {
  child: () => log,
  debug: () => true,
  info: () => true,
  error: () => true,
  fatal: mockLogFatal,
};

/**
 *
 */
describe('Check the class Instance', () => {
  let instance: Instance;
  let connection: any;
  let channel: any;

  /**
   *
   */
  beforeEach(() => {
    connection = {
      on: mockConnectionOn,
      close: mockConnectionClose,
      removeAllListeners: mockConnectionRemoveAllListeners,
    };

    channel = {
      on: mockChannelOn,
      close: mockChannelClose,
      removeAllListeners: mockChannelRemoveAllListeners,
    };

    instance = new Instance(log, connection, channel);
  });

  /**
   *
   */
  test('initialize the class', () => {
    expect(instance).toBeInstanceOf(Instance);

    // Checked the protected class variables
    expect(instance.log).toBe(log);
    expect(instance.channel).toBe(channel);
    expect(instance.connection).toBe(connection);
    expect((instance as any).isClosed).toBe(false);
    expect((instance as any).services).toBeInstanceOf(Map);
  });

  /**
   *
   */
  test('Initialize the events', async () => {
    instance.initEvents();

    expect(mockConnectionOn.mock.calls.length).toBe(2);
    expect(mockConnectionOn.mock.calls[0][0]).toBe('close');
    expect(typeof mockConnectionOn.mock.calls[0][1]).toBe('function');
    expect(mockConnectionOn.mock.calls[1][0]).toBe('error');
    expect(typeof mockConnectionOn.mock.calls[1][1]).toBe('function');

    expect(mockChannelOn.mock.calls.length).toBe(2);
    expect(mockChannelOn.mock.calls[0][0]).toBe('close');
    expect(typeof mockChannelOn.mock.calls[0][1]).toBe('function');
    expect(mockChannelOn.mock.calls[1][0]).toBe('error');
    expect(typeof mockChannelOn.mock.calls[1][1]).toBe('function');
  });

  /**
   *
   */
  describe('Check the event functions', () => {
    /**
     *
     */
    beforeEach(() => {
      instance.initEvents();
    });

    /**
     *
     */
    test('it should be call the connection close event when this is triggered', async () => {
      expect(mockConnectionOn.mock.calls.length).toBe(2);
      expect(mockConnectionOn.mock.calls[0][0]).toBe('close');
      expect(typeof mockConnectionOn.mock.calls[0][1]).toBe('function');

      const event = mockConnectionOn.mock.calls[0][1];
      const mockClose = jest.fn();

      instance.on('close', mockClose);

      // Call the function to be tested.
      await event();

      expect(mockConnectionRemoveAllListeners.mock.calls.length).toBe(1);
      expect(mockConnectionRemoveAllListeners.mock.calls[0]).toEqual(['close']);

      expect(mockClose.mock.calls.length).toBe(1);
      expect(mockClose.mock.calls[0]).toEqual([]);

      expect((instance as any).isClosed).toBe(true);
    });

    /**
     *
     */
    test('it should be call the connection close event when this is triggered with a event error', async () => {
      expect(mockConnectionOn.mock.calls.length).toBe(2);
      expect(mockConnectionOn.mock.calls[0][0]).toBe('close');
      expect(typeof mockConnectionOn.mock.calls[0][1]).toBe('function');

      instance.on('close', async () => {
        throw new Error('event-error');
      });

      const event = mockConnectionOn.mock.calls[0][1];
      const mockClose = jest.fn();

      instance.on('close', mockClose);

      // Call the function to be tested.
      await event();

      expect(mockConnectionRemoveAllListeners.mock.calls.length).toBe(1);
      expect(mockConnectionRemoveAllListeners.mock.calls[0]).toEqual(['close']);

      expect(mockClose.mock.calls.length).toBe(1);
      expect(mockClose.mock.calls[0]).toEqual([]);

      expect((instance as any).isClosed).toBe(true);

      expect(mockProcessEmit).toHaveBeenCalledTimes(1);
      expect(mockProcessEmit).toHaveBeenNthCalledWith(1, 'uncaughtException', new Error('event-error'));
    });

    /**
     *
     */
    test('it should be call the connection error event when this is triggered', async () => {
      expect(mockConnectionOn.mock.calls.length).toBe(2);
      expect(mockConnectionOn.mock.calls[1][0]).toBe('error');
      expect(typeof mockConnectionOn.mock.calls[1][1]).toBe('function');

      const event = mockConnectionOn.mock.calls[1][1];
      const err = new Error('connection error');

      // Call the function to be tested.
      await event(err);

      expect(mockConnectionRemoveAllListeners.mock.calls.length).toBe(1);
      expect(mockConnectionRemoveAllListeners.mock.calls[0]).toEqual(['error']);

      expect(mockLogFatal.mock.calls.length).toBe(1);
      expect(mockLogFatal.mock.calls[0]).toEqual([{ lib: 'tokki', err }, 'A connection error has occurred.']);

      expect((instance as any).isClosed).toBe(false);
    });

    /**
     *
     */
    test('it should be call the channel close event when this is triggered', async () => {
      expect(mockChannelOn.mock.calls.length).toBe(2);
      expect(mockChannelOn.mock.calls[0][0]).toBe('close');
      expect(typeof mockChannelOn.mock.calls[0][1]).toBe('function');

      const event = mockChannelOn.mock.calls[0][1];

      // Call the function to be tested.
      await event();

      expect(mockChannelRemoveAllListeners.mock.calls.length).toBe(1);
      expect(mockChannelRemoveAllListeners.mock.calls[0]).toEqual(['close']);

      expect((instance as any).isClosed).toBe(false);
    });

    /**
     *
     */
    test('it should be call the channel error event when this is triggered', async () => {
      expect(mockChannelOn.mock.calls.length).toBe(2);
      expect(mockChannelOn.mock.calls[1][0]).toBe('error');
      expect(typeof mockChannelOn.mock.calls[1][1]).toBe('function');

      const event = mockChannelOn.mock.calls[1][1];
      const err = new Error('channel error');

      // Call the function to be tested.
      await event(err);

      expect(mockChannelRemoveAllListeners.mock.calls.length).toBe(1);
      expect(mockChannelRemoveAllListeners.mock.calls[0]).toEqual(['error']);

      expect(mockConnectionClose.mock.calls.length).toBe(1);

      expect(mockLogFatal.mock.calls.length).toBe(1);
      expect(mockLogFatal.mock.calls[0]).toEqual([{ lib: 'tokki', err }, 'A channel error has occurred.']);

      expect((instance as any).isClosed).toBe(false);
    });
  });

  /**
   *
   */
  describe('Check the create service functions', () => {
    /**
     *
     */
    test('it should be return a service when function createService() is called', async () => {
      const name = 'queue-name';

      const service = await instance.createService({ Service, name, errorService: mockServiceError as any });

      expect(service).toBeInstanceOf(Service);

      expect((Service as jest.Mock).mock.calls.length).toBe(1);
      expect((Service as jest.Mock).mock.calls[0][0]).toBe(log);
      expect((Service as jest.Mock).mock.calls[0][1]).toBe(instance);
      expect((Service as jest.Mock).mock.calls[0][2]).toBe(name);
      expect((Service as jest.Mock).mock.calls[0][3]).toBe(mockServiceError);

      expect((instance as any).services.size).toBe(1);
      expect((instance as any).services.get(name)).toBe(service);

      expect(Service.prototype.on).toHaveBeenCalledTimes(1);
      expect(Service.prototype.on).toHaveBeenNthCalledWith(1, 'error', expect.any(Function));
    });

    /**
     *
     */
    test('it should be return same service when function createService() is called twice', async () => {
      const name = 'queue-name-2';

      const service1 = await instance.createService({
        Service,
        name,
        errorService: mockServiceError as any,
        closeConnectionByError: false,
      });
      const service2 = await instance.createService({ Service, name });

      expect(service2).toBe(service1);

      expect((instance as any).services.size).toBe(1);
      expect((instance as any).services.get(name)).toBe(service1);
    });

    /**
     *
     */
    test('it should call the connection.close() when createService() is called and an error event is trigger', async () => {
      const name = 'queue-name-2';

      await instance.createService({
        Service,
        name,
        errorService: mockServiceError as any,
      });

      expect(Service.prototype.on).toHaveBeenCalledTimes(1);
      expect(Service.prototype.on).toHaveBeenNthCalledWith(1, 'error', expect.any(Function));

      const cb = (Service.prototype.on as jest.Mock).mock.calls[0][1];

      await cb();

      expect(mockConnectionClose).toHaveBeenCalledTimes(1);
    });

    /**
     *
     */
    test('it should be throw an error when function createService() is called twice with different services', async () => {
      const name = 'queue-name-2';

      expect.assertions(2);
      try {
        await instance.createService({ Service: WorkerService, name });

        await instance.createService({ Service: PublisherService, name });
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe(`Queue "${name}" is a "worker" (deliver: publisher)`);
      }
    });

    /**
     *
     */
    test('it should be throw an error when function createService() is called without queue name', async () => {
      expect.assertions(2);
      try {
        await instance.createService({ Service: WorkerService, name: '' });
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe(`Queue name is missing`);
      }
    });

    /**
     *
     */
    test.each<[keyof SubType<Instance, (...args: any[]) => any>, typeof WorkerService | typeof PublisherService]>([
      ['worker', WorkerService],
      ['publisher', PublisherService],
    ])('it should be return a worker when function %s() is called', async (type, ServiceClass) => {
      const name = type + '-queue-name';

      const service = await (instance[type] as any)({ name, errorService: mockServiceError as any });

      expect(service).toBeInstanceOf(ServiceClass);

      expect((ServiceClass as jest.Mock).mock.calls.length).toBe(1);
      expect((ServiceClass as jest.Mock).mock.calls[0][0]).toBe(log);
      expect((ServiceClass as jest.Mock).mock.calls[0][1]).toBe(instance);
      expect((ServiceClass as jest.Mock).mock.calls[0][2]).toBe(name);
      expect((ServiceClass as jest.Mock).mock.calls[0][3]).toBe(mockServiceError);

      expect((instance as any).services.size).toBe(1);
      expect((instance as any).services.get(name)).toBe(service);
    });
  });

  /**
   *
   */
  describe('Check the close functions', () => {
    /**
     *
     */
    test('it should be called service cancel function when function close() is called without services', async () => {
      await instance.close();

      expect((instance as any).services.size).toBe(0);
      expect(mockChannelClose).toHaveBeenCalledTimes(1);
      expect(mockConnectionClose).toHaveBeenCalledTimes(1);
    });

    /**
     *
     */
    test('it should be called service cancel function when function close() is called with one service', async () => {
      const w1 = await instance.worker({ name: 'w1' });

      await instance.close();

      expect((instance as any).services.size).toBe(1);

      expect(mockChannelClose).toHaveBeenCalledTimes(1);
      expect(mockConnectionClose).toHaveBeenCalledTimes(1);

      expect(w1.cancel).toHaveBeenCalledTimes(1);
    });

    /**
     *
     */
    test('it should be called service cancel function when function close() is called with three services', async () => {
      const w1 = await instance.worker({ name: 'w1' });
      const p1 = await instance.publisher({ name: 'p1' });
      const p2 = await instance.publisher({ name: 'p2' });

      await instance.close();

      expect((instance as any).services.size).toBe(3);

      expect(mockChannelClose).toHaveBeenCalledTimes(1);
      expect(mockConnectionClose).toHaveBeenCalledTimes(1);

      expect(w1.cancel).toHaveBeenCalledTimes(1);
      expect(p1.cancel).toHaveBeenCalledTimes(1);
      expect(p2.cancel).toHaveBeenCalledTimes(1);
    });

    /**
     *
     */
    test('it should be not called service cancel() when close() is called and isClosed is true', async () => {
      const w1 = await instance.worker({ name: 'w1' });
      const p1 = await instance.publisher({ name: 'p1' });
      const p2 = await instance.publisher({ name: 'p2' });

      (instance as any).isClosed = true;

      await instance.close();

      expect((instance as any).services.size).toBe(3);

      expect(mockChannelClose).toHaveBeenCalledTimes(0);
      expect(mockConnectionClose).toHaveBeenCalledTimes(0);

      expect(w1.cancel).toHaveBeenCalledTimes(0);
      expect(p1.cancel).toHaveBeenCalledTimes(0);
      expect(p2.cancel).toHaveBeenCalledTimes(0);
    });
  });
});
