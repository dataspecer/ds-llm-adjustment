import { Test, TestingModule } from '@nestjs/testing';
import { ChangesDetectorController } from './changes-detector.controller';
import { ChangesDetectorService } from './changes-detector.service';

describe('ChangesDetectorController', () => {
  let changesDetectorController: ChangesDetectorController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ChangesDetectorController],
      providers: [ChangesDetectorService],
    }).compile();

    changesDetectorController = app.get<ChangesDetectorController>(ChangesDetectorController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(changesDetectorController.getHello()).toBe('Hello World!');
    });
  });
});
