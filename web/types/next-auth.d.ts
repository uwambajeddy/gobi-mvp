import { User, Tokens } from "./index";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: User;
    tokens: Tokens;
    error?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    user: User;
    tokens: Tokens;
    accessTokenExpires: number;
    error?: string;
  }
}
