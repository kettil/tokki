const mockLogFatal = jest.fn();
const mockAmqpClose = jest.fn();
const mockAmqpConnect = jest.fn();
const mockAmqpChannel = jest.fn();
const mockAmqpPrefetch = jest.fn();

jest.mock('amqplib', () => ({ connect: mockAmqpConnect }));
jest.mock('./instance');

import { logDummy } from './helper';
import Instance from './instance';

import connect from './connect';

/**
 *
 */
describe('Check the function connect()', () => {
  let log: any;
  let returnConnect: any;
  let returnChannel: any;

  /**
   *
   */
  beforeEach(() => {
    log = {
      child: () => log,
      debug: () => {}, // tslint:disable-line: no-empty
      info: () => {}, // tslint:disable-line: no-empty
      error: () => {}, // tslint:disable-line: no-empty
      fatal: mockLogFatal,
    } as any;

    returnConnect = { createChannel: mockAmqpChannel, close: mockAmqpClose };
    returnChannel = { prefetch: mockAmqpPrefetch };

    mockAmqpConnect.mockResolvedValue(returnConnect);
    mockAmqpChannel.mockResolvedValue(returnChannel);
  });

  /**
   *
   */
  test('it should be call the function when the required arguments are passed', async () => {
    const instance = await connect('url');

    expect(instance).toBeInstanceOf(Instance);

    expect((instance.initEvents as jest.Mock).mock.calls.length).toBe(1);

    expect(mockAmqpConnect.mock.calls.length).toBe(1);
    expect(mockAmqpConnect.mock.calls[0]).toEqual(['url', {}]);

    expect(mockAmqpChannel.mock.calls.length).toBe(1);
    expect(mockAmqpChannel.mock.calls[0]).toEqual([]);

    expect(mockAmqpPrefetch.mock.calls.length).toBe(1);
    expect(mockAmqpPrefetch.mock.calls[0]).toEqual([1]);

    expect((Instance as any).mock.calls.length).toBe(1);
    expect((Instance as any).mock.calls[0]).toEqual([logDummy, returnConnect, returnChannel]);
  });

  /**
   *
   */
  test('it should be call the function when the optional prefetch argument is 5', async () => {
    const instance = await connect(
      'url',
      log,
      5,
    );

    expect(instance).toBeInstanceOf(Instance);

    expect((instance.initEvents as jest.Mock).mock.calls.length).toBe(1);

    expect(mockAmqpConnect.mock.calls.length).toBe(1);
    expect(mockAmqpConnect.mock.calls[0]).toEqual(['url', {}]);

    expect(mockAmqpChannel.mock.calls.length).toBe(1);
    expect(mockAmqpChannel.mock.calls[0]).toEqual([]);

    expect(mockAmqpPrefetch.mock.calls.length).toBe(1);
    expect(mockAmqpPrefetch.mock.calls[0]).toEqual([5]);

    expect((Instance as any).mock.calls.length).toBe(1);
    expect((Instance as any).mock.calls[0]).toEqual([log, returnConnect, returnChannel]);
  });

  /**
   *
   */
  test('it should be call the function when amqp connect throw an error', async () => {
    expect.assertions(6);

    mockAmqpConnect.mockRejectedValueOnce(new Error('connection error'));

    try {
      await connect(
        'rabbitmq-url',
        log,
      );
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('connection error');

      expect(mockLogFatal.mock.calls.length).toBe(1);
      expect(mockLogFatal.mock.calls[0]).toEqual([
        { lib: 'tokki', err: expect.any(Error) },
        'Could not connect to "rabbitmq-url".',
      ]);

      expect(mockAmqpConnect.mock.calls.length).toBe(1);
      expect(mockAmqpConnect.mock.calls[0]).toEqual(['rabbitmq-url', {}]);
    }
  });

  /**
   *
   */
  test('it should be call the function when amqp channel throw an error', async () => {
    expect.assertions(10);

    mockAmqpChannel.mockRejectedValueOnce(new Error('channel error'));

    try {
      await connect(
        'rabbitmq-url',
        log,
      );
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('channel error');

      expect(mockLogFatal.mock.calls.length).toBe(1);
      expect(mockLogFatal.mock.calls[0]).toEqual([
        { lib: 'tokki', err: expect.any(Error) },
        'Could not create a channel.',
      ]);

      expect(mockAmqpConnect.mock.calls.length).toBe(1);
      expect(mockAmqpConnect.mock.calls[0]).toEqual(['rabbitmq-url', {}]);

      expect(mockAmqpClose.mock.calls.length).toBe(1);
      expect(mockAmqpClose.mock.calls[0]).toEqual([]);

      expect(mockAmqpChannel.mock.calls.length).toBe(1);
      expect(mockAmqpChannel.mock.calls[0]).toEqual([]);
    }
  });
});
