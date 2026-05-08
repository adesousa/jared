let _debug = false;

export const logger = {
  info: (...args) =>
    console.log(`[INFO] [${new Date().toISOString()}]`, ...args),
  warn: (...args) =>
    console.warn(`[WARN] [${new Date().toISOString()}]`, ...args),
  error: (...args) =>
    console.error(`[ERROR] [${new Date().toISOString()}]`, ...args),
  debug: (...args) => {
    if (_debug) {
      console.debug(`[DEBUG] [${new Date().toISOString()}]`, ...args);
    }
  }
};

export function setDebug(enabled) {
  _debug = !!enabled;
}

export function isDebug() {
  return _debug;
}
