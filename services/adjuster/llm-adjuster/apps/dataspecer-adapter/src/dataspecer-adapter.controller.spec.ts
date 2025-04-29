import { Test, TestingModule } from '@nestjs/testing';
import { DataspecerAdapterController } from './dataspecer-adapter.controller';
import { DataspecerAdapterService } from './dataspecer-adapter.service';

describe('DataspecerAdapterController', () => {
  let dataspecerAdapterController: DataspecerAdapterController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [DataspecerAdapterController],
      providers: [DataspecerAdapterService],
    }).compile();

    dataspecerAdapterController = app.get<DataspecerAdapterController>(DataspecerAdapterController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(dataspecerAdapterController.getHello()).toBe('Hello World!');
    });
  });
});
