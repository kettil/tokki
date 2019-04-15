const mockEventClose = jest.fn();

import CloseHandler from './closeHandler';

/**
 *
 */
describe('Check the class CloseHandler', () => {
  let closeHandler: CloseHandler;

  /**
   *
   */
  beforeEach(() => {
    closeHandler = new CloseHandler();

    closeHandler.on('close', mockEventClose);
  });

  /**
   *
   */
  test('initialize the class', () => {
    expect(closeHandler).toBeInstanceOf(CloseHandler);

    // Checked the protected class variables
    expect((closeHandler as any).counter).toBeInstanceOf(Map);
    expect((closeHandler as any).counter.size).toBe(0);
    expect((closeHandler as any).isClosed).toBe(false);
  });

  /**
   *
   */
  test('it should be increase the counter for the queue when start() is called', () => {
    closeHandler.start('queue1');

    expect((closeHandler as any).counter.get('queue1')).toBe(1);
    expect(mockEventClose.mock.calls.length).toBe(0);
  });

  /**
   *
   */
  test('it should be increase the counter for the queue when start() is called three times', () => {
    closeHandler.start('queue1');
    closeHandler.start('queue2');
    closeHandler.start('queue1');

    expect((closeHandler as any).counter.get('queue1')).toBe(2);
    expect((closeHandler as any).counter.get('queue2')).toBe(1);
    expect(mockEventClose.mock.calls.length).toBe(0);
  });

  /**
   *
   */
  test('it should be decrement the counter for the queue when finish() is called', () => {
    (closeHandler as any).counter.set('queue1', 5);

    closeHandler.finish('queue1');

    expect((closeHandler as any).counter.get('queue1')).toBe(4);
    expect(mockEventClose.mock.calls.length).toBe(0);
  });

  /**
   *
   */
  test('it should be decrement the counter for the queue and is not less than 0 when finish() is called three times', () => {
    (closeHandler as any).counter.set('queue1', 2);

    closeHandler.finish('queue1');
    closeHandler.finish('queue1');
    closeHandler.finish('queue1');

    expect((closeHandler as any).counter.get('queue1')).toBe(0);
    expect(mockEventClose.mock.calls.length).toBe(0);
  });

  /**
   *
   */
  test('it should be do not trigger close event when close() is called and a jobs is running', () => {
    closeHandler.start('q1');

    closeHandler.close();

    expect(mockEventClose.mock.calls.length).toBe(0);
  });

  /**
   *
   */
  test('it should be trigger close event when close() is called and a jobs is finish', () => {
    closeHandler.start('q1');
    closeHandler.finish('q1');

    closeHandler.close();

    expect(mockEventClose.mock.calls.length).toBe(1);
  });

  /**
   *
   */
  test('it should be trigger close event when close() is called directly', () => {
    closeHandler.close();

    expect(mockEventClose.mock.calls.length).toBe(1);
  });
});
