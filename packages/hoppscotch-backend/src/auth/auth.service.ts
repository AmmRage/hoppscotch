import { HttpStatus, Injectable } from '@nestjs/common';
import { MailerService } from 'src/mailer/mailer.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { UserPasswordService } from 'src/user-password/user-password.service';
import { VerifyMagicDto } from './dto/verify-magic.dto';
import { DateTime } from 'luxon';
import * as argon2 from 'argon2';
import * as bcrypt from 'bcrypt';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import { DeviceIdentifierToken } from 'src/types/Passwordless';
import {
  INVALID_EMAIL,
  INVALID_MAGIC_LINK_DATA,
  VERIFICATION_TOKEN_DATA_NOT_FOUND,
  MAGIC_LINK_EXPIRED,
  USER_NOT_FOUND,
  INVALID_REFRESH_TOKEN,
  USER_ALREADY_INVITED,
} from 'src/errors';
import { validateEmail } from 'src/utils';
import {
  AccessTokenPayload,
  AuthTokens,
  RefreshTokenPayload,
} from 'src/types/AuthTokens';
import { JwtService } from '@nestjs/jwt';
import { RESTError } from 'src/types/RESTError';
import { AuthUser, IsAdmin } from 'src/types/AuthUser';
import { VerificationToken } from '@prisma/client';
import { Origin } from './helper';
import { ConfigService } from '@nestjs/config';
import { InfraConfigService } from 'src/infra-config/infra-config.service';
import { Logger } from '@nestjs/common';
import { VerifyPasswordDto } from './dto/verify-password.dto';

@Injectable()
export class AuthService {
  private myLogger = new Logger('AuthService');

  constructor(
    private usersService: UserService,
    private prismaService: PrismaService,
    private userPasswordService: UserPasswordService,
    private jwtService: JwtService,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    private infraConfigService: InfraConfigService,
  ) {}

  /**
   * Generate Id and token for email Magic-Link auth
   *
   * @param user User Object
   * @returns Created VerificationToken token
   */
  private async generateMagicLinkTokens(user: AuthUser) {
    const salt = await bcrypt.genSalt(
      parseInt(this.configService.get('TOKEN_SALT_COMPLEXITY')),
    );
    const now = DateTime.now();
    // this.myLogger.debug(`now: ${now}`);

    const expiresOn = now
      .plus({
        hours: parseInt(this.configService.get('MAGIC_LINK_TOKEN_VALIDITY')),
      })
      .toISO();
    // this.myLogger.debug(`expiresOn: ${expiresOn}`);

    const idToken = await this.prismaService.verificationToken.create({
      data: {
        deviceIdentifier: salt,
        userUid: user.uid,
        expiresOn: expiresOn,
      },
    });

    return idToken;
  }

  /**
   * Check if VerificationToken exist or not
   *
   * @param magicLinkTokens Object containing deviceIdentifier and token
   * @returns Option of VerificationToken token
   */
  private async validatePasswordlessTokens(magicLinkTokens: VerifyMagicDto) {
    try {
      const tokens =
        await this.prismaService.verificationToken.findUniqueOrThrow({
          where: {
            passwordless_deviceIdentifier_tokens: {
              deviceIdentifier: magicLinkTokens.deviceIdentifier,
              token: magicLinkTokens.token,
            },
          },
        });
      return O.some(tokens);
    } catch (error) {
      return O.none;
    }
  }

  /**
   * Generate new refresh token for user
   *
   * @param userUid User Id
   * @returns Generated refreshToken
   */
  private async generateRefreshToken(userUid: string) {
    const refreshTokenPayload: RefreshTokenPayload = {
      iss: this.configService.get('VITE_BASE_URL'),
      sub: userUid,
      aud: [this.configService.get('VITE_BASE_URL')],
    };

    const refreshToken = await this.jwtService.sign(refreshTokenPayload, {
      expiresIn: this.configService.get('REFRESH_TOKEN_VALIDITY'), //7 Days
    });

    const refreshTokenHash = await argon2.hash(refreshToken);

    const updatedUser = await this.usersService.updateUserRefreshToken(
      refreshTokenHash,
      userUid,
    );
    if (E.isLeft(updatedUser))
      return E.left(<RESTError>{
        message: updatedUser.left,
        statusCode: HttpStatus.NOT_FOUND,
      });

    return E.right(refreshToken);
  }

  /**
   * Generate access and refresh token pair
   *
   * @param userUid User ID
   * @returns Either of generated AuthTokens
   */
  async generateAuthTokens(userUid: string) {
    const accessTokenPayload: AccessTokenPayload = {
      iss: this.configService.get('VITE_BASE_URL'),
      sub: userUid,
      aud: [this.configService.get('VITE_BASE_URL')],
    };

    const refreshToken = await this.generateRefreshToken(userUid);
    if (E.isLeft(refreshToken)) return E.left(refreshToken.left);

    return E.right(<AuthTokens>{
      access_token: await this.jwtService.sign(accessTokenPayload, {
        expiresIn: this.configService.get('ACCESS_TOKEN_VALIDITY'), //1 Day
      }),
      refresh_token: refreshToken.right,
    });
  }

  /**
   * Deleted used VerificationToken tokens
   *
   * @param passwordlessTokens VerificationToken entry to delete from DB
   * @returns Either of deleted VerificationToken token
   */
  private async deleteMagicLinkVerificationTokens(
    passwordlessTokens: VerificationToken,
  ) {
    try {
      const deletedPasswordlessToken =
        await this.prismaService.verificationToken.delete({
          where: {
            passwordless_deviceIdentifier_tokens: {
              deviceIdentifier: passwordlessTokens.deviceIdentifier,
              token: passwordlessTokens.token,
            },
          },
        });
      return E.right(deletedPasswordlessToken);
    } catch (error) {
      return E.left(VERIFICATION_TOKEN_DATA_NOT_FOUND);
    }
  }

  /**
   * Verify if Provider account exists for User
   *
   * @param user User Object
   * @param SSOUserData User data from SSO providers (Magic,Google,Github,Microsoft)
   * @returns Either of existing user provider Account
   */
  async checkIfProviderAccountExists(user: AuthUser, SSOUserData) {
    const provider = await this.prismaService.account.findUnique({
      where: {
        verifyProviderAccount: {
          provider: SSOUserData.provider,
          providerAccountId: SSOUserData.id,
        },
      },
    });

    if (!provider) return O.none;

    return O.some(provider);
  }

  /**
   * Create User (if not already present) and send email to initiate Magic-Link auth
   *
   * @param email User's email
   * @returns Either containing DeviceIdentifierToken
   */
  async signInMagicLink(email: string, origin: string) {
    if (!validateEmail(email))
      return E.left({
        message: INVALID_EMAIL,
        statusCode: HttpStatus.BAD_REQUEST,
      });

    let user: AuthUser;
    const queriedUser = await this.usersService.findUserByEmail(email);

    if (O.isNone(queriedUser)) {
      user = await this.usersService.createUserViaMagicLink(email);
    } else {
      user = queriedUser.value;
    }

    const generatedTokens = await this.generateMagicLinkTokens(user);

    // check to see if origin is valid
    let url: string;
    switch (origin) {
      case Origin.ADMIN:
        url = this.configService.get('VITE_ADMIN_URL');
        break;
      case Origin.APP:
        url = this.configService.get('VITE_BASE_URL');
        break;
      default:
        // if origin is invalid by default set URL to Hoppscotch-App
        url = this.configService.get('VITE_BASE_URL');
    }
    const generatedMagicLink = `${url}/enter?token=${generatedTokens.token}`;
    this.myLogger.debug(``);
    this.myLogger.debug(``);
    this.myLogger.debug(`Magic Link: ${generatedMagicLink}`);
    this.myLogger.debug(
      `Device Identifier: ${generatedTokens.deviceIdentifier}`,
    );
    try {
      await this.mailerService.sendEmail(email, {
        template: 'user-invitation',
        variables: {
          inviteeEmail: email,
          magicLink: generatedMagicLink,
        },
      });
    } catch (error) {
      this.myLogger.error(`Error sending Magic Link to ${email}`);
      const userCount = await this.usersService.getUsersCount();
      if (userCount === 0) {
        this.myLogger.debug(`userCount: ${userCount}`);
        this.myLogger.debug(`if userCount === 0, return E.right`);
        return E.right(<DeviceIdentifierToken>{
          deviceIdentifier: generatedTokens.deviceIdentifier,
        });
      }
    }
    // this.myLogger.debug(`Magic Link sent to ${email}`);
    return E.right(<DeviceIdentifierToken>{
      deviceIdentifier: generatedTokens.deviceIdentifier,
    });
  }

  async IsUserInvited(email: string): Promise<boolean> {
    let isUserInvited = false;
    const alreadyInvitedUser = await this.prismaService.invitedUsers.findFirst({
      where: {
        inviteeEmail: {
          equals: email,
          mode: 'insensitive',
        },
      },
    });
    if (alreadyInvitedUser != null) isUserInvited = true;
    else isUserInvited = false;
    if (isUserInvited) {
      return true;
    } else {
      return false;
    }
  }

  /**
   * register user if no user is present, else login user
   * @param email
   * @param password
   * @param origin
   */
  async registerOrLogin(
    email: string,
    password: string,
    origin: string,
  ): Promise<E.Right<[AuthTokens, string]> | E.Left<RESTError>> {
    const existingUserCount = await this.usersService.getUsersCount();
    const user = await this.usersService.findUserByEmail(email);

    const isUserRegistered = !O.isNone(user);
    const isUserInvited = await this.IsUserInvited(email);
    this.myLogger.debug(
      `email: ${email}, password: ${password}, isUserInvited: ${isUserInvited}, isUserRegistered: ${isUserRegistered}, existingUserCount: ${existingUserCount}`,
    );
    if (isUserRegistered) {
      return await this.adminVerifyUserByEmailPassword(email, password);
    } else if (existingUserCount > 0 && !isUserInvited) {
      return E.right([null, 'not-invited']);
    } else if (existingUserCount === 0 || isUserInvited) {
      // if user is invited or no user is present in the system then register user
      return await this.registerUserWithMagicLink(email, password, origin);
    }
  }

  /**
   * Create User (if not already present) and verify it automatically
   *
   * @param email User's email
   * @param password User's password
   * @param origin origin
   * @returns Either containing DeviceIdentifierToken
   */
  async registerUserWithMagicLink(
    email: string,
    password: string,
    origin: string,
  ): Promise<E.Right<[AuthTokens, string]> | E.Left<RESTError>> {
    if (!validateEmail(email))
      return E.left({
        message: INVALID_EMAIL,
        statusCode: HttpStatus.BAD_REQUEST,
      });

    this.myLogger.log(
      `auth.service registerUserWithMagicLink: ${email}, ${password}, ${origin}`,
    );

    const isUserInvited = this.IsUserInvited(email);
    // make sure only one user is registered
    const existingUserCount = await this.usersService.getUsersCount();
    if (existingUserCount > 0 && !isUserInvited) {
      return E.left({
        message: 'Not allowed to register new user',
        statusCode: HttpStatus.FORBIDDEN,
      });
    }
    this.myLogger.log(
      `auth.service registerUserWithMagicLink: existingUserCount: ${existingUserCount}`,
    );

    // step 1: create user and token
    let user: AuthUser;
    const queriedUser = await this.usersService.findUserByEmail(email);

    if (O.isNone(queriedUser)) {
      user = await this.usersService.createUserViaMagicLink(email);
    } else {
      user = queriedUser.value;
    }
    this.myLogger.log(
      `auth.service registerUserWithMagicLink: user: ${JSON.stringify(user)}`,
    );
    const generatedTokens = await this.generateMagicLinkTokens(user);
    this.myLogger.log(
      `auth.service registerUserWithMagicLink: generatedTokens: ${JSON.stringify(
        generatedTokens,
      )}`,
    );
    // check to see if origin is valid
    let url: string;
    switch (origin) {
      case Origin.ADMIN:
        url = this.configService.get('VITE_ADMIN_URL');
        break;
      case Origin.APP:
        url = this.configService.get('VITE_BASE_URL');
        break;
      default:
        // if origin is invalid by default set URL to Hoppscotch-App
        url = this.configService.get('VITE_BASE_URL');
    }
    const generatedMagicLink = `${url}/enter?token=${generatedTokens.token}`;
    this.myLogger.debug(``);
    this.myLogger.debug(``);
    this.myLogger.debug(`Magic Link: ${generatedMagicLink}`);
    this.myLogger.debug(
      `Device Identifier: ${generatedTokens.deviceIdentifier}`,
    );
    try {
      //save token to UserPasswordViaEmailToken table instead of sending email
      // await this.mailerService.sendEmail(email, {
      //   template: 'user-invitation',
      //   variables: {
      //     inviteeEmail: email,
      //     magicLink: generatedMagicLink,
      //   },
      // });
      const result = await this.userPasswordService.upsertPasswordToken(
        email,
        password,
        generatedTokens.token,
        user.uid,
      );
      this.myLogger.debug(
        `userPasswordService result: ${JSON.stringify(result)}`,
      );
    } catch (error) {
      return E.left({
        message: `Error saving token: ${error}`,
        statusCode: 500,
      });
    }
    // this.myLogger.debug(`Magic Link sent to ${email}`);
    // return E.right(<DeviceIdentifierToken>{
    //   deviceIdentifier: generatedTokens.deviceIdentifier,
    // });

    // step 2: verify token
    const magicLinkIDTokens = new VerifyMagicDto();
    magicLinkIDTokens.deviceIdentifier = generatedTokens.deviceIdentifier;
    magicLinkIDTokens.token = generatedTokens.token;
    const passwordlessTokens = await this.validatePasswordlessTokens(
      magicLinkIDTokens,
    );
    if (O.isNone(passwordlessTokens))
      return E.left({
        message: INVALID_MAGIC_LINK_DATA,
        statusCode: HttpStatus.NOT_FOUND,
      });
    const foundUser = await this.usersService.findUserById(
      passwordlessTokens.value.userUid,
    );
    if (O.isNone(foundUser))
      return E.left({
        message: USER_NOT_FOUND,
        statusCode: HttpStatus.NOT_FOUND,
      });

    /**
     * * Check to see if entry for Magic-Link is present in the Account table for user
     * * If user was created with another provider findUserById may return true
     */
    const profile = {
      provider: 'magic',
      id: foundUser.value.email,
    };
    const providerAccountExists = await this.checkIfProviderAccountExists(
      foundUser.value,
      profile,
    );

    if (O.isNone(providerAccountExists)) {
      await this.usersService.createProviderAccount(
        foundUser.value,
        null,
        null,
        profile,
      );
    }

    const currentTime = DateTime.now();
    const expiresOnDateTime = DateTime.fromJSDate(
      passwordlessTokens.value.expiresOn,
    );
    if (currentTime > expiresOnDateTime) {
      return E.left({
        message: MAGIC_LINK_EXPIRED,
        statusCode: HttpStatus.UNAUTHORIZED,
      });
    }
    const tokens = await this.generateAuthTokens(
      passwordlessTokens.value.userUid,
    );
    if (E.isLeft(tokens)) {
      return E.left({
        message: tokens.left.message,
        statusCode: tokens.left.statusCode,
      });
    }

    const deletedPasswordlessToken =
      await this.deleteMagicLinkVerificationTokens(passwordlessTokens.value);
    if (E.isLeft(deletedPasswordlessToken)) {
      // this.myLogger.debug(`verifyMagicLinkTokens: ${HttpStatus.NOT_FOUND}`);
      return E.left({
        message: deletedPasswordlessToken.left,
        statusCode: HttpStatus.NOT_FOUND,
      });
    }
    const updateUserResult = await this.usersService.updateUserLastLoggedOn(
      passwordlessTokens.value.userUid,
    );
    return E.right([tokens.right, 'success']);
  }

  /**
   * Verify and authenticate user from received data for Magic-Link
   *
   * @param magicLinkIDTokens magic-link verification tokens from client
   * @returns Either of generated AuthTokens
   */
  async verifyMagicLinkTokens(
    magicLinkIDTokens: VerifyMagicDto,
  ): Promise<E.Right<AuthTokens> | E.Left<RESTError>> {
    const passwordlessTokens = await this.validatePasswordlessTokens(
      magicLinkIDTokens,
    );
    if (O.isNone(passwordlessTokens))
      return E.left({
        message: INVALID_MAGIC_LINK_DATA,
        statusCode: HttpStatus.NOT_FOUND,
      });
    // this.myLogger.debug(
    //   `user id from magic link: ${passwordlessTokens.value.userUid}`,
    // );
    const user = await this.usersService.findUserById(
      passwordlessTokens.value.userUid,
    );
    if (O.isNone(user))
      return E.left({
        message: USER_NOT_FOUND,
        statusCode: HttpStatus.NOT_FOUND,
      });

    /**
     * * Check to see if entry for Magic-Link is present in the Account table for user
     * * If user was created with another provider findUserById may return true
     */
    const profile = {
      provider: 'magic',
      id: user.value.email,
    };
    const providerAccountExists = await this.checkIfProviderAccountExists(
      user.value,
      profile,
    );

    if (O.isNone(providerAccountExists)) {
      await this.usersService.createProviderAccount(
        user.value,
        null,
        null,
        profile,
      );
    }

    const currentTime = DateTime.now();
    // this.myLogger.debug(`current time iso: ${currentTime.toISO()}`);
    // this.myLogger.debug(
    //   `expires on iso: ${passwordlessTokens.value.expiresOn.toISOString()}`,
    // );

    const expiresOnDateTime = DateTime.fromJSDate(
      passwordlessTokens.value.expiresOn,
    );
    // this.myLogger.debug(`currentTime: ${currentTime}`);
    // this.myLogger.debug(`expiresOnDateTime: ${expiresOnDateTime}`);

    if (currentTime > expiresOnDateTime) {
      // this.myLogger.debug(`verifyMagicLinkTokens: 401`);
      return E.left({
        message: MAGIC_LINK_EXPIRED,
        statusCode: HttpStatus.UNAUTHORIZED,
      });
    }
    const tokens = await this.generateAuthTokens(
      passwordlessTokens.value.userUid,
    );
    if (E.isLeft(tokens)) {
      // this.myLogger.debug(`verifyMagicLinkTokens: ${tokens.left.statusCode}`);
      return E.left({
        message: tokens.left.message,
        statusCode: tokens.left.statusCode,
      });
    }

    const deletedPasswordlessToken =
      await this.deleteMagicLinkVerificationTokens(passwordlessTokens.value);
    if (E.isLeft(deletedPasswordlessToken)) {
      // this.myLogger.debug(`verifyMagicLinkTokens: ${HttpStatus.NOT_FOUND}`);
      return E.left({
        message: deletedPasswordlessToken.left,
        statusCode: HttpStatus.NOT_FOUND,
      });
    }
    const updateUserResult = await this.usersService.updateUserLastLoggedOn(
      passwordlessTokens.value.userUid,
    );
    // this.myLogger.debug(
    //   `updateUserResult: ${JSON.stringify(updateUserResult)}`,
    // );
    return E.right(tokens.right);
  }

  /**
   * Verify and authenticate user by username and password for admin site
   * @param email
   * @param password
   */
  async adminVerifyUserByEmailPassword(
    email: string,
    password: string,
  ): Promise<E.Right<[AuthTokens, string]> | E.Left<RESTError>> {
    const [result, verifyMessage] =
      await this.userPasswordService.verifyUsernameAndPassword(email, password);
    this.myLogger.debug(
      `verifyUsernameAndPassword result: ${result}, verifyMessage: ${verifyMessage}`,
    );
    if (result === false) {
      return E.left({
        message: verifyMessage,
        statusCode: HttpStatus.OK,
      });
    }

    const user = await this.usersService.findUserByEmail(email);
    if (O.isNone(user))
      return E.left({
        message: USER_NOT_FOUND,
        statusCode: HttpStatus.NOT_FOUND,
      });
    const tokens = await this.generateAuthTokens(user ? user.value.uid : '');
    this.myLogger.debug(`email: ${email}, tokens: ${JSON.stringify(tokens)}`);
    if (E.isLeft(tokens)) {
      return E.left({
        message: tokens.left.message,
        statusCode: tokens.left.statusCode,
      });
    }
    let message = '';
    if (user.value.isAdmin) {
      message = 'admin-logged-in';
    } else {
      message = 'not-admin';
    }

    return E.right([tokens.right, message]);
  }

  /**
   * Verify and authenticate user by username and password for application site
   * @param email
   * @param password
   */
  async appVerifyUserByEmailPassword(
    email: string,
    password: string,
  ): Promise<E.Right<[AuthTokens, string]> | E.Left<RESTError>> {
    const [result, verifyMessage] =
      await this.userPasswordService.verifyUsernameAndPassword(email, password);
    this.myLogger.debug(
      `verifyUsernameAndPassword result: ${result}, verifyMessage: ${verifyMessage}`,
    );
    if (result === false) {
      return E.left({
        message: verifyMessage,
        statusCode: HttpStatus.OK,
      });
    }

    const user = await this.usersService.findUserByEmail(email);
    if (O.isNone(user))
      return E.left({
        message: 'encounter error',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    const tokens = await this.generateAuthTokens(user ? user.value.uid : '');
    if (E.isLeft(tokens)) {
      return E.left({
        message: tokens.left.message,
        statusCode: tokens.left.statusCode,
      });
    }
    return E.right([tokens.right, 'login-success']);
  }

  /**
   * Verify and authenticate user from received data for Magic-Link
   *
   * @returns Either of generated AuthTokens
   * @param passwordDto
   */
  async verifyPasswordTokens(
    passwordDto: VerifyPasswordDto,
  ): Promise<E.Right<AuthTokens> | E.Left<RESTError>> {
    const result = await this.userPasswordService.verifyPasswordAndToken(
      passwordDto.email,
      passwordDto.password,
      passwordDto.token,
    );
    if (!result)
      return E.left({
        message: 'Invalid email, password or token',
        statusCode: HttpStatus.NOT_FOUND,
      });

    //
    const magicLinkIDTokens = new VerifyMagicDto();
    magicLinkIDTokens.deviceIdentifier = passwordDto.deviceIdentifier;
    magicLinkIDTokens.token = passwordDto.token;
    const passwordlessTokens = await this.validatePasswordlessTokens(
      magicLinkIDTokens,
    );
    if (O.isNone(passwordlessTokens))
      return E.left({
        message: INVALID_MAGIC_LINK_DATA,
        statusCode: HttpStatus.NOT_FOUND,
      });
    // this.myLogger.debug(
    //   `user id from magic link: ${passwordlessTokens.value.userUid}`,
    // );
    const user = await this.usersService.findUserById(
      passwordlessTokens.value.userUid,
    );
    if (O.isNone(user))
      return E.left({
        message: USER_NOT_FOUND,
        statusCode: HttpStatus.NOT_FOUND,
      });

    /**
     * * Check to see if entry for Magic-Link is present in the Account table for user
     * * If user was created with another provider findUserById may return true
     */
    const profile = {
      provider: 'magic',
      id: user.value.email,
    };
    const providerAccountExists = await this.checkIfProviderAccountExists(
      user.value,
      profile,
    );

    if (O.isNone(providerAccountExists)) {
      await this.usersService.createProviderAccount(
        user.value,
        null,
        null,
        profile,
      );
    }

    const currentTime = DateTime.now();
    // this.myLogger.debug(`current time iso: ${currentTime.toISO()}`);
    // this.myLogger.debug(
    //   `expires on iso: ${passwordlessTokens.value.expiresOn.toISOString()}`,
    // );

    const expiresOnDateTime = DateTime.fromJSDate(
      passwordlessTokens.value.expiresOn,
    );
    // this.myLogger.debug(`currentTime: ${currentTime}`);
    // this.myLogger.debug(`expiresOnDateTime: ${expiresOnDateTime}`);

    if (currentTime > expiresOnDateTime) {
      // this.myLogger.debug(`verifyMagicLinkTokens: 401`);
      return E.left({
        message: MAGIC_LINK_EXPIRED,
        statusCode: HttpStatus.UNAUTHORIZED,
      });
    }
    const tokens = await this.generateAuthTokens(
      passwordlessTokens.value.userUid,
    );
    if (E.isLeft(tokens)) {
      // this.myLogger.debug(`verifyMagicLinkTokens: ${tokens.left.statusCode}`);
      return E.left({
        message: tokens.left.message,
        statusCode: tokens.left.statusCode,
      });
    }

    const deletedPasswordlessToken =
      await this.deleteMagicLinkVerificationTokens(passwordlessTokens.value);
    if (E.isLeft(deletedPasswordlessToken)) {
      // this.myLogger.debug(`verifyMagicLinkTokens: ${HttpStatus.NOT_FOUND}`);
      return E.left({
        message: deletedPasswordlessToken.left,
        statusCode: HttpStatus.NOT_FOUND,
      });
    }
    const updateUserResult = await this.usersService.updateUserLastLoggedOn(
      passwordlessTokens.value.userUid,
    );
    // this.myLogger.debug(
    //   `updateUserResult: ${JSON.stringify(updateUserResult)}`,
    // );
    return E.right(tokens.right);
  }

  /**
   * Refresh refresh and auth tokens
   *
   * @param hashedRefreshToken Hashed refresh token received from client
   * @param user User Object
   * @returns Either of generated AuthTokens
   */
  async refreshAuthTokens(hashedRefreshToken: string, user: AuthUser) {
    // Check to see user is valid
    if (!user)
      return E.left({
        message: USER_NOT_FOUND,
        statusCode: HttpStatus.NOT_FOUND,
      });

    // Check to see if the hashed refresh_token received from the client is the same as the refresh_token saved in the DB
    const isTokenMatched = await argon2.verify(
      user.refreshToken,
      hashedRefreshToken,
    );
    if (!isTokenMatched)
      return E.left({
        message: INVALID_REFRESH_TOKEN,
        statusCode: HttpStatus.NOT_FOUND,
      });

    // if tokens match, generate new pair of auth tokens
    const generatedAuthTokens = await this.generateAuthTokens(user.uid);
    if (E.isLeft(generatedAuthTokens))
      return E.left({
        message: generatedAuthTokens.left.message,
        statusCode: generatedAuthTokens.left.statusCode,
      });

    return E.right(generatedAuthTokens.right);
  }

  /**
   * Verify is signed in User is an admin or not
   *
   * @param user User Object
   * @returns Either of boolean if user is admin or not
   */
  async verifyAdmin(user: AuthUser) {
    if (user.isAdmin) return E.right(<IsAdmin>{ isAdmin: true });

    const usersCount = await this.usersService.getUsersCount();
    if (usersCount === 1) {
      const elevatedUser = await this.usersService.makeAdmin(user.uid);
      if (E.isLeft(elevatedUser))
        return E.left(<RESTError>{
          message: elevatedUser.left,
          statusCode: HttpStatus.NOT_FOUND,
        });

      return E.right(<IsAdmin>{ isAdmin: true });
    }

    return E.right(<IsAdmin>{ isAdmin: false });
  }

  getAuthProviders() {
    return this.infraConfigService.getAllowedAuthProviders();
  }
}
