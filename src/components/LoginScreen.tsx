// src/components/LoginScreen.tsx
"use client";

import React from 'react';
import TopMenu from './TopMenu'; // Assuming TopMenu is also refactored or can handle logged-out state

interface LoginScreenProps {
    onSignIn: () => void;
    // If TopMenu needs theme for its own toggle when logged out:
    // currentTheme: string;
    // onToggleTheme: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onSignIn }) => {
    //const { theme, toggleTheme } = useTheme(); // Get theme for TopMenu

    return (
        // Using Tailwind classes for full-screen flex layout
        <div className="flex min-h-screen flex-col bg-nb-bg"> {/* Use CSS vars for background */}
            <TopMenu
                isLoggedIn={false}
                onSignIn={onSignIn}
                userName={null}
                onSignOut={() => {}}
                currentSourceLabel=""
                onFetchLikedSongs={() => {}}
                playlists={[]}
                selectedPlaylistId=""
                onPlaylistChange={() => {}}
                isLoadingData={false}
                unknownsCount={0}
                onUnknownsClick={() => {}}
                isLoadingPlaylists
            />
            <div className="flex flex-grow flex-col items-center justify-center p-nb-lg text-center"> {/* Tailwind for centering */}
                <h1 className="mb-nb-md text-3xl font-bold text-nb-text md:text-4xl">Spotify Geo Explorer</h1> {/* Tailwind for typography */}
                <p className="mb-nb-lg text-base text-nb-text/80 md:text-lg">
                    Discover the geographic origins of your music.
                </p>
                <button
                    onClick={onSignIn}
                    className="btn px-nb-lg py-nb-md text-base font-semibold md:text-lg" // Global .btn style + Tailwind padding/text
                >
                    Sign In with Spotify
                </button>
            </div>
        </div>
    );
};

export default LoginScreen;