// src/components/MapComponent.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import 'ol/ol.css';
import OlMap from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import GeoJSON from 'ol/format/GeoJSON';
import Feature, { FeatureLike } from 'ol/Feature';
import { Geometry } from 'ol/geom';
import { Fill, Stroke, Style } from 'ol/style';
import { getCountryColor } from '@/utils/mapUtils';
import { MapBrowserEvent } from 'ol';

interface MapComponentProps {
    countrySongCounts: Map<string, number>;
    onCountryClick: (isoCode: string, countryName: string) => void;
}

interface TooltipInfo {
    visible: boolean;
    content: string;
    x: number;
    y: number;
}

const MapComponent: React.FC<MapComponentProps> = ({ countrySongCounts, onCountryClick }) => {
    const mapElement = useRef<HTMLDivElement>(null);
    const mapRef = useRef<OlMap | null>(null);
    const vectorLayerRef = useRef<VectorLayer<VectorSource<Feature<Geometry>>> | null>(null);
    const [maxSongCount, setMaxSongCount] = useState(1); // For styling, derived from countrySongCounts
    const [tooltip, setTooltip] = useState<TooltipInfo>({ visible: false, content: '', x: 0, y: 0 });

    // Effect for deriving maxSongCount from countrySongCounts (for styling)
    useEffect(() => {
        if (countrySongCounts.size > 0) {
            const counts = Array.from(countrySongCounts.values());
            setMaxSongCount(Math.max(...counts, 1));
        } else {
            setMaxSongCount(1); // Default if no counts
        }
    }, [countrySongCounts]);


    // Effect for Map Initialization (runs once or if onCountryClick ref changes - which it shouldn't now)
    useEffect(() => {
        if (!mapElement.current || mapRef.current) { // Prevent re-initialization if map already exists
            return;
        }

        console.log("MapComponent: Initializing OpenLayers Map"); // For debugging

        const osmLayer = new TileLayer({ source: new OSM() });
        const initialVectorSource = new VectorSource<Feature<Geometry>>();
        const countriesLayer = new VectorLayer({
            source: initialVectorSource,
            // Style will be set in the other useEffect
        });
        vectorLayerRef.current = countriesLayer;

        const initialMap = new OlMap({
            target: mapElement.current,
            layers: [osmLayer, countriesLayer],
            view: new View({ center: [0, 0], zoom: 2, projection: 'EPSG:3857' }),
        });
        mapRef.current = initialMap;

        fetch('/countries.geojson')
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status} fetching GeoJSON`);
                return response.json();
            })
            .then(data => {
                const geoJsonFormat = new GeoJSON();
                const features = geoJsonFormat.readFeatures(data, {
                    featureProjection: 'EPSG:3857'
                }) as Feature<Geometry>[];
                initialVectorSource.addFeatures(features);
            })
            .catch(error => console.error("Error loading GeoJSON data:", error));

        // Tooltip and click handlers
        const pointerMoveHandler = (evt: MapBrowserEvent<any>) => {
            if (evt.dragging || !mapRef.current) {
                setTooltip(prev => ({ ...prev, visible: false }));
                if (mapElement.current) mapElement.current.style.cursor = '';
                return;
            }
            const pixel = mapRef.current.getEventPixel(evt.originalEvent);
            let featureFound = false;
            mapRef.current.forEachFeatureAtPixel(pixel, (featureAtPixel) => {
                featureFound = true;
                const typedFeature = featureAtPixel as Feature<Geometry>;
                const countryName = typedFeature.get('name') || 'Unknown Country';
                const isoCode = typedFeature.get('ISO3166-1-Alpha-2')?.toUpperCase();
                
                // Use a local ref or state for countrySongCounts for tooltip if needed to avoid map re-init
                // For now, this is fine as it doesn't change map structure
                const songCount = isoCode ? (countrySongCounts.get(isoCode) || 0) : 0;


                let xCoord = 0;
                let yCoord = 0;
                const originalEvent = evt.originalEvent;
                if (originalEvent instanceof PointerEvent) {
                    xCoord = originalEvent.pageX;
                    yCoord = originalEvent.pageY;
                } // ... (rest of coordinate logic)

                setTooltip({
                    visible: true,
                    content: `${countryName}: ${songCount} song${songCount === 1 ? '' : 's'}`,
                    x: xCoord,
                    y: yCoord,
                });
                if (mapElement.current) mapElement.current.style.cursor = 'pointer';
                return true; 
            });
            if (!featureFound) {
                setTooltip(prev => ({ ...prev, visible: false }));
                if (mapElement.current) mapElement.current.style.cursor = '';
            }
        };
        initialMap.on('pointermove', pointerMoveHandler);

        const clickHandler = (evt: MapBrowserEvent<any>) => {
            if (!mapRef.current) return;
            const pixel = mapRef.current.getEventPixel(evt.originalEvent);
            mapRef.current.forEachFeatureAtPixel(pixel, (featureAtPixel) => {
                const typedFeature = featureAtPixel as Feature<Geometry>;
                const isoCode = typedFeature.get('ISO3166-1-Alpha-2')?.toUpperCase();
                const countryName = typedFeature.get('name') || 'Unknown';
                if (isoCode) {
                    onCountryClick(isoCode, countryName); // onCountryClick is now stable
                }
                return true; 
            });
        };
        initialMap.on('click', clickHandler);
        
        const mapTargetElement = initialMap.getTargetElement();
        const pointerLeaveListener = () => {
            setTooltip(prev => ({ ...prev, visible: false }));
            if (mapElement.current) mapElement.current.style.cursor = '';
        };
        if (mapTargetElement instanceof HTMLElement) {
            mapTargetElement.addEventListener('pointerleave', pointerLeaveListener);
        }

         return () => {
            console.log("MapComponent: Cleaning up OpenLayers Map"); // For debugging
            if (mapTargetElement instanceof HTMLElement) {
                mapTargetElement.removeEventListener('pointerleave', pointerLeaveListener);
            }
            // Clean up listeners from the map instance
            if (mapRef.current) {
                mapRef.current.un('pointermove', pointerMoveHandler);
                mapRef.current.un('click', clickHandler);
                mapRef.current.setTarget(undefined); // Detach map from DOM element
                // mapRef.current.dispose(); // Use dispose for full cleanup if component truly unmounts and won't be reused soon.
                                          // For now, setTarget(undefined) is often enough if the component might be re-rendered with a new target.
                mapRef.current = null; // To allow re-initialization if the component *does* get fully unmounted and remounted.
            }
        };
    // The main map initialization effect should only depend on things that, when changed,
    // require a full map re-initialization. `onCountryClick` is now stable.
    // If `mapElement.current` was somehow changing, that would be an issue, but it shouldn't.
    }, [onCountryClick, countrySongCounts]); // onCountryClick is now stable

    // Effect for Styling Layer based on countrySongCounts (this is fine to run when counts change)
    useEffect(() => {
        if (!vectorLayerRef.current) { // Guard against null ref
            return;
        }
        console.log("MapComponent: Updating styles based on countrySongCounts", countrySongCounts); // For debugging

        const currentMaxForStyle = maxSongCount; // Use the derived maxSongCount

        const countryStyleFunction = (feature: FeatureLike): Style => {
            const typedFeature = feature as Feature<Geometry>;
            const featureIsoCode = typedFeature.get('ISO3166-1-Alpha-2')?.toUpperCase();
            const songCount = featureIsoCode ? (countrySongCounts.get(featureIsoCode) || 0) : 0;

            return new Style({
                fill: new Fill({ color: getCountryColor(songCount, currentMaxForStyle) }),
                stroke: new Stroke({ color: '#BBBBBB', width: 1 }),
            });
        };
        vectorLayerRef.current.setStyle(countryStyleFunction);
        vectorLayerRef.current.changed(); // Explicitly tell OpenLayers the layer changed to force redraw of styles
        if(mapRef.current) mapRef.current.render(); // Force a map render
        
    }, [countrySongCounts, maxSongCount]); // maxSongCount is derived from countrySongCounts


    return (
        <div className="relative h-full w-full border-nb border-nb-border bg-nb-bg/5 shadow-nb">
            <div ref={mapElement} className="h-full w-full" />
            {tooltip.visible && (
                <div
                    className="pointer-events-none fixed z-[1000] whitespace-nowrap rounded-nb border-nb border-nb-accent bg-nb-bg px-nb-md py-nb-sm text-sm text-nb-text shadow-nb-accent"
                    style={{
                        top: `${tooltip.y}px`,      
                        left: `${tooltip.x + 15}px`, 
                        transform: 'translateY(-100%)', 
                    }}
                >
                    {tooltip.content}
                </div>
            )}
        </div>
    );
};

export default MapComponent;