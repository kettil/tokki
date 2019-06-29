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
  const worker = await amqp.worker<payloadType>({ name: 'queue-name', schema, closeConnectionByError: true });

  worker.on('error-task', async (err, payload) => {
    // If an error is thrown within a task,
    // then this event is triggered.
  });

  worker.on('error', async (err) => {
    // If an error is thrown within the service,
    // e.g. if an error occurs in the 'error-task' event,
    // then this event is triggered.
    //
    // After the error the connection is closed,
    // if closeConnectionByError = true (default).
  });

  await worker.setConsumer(async (data) => {
    data.log.debug(`value: ${data.payload.value}`);
    data.log.debug(`count: ${data.payload.count}`);

    // If an error is thrown within the task, the task fails
    // and the event "error-task" is triggered.

    // job is successful
    await data.next();

    /*
    // or: job is failed (but requeue)
    await data.defer();
    // or: job is failed
    await data.discard();
    */
  });
})();
