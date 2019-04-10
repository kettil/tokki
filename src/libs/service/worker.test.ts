const mockChannelAssertExchange = jest.fn();
const mockChannelAssertQueue = jest.fn();
const mockChannelBindQueue = jest.fn();

import Worker from './worker';

/**
 *
 */
describe('Check the class Worker', () => {
  let worker: Worker;
  let errorService: any;
  let instance: any;
  let channel: { [k: string]: any };
  let log: any;

  const name = 'test-queue';

  /**
   *
   */
  beforeEach(() => {
    channel = {
      assertExchange: mockChannelAssertExchange,
      assertQueue: mockChannelAssertQueue,
      bindQueue: mockChannelBindQueue,
    };

    log = {
      child: () => log,
      debug: () => {}, // tslint:disable-line: no-empty
      info: () => {}, // tslint:disable-line: no-empty
      error: () => {}, // tslint:disable-line: no-empty
      fatal: () => {}, // tslint:disable-line: no-empty
    } as any;

    errorService = {};
    instance = { channel };

    // create an instance from a abstract class
    worker = new Worker(log, instance, name, errorService);
  });

  /**
   *
   */
  test('initialize the class', () => {
    expect(worker).toBeInstanceOf(Worker);
  });

  /**
   *
   */
  describe('Checks functions directly', () => {
    /**
     *
     */
    test('it should be configured the channel when call the init() function', async () => {
      expect.assertions(6);

      await worker.initializeGlobal();

      expect(mockChannelAssertExchange.mock.calls.length).toBe(1);
      expect(mockChannelAssertExchange.mock.calls[0]).toEqual([name, 'direct', { durable: true }]);
      expect(mockChannelAssertQueue.mock.calls.length).toBe(1);
      expect(mockChannelAssertQueue.mock.calls[0]).toEqual([name, { durable: true }]);
      expect(mockChannelBindQueue.mock.calls.length).toBe(1);
      expect(mockChannelBindQueue.mock.calls[0]).toEqual([name, name, '', {}]);
    });
  });
});
