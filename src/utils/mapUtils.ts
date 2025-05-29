// src/utils/mapUtils.ts
import * as d3 from 'd3';

export const getCountryColor = (count: number, maxCount: number): string => {
    // Default color for countries with 0 songs or if maxCount is 0
    if (count === 0 || maxCount === 0) {
        return 'rgba(200, 200, 200, 0.6)'; // From your example
    }

    // Ensure maxCount is at least 1 for the domain
    const safeMaxCount = Math.max(1, maxCount);
    const midPoint = Math.sqrt(safeMaxCount);

    // Define the domain for the log scale.
    // If maxCount is 1, the domain might simplify or need adjustment.
    // Let's ensure at least two distinct points in the domain if possible.
    let domainPoints = [1, safeMaxCount];
    if (midPoint > 1 && midPoint < safeMaxCount) {
        domainPoints = [1, midPoint, safeMaxCount];
    } else if (midPoint === 1 && safeMaxCount > 1) {
        // If maxCount is small, e.g., 2 or 3, sqrt might be close to 1.
        // Use a simpler domain for small maxCount to ensure range is used.
        domainPoints = [1, safeMaxCount];
    } else if (safeMaxCount === 1) { // Only one song max
        domainPoints = [1, 1.00001]; // d3 scale needs distinct domain points
    }


    const colorScale = d3.scaleLog<string, string>()
        .domain(domainPoints)
        .range(["#C7F9CC", "#1ED760", "#00441B"].slice(0, domainPoints.length)) // Adjust range to match domain length
        .interpolate(d3.interpolateRgb)
        .clamp(true);

    let fillColor = colorScale(count);

    // Opacity calculation from your example
    const minOpacity = 0.6;
    const maxOpacity = 0.85; // Max opacity you want for the most songs

    // Normalize count for opacity, using log scale for consistency with color
    // Add 1 to count and maxCount before log to handle count=0 if it wasn't filtered, and to map 1 to a non-zero value
    const normalizedValue = safeMaxCount > 1 ? (Math.log10(count + 1) / Math.log10(safeMaxCount + 1)) : 1;
    let opacity = minOpacity + (maxOpacity - minOpacity) * Math.min(1, Math.max(0, normalizedValue));
    
    if (count === 0) opacity = 0.6; // Opacity for 0 count from your example for the base fill

    try {
        const rgbColor = d3.color(fillColor); // d3.color can parse hex strings
        if (rgbColor) {
            return `rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, ${opacity})`;
        } else {
            // Fallback if color parsing fails (should not happen with hex)
            return `rgba(200, 200, 200, ${opacity})`;
        }
    } catch (e) {
        console.error("Error processing color for legend:", e);
        return `rgba(200, 200, 200, ${opacity})`;
    }
};