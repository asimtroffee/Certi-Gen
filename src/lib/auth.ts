import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/src/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),

  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || "dummy",
      clientSecret: process.env.AUTH_GOOGLE_SECRET || "dummy",
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/drive",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],

  session: {
    strategy: "database",
  },

  // pages: {
  //   signIn: "/auth/signin",
  //   error: "/auth/error",
  // },

  callbacks: {
    /**
     * Attach user ID and role to the session object so API routes
     * can identify the admin without an extra DB query.
     */
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        // Fetch role from our User model (not included in default session)
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).role = dbUser?.role ?? "admin";
      }
      return session;
    },
  },
});
