const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation();
const mockProcessOn = jest.spyOn(process, 'on').mockImplementation();

const mockTrigger = jest.fn();

import { processEvent, processExit } from './process';

jest.useFakeTimers();

/**
 *
 */
describe('Check the process functions', () => {
  let signals: NodeJS.Signals[];

  /**
   *
   */
  beforeEach(() => {
    signals = ['SIGTERM', 'SIGINT', 'SIGKILL'];
  });

  /**
   *
   */
  describe('Check the function processEvent()', () => {
    /**
     *
     */
    test('it should be counted number of registered callbacks when the function processEvent is called', () => {
      processEvent(signals, mockTrigger);

      expect(mockProcessOn.mock.calls.length).toBe(5);
      expect(mockProcessOn.mock.calls[0]).toEqual(['SIGTERM', expect.any(Function)]);
      expect(mockProcessOn.mock.calls[1]).toEqual(['SIGINT', expect.any(Function)]);
      expect(mockProcessOn.mock.calls[2]).toEqual(['SIGKILL', expect.any(Function)]);
      expect(mockProcessOn.mock.calls[3]).toEqual(['uncaughtException', expect.any(Function)]);
      expect(mockProcessOn.mock.calls[4]).toEqual(['exit', expect.any(Function)]);
    });

    /**
     *
     */
    test.each<[NodeJS.Signals, number]>([['SIGTERM', 0], ['SIGKILL', 2]])(
      'it should be call the callback when defined process signal (%s) event is triggered',
      (signal, i) => {
        processEvent(signals, mockTrigger);

        expect(mockProcessOn.mock.calls[i]).toEqual([signal, expect.any(Function)]);

        const cb: any = mockProcessOn.mock.calls[i][1];

        cb(signal);

        expect(mockTrigger.mock.calls.length).toBe(1);
        expect(mockTrigger.mock.calls[0]).toEqual([{ signal }]);
      },
    );

    /**
     *
     */
    test('it should be call the callback when uncaughtException event is triggered', () => {
      processEvent(signals, mockTrigger);

      expect(mockProcessOn.mock.calls[3]).toEqual(['uncaughtException', expect.any(Function)]);
      const cb: any = mockProcessOn.mock.calls[3][1];
      const exception = new Error('uncaughtException-error');

      cb(exception);

      expect(mockTrigger.mock.calls.length).toBe(1);
      expect(mockTrigger.mock.calls[0]).toEqual([{ exception }]);
    });

    /**
     *
     */
    test('it should be call the callback when exit event is triggered', () => {
      processEvent(signals, mockTrigger);

      expect(mockProcessOn.mock.calls[4]).toEqual(['exit', expect.any(Function)]);
      const cb: any = mockProcessOn.mock.calls[4][1];

      cb(42);

      expect(mockTrigger.mock.calls.length).toBe(1);
      expect(mockTrigger.mock.calls[0]).toEqual([{ code: 42 }]);
    });
  });

  /**
   *
   */
  describe('Check the function processExit()', () => {
    /**
     *
     */
    test('it should be call process.exit() when the function is called without arguments', () => {
      expect.assertions(4);

      processExit();

      expect(setTimeout).toHaveBeenCalledTimes(1);
      expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 2000);

      jest.runAllTimers();

      expect(mockProcessExit.mock.calls.length).toBe(1);
      expect(mockProcessExit.mock.calls[0]).toEqual([0]);
    });

    /**
     *
     */
    test('it should be call process.exit() when the function is called with arguments', () => {
      expect.assertions(4);

      processExit(42, 5000);

      expect(setTimeout).toHaveBeenCalledTimes(1);
      expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 5000);

      jest.runAllTimers();

      expect(mockProcessExit.mock.calls.length).toBe(1);
      expect(mockProcessExit.mock.calls[0]).toEqual([42]);
    });
  });
});
