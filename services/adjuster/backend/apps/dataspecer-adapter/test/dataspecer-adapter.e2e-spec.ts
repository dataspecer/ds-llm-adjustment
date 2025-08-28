import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { DataspecerAdapterModule } from '../src/dataspecer-adapter.module';
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { ClientProxyFactory, Transport, ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import axios from 'axios';

jest.mock('axios');

describe('DataspecerAdapter (e2e)', () => {
  let app: INestApplication;
  let client: ClientProxy;
  const tcpPort = 48777;

  // Mock RMQ client injected as 'DIALOG_SERVICE' to capture emits
  const mockDialogClient = { emit: jest.fn() } as unknown as ClientProxy;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [DataspecerAdapterModule],
    })
      .overrideProvider('DIALOG_SERVICE')
      .useValue(mockDialogClient)
      .compile();

    app = moduleFixture.createNestApplication();
    app.connectMicroservice({ transport: Transport.TCP, options: { host: '127.0.0.1', port: tcpPort } });
    await app.startAllMicroservices();
    await app.init();

    client = ClientProxyFactory.create({ transport: Transport.TCP, options: { host: '127.0.0.1', port: tcpPort } });
  });

  afterAll(async () => {
    jest.clearAllMocks();
    if (client) {
      await client.close();
    }
    await app.close();
  });

  it('GET / should return hello string', async () => {
    const response = await request(app.getHttpServer()).get('/').expect(200);
    expect(typeof response.text).toBe('string');
  });

  it('AMQP get.psm should return PSM JSON string', async () => {
    const mockedAxios = axios as jest.Mocked<typeof axios>;
    mockedAxios.get.mockResolvedValueOnce({
      status: 200,
      statusText: 'OK',
      data: JSON.stringify({ some: 'psm' }),
    } as any);

    const payload = { dataspecerBaseUrl: 'http://dataspecer.local', iri: 'http://example.com/psm' };
    const result = await firstValueFrom(client.send<string>('get.psm', payload));
    expect(typeof result).toBe('string');
    expect(() => JSON.parse(result)).not.toThrow();
    const parsed = JSON.parse(result);
    expect(parsed).toEqual({ some: 'psm' });
  });

  it('AMQP get.json.schema should prefer DSV metadata flow', async () => {
    const mockedAxios = axios as jest.Mocked<typeof axios>;
    const htmlWithMetadata = `<!doctype html><html><head></head><body>
      <script type="application/ld+json">${JSON.stringify({
        inSpecificationOf: [
          {
            '@type': ['dsv:ApplicationProfile'],
            hasResource: [
              {
                conformsTo: 'https://json-schema.org/draft/2020-12/schema',
                hasArtifact: 'http://dataspecer.local/schema.json',
              },
            ],
          },
        ],
      })}</script>
    </body></html>`;

    mockedAxios.get
      // First call: HTML preview page
      .mockResolvedValueOnce({ status: 200, statusText: 'OK', data: htmlWithMetadata } as any)
      // Second call: JSON schema at hasArtifact URL
      .mockResolvedValueOnce({ status: 200, statusText: 'OK', data: '{"type":"object"}' } as any);

    const payload = { dataspecerBaseUrl: 'http://dataspecer.local', dataSpecificationIri: 'http://example.com/ds', psmIri: undefined };
    const result = await firstValueFrom(client.send<string>('get.json.schema', payload));
    expect(result).toContain('object');
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('AMQP get.json.schema should fallback to old schema endpoint on error', async () => {
    const mockedAxios = axios as jest.Mocked<typeof axios>;
    // Force DSV path to throw by returning 500 for HTML fetch
    mockedAxios.get
      .mockResolvedValueOnce({ status: 500, statusText: 'ERR', data: 'fail' } as any)
      // Fallback old endpoint
      .mockResolvedValueOnce({ status: 200, statusText: 'OK', data: '{"type":"string"}' } as any);

    const payload = { dataspecerBaseUrl: 'http://dataspecer.local', dataSpecificationIri: 'http://example.com/ds', psmIri: 'http://example.com/psm' };
    const result = await firstValueFrom(client.send<string>('get.json.schema', payload));
    expect(result).toContain('string');
  });

  it('AMQP get.dataspecer.zip should return buffer and emit event', async () => {
    const mockedAxios = axios as jest.Mocked<typeof axios>;
    const buf = Buffer.from([1, 2, 3]);
    mockedAxios.get.mockResolvedValueOnce({ data: buf } as any);

    const payload = { dataspecerBaseUrl: 'http://dataspecer.local', iri: 'http://example.com/iri' };
    const result = await firstValueFrom(client.send<any>('get.dataspecer.zip', payload));
    const normalized = Buffer.isBuffer(result)
      ? result
      : Buffer.from((result && result.data) ? result.data : result);
    expect(Buffer.isBuffer(normalized)).toBe(true);
    expect(normalized.equals(buf)).toBe(true);
    expect((mockDialogClient as any).emit).toHaveBeenCalled();
    const emittedCall = (mockDialogClient as any).emit.mock.calls.find((c: any[]) => c[0] === 'dataspecer.zip.exported');
    expect(emittedCall).toBeTruthy();
    const emittedPayload = emittedCall[1];
    expect(Buffer.isBuffer(emittedPayload)).toBe(true);
    expect(emittedPayload.equals(buf)).toBe(true);
  });
});

