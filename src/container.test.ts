const mockLogInfo = jest.fn();
const mockLogFatal = jest.fn();
const mockInstanceOn = jest.fn();
const mockInstanceShutdown = jest.fn();

jest.mock('./libs/connect');
jest.mock('./libs/helper/process');

import connect from './libs/connect';
import { processEvent, processExit } from './libs/helper/process';

import container from './container';

import { objectType } from './libs/types';

/**
 *
 */
describe('Check the function container()', () => {
  let log: any;
  let instanceObj: objectType;

  /**
   *
   */
  beforeEach(() => {
    log = {
      child: () => log,
      debug: () => {}, // tslint:disable-line: no-empty
      info: mockLogInfo, // tslint:disable-line: no-empty
      error: () => {}, // tslint:disable-line: no-empty
      fatal: mockLogFatal,
    } as any;

    instanceObj = {
      on: mockInstanceOn,
      shutdown: mockInstanceShutdown,
    };
    (connect as jest.Mock).mockResolvedValue(instanceObj);
  });

  /**
   *
   */
  test('it should be call the function when the required arguments are passed', async () => {
    const instance = await container(log, 'url');

    expect(instance).toBe(instanceObj);

    expect((connect as jest.Mock).mock.calls.length).toBe(1);
    expect((connect as jest.Mock).mock.calls[0]).toEqual([log, 'url', 1]);

    expect((processEvent as jest.Mock).mock.calls.length).toBe(1);
    expect((processEvent as jest.Mock).mock.calls[0]).toEqual([
      ['SIGTERM', 'SIGINT', 'SIGKILL', 'SIGUSR1', 'SIGUSR2'],
      expect.any(Function),
    ]);

    expect(mockInstanceOn.mock.calls.length).toBe(1);
    expect(mockInstanceOn.mock.calls[0]).toEqual(['close', expect.any(Function)]);
  });

  /**
   *
   */
  test('it should be call the function when the function with all optional arguments are called', async () => {
    const instance = await container(log, 'url', 32, ['SIGTERM']);

    expect(instance).toBe(instanceObj);

    expect((connect as jest.Mock).mock.calls.length).toBe(1);
    expect((connect as jest.Mock).mock.calls[0]).toEqual([log, 'url', 32]);

    expect((processEvent as jest.Mock).mock.calls.length).toBe(1);
    expect((processEvent as jest.Mock).mock.calls[0]).toEqual([['SIGTERM'], expect.any(Function)]);

    expect(mockInstanceOn.mock.calls.length).toBe(1);
    expect(mockInstanceOn.mock.calls[0]).toEqual(['close', expect.any(Function)]);
  });

  /**
   *
   */
  test('it should be exit the application when the instance close event is triggered', async () => {
    await container(log, 'url');

    expect(mockInstanceOn.mock.calls.length).toBe(1);
    expect(mockInstanceOn.mock.calls[0]).toEqual(['close', expect.any(Function)]);

    const event = mockInstanceOn.mock.calls[0][1];

    await event();

    expect((processExit as jest.Mock).mock.calls.length).toBe(1);
    expect((processExit as jest.Mock).mock.calls[0]).toEqual([0]);
  });

  /**
   *
   */
  test('it should be shtudown the application when the process event is triggered', async () => {
    await container(log, 'url', 1, ['SIGTERM']);

    expect((processEvent as jest.Mock).mock.calls.length).toBe(1);
    expect((processEvent as jest.Mock).mock.calls[0]).toEqual([['SIGTERM'], expect.any(Function)]);

    const event = (processEvent as jest.Mock).mock.calls[0][1];
    const params = { a: 'test', q: 23 };

    await event(params);

    expect(mockInstanceShutdown.mock.calls.length).toBe(1);
    expect(mockInstanceShutdown.mock.calls[0]).toEqual([]);

    expect(mockLogInfo.mock.calls.length).toBe(1);
    expect(mockLogInfo.mock.calls[0]).toEqual([params, '[AMQP] Application will shut down.']);
  });

  /**
   *
   */
  test('it should be throw an error when the process event is triggered', async () => {
    await container(log, 'url', 1, ['SIGTERM']);

    expect((processEvent as jest.Mock).mock.calls.length).toBe(1);
    expect((processEvent as jest.Mock).mock.calls[0]).toEqual([['SIGTERM'], expect.any(Function)]);

    const event = (processEvent as jest.Mock).mock.calls[0][1];
    const error = new Error('blabla');
    const params = { a: 'test', q: 23 };

    mockInstanceShutdown.mockRejectedValue(error);

    await event(params);

    expect(mockInstanceShutdown.mock.calls.length).toBe(1);
    expect(mockInstanceShutdown.mock.calls[0]).toEqual([]);

    expect(mockLogInfo.mock.calls.length).toBe(1);
    expect(mockLogInfo.mock.calls[0]).toEqual([params, '[AMQP] Application will shut down.']);

    expect(mockLogFatal.mock.calls.length).toBe(1);
    expect(mockLogFatal.mock.calls[0]).toEqual([{ ...params, err: error }, '[AMQP] Application shut down failed.']);

    expect((processExit as jest.Mock).mock.calls.length).toBe(1);
    expect((processExit as jest.Mock).mock.calls[0]).toEqual([1]);
  });
});
