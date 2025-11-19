import React, { useState } from 'react';
import './FilterBar.css';

const FilterBar = ({ 
  problemCategories, 
  onFilterChange, 
  currentFilters 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusOptions = [
    { value: '', label: 'Todos os Status' },
    { value: 'pending', label: '🟡 Pendente' },
    { value: 'in_progress', label: '🔵 Em Análise' },
    { value: 'resolved', label: '🟢 Resolvida' },
    { value: 'cancelled', label: '🔴 Cancelada' }
  ];

  const handleCategoryChange = (categoryId) => {
    const newCategories = currentFilters.categories.includes(categoryId)
      ? currentFilters.categories.filter(id => id !== categoryId)
      : [...currentFilters.categories, categoryId];
    
    onFilterChange({ ...currentFilters, categories: newCategories });
  };

  const handleStatusChange = (status) => {
    onFilterChange({ ...currentFilters, status });
  };

  const clearAllFilters = () => {
    onFilterChange({ categories: [], status: '' });
  };

  const hasActiveFilters = (currentFilters?.categories?.length || 0) > 0 || (currentFilters?.status || '') !== '';

  return (
    <div className={`filter-bar ${isExpanded ? 'expanded' : ''}`}>
      <div className="filter-header">
        <button 
          className="filter-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span>🎯 Filtros</span>
          {hasActiveFilters && <span className="filter-badge">!</span>}
        </button>
        
        {hasActiveFilters && (
          <button className="clear-filters" onClick={clearAllFilters}>
            Limpar
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="filter-content">
          {/* Filtro por Categoria */}
          <div className="filter-section">
            <h4>Categorias</h4>
            <div className="category-filters">
              {problemCategories.map(category => (
                <label key={category.id} className="category-filter-item">
                  <input
                    type="checkbox"
                    checked={currentFilters.categories.includes(category.id)}
                    onChange={() => handleCategoryChange(category.id)}
                  />
                  <span className="category-icon">{category.icon}</span>
                  <span>{category.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Filtro por Status */}
          <div className="filter-section">
            <h4>Status</h4>
            <div className="status-filters">
              {statusOptions.map(option => (
                <label key={option.value} className="status-filter-item">
                  <input
                    type="radio"
                    name="status"
                    value={option.value}
                    checked={currentFilters.status === option.value}
                    onChange={() => handleStatusChange(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Contador de resultados */}
          <div className="filter-results">
            <small>
              {hasActiveFilters 
                ? `Filtros ativos: ${currentFilters.categories.length} categoria(s) ${currentFilters.status ? '+ status' : ''}`
                : 'Mostrando todas as denúncias'
              }
            </small>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterBar;