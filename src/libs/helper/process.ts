import { processTriggerType } from '../types';

/**
 *
 * @param exitCode
 * @param delay
 */
export const processExit = (exitCode = 0, delay = 2000) => {
  return new Promise<void>(() => {
    setTimeout(() => {
      process.exit(exitCode);
    }, delay);
  });
};

/**
 *
 * @param signals
 * @param trigger
 */
export const processEvent = (signals: NodeJS.Signals[], trigger: processTriggerType) => {
  signals.forEach((signal) => {
    process.on(signal, (status) => {
      trigger({ signal: status });
    });
  });

  process.on('uncaughtException', (exception) => {
    trigger({ exception });
  });

  process.on('exit', (code) => {
    trigger({ code });
  });
};
