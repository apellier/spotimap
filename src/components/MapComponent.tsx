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
import OLMapBrowserEvent from 'ol/MapBrowserEvent'; // OpenLayers MapBrowserEvent
// MapEventType import removed as we'll use string literals
import { Select } from 'ol/interaction';
import { pointerMove } from 'ol/events/condition';
import { getCountryColor } from '@/utils/mapUtils'; // Assuming this path is correct

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
    const [maxSongCount, setMaxSongCount] = useState(1);
    const [tooltip, setTooltip] = useState<TooltipInfo>({ visible: false, content: '', x: 0, y: 0 });

    // Effect to calculate maxSongCount
    useEffect(() => {
        if (countrySongCounts.size > 0) {
            const counts = Array.from(countrySongCounts.values());
            setMaxSongCount(Math.max(...counts, 1));
        } else {
            setMaxSongCount(1);
        }
    }, [countrySongCounts]);

    // Effect for map initialization and event handling
    useEffect(() => {
        if (!mapElement.current || mapRef.current) {
            return;
        }

        const osmLayer = new TileLayer({ source: new OSM() });
        const initialVectorSource = new VectorSource<Feature<Geometry>>();
        const countriesLayer = new VectorLayer({
            source: initialVectorSource,
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

        // --- Interaction for Hover Highlighting (uses pointer events internally) ---
        const selectHoverStyle = new Style({
            stroke: new Stroke({
                color: 'var(--accent-primary)',
                width: 2.5,
            }),
            zIndex: 1
        });

        const selectInteraction = new Select({
            condition: pointerMove,
            style: selectHoverStyle,
            layers: [countriesLayer],
            multi: false,
        });
        initialMap.addInteraction(selectInteraction);

        // --- Pointer Move Handler for Tooltip and Cursor (using PointerEvent) ---
        const pointerMoveHandler = (evt: OLMapBrowserEvent<PointerEvent>) => {
            if (evt.dragging || !mapRef.current) {
                setTooltip(prev => ({ ...prev, visible: false }));
                if (mapElement.current) mapElement.current.style.cursor = '';
                return;
            }

            const pixel = mapRef.current.getEventPixel(evt.originalEvent);
            const featureAtPixel = mapRef.current.forEachFeatureAtPixel(
                pixel,
                (feature) => feature as Feature<Geometry>,
                { layerFilter: (layer) => layer === countriesLayer }
            );

            if (featureAtPixel) {
                const countryName = featureAtPixel.get('name') || featureAtPixel.get('ADMIN') || 'Unknown Country';
                const countryCode = featureAtPixel.get('ISO3166-1-Alpha-2')?.toUpperCase();
                const songCount = countryCode ? (countrySongCounts.get(countryCode) || 0) : 0;

                setTooltip({
                    visible: true,
                    content: `${countryName}: ${songCount} song(s)`,
                    x: evt.originalEvent.clientX,
                    y: evt.originalEvent.clientY,
                });
                if (mapElement.current) mapElement.current.style.cursor = 'pointer';
            } else {
                setTooltip(prev => ({ ...prev, visible: false }));
                if (mapElement.current) mapElement.current.style.cursor = '';
            }
        };
        

        // --- Click Handler (using PointerEvent) ---
        const clickHandler = (evt: OLMapBrowserEvent<PointerEvent>) => {
            if (!mapRef.current) return;
            mapRef.current.forEachFeatureAtPixel(
                evt.pixel,
                (featureAtPixel) => {
                    const typedFeature = featureAtPixel as Feature<Geometry>;
                    const countryCode = typedFeature.get('ISO3166-1-Alpha-2')?.toUpperCase();
                    const countryName = typedFeature.get('name') || typedFeature.get('ADMIN') || 'Unknown Country';
                    if (countryCode) {
                        onCountryClick(countryCode, countryName);
                    }
                    return true;
                },
                { layerFilter: (layer) => layer === countriesLayer }
            );
        };
        

        // --- Mouse Out of Map Container Handler (uses MouseEvent as it's a DOM event) ---
        const mapElementCurrent = mapElement.current;
        const mouseOutHandler = (evt: MouseEvent) => {
            if (mapElementCurrent && !mapElementCurrent.contains(evt.relatedTarget as Node)) {
                 setTooltip(prev => ({ ...prev, visible: false }));
            }
        };
        mapElementCurrent?.addEventListener('mouseout', mouseOutHandler);


        // --- Cleanup ---
        return () => {
            if (initialMap) {
                initialMap.removeInteraction(selectInteraction);
                mapElementCurrent?.removeEventListener('mouseout', mouseOutHandler);
                initialMap.setTarget(undefined);
            }
            mapRef.current = null;
        };
    }, [onCountryClick, countrySongCounts]);

    // Effect for styling the countries layer based on song counts
    useEffect(() => {
        if (!vectorLayerRef.current || !countrySongCounts || maxSongCount <= 0) {
            return;
        }
        const countriesLayer = vectorLayerRef.current;
        const currentMaxSongCount = maxSongCount;

        const countryStyleFunction = (feature: FeatureLike): Style => {
            const typedFeature = feature as Feature<Geometry>;
            const featureIsoCode = typedFeature.get('ISO3166-1-Alpha-2')?.toUpperCase();
            const songCount = featureIsoCode ? (countrySongCounts.get(featureIsoCode) || 0) : 0;

            return new Style({
                fill: new Fill({ color: getCountryColor(songCount, currentMaxSongCount) }),
                stroke: new Stroke({ color: '#BBBBBB', width: 1 }),
            });
        };
        countriesLayer.setStyle(countryStyleFunction);
    }, [countrySongCounts, maxSongCount]);


    return (
        <div className="relative h-full w-full border-nb border-nb-border bg-nb-bg/5 shadow-nb">
            <div ref={mapElement} className="h-full w-full" />
            {tooltip.visible && (
                <div
                    className="pointer-events-none fixed z-[1000] whitespace-nowrap rounded-nb border-nb border-nb-accent bg-nb-bg px-nb-md py-nb-sm text-sm text-nb-text shadow-nb-accent"
                    style={{
                        top: `${tooltip.y + 15}px`,
                        left: `${tooltip.x + 15}px`,
                        transform: 'translate(-50%, -100%)',
                    }}
                >
                    {tooltip.content}
                </div>
            )}
        </div>
    );
};

export default MapComponent;
