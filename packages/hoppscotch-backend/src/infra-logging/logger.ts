import { LoggerService, Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';

@Injectable()
export class MyLogger implements LoggerService {
  private logDir: string;

  constructor() {
    const currentWorkingDirectory = process.cwd();
    this.logDir = join(currentWorkingDirectory, 'logs');
    console.log('Log directory:', this.logDir);
  }

  private async ensureDirExists(dir: string) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      console.error('Failed to create directory:', error);
    }
  }

  private async writeLog(
    level: string,
    message: any,
    ...optionalParams: any[]
  ) {
    const date = new Date();
    const dateString = date.toISOString().split('T')[0];
    const logDirPath = join(this.logDir, dateString);
    const logFilePath = join(logDirPath, `${level.toLowerCase()}.log`);

    await this.ensureDirExists(logDirPath);

    const logMessage = `[${date.toISOString()}] [${level}] ${message} ${optionalParams.join(
      ' ',
    )}\n`;
    try {
      await fs.appendFile(logFilePath, logMessage);
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  log(message: any, ...optionalParams: any[]) {
    this.writeLog('LOG', message, ...optionalParams);
  }

  fatal(message: any, ...optionalParams: any[]) {
    this.writeLog('FATAL', message, ...optionalParams);
  }

  error(message: any, ...optionalParams: any[]) {
    this.writeLog('ERROR', message, ...optionalParams);
  }

  warn(message: any, ...optionalParams: any[]) {
    this.writeLog('WARN', message, ...optionalParams);
  }

  debug?(message: any, ...optionalParams: any[]) {
    console.log('DEBUG:', message);
    this.writeLog('DEBUG', message, ...optionalParams);
  }

  verbose?(message: any, ...optionalParams: any[]) {
    this.writeLog('VERBOSE', message, ...optionalParams);
  }
}
