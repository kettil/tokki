import connect from './libs/connect';

import index from './index';

describe('Check the index file', () => {
  /**
   *
   */
  test('it should be return a connect when import default value', () => {
    expect(index).toBe(connect);

    expect(true).toBeTruthy();
  });
});
