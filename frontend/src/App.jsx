import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
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
import supabase from './utils/supabase';

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
  const [userVotes, setUserVotes] = useState({}); // To store user's votes

  const fetchReports = async () => {
    const { data, error } = await supabase.from('reports').select('*');
    if (error) {
      console.error("Error fetching reports:", error);
    } else {
      const formattedReports = data.map(report => ({
        ...report,
        position: { lat: report.lat, lng: report.lng }
      }));
      setReports(formattedReports);
    }
  };

  const fetchUserVotes = async () => {
    if (currentUser) {
      const { data, error } = await supabase
        .from('user_votes')
        .select('report_id, vote_value')
        .eq('user_id', currentUser.id);

      if (error) {
        console.error("Error fetching user votes:", error);
      } else {
        const votesMap = data.reduce((acc, vote) => {
          acc[vote.report_id] = vote.vote_value;
          return acc;
        }, {});
        setUserVotes(votesMap);
      }
    } else {
      setUserVotes({}); // Clear votes if no user
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  useEffect(() => {
    fetchUserVotes();
  }, [currentUser]); // Re-fetch votes when user changes

  const handleVote = async (reportId, voteType) => {
    if (!currentUser) {
      alert('Você precisa estar logado para votar!');
      return;
    }

    const currentVote = userVotes[reportId];
    let newVoteValue;

    if (voteType === 'upvote') {
      if (currentVote === 1) {
        newVoteValue = 0; // Remove upvote
      } else {
        newVoteValue = 1; // Upvote or change from downvote
      }
    } else if (voteType === 'downvote') {
      if (currentVote === -1) {
        newVoteValue = 0; // Remove downvote
      } else {
        newVoteValue = -1; // Downvote or change from upvote
      }
    }

    try {
      const { error } = await supabase.rpc('handle_vote', {
        report_id_param: reportId,
        user_id_param: currentUser.id,
        new_vote_value_param: newVoteValue,
      });

      if (error) {
        console.error("Error voting:", error);
        alert('Erro ao registrar seu voto: ' + error.message);
      } else {
        fetchReports(); // Re-fetch reports to update counts
        fetchUserVotes(); // Re-fetch user votes to update UI
      }
    } catch (err) {
      console.error("Unexpected error during vote handling:", err);
      alert('Ocorreu um erro inesperado ao registrar seu voto.');
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

    const { data, error } = await supabase
      .from('reports')
      .insert([{ problem: problemType, lat, lng, user_id: currentUser.id }])
      .select();

    if (error) {
      console.error("Error submitting report:", error);
    } else if (data) {
        const savedReport = {
            ...data[0],
            position: { lat: data[0].lat, lng: data[0].lng }
        };
      setReports(prevReports => [...prevReports, savedReport]);
      setNewMarker(null);
      handleFormClose();
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
                    onClick={(e) => { L.DomEvent.stopPropagation(e); handleVote(report.id, 'upvote'); }}
                    disabled={!currentUser}
                    className={userVotes[report.id] === 1 ? 'active-vote' : ''}
                  >
                    <FaThumbsUp /> {report.upvotes}
                  </button>
                  <button 
                    onClick={(e) => { L.DomEvent.stopPropagation(e); handleVote(report.id, 'downvote'); }}
                    disabled={!currentUser}
                    className={userVotes[report.id] === -1 ? 'active-vote' : ''}
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

function Home({ currentUser }) {
  const position = [-23.55052, -46.633308];

  return (
    <main className="map-area">
      <MapContainer center={position} zoom={13} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {currentUser ? <LocationMarker currentUser={currentUser} /> : <LandingPage />}
      </MapContainer>
    </main>
  );
}

function App() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const subscription = authService.onAuthStateChange(setCurrentUser);
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-logo-container">
          <FaRecycle className="app-logo" />
          <h1>Olho Verde</h1>
        </div>
        <Navbar currentUser={currentUser} />
      </header>
      <Routes>
        <Route path="/" element={<Home currentUser={currentUser} />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Routes>
    </div>
  );
}

export default App;

