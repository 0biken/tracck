import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { ApiError, errorEnvelope } from '@tracck/shared';
import type { ApiRequest } from './api-request';

const CHECK_REQUEST = 'Check the request and try again.';

/**
 * Every failure leaves the API as the same error envelope: a stable code, a
 * sentence a person can act on, and the correlation ID. Internal detail stays in
 * the log.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Api');

  catch(error: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<ApiRequest>();
    const response = http.getResponse<Response>();
    const id = request.id ?? 'unknown';

    // Nothing more can be sent once a stream is open. Just end it.
    if (response.headersSent) {
      response.end();
      return;
    }

    if (error instanceof ApiError) {
      response.status(error.status).json(errorEnvelope(error.code, error.message, id));
      return;
    }

    if (error instanceof z.ZodError) {
      response.status(400).json(errorEnvelope('VALIDATION_ERROR', CHECK_REQUEST, id));
      return;
    }

    // Nest's own errors (unknown route, wrong method) and errors from the body parser.
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : (error as { status?: number; statusCode?: number }).status ?? (error as { statusCode?: number }).statusCode;

    if (status === 404) {
      response.status(404).json(errorEnvelope('NOT_FOUND', 'That address does not exist.', id));
      return;
    }
    if (status && status >= 400 && status < 500) {
      response.status(status).json(errorEnvelope('VALIDATION_ERROR', CHECK_REQUEST, id));
      return;
    }

    this.logger.error(`unhandled error ${(error as Error)?.name ?? ''} (${id})`, (error as Error)?.stack);
    response
      .status(500)
      .json(errorEnvelope('INTERNAL_ERROR', 'Something went wrong on our side. Try again.', id));
  }
}
