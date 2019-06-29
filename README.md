# Tokki

A RabbitMQ/AMQP Handler

## Table of Contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Building](#building)
- [Tests](#tests)
- [Prettier and Lint](#prettier-and-lint)

## Installation

```bash
# Production
npm install tokki -P
# Development
npm install tokki -D
```

## Quick start

Create a connection

```javascript
const tokki require('tokki');
// or with TypeScript
import tokki from 'tokki'

// create a connection
const amqp = tokki({
  url: 'amqp://user:pwd@localhost:5672'
});
```

Examples are stored in the [examples folder](./examples).

### Using workers

The worker service distributes the events to the various workers. Each event only goes to one worker.
See the example on [RabbitMQ](https://www.rabbitmq.com/tutorials/tutorial-two-javascript.html).

```javascript
// trigger

const trigger = await amqp.worker('worker-queue-name');

// send a payload to queue
trigger.send({ message: 'imported' });

// consumer

const worker = await amqp.worker('worker-queue-name');

// or with error queue
const error = await amqp.worker('error-queue-name');
const worker = await amqp.worker('worker-queue-name', error);

// define a consumer
worker.setConsumer(async (data) => {
  // data.payload.message = imported

  // ...

  // job is successful
  data.next();

  // or

  // job is failed (but requeue)
  data.defer();

  // or

  // job is failed
  data.discard();
});
// the second parameter of setConsumer() is an optional [JOI](https://github.com/hapijs/joi)
// schema definition for the payload
```

### Using publishers

The Publish Service distributes the events to all publishers.
See the example on [RabbitMQ](https://www.rabbitmq.com/tutorials/tutorial-three-javascript.html).

```javascript
const trigger = await amqp.publisher('publish-queue-name');

const publisher1 = await amqp.publisher('publish-queue-name');

// publisher with error queue
const error = await amqp.worker('error-publish-queue-name');
const publisher2 = await amqp.publisher('publish-queue-name', error);

publisher1.setConsumer(async (data) => {
  // see worker section
  // data.payload.message = imported
});
publisher2.setConsumer(async (data) => {
  // see worker section
  // data.payload.message = imported
});

// send a payload to queue
trigger.send({ message: 'imported' });
```

## Building

Compile the library from TypeScript to JavaScript.

The following command is available:

- `npm run build`

  Builds the library

## Tests

There are three types of tests:

- **Unit Tests**

  These tests have no dependencies outside the tested file (exception: class inheritance). All dependencies are mocked.

  A test coverage of 100% should be achieved.

- **Integration Tests**

  These tests have no dependencies outside the project. All dependencies in the package.json file are mocked.
  Small libraries, e.g. lodash or luxon, don't need to be mocked.

  A test coverage between 50% and 75% should be achieved.

- **Functional Tests**

  These tests are performed with all dependencies and take a long time. External services, e.g. MySQL, will/must be provided via docker.

  No dependency should be mocked.

  A test coverage between 50% and 75% should be achieved.

**The following commands are available:**

| Command                          |    Type     | Description                                     |
| -------------------------------- | :---------: | ----------------------------------------------- |
| `npm run test`                   |    unit     | Run all unit tests                              |
| `npm run test:watch`             |    unit     | Watching mode from unit test                    |
| `npm run coverage`               |    unit     | Creates a coverage report from unit test        |
| `npm run test:integration`       | integration | Run all integration tests                       |
| `npm run test:integration:watch` | integration | Watching mode from integration test             |
| `npm run coverage:integration`   | integration | Creates a coverage report from integration test |
| `npm run test:functional`        | functional  | Run all functional tests                        |
| `npm run test:functional:watch`  | functional  | Watching mode from functional test              |
| `npm run coverage:functional`    | functional  | Creates a coverage report from functional test  |

## Prettier and Lint

Ensures that the code is formatted uniformly and that the coding standards are adhered to.

The following commands are available:

- `npm run prettier`

  Changes the code formatting as defined in the Prettier setting.

- `npm run lint`

  Checks if the lint rules are followed. It calls the prettier command first.
