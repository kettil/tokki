const mockDateNow = jest.spyOn(Date, 'now').mockImplementation();

const mockChannelAssertExchange = jest.fn();
const mockChannelAssertQueue = jest.fn();
const mockChannelBindQueue = jest.fn();
const mockChannelSend = jest.fn();

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
      publish: mockChannelSend,
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
    test('it should be configured the channel when initializeGlobal() is called', async () => {
      expect.assertions(6);

      await (worker as any).initializeGlobal();

      expect(mockChannelAssertExchange.mock.calls.length).toBe(1);
      expect(mockChannelAssertExchange.mock.calls[0]).toEqual([name, 'direct', { durable: true }]);
      expect(mockChannelAssertQueue.mock.calls.length).toBe(1);
      expect(mockChannelAssertQueue.mock.calls[0]).toEqual([name, { durable: true, maxPriority: 10 }]);
      expect(mockChannelBindQueue.mock.calls.length).toBe(1);
      expect(mockChannelBindQueue.mock.calls[0]).toEqual([name, name, '', {}]);
    });

    /**
     *
     */
    test('it should be publish when function send() is called (without priority)', async () => {
      mockDateNow.mockReturnValueOnce(1234567890098);

      await worker.send({ a: 'x' });

      expect(mockChannelSend.mock.calls.length).toBe(1);
      expect(mockChannelSend.mock.calls[0]).toEqual([
        'test-queue',
        '',
        Buffer.from(JSON.stringify({ a: 'x' })),
        { persistent: true, priority: 1, timestamp: 1234567890098 },
      ]);
    });

    /**
     *
     */
    test('it should be publish when function send() is called (with priority)', async () => {
      mockDateNow.mockReturnValueOnce(1234567890098);

      await worker.send({ a: 'y' }, { priority: 5 });

      expect(mockChannelSend.mock.calls.length).toBe(1);
      expect(mockChannelSend.mock.calls[0]).toEqual([
        'test-queue',
        '',
        Buffer.from(JSON.stringify({ a: 'y' })),
        { persistent: true, priority: 5, timestamp: 1234567890098 },
      ]);
    });

    /**
     *
     */
    test.each([[0], [11]])(
      'it should be throw an error when function send() is called (with wrong priority: %d)',
      async (n) => {
        expect.assertions(2);
        mockDateNow.mockReturnValueOnce(1234567890098);

        try {
          await worker.send({ a: 'x' }, { priority: n });
        } catch (err) {
          expect(err).toBeInstanceOf(Error);
          expect(err.message).toBe(`Priority "${n}" is outside the number range [1-10].`);
        }
      },
    );
  });
});
