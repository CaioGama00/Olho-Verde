import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import './ReportForm.css';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD
    ? 'https://olho-verde.onrender.com/api'
    : 'http://localhost:3001/api');

function ReportForm({ position, onClose, onSubmit, problemCategories }) {
  const modalRef = useRef();
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(problemCategories[0]?.id || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (modalRef.current) {
      L.DomEvent.disableClickPropagation(modalRef.current);
    }
  }, []);

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting) return;

    if (!selectedFile) {
      alert('Por favor, selecione uma imagem.');
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('expectedCategoryId', selectedCategoryId);

    const selectedCategory = problemCategories.find((cat) => cat.id === selectedCategoryId);

    try {
      const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/classify-image`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        if (response.status === 422 && errorPayload?.error) {
          alert(errorPayload.error);
          return;
        }
        throw new Error(errorPayload?.error || 'Erro ao classificar a imagem.');
      }

      const result = await response.json();

      if (result.success) {
        const confirmedCategory = problemCategories.find(
          (category) => category.id === result.detectedCategoryId
        ) || selectedCategory;
        await onSubmit(confirmedCategory?.label || selectedCategory?.label || '');
      } else {
        alert(result.error || selectedCategory?.failureMessage || 'A imagem não corresponde ao problema selecionado.');
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Ocorreu um erro ao enviar o relatório.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" ref={modalRef}>
        <h2>Reportar um Problema</h2>
        <p className="location-text">Localização: {position.lat.toFixed(4)}, {position.lng.toFixed(4)}</p>
        <form onSubmit={handleSubmit}>
          <label>Selecione o tipo de problema:</label>
          <div className="category-grid">
            {problemCategories.map((category) => (
              <div
                key={category.id}
                className={`category-card ${selectedCategoryId === category.id ? 'selected' : ''}`}
                onClick={() => setSelectedCategoryId(category.id)}
              >
                <div className="category-icon">{category.icon}</div>
                <span className="category-label">{category.label}</span>
              </div>
            ))}
          </div>

          <label htmlFor="image">Evidência (Foto):</label>
          <div className="file-upload-area">
            <input
              type="file"
              id="image"
              name="image"
              accept="image/*"
              onChange={handleFileChange}
              className="file-input"
            />
            <div className="file-upload-placeholder">
              {selectedFile ? (
                <span className="file-name">{selectedFile.name}</span>
              ) : (
                <span>Clique para enviar uma foto</span>
              )}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="modal-button cancel">Cancelar</button>
            <button type="submit" className="modal-button submit" disabled={isSubmitting}>
              {isSubmitting ? 'Enviando...' : 'Enviar Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReportForm;
