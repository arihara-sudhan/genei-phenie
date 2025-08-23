import React, { useState, useRef, useEffect } from 'react';

const CutSimulation = ({ onGeneHighlight }) => {
  const [highlightedGene, setHighlightedGene] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [genotypePhenotypes, setGenotypePhenotypes] = useState([]);
  const [showList, setShowList] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [currentWindowPosition, setCurrentWindowPosition] = useState(0);
  const [windowSize] = useState(10);
  const [stepSize] = useState(10); // No overlap - step size equals window size

  const [hoveredGene, setHoveredGene] = useState(null);
  const [fullSequence, setFullSequence] = useState("");
  const [isLoadingSequence, setIsLoadingSequence] = useState(true);
  const [currentAnalyzingGene, setCurrentAnalyzingGene] = useState(null);
  const [selectedPhenotype, setSelectedPhenotype] = useState('All Phenotypes'); // Default phenotype
  const sequenceContainerRef = useRef(null);
  
  // Load sequence from data file
  useEffect(() => {
    const loadSequence = async () => {
      try {
        setIsLoadingSequence(true);
        const response = await fetch('/data/sample');
        if (!response.ok) {
          throw new Error(`Failed to load sequence data: ${response.status} ${response.statusText}`);
        }
        if (!response.headers.get('content-type')?.includes('text/')) {
          throw new Error('Response is not text data');
        }
        const sequenceData = await response.text();
        const cleanedSequence = sequenceData.replace(/_/g, '').trim();
        setFullSequence(cleanedSequence);
        console.log('SlidingGenes: Loaded sequence, length:', cleanedSequence.length);
      } catch (error) {
        console.error('SlidingGenes: Error loading sequence:', error);
        // Fallback to a default sequence if loading fails
        setFullSequence("ATGCGTACGCGATCCGTAGCACGTGTGCAACGTAGCTAGCGATCAGTCGTGTGCGTACGTTAGCGATCGCCCGAATCGTAGTGATCGTAGATCGTAGCGAGATCTAGCGTGTGCGTAGCACGATCGTAGCCCGATCGATGGTGTAGCGTAAGCATCGCGGATCGTAGCTGTGCATAGCGATCGCGTAGCCCGACGTATGGTGCGATCGTTCGTAGCGATCGATCAGCGTAAGGTGTACGATGATAGCGCGATGCCGATGATCGGTGCGAATCGAATCGTAGCGAGATCCGATGTGTGTAGCATGCGCGTAGCATCCGAGATCGTGTGATCGCGAATCGCGATGTGATCTACGCGGTGCATGCTACGTAGATCGCCCGATAGCGTGTGCGTATCGTAGCATGCGCGATCCGTATGGTGTACGCTACGCGTAGCGACCGATGCGTAGTGATCGTAGATCGTAGCGTGATCGATCGCGTGCGACTAGCGTAGCGATGCCGATCGTAGGTGCGTAGCTTAGCGATCGTGATCCGATGCGTGTACGCGAATCGCGTAGACCGATGATCGGTGCGATCGCCGATCGTAGTGATCTAGCGCGTGTAGCGATTAGCGCGATCCCGACGTATGGTGCGTAGCAATCGTAGCGAGATCGTAGCTGTGCATCGTACGTAGATCGCCCGATGCGTAGTGATCGTAGTCATGCGCGATCCGTAGCGTTGTACGATGATCGCGTAGCCCGATAGCGTGTGCGTAGCTCGTAGCGATGGATCGATCGCGTGCGAATCGTAGCGATCGTCCGATGATCGGTGTAGCGTAATCGTAGCGAGATCCGATGTGTGCGATCGCCGCGTAGCATCCGAGATCGTGTGTACGCTAATCGCGATGTGATCTACGCGGTGCGTAGCACGTAGATCGCCCGATAGCGTGTGATCGTAGTAGCATGCGCGATCCGTATGGTGCGACTAGCGCGTAGCGACCGATGCGTAGTGATCGTAGTCGTAGCGTGATCGATCGCGTGTACGCGACGTAGCGATGCCGATGATCGGTGCGATCGTAGCGATCGTGATCCGATGTGTGTAGCGATATCGCGTAGACCGATAGCGTGTGCGTAGCACGATCGTAGTGATCGTAGCTGTGCATCGTATAGCGCGATCCGATGCGTAGTGATCGTAGTCGTAGCGAGATCTAGCGCGTGTACGATGCGTAGATCGCCCGACGTATGGTGCGTAGCTTAGCATCGCGGATCCGTAGCGTGCGAATCGAATCGCGTAGCCCGATGATCGGTGTAGCGTAACGTAGCGATGGATCGATCGCGTGCGATCGTAGCGATCGT");
      } finally {
        setIsLoadingSequence(false);
      }
    };
    
    loadSequence();
  }, []);

  // Calculate the actual length of the DNA sequence
  const sequenceLength = fullSequence.length;

  // Split sequence into segments for better display
  const sequenceSegments = fullSequence.match(/.{1,50}/g) || [];

  const getGenePhenotype = async (geneSequence) => {
    try {
      const formData = new FormData();
      formData.append('sequence', geneSequence);

      const response = await fetch('http://localhost:8000/api/predict', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      return {
        phenotype: result.predicted_phenotype,
        confidence: `${(result.confidence * 100).toFixed(1)}%`,
        gcContent: `${(result.predicted_gc_content * 100).toFixed(1)}%`
      };
    } catch (err) {
      console.error(`Failed to get phenotype for sequence ${geneSequence}:`, err.message);
      return null;
    }
  };

  const runSlidingWindowAnalysis = async () => {
    setIsAnalyzing(true);
    setError(null);
    setGenotypePhenotypes([]);
    setShowList(true);
    setCurrentWindowPosition(0);
    
    const totalWindows = Math.floor((sequenceLength - windowSize) / stepSize) + 1;
    
    console.log(`Starting sliding window analysis: ${totalWindows} windows to analyze`);
    
    const newGenotypePhenotypes = [];
    
    for (let i = 0; i < totalWindows; i++) {
      const start = i * stepSize;
      const end = start + windowSize;
      
      // Update progress and window position
      const progress = ((i + 1) / totalWindows) * 100;
      setAnalysisProgress(progress);
      setCurrentWindowPosition(start);
      
      // Extract gene sequence
      const gene = fullSequence.substring(start, end);
      
      // Set current analyzing gene for real-time highlighting
      const currentGene = {
        start: start,
        end: end,
        sequence: gene,
        phenotype: 'Analyzing...',
        confidence: '0%',
        gcContent: '0%'
      };
      setCurrentAnalyzingGene(currentGene);
      
      // Get phenotype from API
      const phenotypeData = await getGenePhenotype(gene);
      
      if (phenotypeData) {
        const geneData = {
          start: start,
          end: end,
          sequence: gene,
          phenotype: phenotypeData.phenotype,
          confidence: phenotypeData.confidence,
          gcContent: phenotypeData.gcContent,
          position: start
        };
        
        newGenotypePhenotypes.push(geneData);
        
        // Update the list in real-time
        setGenotypePhenotypes([...newGenotypePhenotypes]);
        
        // Clear current analyzing gene after processing
        setCurrentAnalyzingGene(null);
        
        // Add a small delay to show progress and window movement
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    setIsAnalyzing(false);
    setAnalysisProgress(0);
    setCurrentWindowPosition(0);
    setCurrentAnalyzingGene(null);
    setSelectedFilter(null); // Reset filter when analysis completes
    console.log(`Analysis complete: ${newGenotypePhenotypes.length} genotypes analyzed`);
  };

  // Get unique phenotypes for filter buttons
  const getUniquePhenotypes = () => {
    if (genotypePhenotypes.length === 0) {
      return ['All Phenotypes', 'SICKLE CELL ANAEMIA', 'HEALTHY', 'NORMAL', 'MUTATION'];
    }
    const phenotypes = genotypePhenotypes.map(item => item.phenotype);
    return ['All Phenotypes', ...new Set(phenotypes)];
  };

  // Filter results based on selected phenotype
  const getFilteredResults = () => {
    if (!selectedFilter) return genotypePhenotypes;
    return genotypePhenotypes.filter(item => item.phenotype === selectedFilter);
  };

  const handleFilterClick = (phenotype) => {
    setSelectedFilter(selectedFilter === phenotype ? null : phenotype);
  };

  const handleItemHover = (item) => {
    if (item) {
      setHoveredGene(item);
      // Pass hovered gene data to parent component for DoubleHelix highlighting
      if (onGeneHighlight) {
        onGeneHighlight(item);
      }
    } else {
      setHoveredGene(null);
      // Clear highlight when not hovering
      if (onGeneHighlight) {
        onGeneHighlight(null);
      }
    }
  };

  const handleItemSelect = (item) => {
    console.log('SlidingGenes handleItemSelect called:', item);
    if (item) {
      setHighlightedGene(item);
      // Pass selected gene data to parent component for DoubleHelix highlighting
      if (onGeneHighlight) {
        console.log('SlidingGenes calling onGeneHighlight with:', item);
        onGeneHighlight(item);
      }
    } else {
      setHighlightedGene(null);
      // Clear highlight when no item is selected
      if (onGeneHighlight) {
        console.log('SlidingGenes calling onGeneHighlight with null');
        onGeneHighlight(null);
      }
    }
  };

  const handleLetterClick = async (letterIndex) => {
    // Find which gene this letter belongs to (assuming 10-letter genes)
    const geneStart = Math.floor(letterIndex / 10) * 10;
    const geneEnd = geneStart + 10;
    const gene = fullSequence.substring(geneStart, geneEnd);
    
    setLoading(true);
    setError(null);
    
    // Get phenotype from API
    const phenotypeData = await getGenePhenotype(gene);
    
    if (phenotypeData) {
      const geneData = {
        start: geneStart,
        end: geneEnd,
        sequence: gene,
        phenotype: phenotypeData.phenotype,
        confidence: phenotypeData.confidence,
        gcContent: phenotypeData.gcContent,
        position: letterIndex
      };
      
      setHighlightedGene(geneData);
      
      // Pass gene data to parent component for DoubleHelix highlighting
      if (onGeneHighlight) {
        onGeneHighlight(geneData);
      }
    } else {
      setError('Failed to analyze this gene sequence');
    }
    
    setLoading(false);
  };

  const isLetterHighlighted = (letterIndex) => {
    if (!highlightedGene) return false;
    return letterIndex >= highlightedGene.start && letterIndex < highlightedGene.end;
  };

  const isLetterHovered = (letterIndex) => {
    if (!hoveredGene) return false;
    return letterIndex >= hoveredGene.start && letterIndex < hoveredGene.end;
  };

  const isInSlidingWindow = (letterIndex) => {
    if (!isAnalyzing) return false;
    return letterIndex >= currentWindowPosition && letterIndex < currentWindowPosition + windowSize;
  };

  // Check if a genotype matches the selected phenotype
  const isSelectedPhenotype = (letterIndex) => {
    // Check completed genotypes (this should persist after analysis)
    const matchingGenotype = genotypePhenotypes.find(genotype => 
      letterIndex >= genotype.start && 
      letterIndex < genotype.end && 
      genotype.phenotype === selectedPhenotype
    );
    
    if (matchingGenotype) {
      return true;
    }
    
    // Check current analyzing gene (for real-time highlighting during analysis)
    if (currentAnalyzingGene && 
        letterIndex >= currentAnalyzingGene.start && 
        letterIndex < currentAnalyzingGene.end) {
      // If we have phenotype data for current gene, check if it matches selected phenotype
      const currentGeneInResults = genotypePhenotypes.find(genotype => 
        genotype.start === currentAnalyzingGene.start && 
        genotype.end === currentAnalyzingGene.end
      );
      if (currentGeneInResults && currentGeneInResults.phenotype === selectedPhenotype) {
        return true;
      }
    }
    
    return false;
  };

  const toggleList = () => {
    if (!showList && genotypePhenotypes.length === 0) {
      // If list is empty and we're trying to show it, run the analysis
      runSlidingWindowAnalysis();
    } else {
      setShowList(!showList);
    }
  };

  // Note: Removed auto-scroll to allow manual scrolling during animation

  // Show loading state while sequence is being loaded
  if (isLoadingSequence) {
    return (
      <div className="cut-simulation" style={{ 
        minHeight: '100vh', 
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: '#e0e7ff',
        fontSize: '1.2rem'
      }}>
        Loading DNA sequence...
      </div>
    );
  }

  return (
    <div className="cut-simulation" style={{ 
      minHeight: '100vh', 
      width: '100%',
      overflow: 'hidden', 
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div className="sequence-display" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="header-section" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '1rem'
        }}>
          <div>
            <h2 style={{ fontFamily: "'Lato', sans-serif", fontSize: 'clamp(1.5rem, 4vw, 2rem)', marginBottom: '0.5rem' }}>Full DNA Sequence</h2>
            <p style={{ fontSize: 'clamp(0.875rem, 2vw, 1rem)', marginBottom: '0.5rem' }}>Click "Run Analysis" to see sliding window in action</p>
            <p style={{ fontSize: 'clamp(0.875rem, 2vw, 1rem)', marginBottom: '1rem' }}><strong>Sequence Length:</strong> {sequenceLength} base pairs</p>
            
            {/* Phenotype Selection Input */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.75rem',
              marginBottom: '1rem',
              flexWrap: 'wrap'
            }}>
              <label style={{ 
                fontSize: 'clamp(0.875rem, 2vw, 1rem)', 
                color: '#e0e7ff',
                fontWeight: '600',
                whiteSpace: 'nowrap'
              }}>
                Highlight Phenotype:
              </label>
              <input
                type="text"
                value={selectedPhenotype}
                onChange={(e) => setSelectedPhenotype(e.target.value)}
                placeholder="Enter phenotype to highlight..."
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: '2px solid rgba(255, 255, 255, 0.2)',
                  background: 'rgba(0, 0, 0, 0.3)',
                  color: '#ffffff',
                  fontSize: 'clamp(0.875rem, 2vw, 1rem)',
                  minWidth: '200px',
                  outline: 'none',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#6366f1';
                  e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <button
                onClick={() => setSelectedPhenotype('SICKLECELLAEMIA')}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: '2px solid #FF4444',
                  background: 'rgba(255, 68, 68, 0.1)',
                  color: '#FF4444',
                  fontSize: 'clamp(0.75rem, 1.5vw, 0.875rem)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255, 68, 68, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255, 68, 68, 0.1)';
                }}
              >
                Reset to Disease (Red)
              </button>
            </div>
            

            </div>
          </div>
          
          <button 
            className="toggle-list-btn"
            onClick={toggleList}
            disabled={isAnalyzing}
            style={{
              background: isAnalyzing ? 'rgba(255, 255, 255, 0.2)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              border: 'none',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              cursor: isAnalyzing ? 'not-allowed' : 'pointer',
              fontSize: 'clamp(0.875rem, 2vw, 1rem)',
              fontWeight: '600',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              opacity: isAnalyzing ? 0.7 : 1
            }}
            onMouseEnter={(e) => {
              if (!isAnalyzing) {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 0.5rem 1rem rgba(99, 102, 241, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = 'none';
            }}
          >
            <span>{isAnalyzing ? '⏳' : (showList ? '📋' : '🔬')}</span>
            <span>
              {isAnalyzing 
                ? `Analyzing... ${Math.round(analysisProgress)}%` 
                : (showList ? 'Hide Analysis' : 'Run Sliding Window Analysis')
              }
            </span>
          </button>
        </div>
        
        <div className="sequence-container" ref={sequenceContainerRef} style={{ 
          fontFamily: 'monospace', 
          fontSize: 'clamp(10px, 1.5vw, 14px)', 
          lineHeight: '1.5',
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          padding: '0.5rem',
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          minHeight: '0',
          position: 'relative'
        }}>
          <style>{`
            .sequence-container::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {sequenceSegments.map((segment, segmentIndex) => (
            <div key={segmentIndex} className="sequence-line" style={{ marginBottom: '5px' }}>
              <span className="line-number" style={{ marginRight: '10px', color: '#888', fontSize: 'clamp(8px, 1.2vw, 12px)' }}>
                {(segmentIndex * 50 + 1).toString().padStart(4, '0')}
              </span>
              <span className="sequence-text">
                                {segment.split('').map((letter, letterIndex) => {
                  const globalIndex = segmentIndex * 50 + letterIndex;
                  const isHighlighted = isLetterHighlighted(globalIndex);
                  const isHovered = isLetterHovered(globalIndex);
                  const isInWindow = isInSlidingWindow(globalIndex);
                  const isSelected = isSelectedPhenotype(globalIndex);
                  
                  return (
                    <span
                      key={letterIndex}
                      data-index={globalIndex}
                      onClick={() => handleLetterClick(globalIndex)}
                      style={{
                        cursor: 'pointer',
                        padding: '1px',
                        backgroundColor: isSelected 
                          ? (selectedPhenotype === 'All Phenotypes' 
                              ? 'rgba(144, 238, 144, 0.3)' // Light green shade for all phenotypes
                              : (selectedPhenotype === 'SICKLECELLAEMIA' 
                                  ? '#FF4444' // Vibrant red for disease only
                                  : '#90EE90')) // Light green for other phenotypes
                          : isInWindow 
                            ? '#90EE90' // Light green for sliding window (same as manual selection)
                            : isHovered 
                              ? 'rgba(255, 165, 0, 0.8)' // Orange for hovered gene
                              : isHighlighted 
                                ? '#90EE90' // Light green for highlighted gene
                                : 'transparent',
                        color: isSelected || isInWindow || isHovered || isHighlighted ? '#000' : '#fff',
                        borderRadius: '2px',
                        transition: 'all 0.2s ease',
                        fontSize: 'clamp(8px, 1.2vw, 12px)',
                        border: 'none',
                        boxShadow: 'none',
                        position: 'relative',
                        zIndex: 1,
                        margin: '0',
                        transform: 'scale(1)'
                      }}
                      onMouseEnter={(e) => {
                        if (!isInWindow && !isSelected) {
                          e.target.style.backgroundColor = isHighlighted ? '#90EE90' : '#333';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isInWindow && !isSelected) {
                          e.target.style.backgroundColor = isHighlighted ? '#90EE90' : 'transparent';
                        }
                      }}
                    >
                      {letter}
                    </span>
                  );
                })}
              </span>
            </div>
          ))}
          

        </div>
      </div>

      {loading && (
        <div className="loading" style={{ marginTop: '1rem', textAlign: 'center' }}>
          <div className="spinner" style={{
            width: '48px',
            height: '48px',
            border: '4px solid rgba(255, 255, 255, 0.1)',
            borderTop: '4px solid #6366f1',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem auto'
          }}></div>
          <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 'clamp(0.875rem, 2vw, 1rem)' }}>Analyzing gene sequence...</p>
        </div>
      )}

      {isAnalyzing && (
        <div className="analysis-progress" style={{ marginTop: '1rem', textAlign: 'center' }}>
          <div className="progress-bar" style={{
            width: '100%',
            height: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '1rem'
          }}>
            <div className="progress-fill" style={{
              width: `${analysisProgress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
              transition: 'width 0.3s ease'
            }}></div>
          </div>
          <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 'clamp(0.875rem, 2vw, 1rem)' }}>
            Sliding window at position {currentWindowPosition + 1}-{currentWindowPosition + windowSize} 
            ({Math.round(analysisProgress)}% complete)
          </p>
        </div>
      )}



      {error && (
        <div className="error-message" style={{ 
          marginTop: '1rem', 
          padding: '1rem 1.5rem', 
          background: 'rgba(239, 68, 68, 0.1)', 
          border: '1px solid rgba(239, 68, 68, 0.3)', 
          borderRadius: '12px', 
          color: '#fca5a5',
          fontSize: 'clamp(0.875rem, 2vw, 1rem)'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {highlightedGene && !loading && (
        <div className="highlighted-gene-phenotype" style={{ marginTop: '1rem' }}>
                      <h3 style={{ fontFamily: "'Lato', sans-serif", fontSize: 'clamp(1.25rem, 3vw, 1.5rem)', marginBottom: '0.5rem' }}>Gene Analysis Results</h3>
          <div className="gene-info" style={{ 
            padding: '1rem', 
            backgroundColor: '#90EE90', 
            color: '#000', 
            borderRadius: '8px',
            fontSize: 'clamp(0.875rem, 2vw, 1rem)'
          }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Gene Sequence:</strong> {highlightedGene.sequence}
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Position:</strong> {highlightedGene.start + 1} - {highlightedGene.end} (of {sequenceLength})
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Predicted Phenotype:</strong> {highlightedGene.phenotype}
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Confidence:</strong> {highlightedGene.confidence}
            </div>
            <div>
              <strong>GC Content:</strong> {highlightedGene.gcContent}
            </div>
          </div>
        </div>
      )}



      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0% {
            border-color: rgba(0, 150, 255, 0.6);
            box-shadow: 0 0 10px rgba(0, 150, 255, 0.3);
          }
          100% {
            border-color: rgba(0, 150, 255, 1);
            box-shadow: 0 0 20px rgba(0, 150, 255, 0.6);
          }
        }
        
        @media (max-width: 768px) {
          .cut-simulation {
            padding: 0.5rem;
          }
          
          .header-section {
            flex-direction: column;
            gap: 1rem;
            align-items: flex-start;
          }
          
          .toggle-list-btn {
            width: 100%;
            justify-content: center;
          }
        }
        
        @media (max-width: 480px) {
          .cut-simulation {
            padding: 0.25rem;
          }
        }
      `}</style>
    </div>
  );
};

export default CutSimulation;
