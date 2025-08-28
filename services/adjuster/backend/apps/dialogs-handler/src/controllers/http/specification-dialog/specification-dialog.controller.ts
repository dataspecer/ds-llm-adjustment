import { Controller, Post, UploadedFiles, UseInterceptors, Body, Get, Param, Query } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { SpecificationProcessorService } from 'apps/dialogs-handler/src/services/specification-processor/specification-processor.service';
import { ApiBody, ApiConsumes, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ChatMessageEntity } from 'apps/dialogs-handler/src/entities/chat-message.entity';

@ApiTags('specification-dialog')
@Controller('specification-dialog')
export class SpecificationDialogController {
  constructor(private readonly _specificationProcessorService: SpecificationProcessorService) {}

  @Post('dialog')
  @ApiOperation({ summary: 'Process PSM and two API specs to start dialog' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        psmArtifact: { type: 'string', format: 'binary' },
        newApi: { type: 'string', format: 'binary' },
        oldApi: { type: 'string', format: 'binary' },
        action: { type: 'string' },
        artifactFormat: { type: 'string' },
        useRemote: { type: 'string', enum: ['true', 'false'] },
      },
      required: ['psmArtifact', 'newApi', 'oldApi', 'action']
    }
  })
  @ApiOkResponse({ description: 'Dialog created and processing started' })
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
    const psmFile: any = files.psmArtifact?.[0];
    const oldApi: any = files.oldApi?.[0];
    const newApi: any = files.newApi?.[0];

    if (!psmFile || !oldApi || !newApi || !action) {
      throw new Error('Missing required files or action.');
    }

    const psmContent: string = psmFile.buffer.toString('utf8');
    const oldApiContent: string = oldApi.buffer.toString('utf8');
    const newApiContent: string = newApi.buffer.toString('utf8');

    const result: ChatMessageEntity = await this._specificationProcessorService.processDefinitions(
      psmContent,
      oldApiContent,
      newApiContent,
      action,
      artifactFormat,
      useRemote === 'true'
    );
    result['url'] = `${process.env.BASE_URL}/specification-dialog/dialog/${result.id}`;

    return result;
  }

  @Post('dialog/difference')
  @ApiOperation({ summary: 'Process difference between APIs using PSM' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        psmArtifact: { type: 'string', format: 'binary' },
        newApi: { type: 'string', format: 'binary' },
        oldApi: { type: 'string', format: 'binary' },
        useOpenAi: { type: 'string', enum: ['true', 'false'] },
      },
      required: ['psmArtifact', 'newApi', 'oldApi']
    }
  })
  @ApiOkResponse({ description: 'Difference processing result' })
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
    const psmFile: any = files.psmArtifact?.[0];
    const oldApi: any = files.oldApi?.[0];
    const newApi: any = files.newApi?.[0];

    if (!psmFile || !oldApi || !newApi) {
      throw new Error('Missing required files or action.');
    }

    const psmContent: string = psmFile.buffer.toString('utf8');
    const oldApiContent: string = oldApi.buffer.toString('utf8');
    const newApiContent: string = newApi.buffer.toString('utf8');

    const result: ChatMessageEntity = await this._specificationProcessorService.processSchemaDifferences(
      oldApiContent,
      newApiContent,
      psmContent
    );
    result['url'] = `${process.env.BASE_URL}/specification-dialog/dialog/${result.id}`;

    return result;
  }

  @Get('dialog/:id')
  @ApiOperation({ summary: 'Get dialog result by id' })
  @ApiOkResponse({ description: 'Dialog result payload' })
  async getRequestById(@Param('id') id: number) {
    const result: ChatMessageEntity = await this._specificationProcessorService.getRequestById(id);
    result['url'] = `${process.env.BASE_URL}/specification-dialog/dialog/${result.id}`;
    return result;
  }
} 