import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrivacyModule } from '../privacy/privacy.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { StaffGuard } from './staff.guard';

@Module({
  imports: [AuthModule, PrivacyModule],
  controllers: [AdminController],
  providers: [AdminService, StaffGuard],
  exports: [AdminService, StaffGuard],
})
export class AdminModule {}
