import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { SpecificationDto } from '../../dto/specification.dto';
import { AnalyzeSchemaDto } from '../../dto/analyze-schema.dto';
import { SchemaChangeDto } from '../../dto/schema-change.dto';
import { ApplyChangesDto } from '../../dto/apply-changes.dto';
import { ChangeDecisionDto } from '../../dto/change-decision.dto';
import { SharedAnalysisDto } from '../../dto/shared-analysis.dto';
import { StoreAnalysisDto } from '../../dto/store-analysis.dto';
import { AcceptedChangeDto } from '../../dto/accepted-change.dto';
import { SharedAnalysisEntity } from '../../entities/shared-analysis.entity';

@Injectable()
export class SpecificationMaintainerService {

  constructor(
    @Inject('CHANGES_DETECTOR') private readonly changesDetectorClient: ClientProxy,
    @Inject('DATASPECER_ADAPTER') private readonly dataspecerAdapterClient: ClientProxy,
    @InjectRepository(SharedAnalysisEntity)
    private readonly sharedAnalysesRepo: Repository<SharedAnalysisEntity>,
  ) {}
  // Mock specifications data
  private readonly mockSpecifications: SpecificationDto[] = [
    {
      id: 'spec-1',
      name: 'E-commerce API Specification',
      psm: {
        id: 'psm-1',
        name: 'E-commerce PSM v1.2',
        iri: 'https://dataspecer.com/psm/ecommerce-v1.2'
      }
    },
    {
      id: 'spec-2',
      name: 'User Management API',
      psm: {
        id: 'psm-2',
        name: 'User Management PSM v2.0',
        iri: 'https://dataspecer.com/psm/user-management-v2.0'
      }
    },
    {
      id: 'spec-3',
      name: 'Payment Processing API',
      psm: {
        id: 'psm-3',
        name: 'Payment PSM v1.5',
        iri: 'https://dataspecer.com/psm/payment-v1.5'
      }
    },
    {
      id: 'spec-4',
      name: 'Inventory Management System',
      psm: {
        id: 'psm-4',
        name: 'Inventory PSM v3.1',
        iri: 'https://dataspecer.com/psm/inventory-v3.1'
      }
    }
  ];

  // Shared analyses are persisted in Postgres via TypeORM repository

  /**
   * Get list of specifications (mock implementation)
   */
  async getSpecifications(search?: string): Promise<SpecificationDto[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    if (!search) {
      return this.mockSpecifications;
    }

    return this.mockSpecifications.filter(spec =>
      spec.name.toLowerCase().includes(search.toLowerCase()) ||
      spec.psm.name.toLowerCase().includes(search.toLowerCase())
    );
  }

  /**
   * Get a specific specification by ID (treat ID as PSM IRI)
   */
  async getSpecification(id: string): Promise<SpecificationDto> {
    // Try to resolve PSM content and label via Dataspecer adapter
    try {
      const dataspecerBaseUrl: string = process.env.DATASPECER_BACKEND_URL || process.env.DATASPECER_API_URL || 'http://dataspecer:80';
      console.log('dataspecerBaseUrl', dataspecerBaseUrl);
      console.log('id', id);
      const psmContent: string = await firstValueFrom(
        this.dataspecerAdapterClient.send('get.psm', { dataspecerBaseUrl, iri: id })
      ) as string;

      let psmName: string = '';
      try {
        const psmJson: any = JSON.parse(psmContent);
        const label: any = (psmJson?.['rdfs:label']) as any;
        if (typeof label === 'string') {
          psmName = label;
        } else if (label && typeof label === 'object') {
          psmName = label['@value'] || label.value || '';
        }
      } catch {}

      if (!psmName) {
        const match: RegExpMatchArray | null = id.match(/([^\/]+)$/);
        psmName = match ? match[1] : 'PSM';
      }

      return {
        id,
        name: psmName,
        psm: {
          id,
          name: psmName,
          iri: id,
        },
      };
    } catch (e) {
      // Fallback to mock if adapter fails
      const spec: SpecificationDto | undefined = this.mockSpecifications.find(s => s.id === id || s.psm.iri === id);
      if (!spec) {
        throw new Error(`Specification with ID ${id} not found`);
      }
      return spec;
    }
  }

  /**
   * Analyze schema against specification (mock implementation)
   */
  async analyzeSchema(analyzeDto: AnalyzeSchemaDto): Promise<{ changes: SchemaChangeDto[] }> {
    const dialogId: string = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    // Try to fetch the previous (old) JSON Schema from Dataspecer using the provided specification identifier (IRI)
    const dataspecerBaseUrl: string = process.env.DATASPECER_BACKEND_URL || process.env.DATASPECER_API_URL || 'http://dataspecer:80';
    let oldJsonSchema: string = '{}';
    try {
      const fetched: string = await firstValueFrom(
        this.dataspecerAdapterClient.send('get.json.schema', {
          dataspecerBaseUrl,
          dataSpecificationIri: analyzeDto.specificationId,
        })
      ) as string;
      if (typeof fetched === 'string' && fetched.trim().length > 0) {
        oldJsonSchema = fetched;
      }
    } catch {
      // Fallback to empty old schema when Dataspecer adapter lookup fails
      oldJsonSchema = '{}';
    }

    const detectPayload: any = {
      dialogId,
      oldApi: oldJsonSchema,
      newApi: analyzeDto.schema,
      artifactFormat: 'json-schema',
    } as any;

    const detected: any = await firstValueFrom(
      this.changesDetectorClient.send('detect.changes', detectPayload)
    ) as any;

    const changes: SchemaChangeDto[] = (detected?.changes || []).map((c: any, index: number) => ({
      id: c.changeId || `change-${index + 1}`,
      type: Array.isArray(c.type) ? (c.type[0] as any) : (c.type as any),
      path: c.path,
      description: c.description,
      isAcceptable: !!c.isAcceptable,
      isProblematic: c.isAcceptable === false,
      groupId: c.groupId ?? undefined,
    }));

    return { changes };
  }

  /**
   * Apply changes to specification (mock implementation)
   */
  async applyChanges(applyDto: ApplyChangesDto): Promise<{ success: boolean; message: string }> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const acceptedChanges: ChangeDecisionDto[] = applyDto.decisions.filter(d => d.decision === 'accept');
    const spec: SpecificationDto = await this.getSpecification(applyDto.specificationId);

    return {
      success: true,
      message: `Successfully applied ${acceptedChanges.length} changes to specification "${spec.name}". Changes will be reflected in the next PSM version.`
    };
  }

  /**
   * Export developer feedback report
   */
  async exportReport(applyDto: ApplyChangesDto): Promise<{ report: any }> {
    const spec: SpecificationDto = await this.getSpecification(applyDto.specificationId);
    const acceptedChanges: ChangeDecisionDto[] = applyDto.decisions.filter(d => d.decision === 'accept');
    const rejectedChanges: ChangeDecisionDto[] = applyDto.decisions.filter(d => d.decision === 'reject');
    const developerFlags: ChangeDecisionDto[] = applyDto.decisions.filter(d => d.decision === 'developer');

    const report: any = {
      specification: {
        id: spec.id,
        name: spec.name,
        psm: spec.psm
      },
      timestamp: new Date().toISOString(),
      summary: {
        totalChanges: applyDto.decisions.length,
        accepted: acceptedChanges.length,
        rejected: rejectedChanges.length,
        flaggedForDevelopers: developerFlags.length
      },
      decisions: applyDto.decisions,
      recommendations: {
        forDevelopers: developerFlags.map(d => d.comment || `Change ${d.changeId} requires developer attention`),
        nextSteps: [
          'Review flagged changes with development team',
          'Update JSON schema based on rejected changes',
          'Re-run analysis after schema modifications'
        ]
      }
    };

    return { report };
  }

  /**
   * Generate validation link for developers
   */
  async generateValidationLink(specificationId: string): Promise<{ token: string; url: string }> {
    const spec: SpecificationDto = await this.getSpecification(specificationId);
    
    const token: string = Buffer.from(JSON.stringify({
      specificationId: spec.id,
      timestamp: Date.now(),
      validUntil: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
    })).toString('base64');

    const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
    const url = `${baseUrl}/validate?token=${token}`;

    return { token, url };
  }

  /**
   * Validate schema using token
   */
  async validateWithToken(token: string): Promise<{ valid: boolean; specification: SpecificationDto }> {
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
      
      if (decoded.validUntil < Date.now()) {
        throw new Error('Token expired');
      }

      const spec: SpecificationDto = await this.getSpecification(decoded.specificationId);
      
      return {
        valid: true,
        specification: spec
      };
    } catch (error) {
      return {
        valid: false,
        specification: null as any
      };
    }
  }

  /**
   * Helper method to find line number of a property in JSON schema
   */
  private findLineNumber(schema: string, property: string): number {
    const lines = schema.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`"${property}"`)) {
        return i + 1;
      }
    }
    return Math.floor(Math.random() * 50) + 10; // Random line number if not found
  }

  /**
   * Store analysis results for sharing
   */
  async storeAnalysis(storeDto: StoreAnalysisDto): Promise<{ success: boolean; shareUrl: string }> {
    const entity: SharedAnalysisEntity = this.sharedAnalysesRepo.create({
      analysisId: storeDto.analysisId,
      oldSchemaName: storeDto.oldSchemaName,
      newSchemaName: storeDto.newSchemaName,
      psmFileName: storeDto.psmFileName,
      changes: storeDto.changes as unknown as object[],
      schema: storeDto.schema,
      decisions: (storeDto.decisions ?? undefined) as unknown as object[] | undefined,
      timestamp: new Date(),
    });

    await this.sharedAnalysesRepo.save(entity);

    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/shared/${storeDto.analysisId}`;

    return { success: true, shareUrl };
  }

  /**
   * Retrieve shared analysis results
   */
  async getSharedAnalysis(analysisId: string): Promise<SharedAnalysisDto> {
    const entity = await this.sharedAnalysesRepo.findOne({ where: { analysisId } });
    if (!entity) {
      throw new Error(`Shared analysis with ID ${analysisId} not found or has expired`);
    }
    const dto: SharedAnalysisDto = {
      analysisId: entity.analysisId,
      oldSchemaName: entity.oldSchemaName,
      newSchemaName: entity.newSchemaName,
      psmFileName: entity.psmFileName,
      changes: entity.changes as any,
      schema: entity.schema,
      decisions: (entity.decisions ?? undefined) as any,
      timestamp: (entity.timestamp instanceof Date ? entity.timestamp.toISOString() : new Date(entity.timestamp as any).toISOString()),
      sharedBy: entity.sharedBy ?? undefined,
    };
    return dto;
  }

  /**
   * Get all accepted changes from stored analyses
   */
  async getAcceptedChanges(): Promise<{ acceptedChanges: AcceptedChangeDto[] }> {
    const rows = await this.sharedAnalysesRepo.find();
    const acceptedChanges: AcceptedChangeDto[] = [];

    for (const row of rows) {
      const decisions: ChangeDecisionDto[] = (row.decisions as any) || [];
      const accepted = decisions.filter(d => d.decision === 'accept');
      for (const decision of accepted) {
        const change = (row.changes as any[]).find(c => c.id === decision.changeId);
        if (change) {
          acceptedChanges.push({
            changeId: change.id,
            analysisId: row.analysisId,
            type: change.type,
            path: change.path,
            description: change.description,
            comment: decision.comment,
            timestamp: (row.timestamp instanceof Date ? row.timestamp.toISOString() : new Date(row.timestamp as any).toISOString()),
            oldSchemaName: row.oldSchemaName,
            newSchemaName: row.newSchemaName,
            psmFileName: row.psmFileName,
            suggestion: change.suggestion,
            rationale: change.rationale,
          });
        }
      }
    }

    acceptedChanges.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return { acceptedChanges };
  }

  /**
   * Fetch PSM content from IRI (mock implementation)
   */
  async fetchPsmFromIri(psmIri: string): Promise<{ content: string; name: string }> {
    const dataspecerBaseUrl = process.env.DATASPECER_BACKEND_URL || process.env.DATASPECER_API_URL || 'http://dataspecer:80';
    const content = await firstValueFrom(
      this.dataspecerAdapterClient.send('get.psm', { dataspecerBaseUrl, iri: psmIri })
    ) as string;
    const nameMatch = psmIri.match(/([^\/]+)$/);
    const name = nameMatch ? nameMatch[1] : 'psm-schema.json';
    return { content, name };
  }


} 