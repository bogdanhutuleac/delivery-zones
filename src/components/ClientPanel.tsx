import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import type { DeliveryZone } from '../utils/geoUtils';
import { isPointInPolygon, formatCurrency } from '../utils/geoUtils';
import { 
  Map as MapIcon, 
  Search, 
  MapPin, 
  CheckCircle2, 
  XCircle, 
  DollarSign, 
  Clock, 
  ShoppingBag,
  Info,
  Settings
} from 'lucide-react';

interface ClientPanelProps {
  zones: DeliveryZone[];
  onAdminLogin?: () => void;
}

interface GeocodeResult {
  display_name: string;
  lat: number;
  lon: number;
}

export const ClientPanel: React.FC<ClientPanelProps> = ({ zones, onAdminLogin }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersGroupRef = useRef<L.FeatureGroup | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchResult, setSearchResult] = useState<{
    success: boolean;
    address: string;
    lat: number;
    lng: number;
    zone?: DeliveryZone;
  } | null>(null);

  // Suggestions search on debounce
  useEffect(() => {
    if (searchQuery.trim().length < 4) {
      setSuggestions([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            searchQuery
          )}&limit=5&addressdetails=1&countrycodes=ie`
        );
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data);
        }
      } catch (err) {
        console.error('Error fetching autocomplete:', err);
      }
    }, 600); // 600ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Centering the map: if zones exist, center on the first zone, else London/NYC
    let center: [number, number] = [53.3498, -6.2603]; // default Dublin
    if (zones.length > 0 && zones[0].coordinates.length > 0) {
      center = zones[0].coordinates[0];
    }

    const map = L.map(mapContainerRef.current, {
      zoomControl: false
    }).setView(center, 12);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // CartoDB Voyager map style (premium, beautiful styling)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20
    }).addTo(map);

    const layersGroup = new L.FeatureGroup().addTo(map);

    mapRef.current = map;
    layersGroupRef.current = layersGroup;

    // Center map on user location automatically
    if (zones.length === 0 && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          map.setView([pos.coords.latitude, pos.coords.longitude], 12);
        },
        () => {}
      );
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Sync zones polygons to map
  useEffect(() => {
    const map = mapRef.current;
    const layersGroup = layersGroupRef.current;
    if (!map || !layersGroup) return;

    layersGroup.clearLayers();

    // Fit map to show all zones on load if they exist
    if (zones.length > 0) {
      const bounds = L.latLngBounds([]);
      zones.forEach(zone => {
        if (zone.coordinates.length > 0) {
          const polygon = L.polygon(zone.coordinates, {
            color: zone.color,
            fillColor: zone.color,
            fillOpacity: 0.2,
            weight: 2,
            interactive: true
          });

          // Bind tooltip for users to see area label
          polygon.bindTooltip(`<strong>${zone.name}</strong><br/>Delivery Fee: ${formatCurrency(zone.deliveryFee)}`, {
            direction: 'center',
            className: 'client-tooltip'
          });

          polygon.addTo(layersGroup);
          bounds.extend(zone.coordinates);
        }
      });
      
      // Only fit bounds on initialization if we don't have a search result active
      if (!searchResult) {
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    }
  }, [zones]);

  // Geocode address when user hits search button manually
  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSuggestions([]);
    setShowSuggestions(false);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&limit=1&countrycodes=ie`
      );
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          handleAddressSelect(data[0]);
        } else {
          alert('Could not find that address. Please try adding more detail (city, country, etc.).');
        }
      }
    } catch (err) {
      console.error(err);
      alert('Search failed. Please check your internet connection.');
    } finally {
      setIsSearching(false);
    }
  };

  // Perform point-in-polygon verification
  const handleAddressSelect = (place: GeocodeResult) => {
    const lat = parseFloat(place.lat.toString());
    const lng = parseFloat(place.lon.toString());
    const point: [number, number] = [lat, lng];

    // Find the delivery zone that contains this coordinate
    const containingZone = zones.find(zone => isPointInPolygon(point, zone.coordinates));

    setSearchResult({
      success: !!containingZone && !containingZone.isNoDelivery,
      address: place.display_name,
      lat,
      lng,
      zone: containingZone
    });

    setSearchQuery(place.display_name);
    setShowSuggestions(false);

    // Update Map
    const map = mapRef.current;
    if (map) {
      map.setView([lat, lng], 15);

      // Clean existing marker
      if (markerRef.current) {
        markerRef.current.remove();
      }

      // Add a custom marker showing client location
      const pinIcon = L.divIcon({
        className: 'custom-pin-marker',
        html: `<div style="
          width: 24px;
          height: 24px;
          background: #6366f1;
          border: 3px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(0,0,0,0.5);
          animation: pulse 1.5s infinite;
        "></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([lat, lng], { icon: pinIcon });
      
      // Bind popup
      const popupContent = `
        <div style="font-family: 'Outfit', sans-serif; padding: 4px;">
          <h4 style="font-weight: 600; margin: 0 0 4px; font-size: 13px;">Searched Location</h4>
          <p style="margin: 0; font-size: 11px; color: #6b7280; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${place.display_name}
          </p>
          ${containingZone ? (
            containingZone.isNoDelivery ? `
              <div style="margin-top: 8px; font-size: 11px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 4px; padding: 4px 6px; color: #f87171; font-weight: 600;">
                No Delivery: ${containingZone.name}
              </div>
            ` : `
              <div style="margin-top: 8px; font-size: 11px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 4px; padding: 4px 6px; color: #059669; font-weight: 600;">
                Delivering via ${containingZone.name}
              </div>
            `
          ) : `
            <div style="margin-top: 8px; font-size: 11px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 4px; padding: 4px 6px; color: #dc2626;">
              Outside delivery area
            </div>
          `}
        </div>
      `;

      marker.bindPopup(popupContent).addTo(map).openPopup();
      markerRef.current = marker;
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
      {/* Background decoration (hidden behind map but visible on overlay) */}
      <div className="bg-aura bg-aura-primary"></div>

      {/* Floating Map Container */}
      <div ref={mapContainerRef} className="map-container" style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />

      {/* Top Floating App Bar */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        right: '20px',
        zIndex: 100,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        pointerEvents: 'none'
      }}>
        {/* App Title */}
        <div className="glass-panel" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 18px',
          borderRadius: 'var(--border-radius-md)',
          pointerEvents: 'auto',
          boxShadow: 'var(--shadow-md)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--color-primary) 0%, #a855f7 100%)'
          }}>
            <MapIcon size={16} color="#ffffff" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '16px', letterSpacing: '-0.02em' }}>Delivo</span>
        </div>

        {/* Admin Login Settings Button */}
        {onAdminLogin && (
          <button
            onClick={onAdminLogin}
            className="glass-panel"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: 'var(--border-radius-md)',
              border: '1px solid var(--border-color)',
              cursor: 'pointer',
              pointerEvents: 'auto',
              color: 'var(--text-main)',
              fontSize: '14px',
              fontWeight: 600,
              transition: 'all var(--transition-fast)'
            }}
            onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
            onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
          >
            <Settings size={16} color="var(--color-primary)" />
            Admin Login
          </button>
        )}
      </div>

      {/* Floating Center Search & Result Overlay */}
      <div style={{
        position: 'absolute',
        top: '80px',
        left: '20px',
        right: '20px',
        maxWidth: '480px',
        margin: '0 auto',
        zIndex: 90,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        {/* Search Panel Card */}
        <div className="glass-panel animate-slide-up" style={{
          padding: '24px',
          borderRadius: 'var(--border-radius-lg)',
          pointerEvents: 'auto',
          boxShadow: 'var(--shadow-lg)'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px', letterSpacing: '-0.01em' }}>
            Delivery Checker
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '18px' }}>
            Enter your address to verify if we can deliver to you.
          </p>

          <form onSubmit={handleManualSearch} className="search-container">
            <div style={{ position: 'relative', display: 'flex', gap: '8px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <MapPin size={18} color="var(--text-muted)" style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)'
                }} />
                <input
                  type="text"
                  placeholder="Enter street, city, or postal code..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="glass-input"
                  style={{ width: '100%', paddingLeft: '44px', paddingRight: '12px' }}
                />
              </div>
              <button 
                type="submit" 
                className="btn-primary" 
                style={{ width: '48px', height: '48px', padding: 0, borderRadius: 'var(--border-radius-md)', flexShrink: 0 }}
                disabled={isSearching}
              >
                {isSearching ? <span className="loading-spinner" style={{ width: '18px', height: '18px' }}></span> : <Search size={18} />}
              </button>
            </div>

            {/* Nominatim Geocoder Autocomplete Suggestions list */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="suggestions-list">
                {suggestions.map((place, idx) => {
                  // Split display name for cleaner look (bold the first part)
                  const nameParts = place.display_name.split(',');
                  const primaryName = nameParts[0];
                  const secondaryName = nameParts.slice(1).join(',').trim();
                  
                  return (
                    <div
                      key={idx}
                      className="suggestion-item"
                      onClick={() => handleAddressSelect(place)}
                    >
                      <strong>{primaryName}</strong>
                      {secondaryName && <span>{secondaryName}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </form>
        </div>

        {/* Results Panel Card */}
        {searchResult && (
          <div className="glass-panel animate-fade-in" style={{
            padding: '24px',
            borderRadius: 'var(--border-radius-lg)',
            pointerEvents: 'auto',
            boxShadow: 'var(--shadow-lg)',
            borderLeft: `5px solid ${searchResult.success ? 'var(--color-success)' : 'var(--color-danger)'}`,
            position: 'relative'
          }}>
            <button 
              onClick={() => setSearchResult(null)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '18px',
                lineHeight: '1'
              }}
            >
              ×
            </button>

            {searchResult.success && searchResult.zone ? (
              /* Success View */
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <CheckCircle2 size={24} color="var(--color-success)" style={{ flexShrink: 0 }} />
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
                      Yes! We Deliver Here
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Your address lies inside: <strong>{searchResult.zone.name}</strong>
                    </p>
                  </div>
                </div>

                {/* Delivery zone parameters */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  padding: '14px',
                  borderRadius: 'var(--border-radius-sm)',
                  border: '1px solid var(--border-color)',
                  marginBottom: '14px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)'
                    }}>
                      <DollarSign size={14} color="var(--color-success)" />
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Delivery Fee</div>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{formatCurrency(searchResult.zone.deliveryFee)}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(99, 102, 241, 0.1)'
                    }}>
                      <Clock size={14} color="var(--color-primary)" />
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Est. Time</div>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{searchResult.zone.deliveryTime || '30-45 mins'}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', gridColumn: 'span 2' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(245, 158, 11, 0.1)'
                    }}>
                      <ShoppingBag size={14} color="var(--color-warning)" />
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Minimum Order</div>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{formatCurrency(searchResult.zone.minOrder)}</div>
                    </div>
                  </div>
                </div>

                {searchResult.zone.message && (
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'flex-start',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    backgroundColor: 'rgba(255, 255, 255, 0.01)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    padding: '10px 12px',
                    borderRadius: '8px'
                  }}>
                    <Info size={14} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{searchResult.zone.message}</span>
                  </div>
                )}
              </div>
            ) : (
              /* Failure View */
              <div>
                {searchResult.zone && searchResult.zone.isNoDelivery ? (
                  /* Inside a No-Delivery Zone */
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                      <XCircle size={24} color="var(--color-danger)" style={{ flexShrink: 0 }} />
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
                          Restricted Delivery Area
                        </h3>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Address matches: <strong>{searchResult.zone.name}</strong>
                        </p>
                      </div>
                    </div>
                    
                    <div style={{
                      backgroundColor: 'var(--color-danger-bg)',
                      border: '1px solid var(--color-danger-border)',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: 'var(--text-main)',
                      lineHeight: '1.4'
                    }}>
                      <strong>Notice:</strong> {searchResult.zone.message || 'We cannot deliver to this area due to regional or access restrictions.'}
                    </div>
                  </div>
                ) : (
                  /* Completely outside any zone */
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <XCircle size={24} color="var(--color-danger)" style={{ flexShrink: 0 }} />
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
                          Outside Delivery Range
                        </h3>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          Sorry, we don't deliver to this address yet.
                        </p>
                      </div>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                      We are constantly expanding! Check the highlighted zones on the map to see our current service area bounds.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Legend / Quick Stats */}
      {zones.length > 0 && !searchResult && (
        <div className="glass-panel" style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          zIndex: 100,
          padding: '12px 16px',
          borderRadius: 'var(--border-radius-md)',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxWidth: '240px'
        }}>
          <h4 style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Service Areas
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {zones.map(zone => (
              <div key={zone.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <span style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: zone.color,
                  flexShrink: 0
                }} />
                <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {zone.name} ({formatCurrency(zone.deliveryFee)})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
