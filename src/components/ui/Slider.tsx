import React from 'react';

interface SliderProps {
    min: number;
    max: number;
    value: number;
    onChange: (value: number) => void;
    className?: string;
    disabled?: boolean;
}

export default function Slider({ min, max, value, onChange, className = '', disabled = false }: SliderProps) {
    const percentage = ((value - min) / (max - min)) * 100;

    return (
        <div className={`relative w-full h-6 flex items-center select-none ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
            {/* Track Background */}
            <div className="absolute w-full h-3 bg-nb-bg border-2 border-nb-border rounded-full overflow-hidden">
                {/* Track Fill */}
                <div
                    className="h-full bg-nb-accent border-r-2 border-nb-border"
                    style={{ width: `${percentage}%` }}
                />
            </div>

            {/* Native Input (Invisible but accessible & handles interaction) */}
            <input
                type="range"
                min={min}
                max={max}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                disabled={disabled}
                className="absolute w-full h-full opacity-0 cursor-pointer z-10"
            />

            {/* Custom Thumb (Visual Only - positioned by percentage) */}
            <div
                className="absolute h-5 w-5 bg-nb-bg border-2 border-nb-border shadow-nb rounded-full pointer-events-none transition-transform active:scale-95"
                style={{ left: `calc(${percentage}% - 10px)` }} // Center thumb
            />
        </div>
    );
}
