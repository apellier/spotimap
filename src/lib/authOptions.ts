// src/lib/authOptions.ts
import { AuthOptions, Profile as NextAuthProfile } from "next-auth"; // Import NextAuthProfile to avoid naming conflict
import SpotifyProvider, { SpotifyProfile } from "next-auth/providers/spotify"; // Import SpotifyProfile

const spotifyScopes = [
    "user-read-email",
    "user-library-read",
    "playlist-read-private",
    "playlist-read-collaborative",
    "user-modify-playback-state",
    "user-read-playback-state",
    "streaming",
    "playlist-modify-public",
    "playlist-modify-private",
];

export const authOptions: AuthOptions = {
    providers: [
        SpotifyProvider({
            clientId: process.env.SPOTIFY_CLIENT_ID as string,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET as string,
            authorization: {
                params: {
                    scope: spotifyScopes.join(" "),
                },
            },
        }),
    ],
    secret: process.env.NEXTAUTH_SECRET,
    callbacks: {
        async jwt({ token, account, profile }) {
            // When a user signs in, account and profile are available.
            // For Spotify, profile is of type SpotifyProfile.
            if (account && profile) {
                const spotifyProfile = profile as SpotifyProfile; // Cast to SpotifyProfile
                token.accessToken = account.access_token;
                token.refreshToken = account.refresh_token;
                token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : undefined;
                token.userId = spotifyProfile.id; // Now correctly accesses id from SpotifyProfile
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
                return token; // Return token without accessToken if refresh fails or no refreshToken
            }

            // console.log("JWT: Token expired, attempting refresh");
            try {
                const response = await fetch("https://accounts.spotify.com/api/token", { // Correct Spotify token URL
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
                    // Potentially clear the tokens or mark an error to force re-login
                    token.error = "RefreshAccessTokenError";
                    delete token.accessToken;
                    delete token.refreshToken; // Important: if refresh token is invalid, remove it
                    delete token.accessTokenExpires;
                    return token;
                    // throw refreshedTokens; // Or throw to indicate a hard error
                }
                // console.log("JWT: Tokens refreshed", refreshedTokens);

                token.accessToken = refreshedTokens.access_token;
                token.accessTokenExpires = Date.now() + refreshedTokens.expires_in * 1000;
                // Spotify might return a new refresh token, update if it does
                token.refreshToken = refreshedTokens.refresh_token ?? token.refreshToken;
                delete token.error; // Clear any previous error
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
            if (token.accessToken) {
              session.accessToken = token.accessToken as string;
            }
            if (token.error) {
              session.error = token.error as string | undefined;
            }
            if (session.user && token.userId) {
                session.user.id = token.userId as string; // Add user ID to session
            }
            // console.log("SESSION: Session populated:", session);
            return session;
        },
    },
    // debug: process.env.NODE_ENV === 'development', // Enable for more logs if needed
};
