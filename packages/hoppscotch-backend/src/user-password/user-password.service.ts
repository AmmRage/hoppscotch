import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
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
   * @returns Option of found User
   */
  async upsertPasswordToken(
    email: string,
    token: string,
    password: string,
  ): Promise<O.None | O.Some<boolean>> {
    const user = await this.prisma.userPasswordViaEmailToken.upsert({
      where: { email },
      create: { email, token, password },
      update: { token, password },
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
  async changePassword(
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
}
