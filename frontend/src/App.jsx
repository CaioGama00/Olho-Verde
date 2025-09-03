import { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { FaMapMarkerAlt, FaWater, FaTrashAlt, FaTree, FaThumbsUp, FaThumbsDown, FaRecycle } from 'react-icons/fa';
import { CgMoreVertical } from "react-icons/cg";
import MarkerClusterGroup from 'react-leaflet-markercluster';

import ReportForm from './ReportForm';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LandingPage from './pages/LandingPage'; // Import LandingPage
import authService from './services/authService';
import reportService from './services/reportService';

import './App.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

const problemTypes = {
  "Alagamento": <FaWater />,
  "Foco de lixo": <FaTrashAlt />,
  "Árvores prestes a cair": <FaTree />,
  "Bueiros entupidos": <CgMoreVertical />,
  "Água parada": <FaWater />,
};

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

function LocationMarker({ currentUser }) {
  const [reports, setReports] = useState([]);
  const [newMarker, setNewMarker] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

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
  }, []);

  const handleVote = async (reportId, voteType) => {
    if (!currentUser) {
      alert('Você precisa estar logado para votar!');
      return;
    }

    try {
      await reportService.vote(reportId, voteType);
      fetchReports(); // Re-fetch reports to update counts
    } catch (error) {
      console.error("Error voting:", error);
      alert('Erro ao registrar seu voto: ' + error.message);
    }
  };

  useMapEvents({
    click(e) {
      if (isFormOpen || !currentUser) return;
      setNewMarker({ position: e.latlng });
      setIsFormOpen(false);
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
      fetchReports();
    } catch (error) {
      console.error("Error submitting report:", error);
    }
  };

  return (
    <>
      <MarkerClusterGroup>
        {reports.map(report => (
          <Marker key={report.id} position={report.position} icon={getProblemIcon(report.problem)}>
            <Popup>
              <div className="popup-content">
                <h4>Problema Reportado</h4>
                <p>{report.problem}</p>
                <div className="vote-controls">
                  <button 
                    onClick={(e) => { L.DomEvent.stopPropagation(e); handleVote(report.id, 'up'); }}
                    disabled={!currentUser}
                  >
                    <FaThumbsUp /> {report.upvotes}
                  </button>
                  <button 
                    onClick={(e) => { L.DomEvent.stopPropagation(e); handleVote(report.id, 'down'); }}
                    disabled={!currentUser}
                  >
                    <FaThumbsDown /> {report.downvotes}
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
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
          problemTypes={Object.keys(problemTypes)}
        />
      )}
    </>
  );
}

const initialMapPosition = [-23.55052, -46.633308]; // Define outside App

function App() {
  const [currentUser, setCurrentUser] = useState(undefined);
  const location = useLocation();

  useEffect(() => {
    const user = authService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
    }
  }, []);

  const disableMapInteraction = 
    !currentUser || 
    location.pathname === '/login' || 
    location.pathname === '/register';

  return (
    <div className="app-container">
      <MapContainer 
        center={initialMapPosition} 
        zoom={13} 
        scrollWheelZoom={true} 
        doubleClickZoom={true} 
        dragging={true} 
        zoomControl={true} 
        style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* Render LocationMarker or LandingPage only on the home route */}
        {location.pathname === '/' && (currentUser ? <LocationMarker currentUser={currentUser} /> : <LandingPage />)}
      </MapContainer>

      <header className="app-header">
        <div className="app-logo-container">
          <FaRecycle className="app-logo" />
          <h1>Olho Verde</h1>
        </div>
        <Navbar currentUser={currentUser} />
      </header>

      <div className="app-content-overlay" style={{ pointerEvents: (location.pathname === '/login' || location.pathname === '/register') ? 'auto' : 'none' }}> {/* New wrapper for content */} 
        <Routes>
          <Route path="/" element={null} /> {/* Handle home route */}
          {/* Login and Register pages will still be rendered as overlays */}
          <Route path="/login" element={<LoginPage setCurrentUser={setCurrentUser} />} />
          <Route path="/register" element={<RegisterPage />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
