import { Module } from '@nestjs/common';
import { PubSubModule } from 'src/pubsub/pubsub.module';
import { UserPasswordService } from './user-password.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PubSubModule, PrismaModule],
  providers: [UserPasswordService],
  exports: [UserPasswordService],
})
export class UserPasswordModule {}
