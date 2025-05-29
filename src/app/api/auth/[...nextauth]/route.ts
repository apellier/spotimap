// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import { authOptions } from "@/lib/authOptions"; // Or the correct path to your new file

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };