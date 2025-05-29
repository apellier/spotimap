// src/app/providers.tsx
"use client"; // This directive marks this as a Client Component

import { SessionProvider } from "next-auth/react";
import React from "react";

type Props = {
    children?: React.ReactNode;
};

export const NextAuthProvider = ({ children }: Props) => {
    return <SessionProvider>{children}</SessionProvider>;
};