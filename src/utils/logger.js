import { createLogger, format as _format, transports as _transports } from 'winston';

const logger = createLogger({
  level: 'debug',
  format: _format.combine(
    _format.timestamp(),
    _format.printf(({ level, message, timestamp }) => {
      return `[${timestamp}] [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [new _transports.Console()]
});

export default logger;
