import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import './ReportForm.css';

function ReportForm({ position, onClose, onSubmit, problemTypes }) {
  const modalRef = useRef();
  const [selectedFile, setSelectedFile] = useState(null);

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

    if (!selectedFile) {
      alert('Por favor, selecione uma imagem.');
      return;
    }

    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      const response = await fetch('https://olho-verde.onrender.com/api/classify-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Erro ao classificar a imagem.');
      }

      const result = await response.json();

      if (result.isTrash) {
        const selectedProblem = event.target.elements.problemType.value;
        onSubmit(selectedProblem);
      } else {
        alert('A imagem não parece conter lixo. O relatório não foi enviado.');
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Ocorreu um erro ao enviar o relatório.');
    }
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
          <label htmlFor="image">Selecione uma imagem:</label>
          <input type="file" id="image" name="image" accept="image/*" onChange={handleFileChange} />
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