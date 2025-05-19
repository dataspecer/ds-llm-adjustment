import { Controller, Post, UploadedFiles, UseInterceptors, Body, ParseFilePipe, FileTypeValidator, Get, Param, Query } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { SpecificationProcessorService } from 'src/services/specification-processor/specification-processor.service';

@Controller('specification-dialog')
export class SpecificationDialogController {
  constructor(private readonly _specificationProcessorService: SpecificationProcessorService) {}

  @Post('dialog')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'psmArtifact', maxCount: 1 },
      { name: 'newApi', maxCount: 1 },
      { name: 'oldApi', maxCount: 1 },
    ])
  )
  public async processDefinitions(
    @UploadedFiles()
    files: { psmArtifact?: any; newApi?: any, oldApi?: any },
    @Body('action') action: string,
    @Body('artifactFormat') artifactFormat: string,
    @Body('useRemote') useRemote: string = 'false'
  ) {
    const psmFile = files.psmArtifact?.[0];
    const oldApi = files.oldApi?.[0];
    const newApi = files.newApi?.[0];

    if (!psmFile || !oldApi || !newApi || !action) {
      throw new Error('Missing required files or action.');
    }

    const psmContent = psmFile.buffer.toString('utf8');
    const oldApiContent = oldApi.buffer.toString('utf8');
    const newApiContent = newApi.buffer.toString('utf8');

    const result = await this._specificationProcessorService.processDefinitions(psmContent, oldApiContent, newApiContent, action, artifactFormat, useRemote === 'true');
    result['url'] = `${process.env.BASE_URL}/specification-dialog/dialog/${result.id}`;

    return result;
  }

  @Post('dialog/difference')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'psmArtifact', maxCount: 1 },
      { name: 'newApi', maxCount: 1 },
      { name: 'oldApi', maxCount: 1 },
    ])
  )
  public async processDifference(
    @UploadedFiles()
    files: { psmArtifact?: any; newApi?: any, oldApi?: any },
    @Query('useOpenAi') useOpenAi: string = 'false'
  ) {
    const psmFile = files.psmArtifact?.[0];
    const oldApi = files.oldApi?.[0];
    const newApi = files.newApi?.[0];

    if (!psmFile || !oldApi || !newApi) {
      throw new Error('Missing required files or action.');
    }

    const psmContent = psmFile.buffer.toString('utf8');
    const oldApiContent = oldApi.buffer.toString('utf8');
    const newApiContent = newApi.buffer.toString('utf8');

    const result = await this._specificationProcessorService.processSchemaDifferences(oldApiContent, newApiContent, psmContent);
    result['url'] = `${process.env.BASE_URL}/specification-dialog/dialog/${result.id}`;

    return result;
  }

  @Get('dialog/:id')
  async getRequestById(@Param('id') id: number) {
    const result = await this._specificationProcessorService.getRequestById(id);

    result['url'] = `${process.env.BASE_URL}/specification-dialog/dialog/${result.id}`;

    return result;
  }
}
