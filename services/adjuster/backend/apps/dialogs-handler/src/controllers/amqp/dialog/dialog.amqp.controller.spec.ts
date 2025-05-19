import { Test, TestingModule } from '@nestjs/testing';
import { DialogAmqpController } from './dialog.amqp.controller';

describe('DialogAmqpController', () => {
  let controller: DialogAmqpController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DialogAmqpController],
    }).compile();

    controller = module.get<DialogAmqpController>(DialogAmqpController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
