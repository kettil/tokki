import ShutdownHandler from './shutdownHandler';

/**
 *
 */
describe('Check the class ShutdownHandler', () => {
  let shutdownHandler: ShutdownHandler;

  /**
   *
   */
  beforeEach(() => {
    shutdownHandler = new ShutdownHandler();
  });

  /**
   *
   */
  test('Initialize the class', async () => {
    expect(shutdownHandler).toBeInstanceOf(ShutdownHandler);

    // Checked the protected class variables
    expect((shutdownHandler as any).jobCounter).toBeInstanceOf(Map);
    expect((shutdownHandler as any).isActive).toBe(false);
  });

  /**
   *
   */
  test('Initialize the events', async () => {
    // no events are registere
    expect((shutdownHandler as any).handler.eventNames()).toEqual([]);

    shutdownHandler.initEvents();

    expect((shutdownHandler as any).handler.eventNames()).toEqual(['start', 'finish', 'check']);
    expect((shutdownHandler as any).handler.listenerCount('start')).toBe(1);
    expect((shutdownHandler as any).handler.listenerCount('finish')).toBe(1);
    expect((shutdownHandler as any).handler.listenerCount('check')).toBe(1);
  });

  /**
   *
   */
  describe('Process flow without directly events', () => {
    /**
     *
     */
    test('it should be returned false when calling isShutdown() directly', async () => {
      shutdownHandler.initEvents();

      // Call the function to be tested.
      const result = await shutdownHandler.isShutdown();

      expect(result).toBe(false);
    });

    /**
     *
     */
    test('it should be called the "check" event when calling activation() directly', async () => {
      expect.assertions(2);

      // Mocks
      const eventMock = jest.fn().mockReturnValue(Promise.resolve());

      // register a event
      shutdownHandler.on('check', eventMock);

      // Call the function to be tested.
      await shutdownHandler.activation();

      // Checked the protected class variables
      expect((shutdownHandler as any).isActive).toBe(true);
      expect(eventMock.mock.calls.length).toBe(1);
    });
  });

  /**
   *
   */
  describe('Process flow with directly events', () => {
    /**
     *
     */
    test('it should be start and finish a job without triggering the "shutdown" event (without activation)', async () => {
      expect.assertions(2);

      // Mocks
      const eventCheckMock = jest.fn().mockReturnValue(Promise.resolve());
      const eventShutdownMock = jest.fn().mockReturnValue(Promise.resolve());

      // pre settings
      shutdownHandler.on('check', eventCheckMock);
      shutdownHandler.on('shutdown', eventShutdownMock);
      shutdownHandler.initEvents();

      await shutdownHandler.emit('start', 'queue-name');
      await shutdownHandler.emit('finish', 'queue-name');

      expect(eventCheckMock.mock.calls.length).toBe(1);
      expect(eventShutdownMock.mock.calls.length).toBe(0);
    });

    /**
     *
     */
    test('it should be start and finish a job with triggering the "shutdown" event (with activation)', async () => {
      expect.assertions(2);

      // Mocks
      const eventCheckMock = jest.fn().mockReturnValue(Promise.resolve());
      const eventShutdownMock = jest.fn().mockReturnValue(Promise.resolve());

      // pre settings
      shutdownHandler.on('check', eventCheckMock);
      shutdownHandler.on('shutdown', eventShutdownMock);
      shutdownHandler.initEvents();

      await shutdownHandler.emit('start', 'queue-name');
      await shutdownHandler.activation();
      await shutdownHandler.emit('finish', 'queue-name');

      expect(eventCheckMock.mock.calls.length).toBe(2);
      expect(eventShutdownMock.mock.calls.length).toBe(1);
    });

    /**
     *
     */
    test('it should be start two jobs and finish one job without triggering the "shutdown" event (with activation)', async () => {
      expect.assertions(2);

      // Mocks
      const eventCheckMock = jest.fn().mockReturnValue(Promise.resolve());
      const eventShutdownMock = jest.fn().mockReturnValue(Promise.resolve());

      // pre settings
      shutdownHandler.on('check', eventCheckMock);
      shutdownHandler.on('shutdown', eventShutdownMock);
      shutdownHandler.initEvents();

      await shutdownHandler.emit('start', 'queue-name1');
      await shutdownHandler.emit('start', 'queue-name2');
      await shutdownHandler.activation();
      await shutdownHandler.emit('finish', 'queue-name1');

      expect(eventCheckMock.mock.calls.length).toBe(2);
      expect(eventShutdownMock.mock.calls.length).toBe(0);
    });
  });

  test('index', () => {
    expect(true).toBeTruthy();
  });
});
