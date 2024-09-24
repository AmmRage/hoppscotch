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
import { DateTime } from 'luxon';
import { GqlThrottlerGuard } from 'src/guards/gql-throttler.guard';
import { UserPasswordService } from './user-password.service';
import { PubSubService } from '../pubsub/pubsub.service';
import { GqlAuthGuard } from '../guards/gql-auth.guard';
import { GqlAdminGuard } from '../admin/guards/gql-admin.guard';
import { throwErr } from '../utils';
import { User } from '../user/user.model';
import { ChangePasswordResponse } from './user-password.model';

@Resolver(() => User)
@UseGuards(GqlThrottlerGuard)
export class UserPasswordResolver {
  constructor(
    private userPasswordService: UserPasswordService,
    private readonly pubsub: PubSubService,
  ) {}

  @Mutation(() => ChangePasswordResponse, {
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
  ): Promise<ChangePasswordResponse> {
    const changeResult = await this.userPasswordService.changePasswordByUserUid(
      userUID,
      newPassword,
      oldPassword,
    );
    const response = new ChangePasswordResponse();
    response.timeGenerated = DateTime.now().toLocal().toJSDate();
    // log
    if (E.isLeft(changeResult)) {
      response.isSuccess = false;
      response.messages = [changeResult.left];
    } else {
      response.isSuccess = changeResult.right;
      response.messages = ['Password changed successfully'];
    }
    return response;
  }
}
