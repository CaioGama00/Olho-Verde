import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { FaMapMarkerAlt, FaWater, FaTrashAlt, FaTree } from 'react-icons/fa';
import { CgMoreVertical } from "react-icons/cg";
import MarkerClusterGroup from 'react-leaflet-markercluster';

import ReportForm from './ReportForm';
import './App.css';
// Required for react-leaflet-markercluster
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';


const API_URL = 'http://localhost:3001/api/reports';

// ... (icon definitions remain the same)
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


function LocationMarker() {
  const [reports, setReports] = useState([]);
  const [newMarker, setNewMarker] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    fetch(API_URL)
      .then(res => res.json())
      .then(data => setReports(data))
      .catch(err => console.error("Error fetching reports:", err));
  }, []);

  useMapEvents({
    click(e) {
      if (isFormOpen) return;
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
    if (!newMarker) return;

    const newReport = {
      problem: problemType,
      position: newMarker.position,
    };

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReport),
      });
      const savedReport = await response.json();
      
      setReports(prevReports => [...prevReports, savedReport]);
      setNewMarker(null);
      handleFormClose();

    } catch (err) {
      console.error("Error submitting report:", err);
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
              <h4>Novo Report</h4>
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

function App() {
  const position = [-23.55052, -46.633308];

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Olho Verde</h1>
      </header>
      <main className="map-area">
        <MapContainer center={position} zoom={13} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker />
        </MapContainer>
      </main>
    </div>
  );
}

export default App;