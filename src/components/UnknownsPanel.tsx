// src/components/UnknownsPanel.tsx
"use client";

import React from 'react';
import styles from '../app/page.module.css'; // Using styles from page.module.css
import { SpotifyTrack } from '@/types'; // Assuming Track type has artist info needed

interface UnknownsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    unknownsList: Array<{ trackName: string; artistName: string }>;
}

const UnknownsPanel: React.FC<UnknownsPanelProps> = ({ isOpen, onClose, unknownsList }) => {
    if (!isOpen) {
        return null;
    }

    return (
        // Using classes from page.module.css for the small info window style
        <div className={`${styles.smallInfoWindow} ${styles.unknownsWindow} fixed right-nb-md top-[70px] z-[600] w-full max-w-xs md:top-[calc(55px+var(--spacing-md))] md:max-w-sm`}> {/* Tailwind for positioning & sizing */}
            <div className={`${styles.smallInfoHeader} flex items-center justify-between`}> {/* Tailwind */}
                <h4 className="m-0 text-base font-semibold"> {/* Tailwind */}
                    Unknown Origins ({unknownsList.length} tracks)
                </h4>
                <button onClick={onClose} className={styles.smallInfoCloseButton}>×</button>
            </div>
            <div className={`${styles.smallInfoContent} ${styles.scrollableContent} mt-nb-sm`}> {/* Tailwind */}
                {unknownsList.length > 0 ? (
                    <ul className="list-none pl-0">
                        {unknownsList.map((item, index) => (
                            <li key={`${item.artistName}-${item.trackName}-${index}`} className="py-nb-xs text-xs"> {/* Tailwind */}
                                <strong className="font-semibold">{item.artistName}</strong> - <em className="text-nb-text/80">{item.trackName}</em> {/* Tailwind */}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-nb-text/70"> {/* Tailwind */}
                        All relevant artists currently have known origins, or data is still being processed.
                    </p>
                )}
            </div>
        </div>
    );
};

export default UnknownsPanel;