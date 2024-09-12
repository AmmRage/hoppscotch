// Inputs to verify and sign a user in via magic-link
export class VerifyPasswordDto {
  email: string;
  password: string;
  deviceIdentifier: string;
  token: string;
}
