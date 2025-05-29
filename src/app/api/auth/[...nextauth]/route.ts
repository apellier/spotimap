// src/app/api/auth/[...nextauth]/route.ts
import NextAuth, { AuthOptions } from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";

// Define the scopes as a simple space-separated string
const spotifyScopes = [
    "user-read-email",
    "user-library-read",
    "playlist-read-private",
    "playlist-read-collaborative",
    // --- New Scopes for Playback & Playlists ---
    "user-modify-playback-state", // Control playback on user's active devices
    "user-read-playback-state",   // Read current playback state and active devices
    "streaming",                  // Required for Web Playback SDK (even if just controlling external, good to have)
    "playlist-modify-public",     // Create/modify public playlists
    "playlist-modify-private",    // Create/modify private playlists
];

export const authOptions: AuthOptions = {
    providers: [
        SpotifyProvider({
            clientId: process.env.SPOTIFY_CLIENT_ID as string,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET as string,
            authorization: { // Updated authorization object
                params: {
                    scope: spotifyScopes.join(" "), // Pass the scopes string here
                },
            },
        }),
    ],
    secret: process.env.NEXTAUTH_SECRET,
    callbacks: {
        async jwt({ token, account, profile }) {
            if (account && profile) {
                token.accessToken = account.access_token;
                token.refreshToken = account.refresh_token;
                token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : undefined;
                token.userId = profile.id; // Using profile.id which is standard from Spotify
                // console.log("JWT: Account present, token populated:", token);
            }

            // Return previous token if the access token has not expired yet
            if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) {
                // console.log("JWT: Token is valid");
                return token;
            }

            // Access token has expired, try to update it using the refresh token
            if (!token.refreshToken) {
                // console.log("JWT: No refresh token, cannot refresh");
                delete token.accessToken;
                delete token.accessTokenExpires;
                return token;
            }

            // console.log("JWT: Token expired, attempting refresh");
            try {
                const response = await fetch("https://accounts.spotify.com/api/token", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        Authorization: "Basic " + Buffer.from(
                            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
                        ).toString("base64"),
                    },
                    body: new URLSearchParams({
                        grant_type: "refresh_token",
                        refresh_token: token.refreshToken as string,
                    }),
                });

                const refreshedTokens = await response.json();
                if (!response.ok) {
                    // console.error("JWT: Refresh token request failed", refreshedTokens);
                    throw refreshedTokens;
                }
                // console.log("JWT: Tokens refreshed", refreshedTokens);

                token.accessToken = refreshedTokens.access_token;
                token.accessTokenExpires = Date.now() + refreshedTokens.expires_in * 1000;
                token.refreshToken = refreshedTokens.refresh_token ?? token.refreshToken; // Keep old if new one isn't provided
                return token;

            } catch (error) {
                // console.error("JWT: Error refreshing access token", error);
                delete token.accessToken;
                delete token.accessTokenExpires;
                // It's important to signal this error back to the session
                return {
                    ...token,
                    error: "RefreshAccessTokenError" as const,
                };
            }
        },
        async session({ session, token }) {
            // Send properties to the client, like an access_token and user ID from the token.
            session.accessToken = token.accessToken as string;
            session.error = token.error as string | undefined; // Propagate error to session
            if (session.user && token.userId) {
                session.user.id = token.userId as string; // Add user ID to session
            }
            // console.log("SESSION: Session populated:", session);
            return session;
        },
    },
    // debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };