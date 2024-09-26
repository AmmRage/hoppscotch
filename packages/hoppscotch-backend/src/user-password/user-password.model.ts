import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ChangePasswordResponse {
  @Field(() => Boolean, {
    description: 'if the password change was successful',
  })
  isSuccess: boolean;
  @Field(() => [String], {
    description: 'messages for the password change',
  })
  messages: [string];
  @Field(() => Date, {
    description: 'the response time',
  })
  timeGenerated: Date;
}
