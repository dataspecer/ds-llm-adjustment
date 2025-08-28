import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { jest, describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import * as request from 'supertest';
import { ChangesSuggesterModule } from '../src/changes-suggester.module';
import { of } from 'rxjs';

// Dynamic mock return for LLM suggestions
let mockedLlMSuggestions: Array<{ changeId: string; suggestion: string; rationale?: string }> = [
  { changeId: 'c1', suggestion: 'Keep as is', rationale: 'No impact' },
];

// Mock langchain OpenAI to avoid network
jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    withStructuredOutput: () => ({
      invoke: async () => ({ suggestions: mockedLlMSuggestions }),
    }),
  })),
}));

jest.mock('@langchain/core/prompts', () => ({
  ChatPromptTemplate: { fromTemplate: () => ({ pipe: (x: any) => x }) },
}));

// Mock PROMPTS config to avoid undefined access in service
jest.mock('@app/common/config/prompts', () => ({
  PROMPTS: {
    changesSuggester: {
      suggestionsTemplate: 'You are a helpful assistant. Generate suggestions.',
    },
  },
}));

describe('ChangesSuggesterController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ChangesSuggesterModule],
    })
      .overrideProvider('DIALOG_SERVICE')
      .useValue({ send: () => of('') })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/suggestions returns mocked suggestions', async () => {
    const body = {
      dialogId: 'dlg-2',
      changes: [
        { changeId: 'c1', type: ['addition'], path: '$.a', description: 'Add', isAcceptable: true },
      ],
      psm: '{}',
    };

    const response = await request(app.getHttpServer())
      .post('/api/suggestions')
      .send(body)
      .expect(201);

    expect(response.body).toHaveProperty('dialogId', 'dlg-2');
    expect(Array.isArray(response.body.suggestions)).toBe(true);
    expect(response.body.suggestions[0].changeId).toBe('c1');
  });

  it('POST /api/suggestions returns empty suggestions when model returns none', async () => {
    mockedLlMSuggestions = [];
    const body = {
      dialogId: 'dlg-empty',
      changes: [
        { changeId: 'c2', type: ['removal'], path: '$.b', description: 'Remove', isAcceptable: false },
      ],
      psm: '{}',
    };

    const response = await request(app.getHttpServer())
      .post('/api/suggestions')
      .send(body)
      .expect(201);

    expect(response.body).toHaveProperty('dialogId', 'dlg-empty');
    expect(Array.isArray(response.body.suggestions)).toBe(true);
    expect(response.body.suggestions.length).toBe(0);
  });

  it('POST /api/suggestions returns multiple suggestions', async () => {
    mockedLlMSuggestions = [
      { changeId: 'c10', suggestion: 'Rename field' },
      { changeId: 'c11', suggestion: 'Add description', rationale: 'Improves clarity' },
    ];

    const body = {
      dialogId: 'dlg-multi',
      changes: [
        { changeId: 'c10', type: ['modification'], path: '$.user.name', description: 'Rename', isAcceptable: true },
        { changeId: 'c11', type: ['addition'], path: '$.user.bio', description: 'Add bio', isAcceptable: true },
      ],
      psm: '{"user": {"name": "John"}}',
    };

    const response = await request(app.getHttpServer())
      .post('/api/suggestions')
      .send(body)
      .expect(201);

    expect(response.body.dialogId).toBe('dlg-multi');
    expect(response.body.suggestions).toHaveLength(2);
    expect(response.body.suggestions.map((s: any) => s.changeId)).toEqual(['c10', 'c11']);
  });

  it('POST /api/suggestions responds 500 when model throws', async () => {
    // Temporarily mock to throw
    const OpenAI = (await import('@langchain/openai')) as any;
    (OpenAI.ChatOpenAI as jest.Mock).mockImplementationOnce(() => ({
      withStructuredOutput: () => ({
        invoke: async () => { throw new Error('Upstream failure'); },
      }),
    }));

    const body = {
      dialogId: 'dlg-err',
      changes: [
        { changeId: 'cX', type: ['addition'], path: '$.x', description: 'X', isAcceptable: true },
      ],
      psm: '{}',
    };

    await request(app.getHttpServer())
      .post('/api/suggestions')
      .send(body)
      .expect(500);
  });
});

