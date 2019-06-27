import EventEmitter from './eventEmitter';

/**
 *
 */
describe('Check the class EventEmitter', () => {
  /**
   *
   */
  test('initialize the class', () => {
    const event = new EventEmitter();

    expect(event).toBeInstanceOf(EventEmitter);

    expect((event as any).listeners).toBeInstanceOf(Map);
    expect((event as any).listeners.size).toBe(0);
  });

  /**
   *
   */
  test('it should be add the function to the listeners when on() is called', () => {
    const mock = jest.fn();

    const event = new EventEmitter();

    event.on('test', mock);

    expect((event as any).listeners.size).toBe(1);
    expect((event as any).listeners.get('test')).toBeInstanceOf(Array);
    expect((event as any).listeners.get('test').length).toBe(1);
  });

  /**
   *
   */
  test('it should be call the listener when emit() is called without listener', async () => {
    const event = new EventEmitter();

    await event.emit('error', 'a', 'b', 3);

    expect((event as any).listeners.size).toBe(0);
    expect((event as any).listeners.get('error')).toBeUndefined();
  });

  /**
   *
   */
  test('it should be call the listener when emit() is called with a listener', async () => {
    const mock = jest.fn();

    const event = new EventEmitter();

    event.on('error', mock);

    await event.emit('error', 'a', 'b', 3);

    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenNthCalledWith(1, 'a', 'b', 3);
  });
});
