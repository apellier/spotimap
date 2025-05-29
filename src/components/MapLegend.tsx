// src/components/MapLegend.tsx
"use client";

import React from 'react';
import styles from './MapLegend.module.css'; // Ensure this CSS module uses global neobrutalist vars

interface LegendItem {
    color: string;
    label: string;
}

interface MapLegendProps {
    legendItems: LegendItem[];
}

const MapLegend: React.FC<MapLegendProps> = ({ legendItems }) => {
    if (!legendItems || legendItems.length === 0) {
        return null;
    }

    return (
        // The styles.mapLegend class from MapLegend.module.css should provide all neobrutalist styling
        // (bg, border, shadow, padding using global CSS variables)
        // Tailwind classes can be added here for minor positional adjustments if absolutely necessary,
        // but ideally, the component is self-contained visually via its module.
        <div className={`${styles.mapLegend} absolute bottom-nb-md left-nb-md z-[500]`}> {/* Using Tailwind for positioning */}
            <h5 className={`${styles.legendTitle} mb-nb-sm text-sm font-bold uppercase tracking-nb-wide`}> {/* Tailwind for text */}
                Songs / Country
            </h5>
            {legendItems.map((item, index) => (
                <div key={index} className={`${styles.legendItem} mb-nb-xs flex items-center`}> {/* Tailwind for layout */}
                    <span
                        className={`${styles.legendColorBox} mr-nb-sm inline-block h-[14px] w-[14px] border border-nb-border rounded-nb`} /* Tailwind for sizing & border */
                        style={{ backgroundColor: item.color }}
                    />
                    <span className={`${styles.legendLabel} text-xs`}>{item.label}</span> {/* Tailwind for text */}
                </div>
            ))}
        </div>
    );
};

export default MapLegend;