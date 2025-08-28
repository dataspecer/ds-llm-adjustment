import { jest, describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { INestApplication, INestMicroservice } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Transport, ClientProxyFactory, ClientProxy } from '@nestjs/microservices';
import * as request from 'supertest';
import { of } from 'rxjs';
import { DialogsHandlerModule } from '../src/dialogs-handler.module';
import { SpecificationProcessorService } from '../src/services/specification-processor/specification-processor.service';
import { IDialogService } from '../src/services/interfaces/dialog/dialog-service.interface';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { ChatMessageEntity } from '../src/entities/chat-message.entity';

jest.setTimeout(20000);

describe('DialogsHandler (e2e)', () => {
  let app: INestApplication;
  let microserviceClient: ClientProxy;
  let microserviceApp: INestMicroservice;
  let moduleFixture: TestingModule;

  // Mocks
  const changesDetectorMock = { send: jest.fn(() => of({ changes: [{ changeId: 'c1', type: 'ADD_PROPERTY', path: '/a', description: 'desc', isAcceptable: true }] })) };
  const changesSuggesterMock = { send: jest.fn(() => of({})) };
  const dataspecerAdapterMock = { send: jest.fn((pattern: string) => {
    if (pattern === 'get.psm') {
      return of(JSON.stringify({ 'rdfs:label': 'My PSM' }));
    }
    return of('');
  }) };

  const specProcessorMock = {
    processDefinitions: jest.fn(async () => ({ id: 42 })),
    processSchemaDifferences: jest.fn(async () => ({ id: 43 })),
    getRequestById: jest.fn(async (id: number) => ({ id })),
  } as unknown as SpecificationProcessorService;

  const dialogServiceMock = {
    integrateChanges: jest.fn(async (payload: any) => ({ ok: true, received: payload })),
    saveSuggestions: jest.fn(async (payload: any) => ({ ok: true, received: payload })),
  } as unknown as IDialogService;

  // Provide a lightweight TypeORM mock to avoid real DB
  class DataSourceMock {
    async initialize() { return this; }
    async destroy() {}
  }

  const repositoryMock = {
    save: jest.fn(async (x?: any) => ({ id: x?.id ?? 1, ...x })),
    find: jest.fn(async () => []),
    update: jest.fn(async () => undefined),
    findOne: jest.fn(async ({ where: { id } }: any) => ({ id })),
  } as any;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [DialogsHandlerModule],
    })
      .overrideProvider('CHANGES_DETECTOR')
      .useValue(changesDetectorMock)
      .overrideProvider('CHANGES_SUGGESTER')
      .useValue(changesSuggesterMock)
      .overrideProvider('DATASPECER_ADAPTER')
      .useValue(dataspecerAdapterMock)
      .overrideProvider(SpecificationProcessorService)
      .useValue(specProcessorMock)
      .overrideProvider(IDialogService)
      .useValue(dialogServiceMock)
      // Override TypeORM DataSource and repository
      .overrideProvider(getDataSourceToken())
      .useValue(new DataSourceMock())
      .overrideProvider(getRepositoryToken(ChatMessageEntity))
      .useValue(repositoryMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    microserviceApp = moduleFixture.createNestMicroservice({ transport: Transport.TCP });
    await microserviceApp.listen();
    microserviceClient = ClientProxyFactory.create({ transport: Transport.TCP });
  });

  afterAll(async () => {
    if (microserviceClient) await microserviceClient.close();
    if (microserviceApp) await microserviceApp.close();
    if (app) await app.close();
  });

  // ========== HTTP: Specification Maintainer ==========
  it('GET /api/specifications returns array', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/specifications')
      .expect(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('GET /api/specifications/by-iri returns object resolved via adapter', async () => {
    const iri = 'http://example.com/psm/test';
    const response = await request(app.getHttpServer())
      .get('/api/specifications/by-iri')
      .query({ iri })
      .expect(200);
    expect(response.body).toHaveProperty('id', iri);
    expect(response.body).toHaveProperty('name');
  });

  it('POST /api/specifications/analyses maps detector changes', async () => {
    const payload = { specificationId: 'spec-1', schema: '{"type":"object"}' };
    const res = await request(app.getHttpServer())
      .post('/api/specifications/analyses')
      .send(payload)
      .expect(201);
    expect(Array.isArray(res.body.changes)).toBe(true);
    expect(res.body.changes.length).toBeGreaterThan(0);
  });

  it('POST /api/specifications/changes/apply returns success message', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/specifications/changes/apply')
      .send({
        specificationId: 'spec-1',
        decisions: [
          { changeId: 'c1', decision: 'accept' },
          { changeId: 'c2', decision: 'reject' },
        ],
      })
      .expect(201);
    expect(res.body).toHaveProperty('success', true);
    expect(typeof res.body.message).toBe('string');
  });

  it('POST /api/specifications/reports returns report object', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/specifications/reports')
      .send({
        specificationId: 'spec-1',
        decisions: [ { changeId: 'c1', decision: 'accept' } ],
      })
      .expect(201);
    expect(res.body).toHaveProperty('report');
  });

  it('POST /api/specifications/validation-links returns token and url', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/specifications/validation-links')
      .send({ specificationId: 'spec-1' })
      .expect(201);
    expect(typeof res.body.token).toBe('string');
    expect(typeof res.body.url).toBe('string');
  });

  it('GET /api/specifications/validation?token= validates true for fresh token', async () => {
    const link = await request(app.getHttpServer())
      .post('/api/specifications/validation-links')
      .send({ specificationId: 'spec-1' });
    const token = link.body.token;
    const res = await request(app.getHttpServer())
      .get('/api/specifications/validation')
      .query({ token })
      .expect(200);
    expect(res.body).toHaveProperty('valid', true);
  });

  it('POST /api/specifications/analyses/share then GET shared analysis', async () => {
    const analysisId = 'analysis-123';
    await request(app.getHttpServer())
      .post('/api/specifications/analyses/share')
      .send({
        analysisId,
        oldSchemaName: 'old.json',
        newSchemaName: 'new.json',
        psmFileName: 'psm.json',
        changes: [],
        schema: '{}',
        decisions: [],
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/specifications/analyses/${analysisId}`)
      .expect(200);
    expect(res.body).toHaveProperty('analysisId', analysisId);
  });

  it('GET /api/specifications/psm returns content and name', async () => {
    const iri = 'http://example.com/psm/schema.json';
    const res = await request(app.getHttpServer())
      .get('/api/specifications/psm')
      .query({ iri })
      .expect(200);
    expect(res.body).toHaveProperty('content');
    expect(res.body).toHaveProperty('name', 'schema.json');
  });

  it('POST /api/specifications/psm returns content', async () => {
    const iri = 'http://example.com/psm/schema2.json';
    const res = await request(app.getHttpServer())
      .post('/api/specifications/psm')
      .send({ iri })
      .expect(201);
    expect(res.body).toHaveProperty('content');
    expect(res.body).toHaveProperty('name', 'schema2.json');
  });

  // ========== HTTP: Specification Dialog (multipart) ==========
  it('POST /api/specification-dialog/dialog processes files', async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .post('/api/specification-dialog/dialog')
      .attach('psmArtifact', Buffer.from('{"psm":true}'), 'psm.json')
      .attach('newApi', Buffer.from('{"openapi":"3.0.0"}'), 'new.json')
      .attach('oldApi', Buffer.from('{"openapi":"3.0.0"}'), 'old.json')
      .field('action', 'analyze')
      .field('artifactFormat', 'json')
      .expect(201);
    expect(res.body).toHaveProperty('id', 42);
    expect(typeof res.body.url).toBe('string');
  });

  it('POST /api/specification-dialog/dialog/difference processes diff', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/specification-dialog/dialog/difference')
      .attach('psmArtifact', Buffer.from('{"psm":true}'), 'psm.json')
      .attach('newApi', Buffer.from('{"openapi":"3.1.0"}'), 'new.json')
      .attach('oldApi', Buffer.from('{"openapi":"3.0.0"}'), 'old.json')
      .field('useOpenAi', 'false')
      .expect(201);
    expect(res.body).toHaveProperty('id', 43);
  });

  it('GET /api/specification-dialog/dialog/:id returns stored result', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/specification-dialog/dialog/99')
      .expect(200);
    expect(res.body).toHaveProperty('id', '99');
  });

  // ========== AMQP Controllers via TCP test microservice ==========
  it('AMQP changes.detected calls dialog service and returns ok', async () => {
    const payload = { dialogId: 'd1', changes: [] };
    const result = await new Promise((resolve, reject) => {
      microserviceClient.send('changes.detected', payload).subscribe({ next: resolve, error: reject });
    });
    expect(result).toHaveProperty('ok', true);
    expect((dialogServiceMock as any).integrateChanges).toHaveBeenCalledWith(payload);
  });

  it('AMQP suggestions.generated calls dialog service and returns ok', async () => {
    const payload = { dialogId: 'd1', suggestions: [] };
    const result = await new Promise((resolve, reject) => {
      microserviceClient.send('suggestions.generated', payload).subscribe({ next: resolve, error: reject });
    });
    expect(result).toHaveProperty('ok', true);
    expect((dialogServiceMock as any).saveSuggestions).toHaveBeenCalledWith(payload);
  });
});

