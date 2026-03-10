import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { findFacultyByEmail } from "@/lib/facultyDirectory";
import { signin } from "@/lib/entryNavigation";
import { APP_CONFIG, ALLOWED_EMAIL_SUFFIX } from "@/lib/config/appConfig";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: APP_CONFIG.security.sessionMaxAgeSeconds,
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production"
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  pages: {
    signIn: signin(),
  },
  callbacks: {
    async signIn({ profile }) {
      const email = (profile?.email ?? "").toLowerCase();
      return email.endsWith(ALLOWED_EMAIL_SUFFIX) && !!findFacultyByEmail(email);
    },
  },
};
