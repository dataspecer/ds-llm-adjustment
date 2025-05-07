import { Test, TestingModule } from '@nestjs/testing';
import { SpecificationProcessorService } from './specification-processor.service';

describe('SpecificationProcessorService', () => {
  let service: SpecificationProcessorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SpecificationProcessorService],
    }).compile();

    service = module.get<SpecificationProcessorService>(SpecificationProcessorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
