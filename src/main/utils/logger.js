const winston = require('winston');
const path = require('path');
const { app } = require('electron');
const fs = require('fs-extra');

function getLogDir() {
  try { return path.join(app.getPath('userData'), 'logs'); }
  catch { return path.join(process.env.APPDATA || process.env.HOME || '.', '.goldclient', 'logs'); }
}
const logDir = getLogDir();
fs.ensureDirSync(logDir);

const { createLogger, format, transports } = winston;
const { combine, timestamp, printf, colorize, errors } = format;
const logFormat = printf(({ level, message, timestamp: ts, stack }) =>
  `[${ts}] [${level.toUpperCase().padEnd(5)}] ${stack || message}`
);
const logger = createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true }), logFormat),
  transports: [
    new transports.Console({ format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), logFormat) }),
    new transports.File({ filename: path.join(logDir, 'latest.log'), maxsize: 10*1024*1024, maxFiles: 5, tailable: true }),
    new transports.File({ filename: path.join(logDir, 'errors.log'), level: 'error', maxsize: 5*1024*1024, maxFiles: 3 }),
  ],
});
module.exports = logger;
