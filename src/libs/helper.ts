import { InterfaceLogger } from './types';

/**
 *
 */
export const logDummy: InterfaceLogger = {
  debug: () => true,
  info: () => true,
  warn: () => true,
  error: () => true,
  fatal: () => true,

  child: () => logDummy,
};

/**
 *
 * @param ms
 */
export const delay = (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
};
