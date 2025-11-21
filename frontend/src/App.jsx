import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import ResetPasswordPage from './pages/ResetPasswordPage';
import authService from './services/authService';
import reportService from './services/reportService';
import { getStatusLabel } from './utils/reportStatus';
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { FaWater, FaTrashAlt, FaTree, FaRoad, FaMapMarkerAlt, FaRecycle, FaLocationArrow } from 'react-icons/fa';
import { CgMoreVertical } from 'react-icons/cg';
import MarkerClusterGroup from 'react-leaflet-markercluster';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminDashboard from './pages/AdminDashboard';
import MyReportsPage from './pages/MyReportsPage';
import UserProfilePage from './pages/UserProfilePage';
import LandingPage from './pages/LandingPage';

import Navbar from './components/Navbar';
import ReportDetailsOverlay from './components/ReportDetailsOverlay';
import ReportForm from './ReportForm';

import './App.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

const addressCache = new Map();

const problemCategories = [
  {
    id: 'alagamento',
    label: 'Alagamento',
    icon: <FaWater />,
    failureMessage: 'A imagem não parece mostrar ruas ou calçadas alagadas. Tente registrar a água cobrindo a via.',
  },
  {
    id: 'foco_lixo',
    label: 'Foco de lixo',
    icon: <FaTrashAlt />,
    failureMessage: 'A imagem não parece conter acúmulo de lixo. Procure focar nos sacos ou montes de resíduos.',
  },
  {
    id: 'arvore_queda',
    label: 'Árvore caída',
    icon: <FaTree />,
    failureMessage: 'Não identificamos uma árvore caída ou tronco quebrado na foto. Mostre o tronco no chão ou prestes a cair.',
  },
  {
    id: 'bueiro_entupido',
    label: 'Bueiro entupido',
    icon: <CgMoreVertical />,
    failureMessage: 'A imagem não evidencia um bueiro entupido. Foque na tampa ou grade obstruída.',
  },
  {
    id: 'buraco_via',
    label: 'Buraco na via',
    icon: <FaRoad />,
    failureMessage: 'Não foi possível ver buracos ou rachaduras na via. Aproxime o foco do dano no asfalto.',
  },
];

const problemTypes = problemCategories.reduce((acc, category) => {
  acc[category.label] = category.icon;
  return acc;
}, {});

const BASE_COLORS = {
  Alagamento: '#1e90ff',
  'Foco de lixo': '#e67e22',
  'Árvore caída': '#27ae60',
  'Bueiro entupido': '#8e44ad',
  'Buraco na via': '#c0392b',
  default: '#3498db',
};

const defaultIcon = (color = BASE_COLORS.default) =>
  L.divIcon({
    html: renderToStaticMarkup(<FaMapMarkerAlt style={{ fontSize: '24px', color }} />),
    className: 'dummy',
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
  });

const userLocationIcon = L.divIcon({
  html: renderToStaticMarkup(
    <div className="user-location-icon">
      <div className="pulse pulse-1" />
      <div className="pulse pulse-2" />
      <div className="dot" />
    </div>
  ),
  className: 'user-location-wrapper',
  iconSize: [48, 48],
  iconAnchor: [24, 24],
  popupAnchor: [0, -12],
  zIndexOffset: 1000,
});

const newReportIcon = L.divIcon({
  html: renderToStaticMarkup(
    <div className="report-target-icon">
      <div className="target-wave wave-1" />
      <div className="target-wave wave-2" />
      <div className="target-wave wave-3" />
      <div className="report-pin">
        <div className="pin-spike" />
        <div className="pin-gem" />
      </div>
    </div>
  ),
  className: 'report-target-wrapper',
  iconSize: [56, 64],
  iconAnchor: [28, 58],
  popupAnchor: [0, -34],
});

const getProblemIcon = (problem) => {
  if (!problem || !problemTypes[problem]) {
    return defaultIcon();
  }
  const iconElement = problemTypes[problem];
  const color = BASE_COLORS[problem] || BASE_COLORS.default;
  return L.divIcon({
    html: renderToStaticMarkup(
      <div className="custom-icon-container" style={{ background: color }}>
        {iconElement}
      </div>
    ),
    className: 'custom-problem-icon',
    iconSize: [36, 42],
    iconAnchor: [18, 38],
    popupAnchor: [0, -20],
  });
};

// NOTE: This component assumes the `report` object from the API includes:
// - upvotes (number)
// - downvotes (number)
// - user_vote ('up', 'down', or null) for the currently logged-in user.
const getStoredComments = (reportId) => {
  try {
    const raw = localStorage.getItem(`report-comments-${reportId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveComments = (reportId, comments) => {
  try {
    localStorage.setItem(`report-comments-${reportId}`, JSON.stringify(comments));
  } catch {
    // ignore
  }
};

function ReportMarker({ report }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleClick = () => {
    const params = new URLSearchParams(location.search);
    params.set('reportId', report.id);
    navigate({ search: params.toString() });
  };

  return (
    <Marker
      position={report.position}
      icon={getProblemIcon(report.problem)}
      eventHandlers={{ click: handleClick }}
    />
  );
}


function LocationMarker({
  currentUser,
  selectedReportId,
  reports,
  refreshReports,
  userLocation,
}) {
  const [newMarker, setNewMarker] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const newMarkerRef = useRef(null);
  const allowedRadiusMeters = 800;

  const map = useMapEvents({
    click(e) {
      if (isFormOpen || !currentUser) return;
      if (!userLocation) {
        alert('Aguardando localização ou localização indisponível. Ative o GPS.');
        return;
      }
      const userLatLng = L.latLng(userLocation.lat, userLocation.lng);
      const clickLatLng = L.latLng(e.latlng.lat, e.latlng.lng);
      const distance = userLatLng.distanceTo(clickLatLng);
      if (distance > allowedRadiusMeters) {
        alert('Selecione um ponto próximo de você (em até ~800m).');
        return;
      }
      setNewMarker({ position: e.latlng });
      setIsFormOpen(false);
    },
  });

  useEffect(() => {
    if (newMarkerRef.current) {
      newMarkerRef.current.openPopup();
    }
  }, [newMarker]);

  const handleReportButtonClick = () => {
    if (newMarker) {
      setIsFormOpen(true);
    }
  };

  useEffect(() => {
    if (!selectedReportId || !map || !reports.length) return;
    const targetId = Number(selectedReportId);
    const targetReport = reports.find((r) => Number(r.id) === targetId);
    if (!targetReport) return;

    if (targetReport.position) {
      map.flyTo(targetReport.position, Math.max(map.getZoom(), 15), {
        animate: true,
        duration: 0.75,
      });
    }
  }, [selectedReportId, reports, map]);

  useEffect(() => {
    if (userLocation && map && !selectedReportId) {
      map.setView([userLocation.lat, userLocation.lng], 15);
    }
  }, [userLocation, map, selectedReportId]);

  const handleFormClose = () => {
    setIsFormOpen(false);
  };

  const handleFormSubmit = async ({ problem, description, file }) => {
    if (!newMarker || !currentUser) {
      console.warn('User not authenticated or no marker set. Cannot submit report.');
      return;
    }

    const { lat, lng } = newMarker.position;

    try {
      await reportService.createReport({ problem, description, lat, lng, image: file });
      setNewMarker(null);
      handleFormClose();
      refreshReports();
    } catch (error) {
      console.error("Error submitting report:", error);
    }
  };

  return (
    <>
      {userLocation && (
        <Marker position={userLocation} icon={userLocationIcon} zIndexOffset={1000}>
          <Popup>
            <div className="popup-content">
              <h4>Sua localização aproximada</h4>
              <p>Ajuste a denúncia em um raio de até 800m deste ponto.</p>
            </div>
          </Popup>
        </Marker>
      )}
      <MarkerClusterGroup>
        {reports.map(report => (
          <ReportMarker
            key={report.id}
            report={report}
          />
        ))}
      </MarkerClusterGroup>

      {newMarker && (
        <Marker
          position={newMarker.position}
          icon={newReportIcon}
          ref={newMarkerRef}
        >
          <Popup>
            <div className="popup-content">
              <h4>Novo local selecionado</h4>
              <p>Localização: {newMarker.position.lat.toFixed(4)}, {newMarker.position.lng.toFixed(4)}</p>
              <div className="cta-row">
                <button className="report-button" onClick={handleReportButtonClick}>
                  Quero reportar aqui
                </button>
                <button className="modal-button cancel" onClick={() => setNewMarker(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          </Popup>
        </Marker>
      )}

      {isFormOpen && newMarker && (
        <ReportForm
          position={newMarker.position}
          onClose={handleFormClose}
          onSubmit={handleFormSubmit}
          problemCategories={problemCategories}
        />

      )}
    </>
  );
}


// Helper component to access map instance
const MapController = ({ onMapReady }) => {
  const map = useMap();
  useEffect(() => {
    onMapReady(map);
  }, [map, onMapReady]);
  return null;
};

const FALLBACK_MAP_POSITION = [-23.55052, -46.633308];

const ProtectedRoute = ({ currentUser, children, adminOnly = false }) => {
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  if (adminOnly && !currentUser.isAdmin) {
    return <Navigate to="/" replace />;
  }
  return children;
};

function App() {
  const [currentUser, setCurrentUser] = useState(() => authService.getCurrentUser());
  const [mapInstance, setMapInstance] = useState(null);
  const [mapCenter, setMapCenter] = useState(FALLBACK_MAP_POSITION);
  const [userLocation, setUserLocation] = useState(null);
  const [hasUserLocation, setHasUserLocation] = useState(false);
  const [reports, setReports] = useState([]);
  const location = useLocation();
  const navigate = useNavigate();
  const selectedReportId = new URLSearchParams(location.search).get('reportId');

  const fetchReports = async () => {
    try {
      const response = await reportService.getReports();
      setReports(response.data);
    } catch (error) {
      console.error("Error fetching reports:", error);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [currentUser]);

  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn('Geolocalização não suportada pelo navegador.');
      return;
    }

    if (location.pathname !== '/' || !currentUser) return;

    const handleSuccess = (pos) => {
      const coords = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };
      setUserLocation(coords);
      setHasUserLocation(true);
      // Only center map if we haven't done it yet or if it's the first fix
      // But the other useEffect handles the flyTo logic based on hasUserLocation
    };

    const handleError = (error) => {
      console.warn('Erro ao obter localização:', error);
    };

    // Try to get position immediately
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });

    // And also watch for changes
    const watchId = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => {
      if (watchId !== undefined && watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [location.pathname, currentUser]);

  useEffect(() => {
    if (!location.hash || location.pathname === '/reset-password') {
      return;
    }

    const params = new URLSearchParams(location.hash.replace(/^#/, ''));
    const type = params.get('type');
    const accessToken = params.get('access_token');

    if (type === 'recovery' && accessToken) {
      navigate(`/reset-password${location.search}${location.hash}`, { replace: true });
    }
  }, [location, navigate]);

  const overlayRoutes = ['/login', '/register', '/admin', '/reset-password', '/minhas-denuncias', '/perfil'];
  const isAuthenticated = Boolean(currentUser);

  useEffect(() => {
    if (!mapInstance) return;

    if (isAuthenticated) {
      mapInstance.dragging.enable();
      mapInstance.scrollWheelZoom.enable();
      mapInstance.doubleClickZoom.enable();
      mapInstance.boxZoom.enable();
      mapInstance.keyboard.enable();
    } else {
      mapInstance.dragging.disable();
      mapInstance.scrollWheelZoom.disable();
      mapInstance.doubleClickZoom.disable();
      mapInstance.boxZoom.disable();
      mapInstance.keyboard.disable();
    }
  }, [mapInstance, isAuthenticated]);



  useEffect(() => {
    const handleAuthLogout = () => {
      handleLogout();
    };

    window.addEventListener('auth:logout', handleAuthLogout);
    return () => {
      window.removeEventListener('auth:logout', handleAuthLogout);
    };
  }, []);

  const handleLogout = async () => {
    await authService.logout();
    setCurrentUser(null);
    setUserLocation(null);
    setHasUserLocation(false);
    navigate('/login');
  };

  const visibleReports = reports.filter((r) => (r.status || '').toLowerCase() !== 'resolvida');

  const selectedReport = selectedReportId
    ? visibleReports.find(r => String(r.id) === String(selectedReportId))
    : null;

  const showLanding = location.pathname === '/' && !currentUser;

  useEffect(() => {
    if (!mapInstance) return;
    if (showLanding) {
      mapInstance.scrollWheelZoom.disable();
      mapInstance.doubleClickZoom.disable();
      mapInstance.dragging.disable();
      mapInstance.keyboard.disable();
      mapInstance.touchZoom.disable();
      mapInstance.boxZoom.disable();
      if (mapInstance.tap) mapInstance.tap.disable();
    } else {
      mapInstance.scrollWheelZoom.enable();
      mapInstance.doubleClickZoom.enable();
      mapInstance.dragging.enable();
      mapInstance.keyboard.enable();
      mapInstance.touchZoom.enable();
      mapInstance.boxZoom.enable();
      if (mapInstance.tap) mapInstance.tap.enable();
    }
  }, [mapInstance, showLanding]);

  const closeReportOverlay = () => {
    const params = new URLSearchParams(location.search);
    params.delete('reportId');
    navigate({ search: params.toString() });
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-logo-container">

          <button type="button" className="logo-button" onClick={() => navigate('/')}>
            <div className="logo-icon-wrapper">
              <FaRecycle className="app-logo" />
            </div>
            <h1 className="app-title">Olho <span className="highlight">Verde</span></h1>
          </button>
        </div>
        <Navbar currentUser={currentUser} onLogout={handleLogout} />
      </header>

      <div className="map-shell">
        <MapContainer
          key={showLanding ? 'landing-map' : 'live-map'}
          center={mapCenter}
          zoom={13}
          scrollWheelZoom={!showLanding}
          doubleClickZoom={!showLanding}
          dragging={!showLanding}
          zoomControl={!showLanding}
          keyboard={!showLanding}
          className={showLanding ? 'map-locked' : ''}
          style={{
            height: '100%',
            width: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 0,
            pointerEvents: showLanding ? 'none' : 'auto',
          }}
        >
          <MapController onMapReady={setMapInstance} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {location.pathname === '/' && (
            currentUser ? (
              <LocationMarker
                currentUser={currentUser}
                selectedReportId={selectedReportId}
                reports={visibleReports}
                refreshReports={fetchReports}
                userLocation={userLocation}
              />
            ) : (
              <LandingPage />
            )
          )}
        </MapContainer>

        {location.pathname === '/' && currentUser && (
          <button
            className="recenter-button"
            onClick={() => {
              if (mapInstance && userLocation) {
                mapInstance.flyTo([userLocation.lat, userLocation.lng], 15, {
                  animate: true,
                  duration: 1.5,
                });
              } else if (!userLocation) {
                alert('Aguardando localização...');
              }
            }}
            title="Minha Localização"
          >
            <FaLocationArrow />
          </button>
        )}

        {selectedReport && (
          <ReportDetailsOverlay
            report={selectedReport}
            currentUser={currentUser}
            onClose={closeReportOverlay}
          />
        )}
      </div>

      <div
        className="app-content-overlay"
        style={{ pointerEvents: overlayRoutes.includes(location.pathname) ? 'auto' : 'none' }}
      >
        <Routes>
          <Route path="/" element={null} />
          <Route path="/login" element={<LoginPage setCurrentUser={setCurrentUser} />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/admin" element={
            <ProtectedRoute currentUser={currentUser} adminOnly>
              <AdminDashboard currentUser={currentUser} />
            </ProtectedRoute>
          } />
          <Route path="/minhas-denuncias" element={
            <ProtectedRoute currentUser={currentUser}>
              <MyReportsPage currentUser={currentUser} />
            </ProtectedRoute>
          } />
          <Route path="/perfil" element={
            <ProtectedRoute currentUser={currentUser}>
              <UserProfilePage currentUser={currentUser} setCurrentUser={setCurrentUser} />
            </ProtectedRoute>
          } />
        </Routes>
      </div>
    </div>
  );
}

export default App;
