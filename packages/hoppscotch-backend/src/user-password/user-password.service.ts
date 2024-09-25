import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DateTime } from 'luxon';
import * as _ from 'lodash';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import * as TO from 'fp-ts/TaskOption';
import * as TE from 'fp-ts/TaskEither';
import * as T from 'fp-ts/Task';
import * as A from 'fp-ts/Array';
import { pipe, constVoid } from 'fp-ts/function';
import { AuthUser } from 'src/types/AuthUser';

import { PubSubService } from 'src/pubsub/pubsub.service';

@Injectable()
export class UserPasswordService {
  private myLogger = new Logger('UserPasswordService');

  constructor(
    private prisma: PrismaService,
    private readonly pubsub: PubSubService,
  ) {}

  /**
   * Find User with given email id
   *
   * @param email User's email
   * @param password User's password
   * @param token User's token supposed to share via email
   * @param userUid
   * @returns Option of found User
   */
  async upsertPasswordToken(
    email: string,
    password: string,
    token: string,
    userUid: string,
  ): Promise<O.None | O.Some<boolean>> {
    const createdAt = DateTime.now().toLocal().toJSDate();
    const updatedAt = DateTime.now().toLocal().toJSDate();
    const user = await this.prisma.userPasswordViaEmailToken.upsert({
      where: { email },
      create: { email, password, token, userUid, createdAt, updatedAt },
      update: { token, password, userUid, updatedAt },
    });

    return user ? O.some(true) : O.none;
  }

  /**
   * update User's password
   *
   * @param email User's email
   * @param password User's password
   * @returns Option of found User
   */
  async changePasswordByEmail(
    email: string,
    password: string,
  ): Promise<O.None | O.Some<boolean>> {
    const user = await this.prisma.userPasswordViaEmailToken.update({
      where: { email },
      data: { password },
    });

    return user ? O.some(true) : O.none;
  }

  /**
   * update User's password by id
   *
   * @param userUid User's id
   * @param newPassword
   * @param oldPassword
   * @returns Option of found User
   */
  async changePasswordByUserUid(
    userUid: string,
    newPassword: string,
    oldPassword: string,
  ): Promise<E.Right<boolean> | E.Left<string>> {
    if (_.isEmpty(newPassword) || _.isEmpty(oldPassword)) {
      return E.left('Password cannot be empty');
    }

    if (newPassword === oldPassword) {
      return E.left('New password cannot be same as old password');
    }

    if (newPassword.length < 6) {
      return E.left('Password must be at least 6 characters long');
    }

    if (newPassword.length > 16) {
      return E.left('Password must be at most 16 characters long');
    }

    if (newPassword.includes(' ')) {
      return E.left('Password cannot contain spaces');
    }

    const user = await this.prisma.userPasswordViaEmailToken.findUnique({
      where: { userUid: userUid },
    });

    if (!user) {
      return E.left('User not found');
    }

    if (user?.password !== oldPassword) {
      this.myLogger.error(
        `Old password ${oldPassword}, user password ${user?.password}`,
      );
      return E.left('Old password is incorrect');
    }

    const updatedResult = await this.prisma.userPasswordViaEmailToken.update({
      where: { userUid },
      data: { password: newPassword },
    });

    if (updatedResult) {
      return E.right(true);
    }
  }

  /**
   * clear User's token
   *
   * @param email User's email
   * @returns Option of found User
   */
  async clearToken(email: string): Promise<O.None | O.Some<boolean>> {
    const user = await this.prisma.userPasswordViaEmailToken.update({
      where: { email },
      data: { token: '' },
    });

    return user ? O.some(true) : O.none;
  }

  async verifyPasswordAndToken(
    email: string,
    password: string,
    token: string,
  ): Promise<O.None | O.Some<boolean>> {
    const user = await this.prisma.userPasswordViaEmailToken.findUnique({
      where: { email },
    });

    return user?.password === password && user?.token === token
      ? O.some(true)
      : O.none;
  }

  async verifyUsernameAndPassword(
    email: string,
    password: string,
  ): Promise<O.None | O.Some<boolean>> {
    const user = await this.prisma.userPasswordViaEmailToken.findUnique({
      where: { email },
    });

    return user?.password === password ? O.some(true) : O.none;
  }
}
