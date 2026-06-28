export interface UserProfile {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  email_verified?: boolean;
  website?: string;
  iss?: string;
  aud?: string;
  exp?: number;
  iat?: number;
}
