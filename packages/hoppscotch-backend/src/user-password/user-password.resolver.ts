import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
  Subscription,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import * as E from 'fp-ts/Either';

import { GqlThrottlerGuard } from 'src/guards/gql-throttler.guard';
import { UserPasswordService } from './user-password.service';
import { PubSubService } from '../pubsub/pubsub.service';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { GqlAdminGuard } from '../admin/guards/gql-admin.guard';
import { throwErr } from '../utils';
import { User } from '../user/user.model';

@Resolver(() => User)
@UseGuards(GqlThrottlerGuard)
export class UserPasswordResolver {
  constructor(
    private userPasswordService: UserPasswordService,
    private readonly pubsub: PubSubService,
  ) {}

  @Mutation(() => Boolean, {
    description: 'Change user password',
  })
  @UseGuards(GqlAuthGuard)
  async changeUserPassword(
    @Args({
      name: 'userUID',
      description: 'users UID',
      type: () => ID,
    })
    userUID: string,
    @Args({
      name: 'newPassword',
      description: 'users new password',
    })
    newPassword: string,
    @Args({
      name: 'oldPassword',
      description: 'users old password',
    })
    oldPassword: string,
  ): Promise<boolean> {
    const changeResult = await this.userPasswordService.changePasswordByUserUid(
      userUID,
      newPassword,
      oldPassword,
    );
    // log
    return changeResult;
  }
}
