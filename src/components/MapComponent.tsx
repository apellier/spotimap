// src/components/MapComponent.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import GeoJSON from 'ol/format/GeoJSON';
import { Feature } from 'ol';
import { Geometry } from 'ol/geom';
import { Fill, Stroke, Style } from 'ol/style';
import { FeatureLike } from 'ol/Feature';
import { MapBrowserEvent } from 'ol';
import { getCountryColor } from '@/utils/mapUtils';

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
    const mapRef = useRef<Map | null>(null);
    const vectorLayerRef = useRef<VectorLayer<VectorSource<Feature<Geometry>>> | null>(null);
    const [maxSongCount, setMaxSongCount] = useState(1);
    const [tooltip, setTooltip] = useState<TooltipInfo>({ visible: false, content: '', x: 0, y: 0 });
    const [hoveredCountryIsoCode, setHoveredCountryIsoCode] = useState<string | null>(null);

    useEffect(() => {
        if (countrySongCounts.size > 0) {
            const counts = Array.from(countrySongCounts.values());
            setMaxSongCount(Math.max(...counts, 1));
        } else {
            setMaxSongCount(1);
        }
    }, [countrySongCounts]);

    useEffect(() => {
        if (!mapElement.current || mapRef.current) {
            return;
        }
        // ... (rest of the OpenLayers map initialization logic - keep as is)
        const osmLayer = new TileLayer({ source: new OSM() });
        const vectorSource = new VectorSource();
        const countriesLayer = new VectorLayer({ source: vectorSource });
        vectorLayerRef.current = countriesLayer;

        const initialMap = new Map({
            target: mapElement.current, // Target the ref
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
                const features = geoJsonFormat.readFeatures(data, { featureProjection: 'EPSG:3857' });
                const source = vectorLayerRef.current?.getSource();
                if (source) {
                    source.addFeatures(features);
                }
            })
            .catch(error => console.error("Error loading GeoJSON data:", error));

        const pointerMoveHandler = (evt: MapBrowserEvent<UIEvent>) => {
            if (evt.dragging || !mapRef.current) {
                setTooltip(prev => ({ ...prev, visible: false }));
                if (mapElement.current) mapElement.current.style.cursor = '';
                setHoveredCountryIsoCode(null);
                return;
            }
            const pixel = mapRef.current.getEventPixel(evt.originalEvent);
            let featureFound = false;
            mapRef.current.forEachFeatureAtPixel(pixel, (featureAtPixel) => {
                featureFound = true;
                const countryName = featureAtPixel.get('name') || featureAtPixel.get('ADMIN') || 'Unknown Country';
                const countryCode = featureAtPixel.get('ISO3166-1-Alpha-2')?.toUpperCase();
                const songCount = countryCode ? (countrySongCounts.get(countryCode) || 0) : 0;

                setTooltip({
                    visible: true,
                    content: `${countryName}: ${songCount} song(s)`,
                    x: evt.originalEvent.clientX,
                    y: evt.originalEvent.clientY,
                });
                setHoveredCountryIsoCode(countryCode || null);
                if (mapElement.current) mapElement.current.style.cursor = 'pointer';
                return true; 
            });

            if (!featureFound) {
                setTooltip(prev => ({ ...prev, visible: false }));
                setHoveredCountryIsoCode(null);
                if (mapElement.current) mapElement.current.style.cursor = '';
            }
        };

        const clickHandler = (evt: MapBrowserEvent<UIEvent>) => {
            if (!mapRef.current) return;
            mapRef.current.forEachFeatureAtPixel(evt.pixel, (featureAtPixel) => {
                const countryCode = featureAtPixel.get('ISO3166-1-Alpha-2')?.toUpperCase();
                const countryName = featureAtPixel.get('name') || featureAtPixel.get('ADMIN') || 'Unknown Country';
                if (countryCode) {
                    onCountryClick(countryCode, countryName);
                }
                return true; 
            });
        };

        const mouseOutHandler = () => {
            setTooltip(prev => ({ ...prev, visible: false }));
            setHoveredCountryIsoCode(null);
            if (mapElement.current) mapElement.current.style.cursor = '';
        };

        initialMap.on('pointermove', pointerMoveHandler);
        initialMap.on('click', clickHandler);
        // Attach mouseout to the map div itself to correctly detect when the pointer leaves the map area
        mapElement.current?.addEventListener('mouseout', mouseOutHandler);


        return () => {
            if (mapRef.current) {
                mapRef.current.un('pointermove', pointerMoveHandler);
                mapRef.current.un('click', clickHandler);
                // No need to remove listener from mapElement.current if the component is unmounting
                mapRef.current.setTarget(undefined);
                mapRef.current = null;
            }
        };
    }, [onCountryClick, countrySongCounts]); // Dependencies re-checked

    useEffect(() => {
        if (!vectorLayerRef.current) { // Removed mapRef.current check as it's not strictly needed for styling layer
            return;
        }
        const countriesLayer = vectorLayerRef.current;
        const currentMaxCount = maxSongCount; // This state is already calculated

        const countryStyleFunction = (feature: FeatureLike): Style => {
            const featureIsoCode = feature.get('ISO3166-1-Alpha-2')?.toUpperCase(); // Use your GeoJSON key
            const songCount = featureIsoCode ? (countrySongCounts.get(featureIsoCode) || 0) : 0;
            const isHovered = featureIsoCode === hoveredCountryIsoCode;

            return new Style({
                fill: new Fill({
                    color: getCountryColor(songCount, currentMaxCount), // Uses your new D3-based function
                }),
                stroke: new Stroke({
                    color: isHovered ? 'var(--stroke-accent)' : '#666666', // Use CSS var for hover, #666 from your example
                    width: isHovered ? 2 : 1, // Thicker on hover, 1px from your example
                }),
                zIndex: isHovered ? 1 : 0,
            });
        };
        countriesLayer.setStyle(countryStyleFunction);
    }, [countrySongCounts, maxSongCount, hoveredCountryIsoCode]);


    return (
        // This root div of MapComponent should fill its parent in page.tsx
        <div className="relative h-full w-full border-nb border-nb-border bg-nb-bg/5 shadow-nb"> {/* Use h-full, w-full */}
            {/* The mapElement ref div also needs to fill this parent div */}
            <div ref={mapElement} className="h-full w-full" /> {/* Ensure this is h-full, w-full */}
            {tooltip.visible && (
                <div
                    className="pointer-events-none fixed z-[1000] whitespace-nowrap rounded-nb border-nb border-nb-accent bg-nb-bg px-nb-md py-nb-sm text-sm text-nb-text shadow-nb-accent"
                    style={{
                        top: `${tooltip.y + 15}px`,
                        left: `${tooltip.x + 15}px`,
                    }}
                >
                    {tooltip.content}
                </div>
            )}
        </div>
    );
};

export default MapComponent;