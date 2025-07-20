import { Injectable } from '@nestjs/common';
import { 
  SpecificationDto, 
  AnalyzeSchemaDto, 
  SchemaChangeDto, 
  ApplyChangesDto, 
  ChangeDecisionDto,
  SharedAnalysisDto,
  StoreAnalysisDto
} from '../../controllers/http/specification-maintainer/specification-maintainer.controller';

@Injectable()
export class SpecificationMaintainerService {
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

  // In-memory storage for shared analyses (in production, use a database)
  private readonly sharedAnalyses = new Map<string, SharedAnalysisDto>();

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
   * Get a specific specification by ID
   */
  async getSpecification(id: string): Promise<SpecificationDto> {
    const spec = this.mockSpecifications.find(s => s.id === id);
    if (!spec) {
      throw new Error(`Specification with ID ${id} not found`);
    }
    return spec;
  }

  /**
   * Analyze schema against specification (mock implementation)
   */
  async analyzeSchema(analyzeDto: AnalyzeSchemaDto): Promise<{ changes: SchemaChangeDto[] }> {
    // Simulate analysis delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Mock changes detection based on schema content
    const mockChanges: SchemaChangeDto[] = [
      {
        id: 'change-1',
        type: 'addition',
        path: '/properties/user/properties/email',
        description: 'Added email property to user object',
        newValue: { type: 'string', format: 'email' },
        lineNumber: this.findLineNumber(analyzeDto.schema, 'email'),
        groupId: 'group-1',
        isAcceptable: true,
        isProblematic: false,
        suggestion: 'Add email field to User entity in PSM',
        rationale: 'Email is a common user property and follows standard format'
      },
      {
        id: 'change-2',
        type: 'removal',
        path: '/properties/user/properties/username',
        description: 'Removed username property from user object',
        oldValue: { type: 'string' },
        lineNumber: this.findLineNumber(analyzeDto.schema, 'username'),
        groupId: 'group-1',
        isAcceptable: false,
        isProblematic: true,
        suggestion: 'Username is required for user identification',
        rationale: 'Removing username breaks existing user identification logic'
      },
      {
        id: 'change-3',
        type: 'type-change',
        path: '/properties/product/properties/price',
        description: 'Changed price type from string to number',
        oldValue: { type: 'string' },
        newValue: { type: 'number' },
        lineNumber: this.findLineNumber(analyzeDto.schema, 'price'),
        isAcceptable: true,
        isProblematic: false,
        suggestion: 'Update PSM to use numeric type for price',
        rationale: 'Numeric type is more appropriate for price calculations'
      },
      {
        id: 'change-4',
        type: 'rename',
        path: '/properties/order/properties/orderDate',
        description: 'Renamed orderDate to createdAt',
        oldValue: 'orderDate',
        newValue: 'createdAt',
        lineNumber: this.findLineNumber(analyzeDto.schema, 'createdAt'),
        groupId: 'group-2',
        isAcceptable: true,
        isProblematic: false,
        suggestion: 'Rename orderDate field to createdAt in PSM',
        rationale: 'createdAt is a more standard naming convention'
      }
    ];

    // Filter changes based on actual schema content for more realistic results
    const filteredChanges = mockChanges.filter(change => {
      if (change.type === 'addition' && change.newValue) {
        return analyzeDto.schema.includes(Object.keys(change.newValue)[0] || 'email');
      }
      return true;
    });

    return { changes: filteredChanges };
  }

  /**
   * Apply changes to specification (mock implementation)
   */
  async applyChanges(applyDto: ApplyChangesDto): Promise<{ success: boolean; message: string }> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const acceptedChanges = applyDto.decisions.filter(d => d.decision === 'accept');
    const spec = await this.getSpecification(applyDto.specificationId);

    return {
      success: true,
      message: `Successfully applied ${acceptedChanges.length} changes to specification "${spec.name}". Changes will be reflected in the next PSM version.`
    };
  }

  /**
   * Export developer feedback report
   */
  async exportReport(applyDto: ApplyChangesDto): Promise<{ report: any }> {
    const spec = await this.getSpecification(applyDto.specificationId);
    const acceptedChanges = applyDto.decisions.filter(d => d.decision === 'accept');
    const rejectedChanges = applyDto.decisions.filter(d => d.decision === 'reject');
    const developerFlags = applyDto.decisions.filter(d => d.decision === 'developer');

    const report = {
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
    const spec = await this.getSpecification(specificationId);
    
    const token = Buffer.from(JSON.stringify({
      specificationId: spec.id,
      timestamp: Date.now(),
      validUntil: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
    })).toString('base64');

    const baseUrl = process.env.BASE_URL || 'http://localhost:3101';
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

      const spec = await this.getSpecification(decoded.specificationId);
      
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
    const sharedAnalysis: SharedAnalysisDto = {
      analysisId: storeDto.analysisId,
      oldSchemaName: storeDto.oldSchemaName,
      newSchemaName: storeDto.newSchemaName,
      psmFileName: storeDto.psmFileName,
      changes: storeDto.changes,
      schema: storeDto.schema,
      decisions: storeDto.decisions,
      timestamp: new Date().toISOString()
    };

    // Store the analysis
    this.sharedAnalyses.set(storeDto.analysisId, sharedAnalysis);

    // In production, you would store this in a database and clean up old entries
    // For now, we'll just keep them in memory

    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/shared/${storeDto.analysisId}`;

    return {
      success: true,
      shareUrl
    };
  }

  /**
   * Retrieve shared analysis results
   */
  async getSharedAnalysis(analysisId: string): Promise<SharedAnalysisDto> {
    const analysis = this.sharedAnalyses.get(analysisId);
    
    if (!analysis) {
      throw new Error(`Shared analysis with ID ${analysisId} not found or has expired`);
    }

    return analysis;
  }

  /**
   * Fetch PSM content from IRI (mock implementation)
   */
  async fetchPsmFromIri(psmIri: string): Promise<{ content: string; name: string }> {
    // In a real implementation, this would fetch the PSM from the IRI
    // For now, we'll return a mock PSM content
    
    // Extract a meaningful name from the IRI
    const nameMatch = psmIri.match(/([^\/]+)$/);
    const name = nameMatch ? nameMatch[1] : 'psm-schema.json';
    
    const mockPsmContent = {
      "@context": {
        "pim": "https://ofn.gov.cz/pim/",
        "rdfs": "http://www.w3.org/2000/01/rdf-schema#"
      },
      "@type": "pim:PIMSpecification",
      "@id": psmIri,
      "rdfs:label": {
        "@language": "en",
        "@value": "Generated PSM Schema"
      },
      "pim:entities": [
        {
          "@type": "pim:PIMClass",
          "@id": psmIri + "/user",
          "rdfs:label": {
            "@language": "en", 
            "@value": "User"
          },
          "pim:attributes": [
            {
              "@type": "pim:PIMAttribute",
              "@id": psmIri + "/user/email",
              "rdfs:label": {
                "@language": "en",
                "@value": "email"
              },
              "pim:datatype": "http://www.w3.org/2001/XMLSchema#string"
            },
            {
              "@type": "pim:PIMAttribute", 
              "@id": psmIri + "/user/username",
              "rdfs:label": {
                "@language": "en",
                "@value": "username"
              },
              "pim:datatype": "http://www.w3.org/2001/XMLSchema#string"
            }
          ]
        }
      ]
    };

    return {
      content: JSON.stringify(mockPsmContent, null, 2),
      name: name
    };
  }
} 