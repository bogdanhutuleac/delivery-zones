import { useState, useEffect } from "react";
import { ClientPanel } from "./components/ClientPanel";
import { AdminLogin } from "./components/AdminLogin";
import { AdminPanel } from "./components/AdminPanel";
import type { DeliveryZone } from "./utils/geoUtils";

// Default mock zones centered around Dublin, Ireland for demo purposes
const DEFAULT_DEMO_ZONES: DeliveryZone[] = [
  {
    id: "demo_zone_1",
    name: "Dublin Central",
    coordinates: [
      [53.355, -6.275],
      [53.34, -6.275],
      [53.338, -6.24],
      [53.355, -6.24],
    ],
    deliveryFee: 2.99,
    minOrder: 15.0,
    deliveryTime: "20-35 mins",
    message: "Free delivery on orders over $30!",
    color: "#6366f1", // Indigo
  },
  {
    id: "demo_zone_2",
    name: "Dublin Port (NO DELIVERY)",
    coordinates: [
      [53.355, -6.21],
      [53.34, -6.21],
      [53.34, -6.18],
      [53.355, -6.18],
    ],
    deliveryFee: 0,
    minOrder: 0,
    deliveryTime: "",
    message:
      "No deliveries to the port area due to access safety restrictions.",
    color: "#f43f5e", // Rose Red
    isNoDelivery: true,
  },
];

// ==================== CONFIGURATION ====================
let ENABLE_ADMIN = false;
// TO ENABLE THE ADMIN PANEL, UNCOMMENT THE LINE BELOW.
// TO DISABLE IT FOR CLIENT DEPLOYMENT, COMMENT IT OUT.
ENABLE_ADMIN = false;
// =======================================================

function App() {
  const [view, setView] = useState<"client" | "login" | "admin">("client");
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load zones on startup (LocalStorage drafts -> zones.json -> Demo fallbacks)
  useEffect(() => {
    const fetchZones = async () => {
      // 1. Check local storage drafts
      const draft = localStorage.getItem("delivo_zones_draft");
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setZones(parsed);
            setIsInitialized(true);
            return;
          }
        } catch (e) {
          console.error("Failed to parse draft from localStorage:", e);
        }
      }

      // 2. Fetch public/zones.json if available
      try {
        const res = await fetch("/zones.json");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setZones(data);
            setIsInitialized(true);
            return;
          }
        }
      } catch (e) {
        console.log("No zones.json found on server. Using default demo data.");
      }

      // 3. Fallback to demo default zones
      setZones(DEFAULT_DEMO_ZONES);
      setIsInitialized(true);
    };

    fetchZones();
  }, []);

  const handleLoginSuccess = () => {
    setView("admin");
  };

  const handleLogout = () => {
    setView("client");
  };

  if (!isInitialized) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          backgroundColor: "#0b0f19",
          color: "#ffffff",
          fontFamily: "'Outfit', sans-serif",
        }}
      >
        <div
          className="loading-spinner"
          style={{ width: "40px", height: "40px", borderWidth: "4px" }}
        ></div>
        <p
          style={{
            marginTop: "16px",
            fontSize: "16px",
            fontWeight: 500,
            color: "var(--text-muted)",
          }}
        >
          Loading map layout...
        </p>
      </div>
    );
  }

  return (
    <div className="main-wrapper animate-fade-in">
      {view === "client" && (
        <ClientPanel
          zones={zones}
          onAdminLogin={ENABLE_ADMIN ? () => setView("login") : undefined}
        />
      )}

      {ENABLE_ADMIN && view === "login" && (
        <AdminLogin
          onLoginSuccess={handleLoginSuccess}
          onBackToClient={() => setView("client")}
        />
      )}

      {ENABLE_ADMIN && view === "admin" && (
        <AdminPanel
          zones={zones}
          setZones={setZones}
          onLogout={handleLogout}
          onViewClient={() => setView("client")}
        />
      )}
    </div>
  );
}

export default App;
