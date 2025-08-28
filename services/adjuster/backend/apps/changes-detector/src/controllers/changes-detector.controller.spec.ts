import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ChangesDetectorController } from './changes-detector.controller';
import { ChangesDetectorService } from '../services/changes-detector.service';

describe('ChangesDetectorController', () => {
  let controller: ChangesDetectorController;
  let service: jest.Mocked<ChangesDetectorService>;

  beforeEach(async () => {
    const serviceMock: jest.Mocked<ChangesDetectorService> = {
      detect: jest.fn(),
      detectFromIri: jest.fn(),
      detectHybrid: jest.fn(),
      detectAutomatic: jest.fn(),
      fetchJsonSchemaViaDsv: jest.fn(),
      processChanges: jest.fn(),
    } as unknown as jest.Mocked<ChangesDetectorService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChangesDetectorController],
      providers: [
        { provide: ChangesDetectorService, useValue: serviceMock },
      ],
    }).compile();

    controller = module.get<ChangesDetectorController>(ChangesDetectorController);
    service = module.get(ChangesDetectorService);
  });

  it('detectChangesHttp delegates to service.detect', async () => {
    const dto: any = { dialogId: 'd', oldApi: '{}', newApi: '{}' };
    const expected = { dialogId: 'd', changes: [] } as any;
    service.detect.mockResolvedValue(expected);

    const result = await controller.detectChangesHttp(dto);
    expect(service.detect).toHaveBeenCalledWith(dto);
    expect(result).toBe(expected);
  });

  it('detectChangesFromIriHttp delegates to service.detectFromIri', async () => {
    const dto: any = { dialogId: 'd', psmIri: 'p', dataSpecificationIri: 'x', newJsonSchema: '{}' };
    const expected = { dialogId: 'd', changes: [] } as any;
    service.detectFromIri.mockResolvedValue(expected);

    const result = await controller.detectChangesFromIriHttp(dto);
    expect(service.detectFromIri).toHaveBeenCalledWith(dto);
    expect(result).toBe(expected);
  });

  it('detectChangesHybridHttp delegates to service.detectHybrid', async () => {
    const dto: any = { dialogId: 'd', psmIri: 'p', oldJsonSchema: '{}', newJsonSchema: '{}' };
    const expected = { dialogId: 'd', changes: [] } as any;
    service.detectHybrid.mockResolvedValue(expected);

    const result = await controller.detectChangesHybridHttp(dto);
    expect(service.detectHybrid).toHaveBeenCalledWith(dto);
    expect(result).toBe(expected);
  });

  it('detectChangesAutomaticHttp delegates to service.detectAutomatic', async () => {
    const dto: any = { dialogId: 'd', dataSpecificationIri: 'x', psmIri: 'p', newJsonSchema: '{}' };
    const expected = { dialogId: 'd', changes: [] } as any;
    service.detectAutomatic.mockResolvedValue(expected);

    const result = await controller.detectChangesAutomaticHttp(dto);
    expect(service.detectAutomatic).toHaveBeenCalledWith(dto);
    expect(result).toBe(expected);
  });

  it('fetchJsonSchemaDsvHttp returns content and name', async () => {
    service.fetchJsonSchemaViaDsv.mockResolvedValue('{"type":"object"}');
    const result = await controller.fetchJsonSchemaDsvHttp('iri');
    expect(service.fetchJsonSchemaViaDsv).toHaveBeenCalledWith('iri');
    expect(result).toEqual({ content: '{"type":"object"}', name: 'schema.json' });
  });
});
