import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import type { DeliveryZone } from '../utils/geoUtils';
import { ZONE_COLORS, formatCurrency } from '../utils/geoUtils';
import { 
  Map as MapIcon, 
  Download, 
  Trash2, 
  Save, 
  LogOut, 
  Plus, 
  ChevronLeft, 
  Edit3, 
  DollarSign, 
  Clock, 
  ShoppingBag, 
  Info,
  HelpCircle,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface AdminPanelProps {
  zones: DeliveryZone[];
  setZones: React.Dispatch<React.SetStateAction<DeliveryZone[]>>;
  onLogout: () => void;
  onViewClient: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ zones, setZones, onLogout, onViewClient }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersGroupRef = useRef<L.FeatureGroup | null>(null);
  
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(true);
  const [showInstructions, setShowInstructions] = useState(true);
  const [isDrawingActive, setIsDrawingActive] = useState(false);

  // Form values for the selected zone
  const [name, setName] = useState('');
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [minOrder, setMinOrder] = useState<number>(0);
  const [deliveryTime, setDeliveryTime] = useState('');
  const [message, setMessage] = useState('');
  const [color, setColor] = useState('');
  const [isNoDelivery, setIsNoDelivery] = useState(false);

  const selectedZone = zones.find(z => z.id === selectedZoneId);

  // Sync form values when the selected zone changes
  useEffect(() => {
    if (selectedZone) {
      setName(selectedZone.name);
      setDeliveryFee(selectedZone.deliveryFee);
      setMinOrder(selectedZone.minOrder);
      setDeliveryTime(selectedZone.deliveryTime);
      setMessage(selectedZone.message);
      setColor(selectedZone.color);
      setIsNoDelivery(!!selectedZone.isNoDelivery);
    } else {
      setName('');
      setDeliveryFee(0);
      setMinOrder(0);
      setDeliveryTime('');
      setMessage('');
      setColor('');
      setIsNoDelivery(false);
    }
  }, [selectedZoneId, selectedZone]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Create Leaflet Map centered on default location (Dublin or user's polygons center)
    let center: [number, number] = [53.3498, -6.2603]; // Dublin
    if (zones.length > 0 && zones[0].coordinates.length > 0) {
      center = zones[0].coordinates[0];
    }

    const map = L.map(mapContainerRef.current, {
      zoomControl: false // Custom placement later or default on right
    }).setView(center, 13);
    
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Add CartoDB Voyager map tiles (Free, beautiful, light/dark responsive look)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20
    }).addTo(map);

    // Initialize FeatureGroup to hold our zones
    const layersGroup = new L.FeatureGroup();
    layersGroup.addTo(map);

    mapRef.current = map;
    layersGroupRef.current = layersGroup;

    // Try to center map on user's current location if no zones exist
    if (zones.length === 0 && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          map.setView([pos.coords.latitude, pos.coords.longitude], 13);
        },
        () => {} // Ignore errors
      );
    }

    // Implement right-click drag panning (crucial for drawing mode)
    let isRightDragging = false;
    let lastMousePos = { x: 0, y: 0 };

    const handleMapMouseDown = (e: L.LeafletMouseEvent) => {
      // 2 is the code for right-click
      if (e.originalEvent.button === 2) {
        isRightDragging = true;
        lastMousePos = {
          x: e.originalEvent.clientX,
          y: e.originalEvent.clientY
        };
        map.dragging.disable();
      }

      // 1 is the code for middle-click (scroll-click)
      if (e.originalEvent.button === 1) {
        e.originalEvent.preventDefault();
        
        const activeShape = map.pm.Draw.getActiveShape();
        if (activeShape) {
          const drawInstance = (map.pm.Draw as any)[activeShape];
          if (drawInstance && typeof drawInstance._removeLastVertex === 'function') {
            drawInstance._removeLastVertex();
          }
        }
      }
    };

    const handleMapMouseMove = (e: L.LeafletMouseEvent) => {
      if (isRightDragging) {
        const dx = e.originalEvent.clientX - lastMousePos.x;
        const dy = e.originalEvent.clientY - lastMousePos.y;
        
        map.panBy([-dx, -dy], { animate: false });
        
        lastMousePos = {
          x: e.originalEvent.clientX,
          y: e.originalEvent.clientY
        };
      }
    };

    const handleMapMouseUp = (e: L.LeafletMouseEvent) => {
      if (e.originalEvent.button === 2) {
        isRightDragging = false;
        map.dragging.enable();
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleDOMMouseDown = (e: MouseEvent) => {
      // Prevent browser autoscroll icon on middle click
      if (e.button === 1) {
        e.preventDefault();
      }
    };

    map.on('mousedown', handleMapMouseDown);
    map.on('mousemove', handleMapMouseMove);
    map.on('mouseup', handleMapMouseUp);

    const container = mapContainerRef.current;
    if (container) {
      container.addEventListener('contextmenu', handleContextMenu);
      container.addEventListener('mousedown', handleDOMMouseDown);
    }

    // Configure Geoman Drawing Plugin
    map.pm.addControls({
      position: 'topleft',
      drawMarker: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawRectangle: true,
      drawPolygon: true,
      drawCircle: false,
      editMode: true,
      dragMode: true,
      cutPolygon: false,
      removalMode: true,
    });

    // Translate/customize PM tooltips
    map.pm.setLang('en');

    // Set global options for editing: left-click to remove vertex, and don't delete layer when vertex count goes below 3
    map.pm.setGlobalOptions({
      removeVertexOn: 'click',
      removeLayerBelowMinVertexCount: false,
    });

    map.on('pm:drawstart', () => {
      setIsDrawingActive(true);
    });

    map.on('pm:drawend', () => {
      setIsDrawingActive(false);
    });

    // Listen to vertices being added during drawing, so they can be deleted by clicking on them
    map.on('pm:vertexadded', (e: any) => {
      const marker = e.marker;
      if (marker) {
        marker.on('click', (ev: any) => {
          L.DomEvent.stopPropagation(ev);
          ev.originalEvent.preventDefault();

          const activeShape = map.pm.Draw.getActiveShape();
          if (activeShape) {
            const drawInstance = (map.pm.Draw as any)[activeShape];
            if (drawInstance && drawInstance._markers) {
              const idx = drawInstance._markers.indexOf(marker);
              if (idx === 0) {
                // Let the first marker close the shape natively
                return;
              }
              
              if (idx > 0) {
                const markers = drawInstance._markers;
                // If it's the last vertex, use Geoman's native removal
                if (idx === markers.length - 1) {
                  if (typeof drawInstance._removeLastVertex === 'function') {
                    drawInstance._removeLastVertex();
                  }
                  return;
                }

                // Remove intermediate marker layer
                if (drawInstance._layerGroup) {
                  drawInstance._layerGroup.removeLayer(marker);
                }
                markers.splice(idx, 1);

                // Update coordinates of drawing layer
                let coords = drawInstance._layer.getLatLngs();
                let isNested = false;
                let latlngsToUpdate = coords;
                if (Array.isArray(coords[0])) {
                  isNested = true;
                  latlngsToUpdate = coords[0];
                }

                latlngsToUpdate.splice(idx, 1);
                
                if (isNested) {
                  drawInstance._layer.setLatLngs([latlngsToUpdate]);
                } else {
                  drawInstance._layer.setLatLngs(latlngsToUpdate);
                }

                if (Array.isArray(drawInstance._layer._latlngInfo)) {
                  drawInstance._layer._latlngInfo.splice(idx, 1);
                }

                if (typeof drawInstance._syncHintLine === 'function') {
                  drawInstance._syncHintLine();
                }
                if (typeof drawInstance._setTooltipText === 'function') {
                  drawInstance._setTooltipText();
                }
                if (typeof drawInstance._change === 'function') {
                  drawInstance._change(drawInstance._layer.getLatLngs());
                }
              }
            }
          }
        });
      }
    });

    // Handle PM creation of shape
    map.on('pm:create', (e) => {
      const { layer } = e;
      
      // Extract coordinates from drawn layer
      let coordinates: [number, number][] = [];
      if (layer instanceof L.Polygon) {
        const latlngs = layer.getLatLngs();
        // Geoman might return nested array for polygon
        if (Array.isArray(latlngs)) {
          const first = latlngs[0];
          if (Array.isArray(first)) {
            coordinates = first.map((ll: any) => [ll.lat, ll.lng]);
          } else {
            coordinates = latlngs.map((ll: any) => [ll.lat, ll.lng]);
          }
        }
      }

      // Remove the drawn layer immediately since we will render it via react state
      layer.remove();

      if (coordinates.length < 3) return;

      const randomColor = ZONE_COLORS[Math.floor(Math.random() * ZONE_COLORS.length)].value;
      const newZoneId = `zone_${Date.now()}`;
      const newZone: DeliveryZone = {
        id: newZoneId,
        name: `Zone ${zones.length + 1}`,
        coordinates,
        deliveryFee: 0,
        minOrder: 0,
        deliveryTime: '30-45 mins',
        message: 'Free delivery in this area!',
        color: randomColor
      };

      setZones(prev => [...prev, newZone]);
      setSelectedZoneId(newZoneId);
      setIsSaved(false);
    });

    return () => {
      if (container) {
        container.removeEventListener('contextmenu', handleContextMenu);
        container.removeEventListener('mousedown', handleDOMMouseDown);
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update map layers when zones array changes
  useEffect(() => {
    const map = mapRef.current;
    const layersGroup = layersGroupRef.current;
    if (!map || !layersGroup) return;

    // Clear existing layers
    layersGroup.clearLayers();

    zones.forEach(zone => {
      const isSelected = zone.id === selectedZoneId;
      
      const polygon = L.polygon(zone.coordinates, {
        color: zone.color,
        fillColor: zone.color,
        fillOpacity: isSelected ? 0.45 : 0.25,
        weight: isSelected ? 4 : 2,
        dashArray: isSelected ? '6, 6' : undefined,
        pmIgnore: false // Let Geoman edit it
      });

      // Bind click to select zone
      polygon.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setSelectedZoneId(zone.id);
      });

      // Listen for Geoman edit/update/vertex removal events on the polygon itself
      const handleGeometryChange = () => {
        const latlngs = polygon.getLatLngs();
        let updatedCoords: [number, number][] = [];
        if (Array.isArray(latlngs)) {
          const first = latlngs[0];
          if (Array.isArray(first)) {
            updatedCoords = first.map((ll: any) => [ll.lat, ll.lng]);
          } else {
            updatedCoords = latlngs.map((ll: any) => [ll.lat, ll.lng]);
          }
        }
        
        if (updatedCoords.length >= 3) {
          setZones(prev => prev.map(z => z.id === zone.id ? { ...z, coordinates: updatedCoords } : z));
          setIsSaved(false);
        }
      };

      polygon.on('pm:edit', handleGeometryChange);
      polygon.on('pm:vertexremoved', handleGeometryChange);

      // Listen for Geoman deletion tool
      polygon.on('pm:remove', () => {
        setZones(prev => prev.filter(z => z.id !== zone.id));
        if (selectedZoneId === zone.id) {
          setSelectedZoneId(null);
        }
        setIsSaved(false);
      });

      polygon.addTo(layersGroup);

      // Add simple text label tooltip
      polygon.bindTooltip(zone.name, {
        permanent: true,
        direction: 'center',
        className: 'custom-map-tooltip'
      });
      // Style the tooltip in JS dynamically or in CSS
    });
  }, [zones, selectedZoneId]);

  // Zoom to a specific zone when clicked in list
  const handleZoomToZone = (zone: DeliveryZone) => {
    setSelectedZoneId(zone.id);
    const map = mapRef.current;
    if (map && zone.coordinates.length > 0) {
      const bounds = L.latLngBounds(zone.coordinates);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  // Move a zone up or down in the priority order
  const handleMoveZone = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === zones.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updatedZones = [...zones];
    
    // Swap elements
    const temp = updatedZones[index];
    updatedZones[index] = updatedZones[targetIndex];
    updatedZones[targetIndex] = temp;

    setZones(updatedZones);
    setIsSaved(false);
  };

  // Trigger polygon drawing programmatically
  const handleAddNewZone = () => {
    const map = mapRef.current;
    if (map) {
      map.pm.enableDraw('Polygon');
    }
  };

  // Undo the last placed point during drawing mode
  const handleUndoLastPoint = () => {
    const map = mapRef.current;
    if (map) {
      const activeShape = map.pm.Draw.getActiveShape();
      if (activeShape) {
        const drawInstance = (map.pm.Draw as any)[activeShape];
        if (drawInstance && typeof drawInstance._removeLastVertex === 'function') {
          drawInstance._removeLastVertex();
        }
      }
    }
  };

  // Save changes to localStorage draft
  const handleSaveDraft = () => {
    localStorage.setItem('delivo_zones_draft', JSON.stringify(zones));
    setIsSaved(true);
    alert('Draft saved locally! Remember to download zones.json and upload it to GitHub to go live.');
  };

  // Export zones to zones.json file
  const handleExportJSON = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(zones, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', 'zones.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    
    // Also save draft automatically
    localStorage.setItem('delivo_zones_draft', JSON.stringify(zones));
    setIsSaved(true);
  };

  // Update selected zone details from form
  const handleUpdateZoneDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedZoneId) return;

    setZones(prev => prev.map(z => {
      if (z.id === selectedZoneId) {
        return {
          ...z,
          name,
          deliveryFee: isNoDelivery ? 0 : deliveryFee,
          minOrder: isNoDelivery ? 0 : minOrder,
          deliveryTime: isNoDelivery ? '' : deliveryTime,
          message,
          color,
          isNoDelivery
        };
      }
      return z;
    }));

    setIsSaved(false);
  };

  const handleDeleteZone = (id: string) => {
    if (confirm('Are you sure you want to delete this delivery zone?')) {
      setZones(prev => prev.filter(z => z.id !== id));
      if (selectedZoneId === id) {
        setSelectedZoneId(null);
      }
      setIsSaved(false);
    }
  };

  return (
    <div className="admin-layout">
      {/* Sidebar Controls */}
      <div className="admin-sidebar glass-panel">
        {/* Header */}
        <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapIcon size={22} className="text-indigo-400" color="var(--color-primary)" />
              <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Delivo Admin</h1>
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: '20px',
              backgroundColor: 'var(--color-primary-light)',
              color: 'var(--color-primary)'
            }}>
              Editor Mode
            </span>
          </div>
          
          <button 
            onClick={onViewClient}
            className="btn-secondary" 
            style={{ width: '100%', padding: '8px 12px', fontSize: '13px', display: 'flex', justifyContent: 'center', gap: '6px' }}
          >
            <ChevronLeft size={16} />
            Customer Map View
          </button>
        </div>

        {/* Info panel */}
        {showInstructions && (
          <div style={{
            margin: '16px 20px 0',
            padding: '12px 16px',
            borderRadius: 'var(--border-radius-sm)',
            backgroundColor: 'rgba(99, 102, 241, 0.06)',
            border: '1px dashed var(--border-color)',
            fontSize: '13px',
            color: 'var(--text-muted)',
            position: 'relative'
          }}>
            <button 
              onClick={() => setShowInstructions(false)}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ×
            </button>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginTop: '2px' }}>
              <HelpCircle size={16} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>How to draw zones:</strong>
                <ol style={{ marginLeft: '16px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <li>Click the Polygon icon ⬡ on the map toolbar.</li>
                  <li>Click on the map to place corners of your zone.</li>
                  <li>Click the first point again to close and complete the zone.</li>
                  <li>Click on a zone to edit its details. Drag vertices to change shape.</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        <div style={{ padding: '20px', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h3 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', margin: 0, fontWeight: 600 }}>
              Delivery Zones ({zones.length})
            </h3>
            <div style={{ display: 'flex', gap: '6px' }}>
              {isDrawingActive ? (
                <button 
                  onClick={handleUndoLastPoint}
                  className="btn-danger"
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: 'none'
                  }}
                  title="Delete the last placed point of the drawing shape"
                >
                  Undo Last Point
                </button>
              ) : (
                <button 
                  onClick={handleAddNewZone}
                  className="btn-primary"
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    borderRadius: '8px',
                    boxShadow: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Draw a new delivery zone polygon on the map"
                >
                  <Plus size={12} />
                  Add Zone
                </button>
              )}
            </div>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: '1.3' }}>
            💡 Zones at the top have priority. Move overlapping restricted zones to the top of the list.
          </p>

          {zones.length === 0 ? (
            <div style={{ padding: '30px 10px', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: 'var(--border-radius-md)' }}>
              <Plus size={24} color="var(--text-muted)" style={{ margin: '0 auto 8px' }} />
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No zones drawn yet.</p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Use the polygon drawing tool on the map to start.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
              {zones.map((zone, idx) => {
                const isSelected = zone.id === selectedZoneId;
                return (
                  <div 
                    key={zone.id}
                    onClick={() => handleZoomToZone(zone)}
                    style={{
                      padding: '12px',
                      borderRadius: 'var(--border-radius-sm)',
                      background: isSelected ? 'var(--color-primary-light)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-color)'}`,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: zone.color,
                        flexShrink: 0
                      }} />
                      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', backgroundColor: 'rgba(255,255,255,0.05)', padding: '1px 4px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.03)' }}>
                            #{idx + 1}
                          </span>
                          {zone.name}
                          {zone.isNoDelivery && (
                            <span style={{ fontSize: '9px', backgroundColor: 'var(--color-danger-bg)', color: '#f87171', border: '1px solid var(--color-danger-border)', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                              NO DELIVERY
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {zone.isNoDelivery ? (
                            <span style={{ color: '#f87171', fontWeight: 500 }}>Service Restricted</span>
                          ) : (
                            <span style={{ display: 'flex', gap: '8px' }}>
                              <span>Fee: {formatCurrency(zone.deliveryFee)}</span>
                              <span>•</span>
                              <span>Min: {formatCurrency(zone.minOrder)}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '8px' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleMoveZone(idx, 'up')}
                        disabled={idx === 0}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: idx === 0 ? 'rgba(255,255,255,0.08)' : 'var(--text-muted)',
                          cursor: idx === 0 ? 'not-allowed' : 'pointer',
                          padding: '4px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseOver={(e) => { if (idx > 0) e.currentTarget.style.color = 'var(--color-primary)'; }}
                        onMouseOut={(e) => { if (idx > 0) e.currentTarget.style.color = 'var(--text-muted)'; }}
                        title="Move Up (Increase Priority)"
                      >
                        <ArrowUp size={13} />
                      </button>

                      <button
                        onClick={() => handleMoveZone(idx, 'down')}
                        disabled={idx === zones.length - 1}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: idx === zones.length - 1 ? 'rgba(255,255,255,0.08)' : 'var(--text-muted)',
                          cursor: idx === zones.length - 1 ? 'not-allowed' : 'pointer',
                          padding: '4px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseOver={(e) => { if (idx < zones.length - 1) e.currentTarget.style.color = 'var(--color-primary)'; }}
                        onMouseOut={(e) => { if (idx < zones.length - 1) e.currentTarget.style.color = 'var(--text-muted)'; }}
                        title="Move Down (Decrease Priority)"
                      >
                        <ArrowDown size={13} />
                      </button>

                      <button 
                        onClick={() => handleDeleteZone(zone.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.color = '#f87171'}
                        onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                        title="Delete Zone"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Zone Edit Form */}
        {selectedZone && (
          <div style={{ 
            padding: '20px', 
            borderTop: '1px solid var(--border-color)', 
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'rgba(255,255,255,0.01)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={16} color="var(--color-primary)" />
                <h4 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Edit Zone Details</h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedZoneId(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  padding: '2px 6px',
                  lineHeight: '1',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'}
                onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                title="Close editing details"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleUpdateZoneDetails} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <input 
                  type="checkbox" 
                  id="isNoDelivery"
                  checked={isNoDelivery} 
                  onChange={(e) => {
                    setIsNoDelivery(e.target.checked);
                    if (e.target.checked) {
                      setColor('#f43f5e'); // Default to rose red for no-delivery area
                    }
                  }}
                  style={{
                    width: '16px',
                    height: '16px',
                    accentColor: '#f43f5e',
                    cursor: 'pointer'
                  }}
                />
                <label htmlFor="isNoDelivery" style={{ fontSize: '13px', fontWeight: 600, color: '#f87171', cursor: 'pointer' }}>
                  Mark as No-Delivery Area
                </label>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>Zone Label Name</label>
                <input 
                  type="text" 
                  className="glass-input" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '8px' }}
                  required
                />
              </div>

              {!isNoDelivery && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>Delivery Fee ($)</label>
                      <div style={{ position: 'relative' }}>
                        <DollarSign size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input 
                          type="number" 
                          min="0"
                          step="0.01"
                          className="glass-input" 
                          value={deliveryFee} 
                          onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                          style={{ padding: '8px 8px 8px 24px', fontSize: '14px', borderRadius: '8px', width: '100%' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>Min. Order ($)</label>
                      <div style={{ position: 'relative' }}>
                        <ShoppingBag size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input 
                          type="number" 
                          min="0"
                          step="0.01"
                          className="glass-input" 
                          value={minOrder} 
                          onChange={(e) => setMinOrder(parseFloat(e.target.value) || 0)}
                          style={{ padding: '8px 8px 8px 24px', fontSize: '14px', borderRadius: '8px', width: '100%' }}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>Estimated Delivery Time</label>
                    <div style={{ position: 'relative' }}>
                      <Clock size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }} />
                      <input 
                        type="text" 
                        placeholder="e.g. 20-30 mins"
                        className="glass-input" 
                        value={deliveryTime} 
                        onChange={(e) => setDeliveryTime(e.target.value)}
                        style={{ padding: '8px 8px 8px 24px', fontSize: '14px', borderRadius: '8px', width: '100%' }}
                      />
                    </div>
                  </div>
                </>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>
                  {isNoDelivery ? 'Reason / Customer Message' : 'Custom Message'}
                </label>
                <textarea 
                  className="glass-input" 
                  value={message} 
                  onChange={(e) => setMessage(e.target.value)}
                  style={{ padding: '8px 12px', fontSize: '13px', borderRadius: '8px', resize: 'vertical', minHeight: '60px' }}
                  placeholder={isNoDelivery ? "e.g. No deliveries to this area due to toll bridge access issues." : "e.g. Free delivery over $40"}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>Map Zone Color</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                  {ZONE_COLORS.map(col => (
                    <button
                      key={col.value}
                      type="button"
                      onClick={() => setColor(col.value)}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: col.value,
                        border: color === col.value ? '2px solid #ffffff' : '1px solid rgba(0,0,0,0.2)',
                        boxShadow: color === col.value ? '0 0 0 2px var(--color-primary)' : 'none',
                        cursor: 'pointer',
                        padding: 0
                      }}
                      title={col.name}
                    />
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button 
                  type="button"
                  onClick={() => setSelectedZoneId(null)}
                  className="btn-secondary" 
                  style={{ flex: 1, padding: '10px', fontSize: '14px', borderRadius: '8px', display: 'flex', justifyContent: 'center' }}
                >
                  Close
                </button>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  style={{ flex: 2, padding: '10px', fontSize: '14px', borderRadius: '8px', boxShadow: 'none', display: 'flex', justifyContent: 'center' }}
                >
                  Apply Changes
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Save & Export Actions */}
        <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={handleSaveDraft}
              className="btn-secondary" 
              style={{ flex: 1, padding: '10px 12px', fontSize: '13px', display: 'flex', gap: '6px', justifyContent: 'center' }}
            >
              <Save size={16} />
              Save Draft
              {!isSaved && (
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#ef4444',
                  display: 'inline-block'
                }} />
              )}
            </button>
            <button 
              onClick={handleExportJSON}
              className="btn-primary" 
              style={{ flex: 1, padding: '10px 12px', fontSize: '13px', display: 'flex', gap: '6px', justifyContent: 'center' }}
            >
              <Download size={16} />
              Publish File
            </button>
          </div>

          <div style={{
            fontSize: '11px',
            color: 'var(--text-muted)',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px', fontWeight: 600 }}>
              <Info size={12} color="var(--color-primary)" />
              <span>To Deploy Changes Online:</span>
            </div>
            Click <strong>Publish File</strong>, download <code>zones.json</code>, and upload it into your GitHub repository root/public folder!
          </div>

          <button 
            onClick={onLogout}
            style={{
              background: 'none',
              border: 'none',
              color: '#f87171',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 500,
              padding: '8px',
              marginTop: '6px'
            }}
          >
            <LogOut size={14} />
            Log Out Session
          </button>
        </div>
      </div>

      {/* Full height map container */}
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <div ref={mapContainerRef} className="map-container" />
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          zIndex: 100,
          pointerEvents: 'none',
          backgroundColor: 'var(--bg-card-solid)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '11px',
          color: 'var(--text-muted)',
          boxShadow: 'var(--shadow-md)'
        }}>
          💡 <strong>Tip:</strong> Double-click a point on the map inside a zone to start adjusting its shape boundaries.
        </div>
      </div>
    </div>
  );
};
