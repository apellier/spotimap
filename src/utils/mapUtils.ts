// src/utils/mapUtils.ts
import * as d3 from 'd3';
import { RGBColor } from 'd3-color'; // Import RGBColor type for clarity

export const getCountryColor = (count: number, maxCount: number): string => {
    // Default color for countries with 0 songs or if maxCount is 0
    if (count === 0 || maxCount === 0) {
        return 'rgba(200, 200, 200, 0.6)'; // Default light grey
    }

    // Ensure maxCount is at least 1 for the domain
    const safeMaxCount = Math.max(1, maxCount);
    const midPoint = Math.sqrt(safeMaxCount);

    // Define the domain for the log scale.
    let domainPoints = [1, safeMaxCount];
    if (midPoint > 1 && midPoint < safeMaxCount) {
        domainPoints = [1, midPoint, safeMaxCount];
    } else if (safeMaxCount === 1) { // Only one song max
        domainPoints = [1, 1.00001]; // d3 scale needs distinct domain points
    }
    // Ensure domainPoints are sorted and unique if logic gets complex
    domainPoints = [...new Set(domainPoints)].sort((a, b) => a - b);
    if (domainPoints.length === 1 && domainPoints[0] === 1 && safeMaxCount === 1) { // Special case for maxCount = 1
      // Ensure there are two points for the scale if maxCount is 1
      // This ensures the scale can interpolate to a single color correctly
      domainPoints = [1, 1.00001];
    } else if (domainPoints.length === 1 && domainPoints[0] > 1) {
        // If somehow only one point > 1, add 1 to the start for a valid range
        domainPoints.unshift(1);
    }


    // Adjust range to always have at least two colors if domain has two points,
    // or one color if domain effectively has one point (for maxCount=1)
    let colorRange = ["#C7F9CC", "#1ED760", "#00441B"];
    if (domainPoints.length < 2) { // Should ideally not happen with above logic for maxCount=1
        colorRange = [colorRange[1]]; // Use the mid-color if only one point
    } else if (domainPoints.length < 3) {
        colorRange = [colorRange[0], colorRange[1]]; // Use first two colors if domain has two points
    }


    const colorScale = d3.scaleLog<string, string>()
        .domain(domainPoints)
        .range(colorRange)
        .interpolate(d3.interpolateRgb)
        .clamp(true);

    const fillColor = colorScale(count);

    // Opacity calculation
    const minOpacity = 0.6;
    const maxOpacity = 0.85;

    // Normalize count for opacity
    // Add 1 to count and maxCount before log to handle count=0 if it wasn't filtered,
    // and to map 1 to a non-zero value for log scale.
    const normalizedValue = safeMaxCount > 1 ? (Math.log10(count + 1) / Math.log10(safeMaxCount + 1)) : 1;
    let opacity = minOpacity + (maxOpacity - minOpacity) * Math.min(1, Math.max(0, normalizedValue));

    if (count === 0) { // This case is handled at the top, but as a safeguard for opacity if logic changes
        opacity = 0.6;
    }

    try {
        const d3ColorObject = d3.color(fillColor);
        if (d3ColorObject) {
            // Ensure we have an RGBColor object to access .r, .g, .b
            const rgbVersion = d3ColorObject.rgb(); // This converts to RGB if it's not already
            return `rgba(${rgbVersion.r}, ${rgbVersion.g}, ${rgbVersion.b}, ${opacity})`;
        } else {
            // Fallback if color parsing fails (should not happen with hex from scale)
            console.warn(`d3.color returned null for: ${fillColor}`);
            return `rgba(200, 200, 200, ${opacity})`; // Fallback to default grey
        }
    } catch (e) {
        console.error("Error processing color:", e, "Input fillColor:", fillColor);
        return `rgba(200, 200, 200, ${opacity})`; // Fallback on any error
    }
};
