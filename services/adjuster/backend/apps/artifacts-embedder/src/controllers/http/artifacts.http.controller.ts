import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ArtifactsService } from '../../services/artifacts.service';
import { EmbedDataspecerDto } from '../../dto/embed-dataspecer.dto';
import { EmbedDocumentsDto } from '../../dto/embed-documents.dto';
import { SearchQueryDto } from '../../dto/search.query.dto';

@ApiTags('artifacts')
@Controller('artifacts')
export class ArtifactsHttpController {
  constructor(private readonly _artifactsService: ArtifactsService) {}

  @Post('embed/dataspecer')
  @ApiOperation({ summary: 'Embed artifacts from Dataspecer by IRIs' })
  @ApiBody({ type: EmbedDataspecerDto })
  @ApiOkResponse({ description: 'Embedding completed' })
  public async embedFromDataspecer(@Body() dto: EmbedDataspecerDto): Promise<{ embedded: number }> {
    const embedded: number = await this._artifactsService.embedFromDataspecer(dto);
    return { embedded };
  }

  @Post('embed/documents')
  @ApiOperation({ summary: 'Embed arbitrary documents' })
  @ApiBody({ type: EmbedDocumentsDto })
  @ApiOkResponse({ description: 'Embedding completed' })
  public async embedDocuments(@Body() dto: EmbedDocumentsDto): Promise<{ embedded: number }> {
    const embedded: number = await this._artifactsService.embedDocuments(dto.documents);
    return { embedded };
  }

  @Get('search')
  @ApiOperation({ summary: 'Semantic search over embedded artifacts' })
  @ApiOkResponse({ description: 'Search results' })
  public async search(@Query() query: SearchQueryDto): Promise<any> {
    const k: number = query.k ? Number(query.k) : 5;
    return this._artifactsService.search(query.query, k, {
      psmIri: query.psmIri,
      dataSpecificationIri: query.dataSpecificationIri,
    });
  }
}


