import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

/**
 * Checks a body, query or parameter against a zod schema. A failure is a ZodError,
 * which the exception filter turns into a 400 in the error envelope.
 */
export class ZodPipe<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    return this.schema.parse(value);
  }
}
