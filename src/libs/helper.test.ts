import { delay, logDummy } from './helper';

jest.useFakeTimers();

/**
 *
 */
describe('Check the helper functions', () => {
  /**
   *
   */
  test('check the log dummy', () => {
    expect(typeof logDummy).toBe('object');

    expect(logDummy.debug('m')).toBe(true);
    expect(logDummy.info('m')).toBe(true);
    expect(logDummy.warn('m')).toBe(true);
    expect(logDummy.error('m')).toBe(true);
    expect(logDummy.fatal('m')).toBe(true);

    expect(logDummy.child({})).toBe(logDummy);
  });

  /**
   *
   */
  test('it should be a delay per setTimeout() when delay() is called', (done) => {
    expect.assertions(2);

    const promise = delay(500);

    jest.runAllTimers();

    promise
      .then(() => {
        expect(setTimeout).toHaveBeenCalledTimes(1);
        expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 500);
        done();
      })
      .catch(done.fail);
  });
});
