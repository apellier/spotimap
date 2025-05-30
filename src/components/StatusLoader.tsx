// src/components/StatusLoader.tsx
"use client";

import React from 'react';

interface StatusLoaderProps {
  message: string;
}

const StatusLoader: React.FC<StatusLoaderProps> = ({ message }) => {
  return (
    <div className="fixed inset-0 z-[1100] flex flex-col items-center justify-center bg-nb-bg/80 backdrop-blur-sm">
      <div className="rounded-nb border-nb-thick border-nb-border bg-nb-bg p-nb-lg text-center shadow-nb-accent">
        {/* Optional: Add a spinner or animation here */}
        <svg className="mx-auto mb-nb-sm h-12 w-12 animate-spin text-nb-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-lg font-semibold text-nb-text">{message}</p>
      </div>
    </div>
  );
};

export default StatusLoader;