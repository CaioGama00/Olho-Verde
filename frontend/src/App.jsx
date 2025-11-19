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

function ReportMarker({ report, currentUser, registerMarker }) {
  const markerRef = useRef(null);
  const [address, setAddress] = useState(null);
  const noAddressLabel = 'Endereço aproximado indisponível';
  const [comments, setComments] = useState(() => getStoredComments(report.id));
  const [newComment, setNewComment] = useState('');

  // Local state for immediate UI updates
  const [localUpvotes, setLocalUpvotes] = useState(report.upvotes || 0);
  const [localDownvotes, setLocalDownvotes] = useState(report.downvotes || 0);
  const [currentUserVote, setCurrentUserVote] = useState(report.user_vote || null);
  const [isVoting, setIsVoting] = useState(false);

  const initialVoteState = useRef({
    vote: report.user_vote || null,
    upvotes: report.upvotes || 0,
    downvotes: report.downvotes || 0,
  });

  useEffect(() => {
    setLocalUpvotes(report.upvotes || 0);
    setLocalDownvotes(report.downvotes || 0);
    setCurrentUserVote(report.user_vote || null);
    initialVoteState.current = {
      vote: report.user_vote || null,
      upvotes: report.upvotes || 0,
      downvotes: report.downvotes || 0,
    };
  }, [report.upvotes, report.downvotes, report.user_vote]);
  useEffect(() => {
    const coords = report.position;
    if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') return;
    const cacheKey = `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`;
    if (addressCache.has(cacheKey)) {
      setAddress(addressCache.get(cacheKey));
      return;
    }
    const controller = new AbortController();
    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lng}`, {
      headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'Olho-Verde' },
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        const label =
          data?.address?.road ||
          data?.address?.pedestrian ||
          data?.address?.suburb ||
          data?.display_name ||
          '';
        const formatted = label || noAddressLabel;
        addressCache.set(cacheKey, formatted);
        setAddress(formatted);
      })
      .catch(() => {
        setAddress(noAddressLabel);
      });
    return () => controller.abort();
  }, [report.position]);

  const statusCopy = {
    nova: {
      label: getStatusLabel('nova'),
      tone: 'nova',
      detail: 'Recebida e aguardando triagem inicial.',
    },
    em_analise: {
      label: getStatusLabel('em_analise'),
      tone: 'em_analise',
      detail: 'Em andamento: equipe avaliando e encaminhando solução.',
    },
    resolvida: {
      label: getStatusLabel('resolvida'),
      tone: 'resolvida',
      detail: 'Marcada como resolvida. Obrigado por enviar o alerta!',
    },
  };

  const getStatusInfo = (status) => {
    const info = statusCopy[status];
    if (info) return info;
    const fallbackLabel = getStatusLabel(status) || 'Status indefinido';
    return {
      label: fallbackLabel,
      tone: 'default',
      detail: 'Aguardando atualização do status.',
    };
  };

  const handleLocalVote = (e, voteType) => {
    L.DomEvent.stopPropagation(e); // Prevent the popup from closing on click
    if (!currentUser || isVoting) return;

    const button = e.currentTarget;
    button.classList.add('vote-animating');
    setTimeout(() => button.classList.remove('vote-animating'), 300);

    let newVote = currentUserVote;
    let upvotes = localUpvotes;
    let downvotes = localDownvotes;

    const isCurrentlyUpvoted = newVote === 'up';
    const isCurrentlyDownvoted = newVote === 'down';

    if (voteType === 'up') {
      if (isCurrentlyUpvoted) {
        newVote = null;
        upvotes--;
      } else if (isCurrentlyDownvoted) {
        newVote = 'up';
        upvotes++;
        downvotes--;
      } else {
        newVote = 'up';
        upvotes++;
      }
    } else if (voteType === 'down') {
      if (isCurrentlyDownvoted) {
        newVote = null;
        downvotes--;
      } else if (isCurrentlyUpvoted) {
        newVote = 'down';
        downvotes++;
        upvotes--;
      } else {
        newVote = 'down';
        downvotes++;
      }
    }

    setCurrentUserVote(newVote);
    setLocalUpvotes(upvotes);
    setLocalDownvotes(downvotes);

    const voteToSend = newVote === 'up' ? 'up' : newVote === 'down' ? 'down' : null;

    setIsVoting(true);
    reportService.vote(report.id, voteToSend)
      .then((response) => {
        const payload = response?.data || {};
        const syncedUpvotes = payload.upvotes ?? upvotes;
        const syncedDownvotes = payload.downvotes ?? downvotes;
        const syncedVote = payload.user_vote ?? voteToSend;

        setLocalUpvotes(syncedUpvotes);
        setLocalDownvotes(syncedDownvotes);
        setCurrentUserVote(syncedVote);

        initialVoteState.current = {
          vote: syncedVote,
          upvotes: syncedUpvotes,
          downvotes: syncedDownvotes,
        };
      })
      .catch(error => {
        console.error("Failed to persist vote:", error);
        alert('Houve um erro ao salvar seu voto. Tente novamente.');
        setLocalUpvotes(initialVoteState.current.upvotes);
        setLocalDownvotes(initialVoteState.current.downvotes);
        setCurrentUserVote(initialVoteState.current.vote);
      })
      .finally(() => setIsVoting(false));
  };

  const statusInfo = getStatusInfo(report.status);
  const hasLocation = report.position && typeof report.position.lat === 'number' && typeof report.position.lng === 'number';
  const createdAt = report.created_at ? new Date(report.created_at) : null;
  const locationText = hasLocation
    ? `${report.position.lat.toFixed(4)}, ${report.position.lng.toFixed(4)}`
    : '—';

  useEffect(() => {
    if (registerMarker && markerRef.current) {
      registerMarker(report.id, markerRef.current);
      return () => registerMarker(report.id, null);
    }
  }, [report.id, registerMarker]);

  const handleAddComment = () => {
    if (!currentUser || !newComment.trim()) return;
    const entry = {
      id: Date.now(),
      author: currentUser?.user?.user_metadata?.name || currentUser?.email || 'Você',
      text: newComment.trim(),
      createdAt: new Date().toISOString(),
    };
    const updated = [entry, ...comments].slice(0, 30);
    setComments(updated);
    saveComments(report.id, updated);
    setNewComment('');
  };

  return (
    <Marker ref={markerRef} position={report.position} icon={getProblemIcon(report.problem)}>
      <Popup>
        <div className="popup-content">
          <div className="popup-header">
            <div>
              <p className="popup-eyebrow">Denúncia #{report.id}</p>
              <h4>{report.problem}</h4>
            </div>
            <span className={`status-chip status-${statusInfo.tone}`}>
              {statusInfo.label}
            </span>
          </div>
          <p className="status-description">{statusInfo.detail}</p>
          <div className="popup-meta">
            {hasLocation && (
              <div className="meta-item">
                <span className="meta-label">Localização</span>
                <span className="meta-value">
                  {locationText}
                </span>
              </div>
            )}
            {createdAt && (
              <div className="meta-item">
                <span className="meta-label">Criada em</span>
                <span className="meta-value">
                  {createdAt.toLocaleDateString('pt-BR')}
                </span>
              </div>
            )}
          </div>
          <div className="vote-area">
            <div className="vote-label">Avalie o status desta denúncia</div>
            <div className="vote-controls">
              <button
                onClick={(e) => handleLocalVote(e, 'up')}
                disabled={!currentUser || isVoting}
                className={currentUserVote === 'up' ? 'active-vote' : ''}
              >
                <FaThumbsUp /> {localUpvotes}
              </button>
              <button
                onClick={(e) => handleLocalVote(e, 'down')}
                disabled={!currentUser || isVoting}
                className={currentUserVote === 'down' ? 'active-vote' : ''}
              >
                <FaThumbsDown /> {localDownvotes}
              </button>
            </div>
            {!currentUser && (
              <p className="vote-hint">Entre para deixar seu voto.</p>
            )}
          </div>
          <div className="comments-area">
            <div className="comments-header">
              <h5>Comentários</h5>
              <span className="comments-count">{comments.length}</span>
            </div>
            {currentUser ? (
              <div className="comment-form">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Adicionar um comentário..."
                  rows={2}
                />
                <button type="button" onClick={handleAddComment} disabled={!newComment.trim()}>
                  Enviar
                </button>
              </div>
            ) : (
              <p className="vote-hint">Faça login para comentar.</p>
            )}
            <div className="comments-list">
              {comments.length === 0 ? (
                <p className="vote-hint">Nenhum comentário ainda.</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="comment-item">
                    <div className="comment-meta">
                      <strong>{c.author}</strong>
                      <small>{new Date(c.createdAt).toLocaleString('pt-BR')}</small>
                    </div>
                    <p>{c.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}


function LocationMarker({ currentUser, mapInstance, selectedReportId, onClearSelection }) {
  const [reports, setReports] = useState([]);
  const [newMarker, setNewMarker] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const newMarkerRef = useRef(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const allowedRadiusMeters = 800;
  const markerRefs = useRef({});
  const openMarker = (report) => {
    const marker = markerRefs.current[report.id];
    if (marker) {
      marker.openPopup();
      if (mapInstance && report.position) {
        mapInstance.flyTo(report.position, Math.max(mapInstance.getZoom(), 15), {
          animate: true,
          duration: 0.75,
        });
      }
      if (onClearSelection) {
        onClearSelection();
      }
      return true;
    }
    return false;
  };

  const fetchReports = async () => {
    try {
      // The backend returns the current user's vote when authenticated.
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
    if (!currentUser) return;
    if (!navigator.geolocation) {
      setLocationError('Seu navegador não permite obter localização.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setUserLocation(coords);
      },
      () => setLocationError('Não foi possível obter sua localização.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }, [currentUser]);

  useMapEvents({
    click(e) {
      if (isFormOpen || !currentUser) return;
      if (!userLocation) {
        alert(locationError || 'Ative a localização para posicionar sua denúncia.');
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
      setIsFormOpen(false); // apenas mostra o marcador; pergunta antes de abrir o formulário
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
    if (!selectedReportId || !mapInstance || !reports.length) return;
    const targetId = Number(selectedReportId);
    const targetReport = reports.find((r) => Number(r.id) === targetId);
    if (!targetReport) return;

    if (openMarker(targetReport)) return;

    const timeout = setTimeout(() => {
      openMarker(targetReport);
    }, 400);

    return () => clearTimeout(timeout);
  }, [selectedReportId, reports, mapInstance, onClearSelection, openMarker]);

  const registerMarker = (id, marker) => {
    if (marker) {
      markerRefs.current[id] = marker;
      if (selectedReportId && Number(selectedReportId) === Number(id)) {
        const target = reports.find((r) => Number(r.id) === Number(id));
        if (target) {
          openMarker(target);
        }
      }
    } else {
      delete markerRefs.current[id];
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
      {userLocation && (
        <Marker position={userLocation} icon={userLocationIcon}>
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
            registerMarker={registerMarker}
            currentUser={currentUser}
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

const initialMapPosition = [-23.55052, -46.633308]; // Define outside App

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const selectedReportId = new URLSearchParams(location.search).get('reportId');

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
          {isAuthenticated && location.pathname !== '/' && (
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
          {location.pathname === '/' && (
            currentUser ? (
              <LocationMarker
                currentUser={currentUser}
                mapInstance={mapInstance}
                selectedReportId={selectedReportId}
                onClearSelection={() => {
                  const params = new URLSearchParams(location.search);
                  params.delete('reportId');
                  navigate({ pathname: '/', search: params.toString() ? `?${params}` : '' }, { replace: true });
                }}
              />
            ) : (
              <LandingPage />
            )
          )}
        </MapContainer>
      </div>

      <div
        className="app-content-overlay"
        style={{ pointerEvents: overlayRoutes.includes(location.pathname) ? 'auto' : 'none' }}
      >
        <Routes>
          <Route path="/" element={null} /> {}
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
