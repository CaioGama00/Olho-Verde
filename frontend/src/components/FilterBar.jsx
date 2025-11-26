import React from 'react';
import './FilterBar.css';

const FilterBar = ({ 
  problemCategories, 
  onFilterChange, 
  currentFilters,
  hideToggle = false,
  forceExpanded = false
}) => {
  
  const statusOptions = [
    { value: '', label: 'Todos os Status' },
    { value: 'nova', label: '🟡 Pendente' },
    { value: 'em_analise', label: '🔵 Em Análise' },
    { value: 'resolvida', label: '🟢 Resolvida' }
  ];

  const handleCategoryChange = (categoryId) => {
    const newCategories = currentFilters.categories.includes(categoryId)
      ? currentFilters.categories.filter(id => id !== categoryId)
      : [...currentFilters.categories, categoryId];
    
    onFilterChange({ ...currentFilters, categories: newCategories });
  };

  const handleStatusChange = (status) => {
    // Se clicar no mesmo status já selecionado, limpa o filtro (toggle)
    const newStatus = currentFilters.status === status ? '' : status;
    onFilterChange({ ...currentFilters, status: newStatus });
  };

  const clearAllFilters = () => {
    onFilterChange({ categories: [], status: '' });
  };

  const hasActiveFilters = (currentFilters?.categories?.length || 0) > 0 || (currentFilters?.status || '') !== '';

  return (
    <div className="filter-bar-content">
      {/* Cabeçalho do Filtro */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, color: 'var(--primary-color)' }}>Filtros</h3>
        {hasActiveFilters && (
          <button 
            onClick={clearAllFilters}
            style={{
              background: 'none',
              border: 'none',
              color: '#e74c3c',
              fontSize: '0.85rem',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Limpar tudo
          </button>
        )}
      </div>

      {/* Filtro por Categoria */}
      <div className="filter-section">
        <h3>Categorias</h3>
        <div className="category-filters" style={{ display: 'flex', flexWrap: 'wrap' }}>
          {problemCategories.map(category => (
            <button
              key={category.id}
              className={`filter-chip ${currentFilters.categories.includes(category.id) ? 'active' : ''}`}
              onClick={() => handleCategoryChange(category.id)}
              title={category.label}
            >
              <span className="category-icon">{category.icon}</span>
              <span>{category.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filtro por Status */}
      <div className="filter-section">
        <h3>Status</h3>
        <div className="status-filters">
          {statusOptions.map(option => (
            <button
              key={option.value}
              className={`status-chip-button ${currentFilters.status === option.value ? 'active' : ''}`}
              onClick={() => handleStatusChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Resumo */}
      <div className="filter-results" style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#888', textAlign: 'center' }}>
        {hasActiveFilters 
          ? `${currentFilters.categories.length} categorias • ${currentFilters.status ? 'Status filtrado' : 'Todos status'}`
          : 'Mostrando tudo'
        }
      </div>
    </div>
  );
};

export default FilterBar;