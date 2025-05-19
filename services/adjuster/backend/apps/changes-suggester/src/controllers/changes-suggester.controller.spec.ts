import { Test, TestingModule } from '@nestjs/testing';
import { ChangesSuggesterController } from './changes-suggester.controller';
import { ChangesSuggesterService } from './changes-suggester.service';

describe('ChangesSuggesterController', () => {
  let changesSuggesterController: ChangesSuggesterController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ChangesSuggesterController],
      providers: [ChangesSuggesterService],
    }).compile();

    changesSuggesterController = app.get<ChangesSuggesterController>(ChangesSuggesterController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(changesSuggesterController.getHello()).toBe('Hello World!');
    });
  });
});
