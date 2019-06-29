import Joi from '@hapi/joi';
import pino from 'pino';

import tokki from '../src';

type payloadType = {
  value: number;
  count: number;
};

// optional: logger
const log = pino();

// optional: schema definition
const schema = Joi.object().keys({
  value: Joi.number()
    .min(1)
    .max(5)
    .required(),
  count: Joi.number()
    .integer()
    .min(0)
    .required(),
});

(async () => {
  // create a connection
  const amqp = await tokki({ url: 'amqp://...', log });

  // create a worker instance
  const worker = await amqp.worker<payloadType>({ name: 'queue-name', schema });

  const payload1 = { value: 3, count: 5 };
  const payload2 = { value: 1, count: 3 };
  const payload3 = { value: 5, count: 9 };

  // 1. task
  await worker.send(payload1);

  // 2. task
  await worker.send(payload2, { priority: 5 });

  // 3. task
  await worker.send(payload3);

  //
  // If a consumer registers on the queue now, then
  // the 2nd task becomes first, then the 1st task
  // and finally the 3rd task.
  //
  // The second task has a higher priority and is
  // therefore processed first.
  //
})();
