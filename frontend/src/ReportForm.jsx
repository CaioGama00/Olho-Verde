import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import './ReportForm.css';

function ReportForm({ position, onClose, onSubmit, problemTypes }) {
  const modalRef = useRef();

  useEffect(() => {
    if (modalRef.current) {
      L.DomEvent.disableClickPropagation(modalRef.current);
    }
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
    const selectedProblem = event.target.elements.problemType.value;
    onSubmit(selectedProblem);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" ref={modalRef}>
        <h2>Reportar um Problema</h2>
        <p>Localização: {position.lat.toFixed(4)}, {position.lng.toFixed(4)}</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="problemType">Selecione o tipo de problema:</label>
          <select id="problemType" name="problemType">
            {problemTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <div className="modal-actions">
            <button type="submit" className="modal-button submit">Enviar</button>
            <button type="button" onClick={onClose} className="modal-button cancel">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReportForm;
