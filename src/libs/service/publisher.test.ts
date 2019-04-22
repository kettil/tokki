const mockDateNow = jest.spyOn(Date, 'now').mockImplementation();

const mockChannelAssertExchange = jest.fn();
const mockChannelAssertQueue = jest.fn();
const mockChannelBindQueue = jest.fn();
const mockChannelConsume = jest.fn();
const mockChannelSend = jest.fn();

import Publisher from './publisher';

/**
 *
 */
describe('Check the class Publisher', () => {
  let publisher: Publisher;
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
      consume: mockChannelConsume,
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
    publisher = new Publisher(log, instance, name, errorService);
  });

  /**
   *
   */
  test('initialize the class', () => {
    expect(publisher).toBeInstanceOf(Publisher);
  });

  /**
   *
   */
  describe('Checks functions directly', () => {
    /**
     *
     */
    test('it should be configured the channel when call the init() function', async () => {
      expect.assertions(2);

      await publisher.initializeGlobal();

      expect(mockChannelAssertExchange.mock.calls.length).toBe(1);
      expect(mockChannelAssertExchange.mock.calls[0]).toEqual([name, 'fanout', { durable: true }]);
    });

    /**
     *
     */
    test('it should be configured the channel when call the init() function', async () => {
      expect.assertions(4);

      const randomQueueName = 'rand-queue-name';

      mockChannelAssertQueue.mockResolvedValue({ queue: randomQueueName });
      mockChannelConsume.mockResolvedValue({ consumerTag: 'tag' });

      await publisher.initializeConsumer();

      expect(mockChannelAssertQueue.mock.calls.length).toBe(1);
      expect(mockChannelAssertQueue.mock.calls[0]).toEqual(['', { autoDelete: true, exclusive: true }]);
      expect(mockChannelBindQueue.mock.calls.length).toBe(1);
      expect(mockChannelBindQueue.mock.calls[0]).toEqual([randomQueueName, name, '', {}]);
    });

    /**
     *
     */
    test('it should be publish when function send() is called', async () => {
      mockDateNow.mockReturnValueOnce(1234567890098);

      await publisher.send({ a: 'z' });

      expect(mockChannelSend.mock.calls.length).toBe(1);
      expect(mockChannelSend.mock.calls[0]).toEqual([
        'test-queue',
        '',
        Buffer.from(JSON.stringify({ a: 'z' })),
        { persistent: true, priority: undefined, timestamp: 1234567890098 },
      ]);
    });
  });
});
