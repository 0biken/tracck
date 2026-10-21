import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MeController } from './me.controller';
import { MeService } from './me.service';

/** The signed-in person: profile, preferences, home counts, notifications, who has access. */
@Module({
  imports: [AuthModule],
  controllers: [MeController],
  providers: [MeService],
  exports: [MeService],
})
export class MeModule {}
