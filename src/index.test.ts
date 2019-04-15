import container from './container';
import connect from './libs/connect';
import Publisher from './libs/service/publisher';
import Service from './libs/service/service';
import Worker from './libs/service/worker';

import index, * as indexObject from './index';

describe('Check the index file', () => {
  /**
   *
   */
  test('it should be return a connect when import default value', () => {
    expect(index).toBe(connect);

    expect(indexObject.container).toBe(container);

    expect(indexObject.AbstractService).toBe(Service);
    expect(indexObject.PublisherService).toBe(Publisher);
    expect(indexObject.WorkerService).toBe(Worker);
  });
});
