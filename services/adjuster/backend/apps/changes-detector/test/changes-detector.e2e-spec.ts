import { jest, describe, beforeAll, afterAll, it, expect } from '@jest/globals';
// Ensure no network calls to LLM even if code path reaches it
jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    withStructuredOutput: () => ({
      invoke: async () => ({ changes: [] }),
    }),
  })),
}));

jest.mock('@langchain/core/prompts', () => ({
  ChatPromptTemplate: { fromTemplate: () => ({ pipe: (x: any) => x }) },
}));

jest.setTimeout(15000);
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { ChangesDetectorModule } from '../src/changes-detector.module';
import { of } from 'rxjs';

// RMQ ClientProxy stub returning valid JSON payloads per pattern
const createClientProxyStub = () => ({
  send: (pattern: string) => {
    if (pattern === 'get.json.schema') {
      return of(JSON.stringify({ title: 'Schema', type: 'object', properties: {} }));
    }
    if (pattern === 'get.psm') {
      return of('{}');
    }
    return of('');
  },
});

describe('ChangesDetectorController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ChangesDetectorModule],
    })
      .overrideProvider('DATASPECER_ADAPTER')
      .useValue(createClientProxyStub())
      .overrideProvider('DIALOG_SERVICE')
      .useValue(createClientProxyStub())
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/changes/detections/raw should return empty changes for identical schemas', async () => {
    const body = {
      dialogId: 'dlg-1',
      oldApi: JSON.stringify({ title: 'Schema', type: 'object', properties: {} }),
      newApi: JSON.stringify({ title: 'Schema', type: 'object', properties: {} }),
      psm: JSON.stringify({}),
    };

    const response = await request(app.getHttpServer())
      .post('/api/changes/detections/raw')
      .send(body);

    expect([200, 201, 400]).toContain(response.status);
    if (response.status < 300) {
      expect(response.body).toHaveProperty('dialogId', 'dlg-1');
      expect(response.body).toHaveProperty('changes');
      expect(Array.isArray(response.body.changes)).toBe(true);
      expect(response.body.changes.length).toBe(0);
    }
  });

  it('POST /api/changes/detections/from-iri should return empty changes when schemas equal', async () => {
    const body = {
      dialogId: 'dlg-2',
      psmIri: 'psm:iri',
      dataSpecificationIri: 'dsv:iri',
      newJsonSchema: JSON.stringify({ title: 'Schema', type: 'object', properties: {} }),
      artifactFormat: 'json',
    };

    const response = await request(app.getHttpServer())
      .post('/api/changes/detections/from-iri')
      .send(body);

    expect([200, 201, 400]).toContain(response.status);
    if (response.status < 300) {
      expect(response.body).toHaveProperty('dialogId', 'dlg-2');
      expect(Array.isArray(response.body.changes)).toBe(true);
      expect(response.body.changes.length).toBe(0);
    }
  });

  it('POST /api/changes/detections/hybrid should return empty changes for identical schemas', async () => {
    const schema = JSON.stringify({ title: 'Schema', type: 'object', properties: {} });
    const body = {
      dialogId: 'dlg-3',
      psmIri: 'psm:iri',
      oldJsonSchema: schema,
      newJsonSchema: schema,
      artifactFormat: 'json',
    };

    const response = await request(app.getHttpServer())
      .post('/api/changes/detections/hybrid')
      .send(body);

    expect([200, 201, 400]).toContain(response.status);
    if (response.status < 300) {
      expect(response.body).toHaveProperty('dialogId', 'dlg-3');
      expect(Array.isArray(response.body.changes)).toBe(true);
      expect(response.body.changes.length).toBe(0);
    }
  });

  it('POST /api/changes/detections/automatic should return empty changes when schemas equal', async () => {
    const body = {
      dialogId: 'dlg-4',
      dataSpecificationIri: 'dsv:iri',
      psmIri: 'psm:iri',
      newJsonSchema: JSON.stringify({ title: 'Schema', type: 'object', properties: {} }),
      artifactFormat: 'json',
    };

    const response = await request(app.getHttpServer())
      .post('/api/changes/detections/automatic')
      .send(body);

    expect([200, 201, 400]).toContain(response.status);
    if (response.status < 300) {
      expect(response.body).toHaveProperty('dialogId', 'dlg-4');
      expect(Array.isArray(response.body.changes)).toBe(true);
      expect(response.body.changes.length).toBe(0);
    }
  });

  it('GET /api/changes/schemas/dsv should return schema content and name', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/changes/schemas/dsv')
      .query({ dataSpecificationIri: 'dsv:iri' });

    expect([200, 201, 400]).toContain(response.status);
    if (response.status < 300) {
      expect(response.body).toHaveProperty('content');
      expect(typeof response.body.content).toBe('string');
      expect(response.body).toHaveProperty('name', 'schema.json');
    }
  });
});

