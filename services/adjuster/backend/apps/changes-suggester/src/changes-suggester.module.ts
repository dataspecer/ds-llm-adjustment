import { Module } from '@nestjs/common';
import { ChangesSuggesterService } from './changes-suggester.service';
import { ChangesSuggesterController } from './controllers/changes-suggester.controller';

@Module({
  imports: [],
  controllers: [ChangesSuggesterController],
  providers: [ChangesSuggesterService],
})
export class ChangesSuggesterModule {}
