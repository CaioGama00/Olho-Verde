import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { FaMapMarkerAlt, FaWater, FaTrashAlt, FaTree, FaThumbsUp, FaThumbsDown, FaRecycle, FaRoad } from 'react-icons/fa';
import { CgMoreVertical } from "react-icons/cg";
import MarkerClusterGroup from 'react-leaflet-markercluster';

import ReportForm from './ReportForm';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LandingPage from './pages/LandingPage'; // Import LandingPage
import AdminDashboard from './pages/AdminDashboard';
import ResetPasswordPage from './pages/ResetPasswordPage';
import authService from './services/authService';
import reportService from './services/reportService';
import { getStatusLabel } from './utils/reportStatus';
import MinhasDenuncias from './pages/MyReportsPage';

import './App.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

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

const defaultIcon = L.divIcon({
  html: renderToStaticMarkup(<FaMapMarkerAlt style={{ fontSize: '24px', color: '#3498db' }} />),
  className: 'dummy',
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24],
});

const getProblemIcon = (problem) => {
  if (!problem || !problemTypes[problem]) {
    return defaultIcon;
  }
  const iconElement = problemTypes[problem];
  return L.divIcon({
    html: renderToStaticMarkup(
      <div className="custom-icon-container">
        {iconElement}
      </div>
    ),
    className: 'custom-problem-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
};

// NOTE: This component assumes the `report` object from the API includes:
// - upvotes (number)
// - downvotes (number)
// - user_vote ('up', 'down', or null) for the currently logged-in user.
// The `reportService.getReports()` may need to be updated to provide this.
function ReportMarker({ report, currentUser }) {
  const markerRef = useRef(null);

  // Local state for immediate UI updates
  const [localUpvotes, setLocalUpvotes] = useState(report.upvotes);
  const [localDownvotes, setLocalDownvotes] = useState(report.downvotes);
  const [currentUserVote, setCurrentUserVote] = useState(report.user_vote);

  // Use a ref to store the initial vote state to compare against on close
  const initialVoteState = useRef({
    vote: report.user_vote,
    upvotes: report.upvotes,
    downvotes: report.downvotes,
  });

  // This effect handles persisting the vote when the popup is closed
  useEffect(() => {
    const marker = markerRef.current;
    if (marker) {
      const handlePopupClose = () => {
        // If the vote has changed from its initial state, persist it
        if (currentUserVote !== initialVoteState.current.vote) {
          // The vote to send can be null (if un-voted)
          const voteToSend = currentUserVote === 'up' || currentUserVote === 'down' ? currentUserVote : null;
          reportService.vote(report.id, voteToSend).catch(error => {
            console.error("Failed to persist vote:", error);
            // On failure, revert the UI to its original state
            alert('Houve um erro ao salvar seu voto. Tente novamente.');
            setLocalUpvotes(initialVoteState.current.upvotes);
            setLocalDownvotes(initialVoteState.current.downvotes);
            setCurrentUserVote(initialVoteState.current.vote);
          });
        }
      };

      marker.on('popupclose', handlePopupClose);

      return () => {
        marker.off('popupclose', handlePopupClose);
      };
    }
  }, [currentUserVote, report.id]);

  const handleLocalVote = (e, voteType) => {
    L.DomEvent.stopPropagation(e); // Prevent the popup from closing on click
    if (!currentUser) return;

    // Animation: Add class to trigger pop and remove after animation completes
    const button = e.currentTarget;
    button.classList.add('vote-animating');
    setTimeout(() => {
      button.classList.remove('vote-animating');
    }, 300); // Must match animation duration in App.css

    // Create copies of current state to modify
    let newVote = currentUserVote;
    let upvotes = localUpvotes;
    let downvotes = localDownvotes;

    const isCurrentlyUpvoted = newVote === 'up';
    const isCurrentlyDownvoted = newVote === 'down';

    if (voteType === 'up') {
      if (isCurrentlyUpvoted) { // User is un-voting
        newVote = null;
        upvotes--;
      } else if (isCurrentlyDownvoted) { // User is switching from downvote to upvote
        newVote = 'up';
        upvotes++;
        downvotes--;
      } else { // User is casting a new upvote
        newVote = 'up';
        upvotes++;
      }
    } else if (voteType === 'down') {
      if (isCurrentlyDownvoted) { // User is un-voting
        newVote = null;
        downvotes--;
      } else if (isCurrentlyUpvoted) { // User is switching from upvote to downvote
        newVote = 'down';
        downvotes++;
        upvotes--;
      } else { // User is casting a new downvote
        newVote = 'down';
        downvotes++;
      }
    }

    // Update the local state to give immediate feedback
    setCurrentUserVote(newVote);
    setLocalUpvotes(upvotes);
    setLocalDownvotes(downvotes);
  };

  return (
    <Marker ref={markerRef} position={report.position} icon={getProblemIcon(report.problem)}>
      <Popup>
        <div className="popup-content">
          <h4>Problema Reportado</h4>
          <p>{report.problem}</p>
          <p className="report-status">Status: <strong>{getStatusLabel(report.status)}</strong></p>
          <div className="vote-controls">
            <button
              onClick={(e) => handleLocalVote(e, 'up')}
              disabled={!currentUser}
              className={currentUserVote === 'up' ? 'active-vote' : ''}
            >
              <FaThumbsUp /> {localUpvotes}
            </button>
            <button
              onClick={(e) => handleLocalVote(e, 'down')}
              disabled={!currentUser}
              className={currentUserVote === 'down' ? 'active-vote' : ''}
            >
              <FaThumbsDown /> {localDownvotes}
            </button>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}


function LocationMarker({ currentUser }) {
  const [reports, setReports] = useState([]);
  const [newMarker, setNewMarker] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const fetchReports = async () => {
    try {
      // NOTE: This service call should be updated to include the current user's
      // vote status for each report (e.g., a `user_vote` field).
      const response = await reportService.getReports();
      setReports(response.data);
    } catch (error) {
      console.error("Error fetching reports:", error);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  useMapEvents({
    click(e) {
      if (isFormOpen || !currentUser) return;
      setNewMarker({ position: e.latlng });
      setIsFormOpen(false); // Close any previous form
    },
  });

  const handleReportButtonClick = () => {
    if (newMarker) {
      setIsFormOpen(true);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
  };

  const handleFormSubmit = async (problemType) => {
    if (!newMarker || !currentUser) return;

    const { lat, lng } = newMarker.position;

    try {
      await reportService.createReport({ problem: problemType, position: { lat, lng } });
      setNewMarker(null);
      handleFormClose();
      fetchReports(); // Re-fetch reports to include the new one
    } catch (error) {
      console.error("Error submitting report:", error);
    }
  };

  return (
    <>
      <MarkerClusterGroup>
        {reports.map(report => (
          <ReportMarker
            key={report.id}
            report={report}
            currentUser={currentUser}
          />
        ))}
      </MarkerClusterGroup>

      {newMarker && (
        <Marker
          position={newMarker.position}
          icon={defaultIcon}
        >
          <Popup>
            <div className="popup-content">
              <h4>Novo Reporte</h4>
              <p>Localização: {newMarker.position.lat.toFixed(4)}, {newMarker.position.lng.toFixed(4)}</p>
              <button className="report-button" onClick={handleReportButtonClick}>
                Reportar problema
              </button>
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

const initialMapPosition = [-23.55052, -46.633308]; // Define outside App

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!location.hash || location.pathname === '/reset-password') {
      return;
    }

    const params = new URLSearchParams(location.hash.replace(/^#/, ''));
    const type = params.get('type');
    const accessToken = params.get('access_token');

    if (type === 'recovery' && accessToken) {
      // Recovery emails may still point to /login, so force the dedicated reset route.
      navigate(`/reset-password${location.search}${location.hash}`, { replace: true });
    }
  }, [location, navigate]);

  useEffect(() => {
    const user = authService.getCurrentUser();
    setCurrentUser(user || null);
  }, []);

  const overlayRoutes = ['/login', '/register', '/admin', '/reset-password', '/minhas-denuncias'];
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

  const handleLogout = async () => {
    await authService.logout();
    setCurrentUser(null);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-logo-container">
          {isAuthenticated && (
            <button type="button" className="home-chip" onClick={() => navigate('/')}>
              ← Mapa
            </button>
          )}
          <button type="button" className="logo-button" onClick={() => navigate('/')}>
            <FaRecycle className="app-logo" />
            <h1>Olho Verde</h1>
          </button>
        </div>
        <Navbar currentUser={currentUser} onLogout={handleLogout} />
      </header>

      <div className="map-shell">
        <MapContainer 
          center={initialMapPosition} 
          zoom={13} 
          scrollWheelZoom={true} 
          doubleClickZoom={true} 
          dragging={true} 
          zoomControl={true} 
          whenCreated={setMapInstance}
          style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0 }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {/* Render LocationMarker or LandingPage only on the home route */}
          {location.pathname === '/' && (currentUser ? <LocationMarker currentUser={currentUser} /> : <LandingPage />)}
        </MapContainer>
      </div>

      <div
        className="app-content-overlay"
        style={{ pointerEvents: overlayRoutes.includes(location.pathname) ? 'auto' : 'none' }}
      >
        <Routes>
          <Route path="/" element={null} /> {/* Handle home route */}
          {/* Login and Register pages will still be rendered as overlays */}
          <Route path="/login" element={<LoginPage setCurrentUser={setCurrentUser} />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/admin" element={<AdminDashboard currentUser={currentUser} />} />
          <Route path="/minhas-denuncias" element={<MinhasDenuncias currentUser={currentUser} />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
