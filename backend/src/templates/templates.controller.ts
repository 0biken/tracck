import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiError, type TemplateView } from '@tracck/shared';
import type { Response } from 'express';
import { DEFAULT_TEMPLATE, findTemplate, TEMPLATES } from './registry';

/** The resume templates a person can choose from. Public, like the roles list. */
@Controller('v1/templates')
export class TemplatesController {
  @Get()
  list(): { templates: TemplateView[] } {
    return {
      templates: TEMPLATES.map((template) => ({
        id: template.id,
        name: template.name,
        description: template.description,
        previewUrl: `/v1/templates/${template.id}/preview`,
        isDefault: template.id === DEFAULT_TEMPLATE.id,
        sections: template.sections.map(({ id, heading }) => ({ id, heading })),
        details: template.details,
      })),
    };
  }

  @Get(':id/preview')
  preview(@Param('id') id: string, @Res() res: Response): void {
    const template = findTemplate(id);
    if (!template) throw new ApiError(404, 'NOT_FOUND', 'That template does not exist.');
    res.type('png').set('Cache-Control', 'public, max-age=86400').sendFile(template.previewPath);
  }
}
