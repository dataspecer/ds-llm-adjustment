import { Test, TestingModule } from '@nestjs/testing';
import { SpecificationDialogController } from './specification-dialog.controller';

describe('SpecificationDialogController', () => {
  let controller: SpecificationDialogController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SpecificationDialogController],
    }).compile();

    controller = module.get<SpecificationDialogController>(SpecificationDialogController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
