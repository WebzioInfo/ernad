import { Module, Global } from '@nestjs/common';
import { EditHistoryService } from './edit-history.service';
import { EditHistoryController } from './edit-history.controller';

@Global()
@Module({
  controllers: [EditHistoryController],
  providers: [EditHistoryService],
  exports: [EditHistoryService],
})
export class EditHistoryModule {}
