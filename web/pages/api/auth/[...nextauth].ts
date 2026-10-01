import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

/** Access tokens live 15 minutes on the API; refresh one minute early. */
const ACCESS_TOKEN_LIFETIME_MS = 14 * 60 * 1000;

/** Exchanges the refresh token for a new access token. */
async function refreshAccessToken(token: any) {
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refreshToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: token.tokens.refreshToken }),
    });

    const response = await res.json();

    if (!res.ok) throw new Error(response.message || "Token refresh failed");

    return {
      ...token,
      tokens: { ...token.tokens, accessToken: response.data.accessToken },
      accessTokenExpires: Date.now() + ACCESS_TOKEN_LIFETIME_MS,
      error: undefined,
    };
  } catch {
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const isSignup = req?.body?.isSignup === "true" || req?.body?.isSignup === true;
        const endpoint = isSignup
          ? `${API_URL}/api/v1/auth/register`
          : `${API_URL}/api/v1/auth/login`;

        const body = isSignup
          ? {
              firstName: req?.body?.firstName,
              lastName: req?.body?.lastName,
              email: credentials?.email,
              password: credentials?.password,
              ...(req?.body?.phoneNumber && { phoneNumber: req.body.phoneNumber }),
            }
          : {
              email: credentials?.email,
              password: credentials?.password,
            };

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const response = await res.json();

        if (res.ok && response.data) {
          // { user, tokens } from the API becomes the NextAuth `user` object
          return response.data;
        }

        throw new Error(response.message || "Authentication failed");
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // First sign-in: persist the API payload on the NextAuth token
      if (user) {
        const payload = user as any;
        return {
          ...token,
          user: payload.user,
          tokens: payload.tokens,
          accessTokenExpires: Date.now() + ACCESS_TOKEN_LIFETIME_MS,
        };
      }

      // Client called `update(...)` (e.g. after editing the profile)
      if (trigger === "update" && session?.user) {
        token.user = { ...token.user, ...session.user };
        return token;
      }

      // Access token still valid
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      // Access token expired, refresh it
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.user = token.user;
      session.tokens = token.tokens;
      session.error = token.error;
      return session;
    },
  },
};

export default NextAuth(authOptions);
