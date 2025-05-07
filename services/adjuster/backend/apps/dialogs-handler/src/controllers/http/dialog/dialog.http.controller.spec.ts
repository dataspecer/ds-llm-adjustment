import { Test, TestingModule } from '@nestjs/testing';
import { DialogHttpController } from './dialog.http.controller';

describe('DialogHttpController', () => {
  let controller: DialogHttpController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DialogHttpController],
    }).compile();

    controller = module.get<DialogHttpController>(DialogHttpController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
