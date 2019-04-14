const mockLogFatal = jest.fn();
const mockAmqpClose = jest.fn();
const mockAmqpConnect = jest.fn();
const mockAmqpChannel = jest.fn();
const mockAmqpPrefetch = jest.fn();

jest.mock('amqplib', () => ({ connect: mockAmqpConnect }));
jest.mock('./instance');
jest.mock('./helper/process');

import connect from './connect';
import Instance from './instance';
import { processExit } from './helper/process';

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
    const instance = await connect(
      log,
      'url',
    );

    expect(instance).toBeInstanceOf(Instance);

    expect((instance.initEvents as jest.Mock).mock.calls.length).toBe(1);
    expect((processExit as jest.Mock).mock.calls.length).toBe(0);

    expect(mockAmqpConnect.mock.calls.length).toBe(1);
    expect(mockAmqpConnect.mock.calls[0]).toEqual(['url', {}]);

    expect(mockAmqpChannel.mock.calls.length).toBe(1);
    expect(mockAmqpChannel.mock.calls[0]).toEqual([]);

    expect(mockAmqpPrefetch.mock.calls.length).toBe(1);
    expect(mockAmqpPrefetch.mock.calls[0]).toEqual([1]);

    expect((Instance as any).mock.calls.length).toBe(1);
    expect((Instance as any).mock.calls[0]).toEqual([log, returnConnect, returnChannel]);
  });

  /**
   *
   */
  test('it should be call the function when the optional prefetch argument is 5', async () => {
    const instance = await connect(
      log,
      'url',
      5,
    );

    expect(instance).toBeInstanceOf(Instance);

    expect((instance.initEvents as jest.Mock).mock.calls.length).toBe(1);
    expect((processExit as jest.Mock).mock.calls.length).toBe(0);

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
    const err = new Error('connection error');

    mockAmqpConnect.mockImplementation(async () => {
      throw err;
    });

    await connect(
      log,
      'rabbitmq-url',
    );

    expect(mockLogFatal.mock.calls.length).toBe(1);
    expect(mockLogFatal.mock.calls[0]).toEqual([{ err }, '[AMQP] Could not connect to rabbitmq-url.']);

    expect((processExit as jest.Mock).mock.calls.length).toBe(1);
    expect((processExit as jest.Mock).mock.calls[0]).toEqual([1, 250]);

    expect(mockAmqpConnect.mock.calls.length).toBe(1);
    expect(mockAmqpConnect.mock.calls[0]).toEqual(['rabbitmq-url', {}]);
  });

  /**
   *
   */
  test('it should be call the function when amqp channel throw an error', async () => {
    const err = new Error('channel error');

    mockAmqpChannel.mockImplementation(async () => {
      throw err;
    });

    await connect(
      log,
      'rabbitmq-url',
    );

    expect(mockLogFatal.mock.calls.length).toBe(1);
    expect(mockLogFatal.mock.calls[0]).toEqual([{ err }, '[AMQP] Could not create a channel.']);

    expect((processExit as jest.Mock).mock.calls.length).toBe(1);
    expect((processExit as jest.Mock).mock.calls[0]).toEqual([1, 1000]);

    expect(mockAmqpConnect.mock.calls.length).toBe(1);
    expect(mockAmqpConnect.mock.calls[0]).toEqual(['rabbitmq-url', {}]);

    expect(mockAmqpClose.mock.calls.length).toBe(1);
    expect(mockAmqpClose.mock.calls[0]).toEqual([]);

    expect(mockAmqpChannel.mock.calls.length).toBe(1);
    expect(mockAmqpChannel.mock.calls[0]).toEqual([]);
  });
});
