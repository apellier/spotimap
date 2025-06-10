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
    onCountryClick: (isoCode: string, countryName: string, isShiftKey: boolean) => void;
    selectedIsoCodes: string[];
    isExporting: boolean;
    onExportComplete: () => void;
}

interface TooltipInfo {
    visible: boolean;
    content: string;
    x: number;
    y: number;
}

const MapComponent: React.FC<MapComponentProps> = ({ countrySongCounts, onCountryClick, selectedIsoCodes, isExporting, onExportComplete }) => {
    const mapElement = useRef<HTMLDivElement>(null);
    const mapRef = useRef<OlMap | null>(null);
    const vectorLayerRef = useRef<VectorLayer<VectorSource<Feature<Geometry>>> | null>(null);
    const [tooltip, setTooltip] = useState<TooltipInfo>({ visible: false, content: '', x: 0, y: 0 });

    // Store the onCountryClick callback in a ref to keep it stable for the map event listener
    const onCountryClickRef = useRef(onCountryClick);
    useEffect(() => {
        onCountryClickRef.current = onCountryClick;
    }, [onCountryClick]);

    const countrySongCountsRef = useRef(countrySongCounts);
    useEffect(() => {
        countrySongCountsRef.current = countrySongCounts;
    }, [countrySongCounts]);

    // Effect for initializing the map (should only run once)
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
            .then(response => response.ok ? response.json() : Promise.reject(`HTTP error! status: ${response.status}`))
            .then(data => {
                const geoJsonFormat = new GeoJSON();
                const features = geoJsonFormat.readFeatures(data, { featureProjection: 'EPSG:3857' }) as Feature<Geometry>[];
                initialVectorSource.addFeatures(features);
            })
            .catch(error => console.error("Error loading GeoJSON data:", error));

        initialMap.on('pointermove', (evt: MapBrowserEvent<any>) => {
            // ... (tooltip logic remains the same)
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
                const currentCounts = countrySongCountsRef.current;
                const songCount = isoCode ? (currentCounts.get(isoCode) || 0) : 0; // UPDATED LINE

                let xCoord = 0, yCoord = 0;
                const originalEvent = evt.originalEvent;
                if (originalEvent instanceof PointerEvent) { xCoord = originalEvent.pageX; yCoord = originalEvent.pageY; }
                else if (originalEvent instanceof MouseEvent) { xCoord = originalEvent.pageX; yCoord = originalEvent.pageY; }
                else if (originalEvent instanceof TouchEvent && originalEvent.changedTouches?.length > 0) { xCoord = originalEvent.changedTouches[0].pageX; yCoord = originalEvent.changedTouches[0].pageY;}
                
                setTooltip({ visible: true, content: `${countryName}: ${songCount} song${songCount === 1 ? '' : 's'}`, x: xCoord, y: yCoord });
                if (mapElement.current) mapElement.current.style.cursor = 'pointer';
                return true;
            });
            if (!featureFound) {
                setTooltip(prev => ({ ...prev, visible: false }));
                if (mapElement.current) mapElement.current.style.cursor = '';
            }
        });

        initialMap.on('click', (evt: MapBrowserEvent<any>) => {
            if (!mapRef.current) return;
            const pixel = mapRef.current.getEventPixel(evt.originalEvent);
            mapRef.current.forEachFeatureAtPixel(pixel, (featureAtPixel) => {
                const typedFeature = featureAtPixel as Feature<Geometry>;
                const isoCode = typedFeature.get('ISO3166-1-Alpha-2')?.toUpperCase();
                const countryName = typedFeature.get('name') || 'Unknown';
                if (isoCode) {
                    const isShiftKey = evt.originalEvent.shiftKey;
                    onCountryClickRef.current(isoCode, countryName, isShiftKey); // Use the ref
                }
                return true;
            });
        });
        
        const mapTargetElement = initialMap.getTargetElement();
        const pointerLeaveListener = () => {
            setTooltip(prev => ({ ...prev, visible: false }));
            if (mapElement.current) mapElement.current.style.cursor = '';
        };
        if (mapTargetElement instanceof HTMLElement) {
            mapTargetElement.addEventListener('pointerleave', pointerLeaveListener);
        }

         return () => {
            if (mapTargetElement instanceof HTMLElement) {
                mapTargetElement.removeEventListener('pointerleave', pointerLeaveListener);
            }
            if (mapRef.current) {
                mapRef.current.setTarget(undefined);
                mapRef.current.dispose(); // It's good practice to dispose the map
                mapRef.current = null;
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // EMPTY dependency array: map initializes only once

    // Effect to update country styles (this is for visual changes, not full map re-init)
    useEffect(() => {
        if (!vectorLayerRef.current || !countrySongCounts) {
            return;
        }
        // console.log("Updating map styles due to selectedIsoCodes or countrySongCounts change:", selectedIsoCodes);
        const countriesLayer = vectorLayerRef.current;
        const currentMaxSongCount = Math.max(...Array.from(countrySongCounts.values()), 1);

        const countryStyleFunction = (feature: FeatureLike): Style => {
            const typedFeature = feature as Feature<Geometry>;
            const featureIsoCode = typedFeature.get('ISO3166-1-Alpha-2')?.toUpperCase();
            const songCount = featureIsoCode ? (countrySongCounts.get(featureIsoCode) || 0) : 0;
            const isSelected = featureIsoCode ? selectedIsoCodes.includes(featureIsoCode) : false;

            return new Style({
                fill: new Fill({ color: getCountryColor(songCount, currentMaxSongCount) }),
                stroke: new Stroke({ 
                    color: isSelected ? '#FF8E72' : '#BBBBBB', // Your chosen highlight color
                    width: isSelected ? 2.5 : 1 
                }),
                zIndex: isSelected ? 1 : 0
            });
        };
        countriesLayer.setStyle(countryStyleFunction);
        countriesLayer.changed();
    }, [countrySongCounts, selectedIsoCodes]); // This effect handles style updates

    useEffect(() => {
        if (!isExporting || !mapRef.current) {
            return;
        }

        const map = mapRef.current;
        map.once('rendercomplete', () => {
            try {
                const mapCanvas = document.createElement('canvas');
                const size = map.getSize();
                if (!size) throw new Error("Map size not available.");

                mapCanvas.width = size[0];
                mapCanvas.height = size[1];
                const mapContext = mapCanvas.getContext('2d');
                if (!mapContext) throw new Error("Could not get canvas context.");

                // Iterate through all canvas elements rendered by OpenLayers
                Array.from(map.getViewport().querySelectorAll('.ol-layer canvas, canvas.ol-layer'))
                    .forEach((canvas) => {
                        if (canvas instanceof HTMLCanvasElement && canvas.width > 0) {
                            const opacity = (canvas.parentNode as HTMLElement)?.style.opacity || canvas.style.opacity;
                            mapContext.globalAlpha = opacity === '' ? 1 : Number(opacity);

                            const transform = canvas.style.transform;
                            // Get the transform matrix from the style and apply it
                            if (transform) {
                                const matrix = transform
                                    .match(/^matrix\(([^)]*)\)$/)?.[1]
                                    .split(',')
                                    .map(Number);
                                if (matrix) {
                                    mapContext.setTransform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
                                }
                            }
                            mapContext.drawImage(canvas, 0, 0);
                        }
                    });

                // Reset transform for safety
                mapContext.globalAlpha = 1;
                mapContext.setTransform(1, 0, 0, 1, 0, 0);
                
                // Trigger download
                const link = document.createElement('a');
                link.download = 'spotimap-export.png';
                link.href = mapCanvas.toDataURL();
                link.click();
            } catch (error) {
                console.error("Error exporting map:", error);
            } finally {
                // Signal completion regardless of success or failure
                onExportComplete();
            }
        });

        // Trigger a render to start the process
        map.renderSync();
    }, [isExporting, onExportComplete]);

    return (
        <div className="relative h-full w-full border-nb border-nb-border bg-nb-bg/5 shadow-nb">
            <div ref={mapElement} className="h-full w-full" />
            {tooltip.visible && (
                <div
                    className="pointer-events-none fixed z-[1000] whitespace-nowrap rounded-nb border-nb border-nb-accent bg-nb-bg px-nb-md py-nb-sm text-sm text-nb-text shadow-nb-accent"
                    style={{ top: `${tooltip.y}px`, left: `${tooltip.x + 15}px`, transform: 'translateY(-100%)' }}
                >
                    {tooltip.content}
                </div>
            )}
        </div>
    );
};

export default MapComponent;