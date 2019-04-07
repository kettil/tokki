const mockOn = jest.fn();
const mockRawListeners = jest.fn();

jest.mock('events', () => {
  return {
    EventEmitter: jest.fn().mockImplementation(() => {
      return { on: mockOn, rawListeners: mockRawListeners };
    }),
  };
});

import EventAsyncEmitter from './eventAsyncEmitter';

/**
 *
 */
describe('Check the class EventAsyncEmitter', () => {
  let eventHandler: EventAsyncEmitter;

  /**
   *
   */
  beforeEach(() => {
    eventHandler = new EventAsyncEmitter();
  });

  /**
   *
   */
  test('initialize the class', () => {
    expect(eventHandler).toBeInstanceOf(EventAsyncEmitter);
  });

  /**
   *
   */
  describe('Check the on() function', () => {
    /**
     *
     */
    test('it should be create a event callback', () => {
      const event = 'test-event';
      const callback = async () => {}; // tslint:disable-line: no-empty

      const returnValue = eventHandler.on(event, callback);

      expect(mockOn.mock.calls.length).toBe(1);
      expect(mockOn.mock.calls[0][0]).toBe(event);
      expect(mockOn.mock.calls[0][1]).toBe(callback);
      expect(returnValue).toBe(eventHandler);
    });
  });

  /**
   *
   */
  describe('Check the emit() function', () => {
    /**
     *
     */
    test('it should be trigger a single event', async () => {
      expect.assertions(6);

      const event = 'test';
      const callback = jest.fn<Promise<void>, any>(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            // this is an async test
            expect(true).toBeTruthy();
            resolve();
          }, 250);
        });
      });

      mockRawListeners.mockImplementation(() => [callback]);

      // trigger the event
      await eventHandler.emit(event, 'a', 1);

      expect(mockRawListeners.mock.calls.length).toBe(1);
      expect(mockRawListeners.mock.calls[0]).toEqual([event]);
      expect(callback.mock.calls.length).toBe(1);
      expect(callback.mock.calls[0]).toEqual(['a', 1]);
      expect(callback.mock.results[0].value).toBeInstanceOf(Promise);
    });

    /**
     *
     */
    test('it should be throw an error in a callback', async () => {
      expect.assertions(2);

      const event = 'test';
      const callback = async () => {
        throw new Error('callback error');
      };

      mockRawListeners.mockImplementation(() => [callback]);

      try {
        // trigger the event
        await eventHandler.emit(event);
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect(err.message).toBe('callback error');
      }
    });
  });
});
