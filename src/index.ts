import connect from './libs/connect';

import _Instance from './libs/instance';
import _Publisher from './libs/services/publisher';
import _Service from './libs/services/service';
import _Worker from './libs/services/worker';

export * from './libs/types';

export default connect;

export const Instance = _Instance;

export const AbstractService = _Service;
export const PublisherService = _Publisher;
export const WorkerService = _Worker;
