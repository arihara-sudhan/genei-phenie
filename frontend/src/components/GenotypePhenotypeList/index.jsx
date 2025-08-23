import React, { useState, useEffect, useRef } from 'react';
import './styles.css';

const GenotypePhenotypeList = ({ genotypePhenotypes, isVisible, isFiltered = false, onItemSelect, onItemHover }) => {
  const [displayedItems, setDisplayedItems] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null); // Track selected item
  const containerRef = useRef(null);
  const ANIMATION_DURATION = 600;

  const generateId = () => crypto.randomUUID();

  useEffect(() => {
    if (!genotypePhenotypes || genotypePhenotypes.length === 0) {
      setDisplayedItems([]);
      setSelectedItemId(null);
      return;
    }

    if (isFiltered) {
      setDisplayedItems(genotypePhenotypes.map(item => ({
        ...item,
        id: generateId(),
        isNew: false,
        timestamp: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
      })));
      setIsAnimating(false);
    } else {
      const newItem = genotypePhenotypes[genotypePhenotypes.length - 1];
      setIsAnimating(true);
      const newItemId = generateId();
      setDisplayedItems(prev => [
        ...prev,
        {
          ...newItem,
          id: newItemId,
          isNew: true,
          timestamp: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
        }
      ]);

      setTimeout(() => {
        setDisplayedItems(prev => prev.map(item => ({ ...item, isNew: false })));
        setIsAnimating(false);
      }, ANIMATION_DURATION);
    }
  }, [genotypePhenotypes, isFiltered]);

  const removeItem = (id) => {
    setDisplayedItems(prev => prev.filter(item => item.id !== id));
    if (selectedItemId === id) {
      setSelectedItemId(null);
      onItemSelect(null); // Clear highlight if selected item is removed
    }
  };

  const clearAll = () => {
    setDisplayedItems([]);
    setSelectedItemId(null);
    onItemSelect(null);
  };

  const handleItemSelect = (item) => {
    setSelectedItemId(item.id);
    if (onItemSelect) {
      onItemSelect({ start: item.start, end: item.end, sequence: item.sequence });
    }
  };

  if (!isVisible) return null;

  return (
    <div className="genotype-phenotype-container" role="region" aria-label="Genotype-Phenotype Analysis">
      <div className="list-header">
        <h3>{isFiltered ? 'Filtered Genotype-Phenotype Analysis' : 'Genotype-Phenotype Analysis'}</h3>
        <div className="header-controls">
          <span className="item-count">{displayedItems.length} items</span>
          {displayedItems.length > 0 && (
            <button className="clear-btn" onClick={clearAll} aria-label="Clear all items">
              Clear All
            </button>
          )}
        </div>
      </div>
      <div className="list-container" ref={containerRef}>
        {displayedItems.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🧬</div>
            <p>{isFiltered ? 'No results match the selected filter' : 'Click on DNA sequence to analyze'}</p>
            <p className="empty-subtitle">
              {isFiltered ? 'Try adjusting filters' : 'Results will appear here'}
            </p>
          </div>
        ) : (
          <div className="items-list">
            {displayedItems.map((item, index) => (
              <div
                key={item.id}
                className={`list-item ${item.isNew ? 'slide-in' : ''} ${selectedItemId === item.id ? 'selected' : ''}`}
                style={{ animationDelay: `${index * 0.1}s` }}
                onClick={() => handleItemSelect(item)}
                onMouseEnter={() => onItemHover && onItemHover(item)}
                onMouseLeave={() => onItemHover && onItemHover(null)}
                tabIndex={0}
                role="button"
                aria-label={`Select analysis item ${index + 1}`}
                onKeyDown={(e) => e.key === 'Enter' && handleItemSelect(item)}
              >
                <div className="item-header">
                  <div className="item-number">#{index + 1}</div>
                  <button
                    className="remove-btn"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent triggering onClick of parent
                      removeItem(item.id);
                    }}
                    aria-label={`Remove analysis item ${index + 1}`}
                  >
                    ×
                  </button>
                </div>
                <div className="genotype-section">
                  <h4 style={{ fontFamily: "'Lato', sans-serif" }}>Genotype</h4>
                  <div className="sequence-display">
                    <span className="sequence-text">{item.sequence}</span>
                    <span className="position-info">Position: {item.start + 1} - {item.end}</span>
                  </div>
                </div>
                <div className="phenotype-section">
                  <h4 style={{ fontFamily: "'Lato', sans-serif" }}>Phenotype Analysis</h4>
                  <div className="phenotype-grid">
                    <div className="phenotype-item">
                      <span className="label">Predicted Phenotype:</span>
                      <span className="value phenotype-value">{item.phenotype}</span>
                    </div>
                    <div className="phenotype-item">
                      <span className="label">Confidence:</span>
                      <span className="value confidence-value">{item.confidence}</span>
                    </div>
                    <div className="phenotype-item">
                      <span className="label">GC Content:</span>
                      <span className="value gc-value">{item.gcContent}</span>
                    </div>
                  </div>
                </div>
                <div className="item-footer">
                  <span className="timestamp">Analyzed at {item.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GenotypePhenotypeList;