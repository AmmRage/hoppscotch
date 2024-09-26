import { Module } from '@nestjs/common';
import { PubSubModule } from 'src/pubsub/pubsub.module';
import { UserPasswordService } from './user-password.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UserPasswordResolver } from './user-password.resolver';

@Module({
  imports: [PubSubModule, PrismaModule],
  providers: [UserPasswordService, UserPasswordResolver],
  exports: [UserPasswordService],
})
export class UserPasswordModule {}
