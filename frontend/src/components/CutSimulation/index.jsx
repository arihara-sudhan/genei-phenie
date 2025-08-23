import React, { useState, useRef, useEffect } from 'react';

const CutSimulation = ({ onGeneHighlight, onSlidingWindowUpdate, onCrisprUpdate, onChatToggle = () => {}, chatAction, onChatActionComplete }) => {
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
  const [isCRISPRActive, setIsCRISPRActive] = useState(false);
  const [correctedSequence, setCorrectedSequence] = useState('');
  const [gRNASuggestion, setGRNASuggestion] = useState('');
  const [templateDNASuggestion, setTemplateDNASuggestion] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [isProcessingChatAction, setIsProcessingChatAction] = useState(false);
  const isPausedRef = useRef(false);
  const isAnalyzingRef = useRef(false);
  const sequenceContainerRef = useRef(null);
  const geneAnalysisRef = useRef(null);

  // Keep refs in sync with state
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    isAnalyzingRef.current = isAnalyzing;
  }, [isAnalyzing]);


  
  // Load sequence from data file
  useEffect(() => {
    const loadSequence = async () => {
      try {
        setIsLoadingSequence(true);
        const response = await fetch('/data/sample');
        if (!response.ok) {
          throw new Error(`Failed to load sequence data: ${response.status} ${response.statusText}`);
        }
        const sequenceData = await response.text();
        const cleanedSequence = sequenceData.replace(/_/g, '').trim();
        setFullSequence(cleanedSequence);
        console.log('CutSimulation: Loaded sequence, length:', cleanedSequence.length);
      } catch (error) {
        console.error('CutSimulation: Error loading sequence:', error);
        // Fallback to a default sequence if loading fails
        setFullSequence("ATGCGTACGCGATCCGTAGCACGTGTGCAACGTAGCTAGCGATCAGTCGTGTGCGTACGTTAGCGATCGCCCGAATCGTAGTGATCGTAGATCGTAGCGAGATCTAGCGTGTGCGTAGCACGATCGTAGCCCGATCGATGGTGTAGCGTAAGCATCGCGGATCGTAGCTGTGCATAGCGATCGCGTAGCCCGACGTATGGTGCGATCGTTCGTAGCGATCGATCAGCGTAAGGTGTACGATGATAGCGCGATGCCGATGATCGGTGCGAATCGAATCGTAGCGAGATCCGATGTGTGTAGCATGCGCGTAGCATCCGAGATCGTGTGATCGCGAATCGCGATGTGATCTACGCGGTGCATGCTACGTAGATCGCCCGATAGCGTGTGCGTATCGTAGCATGCGCGATCCGTATGGTGTACGCTACGCGTAGCGACCGATGCGTAGTGATCGTAGATCGTAGCGTGATCGATCGCGTGCGACTAGCGTAGCGATGCCGATCGTAGGTGCGTAGCTTAGCGATCGTGATCCGATGCGTGTACGCGAATCGCGTAGACCGATGATCGGTGCGATCGCCGATCGTAGTGATCTAGCGCGTGTAGCGATTAGCGCGATCCCGACGTATGGTGCGTAGCAATCGTAGCGAGATCGTAGCTGTGCATCGTACGTAGATCGCCCGATGCGTAGTGATCGTAGTCATGCGCGATCCGTAGCGTTGTACGATGATCGCGTAGCCCGATAGCGTGTGCGTAGCTCGTAGCGATGGATCGATCGCGTGCGAATCGTAGCGATCGTCCGATGATCGGTGTAGCGTAATCGTAGCGAGATCCGATGTGTGCGATCGCCGCGTAGCATCCGAGATCGTGTGTACGCTAATCGCGATGTGATCTACGCGGTGCGTAGCACGTAGATCGCCCGATAGCGTGTGATCGTAGTAGCATGCGCGATCCGTATGGTGCGACTAGCGCGTAGCGACCGATGCGTAGTGATCGTAGTCGTAGCGTGATCGATCGCGTGTACGCGACGTAGCGATGCCGATGATCGGTGCGATCGTAGCGATCGTGATCCGATGTGTGTAGCGATATCGCGTAGACCGATAGCGTGTGCGTAGCACGATCGTAGTGATCGTAGCTGTGCATCGTATAGCGCGATCCGATGCGTAGTGATCGTAGTCGTAGCGAGATCTAGCGCGTGTACGATGCGTAGATCGCCCGACGTATGGTGCGTAGCTTAGCATCGCGGATCCGTAGCGTGCGAATCGAATCGCGTAGCCCGATGATCGGTGTAGCGTAACGTAGCGATGGATCGATCGCGTGCGATCGTAGCGATCGT");
      } finally {
        setIsLoadingSequence(false);
      }
    };
    
    loadSequence();
  }, []);

  // Update sliding window data in parent component
  useEffect(() => {
    if (onSlidingWindowUpdate) {
      onSlidingWindowUpdate({
        isAnalyzing,
        currentWindowPosition,
        windowSize,
        isPaused
      });
    }
  }, [isAnalyzing, currentWindowPosition, windowSize, isPaused]);

  // Update CRISPR data in parent component
  useEffect(() => {
    if (onCrisprUpdate) {
      onCrisprUpdate({
        isCRISPRActive,
        correctedSequence
      });
    }
  }, [isCRISPRActive, correctedSequence, onCrisprUpdate]);

  // Handle chat actions
  useEffect(() => {
    if (chatAction) {
      console.log('Processing chat action:', chatAction);
      setIsProcessingChatAction(true);
      
      switch (chatAction.action) {
        case 'find_sickle_cell':
          // Set phenotype filter to SICKLECELLAEMIA and run analysis
          setSelectedPhenotype('SICKLECELLAEMIA');
          setShowList(true); // Ensure the results list is visible
          setTimeout(() => {
            runSlidingWindowAnalysis();
          }, 500);
          break;
          
        case 'run_analysis':
          // Run full analysis
          setTimeout(() => {
            runSlidingWindowAnalysis();
          }, 500);
          break;
          
        case 'find_diseases':
          // Set phenotype filter to show diseases and run analysis
          setSelectedPhenotype('SICKLECELLAEMIA');
          setTimeout(() => {
            runSlidingWindowAnalysis();
          }, 500);
          break;
          
        case 'find_healthy':
          // Set phenotype filter to show healthy genes
          setSelectedPhenotype('HEALTHY');
          break;
          
        case 'crispr_suggestions':
          // If there's a highlighted gene with disease, show CRISPR options
          if (highlightedGene && highlightedGene.phenotype === 'SICKLECELLAEMIA') {
            // CRISPR suggestions will be shown in the existing UI
            console.log('CRISPR suggestions available for highlighted gene');
          } else {
            // Find a disease gene first
            setSelectedPhenotype('SICKLECELLAEMIA');
            setTimeout(() => {
              runSlidingWindowAnalysis();
            }, 500);
          }
          break;
          
        case 'sequence_info':
          // Show sequence information (this could be enhanced with a modal)
          console.log('Sequence info requested');
          break;
          
        default:
          console.log('Unknown chat action:', chatAction.action);
      }
      
      // Clear the chat action after processing
      if (onChatActionComplete) {
        setTimeout(() => {
          onChatActionComplete();
          setIsProcessingChatAction(false);
        }, 1000);
      }
    }
  }, [chatAction, onChatActionComplete]);

  // Effect to handle CRISPR completion and cleanup
  useEffect(() => {
    if (!isCRISPRActive && correctedSequence && highlightedGene) {
      // CRISPR animation has completed, now clean up
      setTimeout(() => {
        // Update the genotypePhenotypes to reflect the corrected gene
        setGenotypePhenotypes(prev => 
          prev.map(genotype => 
            genotype.start === highlightedGene.start && genotype.end === highlightedGene.end
              ? { ...genotype, phenotype: 'HEALTHY', confidence: '100.0%' }
              : genotype
          )
        );
        
        // Remove the red highlight after the 3D repair animation is complete
        setHighlightedGene(null);
        setCurrentAnalyzingGene(null);
        setHoveredGene(null);
        setCorrectedSequence('');
        setGRNASuggestion('');
        setTemplateDNASuggestion('');
      }, 1000); // Wait 1 second after CRISPR completion to show the final result
    }
  }, [isCRISPRActive, correctedSequence, highlightedGene]);

  // Calculate the actual length of the DNA sequence
  const sequenceLength = fullSequence.length;

  // Display sequence as one continuous flow
  const sequenceSegments = [fullSequence];

  const getCRISPRSuggestions = async (geneSequence) => {
    try {
      const formData = new FormData();
      formData.append('sequence', geneSequence);
      formData.append('request_type', 'crispr_suggestions');

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
        gRNA: result.gRNA_suggestion || 'GGCGGCGGCGG',
        templateDNA: result.template_dna_suggestion || 'ATGCGTACGCG'
      };
    } catch (err) {
      console.error(`Failed to get CRISPR suggestions for sequence ${geneSequence}:`, err.message);
      return {
        gRNA: 'GGCGGCGGCGG',
        templateDNA: 'ATGCGTACGCG'
      };
    }
  };

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
    console.log('Button clicked! Current state:', { isAnalyzing, isPaused, sequenceLength });
    
    if (isAnalyzing && !isPaused) {
      // If already analyzing, pause it
      console.log('Pausing analysis...');
      setIsPaused(true);
      return;
    }
    
    if (isAnalyzing && isPaused) {
      // If paused, resume
      console.log('Resuming analysis...');
      setIsPaused(false);
      return;
    }
    
    // Start new analysis
    console.log('Starting new analysis...');
    
    // Check if sequence is loaded
    if (!fullSequence || fullSequence.length === 0) {
      console.error('No sequence loaded!');
      setError('No DNA sequence loaded. Please wait for sequence to load.');
      return;
    }
    
    setIsAnalyzing(true);
    setIsPaused(false);
    setError(null);
    setGenotypePhenotypes([]);
    setShowList(true);
    setCurrentWindowPosition(0);
    setCurrentAnalyzingGene(null);
    
    const totalWindows = Math.floor((sequenceLength - windowSize) / stepSize) + 1;
    
    console.log(`Starting sliding window analysis: ${totalWindows} windows to analyze`);
    
    // Test API connection with a valid sequence
    try {
      const testFormData = new FormData();
      testFormData.append('sequence', 'ATGCGTACGCG'); // Test with a valid sequence
      
      const testResponse = await fetch('http://localhost:8000/api/predict', {
        method: 'POST',
        body: testFormData
      });
      
      if (!testResponse.ok) {
        throw new Error(`Backend error: ${testResponse.status}`);
      }
      
      console.log('Backend connection OK');
    } catch (error) {
      console.error('Backend connection failed:', error);
      setError(`Backend connection failed: ${error.message}`);
      setIsAnalyzing(false);
      return;
    }
    
    const newGenotypePhenotypes = [];
    
    for (let i = 0; i < totalWindows; i++) {
      // Check for pause state - use ref for immediate updates
      while (isPausedRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // If analysis was stopped while paused, break out of the loop
      if (!isAnalyzingRef.current) {
        break;
      }
      
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

    console.log(`Analysis complete: ${newGenotypePhenotypes.length} genotypes analyzed`);
  };

  // Get unique phenotypes for dropdown
  const getUniquePhenotypes = () => {
    if (genotypePhenotypes.length === 0) {
      return ['All Phenotypes', 'SICKLECELLAEMIA', 'HEALTHY', 'NORMAL', 'MUTATION'];
    }
    const phenotypes = genotypePhenotypes.map(item => item.phenotype);
    return ['All Phenotypes', ...new Set(phenotypes)];
  };



  const handleCRISPRCorrection = async () => {
    if (!highlightedGene || highlightedGene.phenotype !== 'SICKLECELLAEMIA') return;
    
    setIsCRISPRActive(true);
    
    // Store the highlighted gene for later cleanup
    const geneToCorrect = highlightedGene;
    
    // Get CRISPR suggestions
    const suggestions = await getCRISPRSuggestions(highlightedGene.sequence);
    setGRNASuggestion(suggestions.gRNA);
    setTemplateDNASuggestion(suggestions.templateDNA);
    
    // Start correction animation
    const originalSequence = highlightedGene.sequence;
    const correctedSequence = suggestions.templateDNA;
    
          for (let i = 0; i < originalSequence.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay per letter
        
        const newSequence = originalSequence.substring(0, i) + correctedSequence[i] + originalSequence.substring(i + 1);
        setCorrectedSequence(newSequence);
        
        // Update the full sequence
        const newFullSequence = fullSequence.substring(0, highlightedGene.start) + newSequence + fullSequence.substring(highlightedGene.end);
        setFullSequence(newFullSequence);
      }
      
      // The 3D CRISPR animation will handle the completion
      // The red highlight will be removed when the animation completes
      // (handled by the useEffect that watches isCRISPRActive)
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
      (selectedPhenotype === 'All Phenotypes' || genotype.phenotype === selectedPhenotype)
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
      if (currentGeneInResults && (selectedPhenotype === 'All Phenotypes' || currentGeneInResults.phenotype === selectedPhenotype)) {
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

  const hideGeneAnalysis = () => {
    setHighlightedGene(null);
  };

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
            <p style={{ fontSize: 'clamp(0.875rem, 2vw, 1rem)', marginBottom: '1rem' }}><strong>Sequence Length:</strong> {sequenceLength} base pairs</p>
            
            {/* Phenotype Selection Dropdown */}
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
              <select
                value={selectedPhenotype}
                onChange={(e) => setSelectedPhenotype(e.target.value)}
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
              >
                {getUniquePhenotypes().map((phenotype, index) => (
                  <option key={index} value={phenotype} style={{ background: '#1f2937', color: '#ffffff' }}>
                    {phenotype}
                  </option>
                ))}
              </select>

            </div>
            
            {/* Error Display */}
            {error && (
              <div style={{
                background: 'rgba(255, 68, 68, 0.1)',
                border: '2px solid #FF4444',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                marginTop: '1rem',
                color: '#FF4444',
                fontSize: 'clamp(0.875rem, 2vw, 1rem)'
              }}>
                <strong>Error:</strong> {error}
              </div>
            )}

            {/* Chat Action Processing Indicator */}
            {isProcessingChatAction && (
              <div style={{
                background: 'rgba(99, 102, 241, 0.1)',
                border: '2px solid #6366f1',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                marginTop: '1rem',
                color: '#6366f1',
                fontSize: 'clamp(0.875rem, 2vw, 1rem)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #6366f1',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <strong>Processing Chat Action:</strong> Finding sickle cell anemia cases...
              </div>
            )}

          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button 
              className="play-pause-btn"
              onClick={runSlidingWindowAnalysis}
              style={{
                background: isAnalyzing 
                  ? (isPaused ? 'rgba(255, 165, 0, 0.8)' : 'rgba(255, 68, 68, 0.8)')
                  : 'rgba(76, 175, 80, 0.8)',
                border: 'none',
                color: 'white',
                padding: '0.5rem',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '1.2rem',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'scale(1)';
              }}
            >
              {isAnalyzing 
                ? (isPaused ? '▶' : '⏸') 
                : '▶'
              }
            </button>
            
            <button 
              className="chat-btn"
              onClick={onChatToggle}
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                border: 'none',
                color: 'white',
                padding: '0.5rem',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '1.2rem',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'scale(1.1)';
                e.target.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'scale(1)';
                e.target.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
              }}
            >
              💬
            </button>
          </div>
        </div>
        
        <div className="sequence-container" ref={sequenceContainerRef} style={{ 
          fontFamily: "'Courier New', 'Consolas', 'Monaco', monospace", 
          fontSize: 'clamp(12px, 1.8vw, 16px)', 
          lineHeight: '1.8',
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden', // Hide horizontal scroll since we're wrapping
          scrollbarWidth: 'thin',
          msOverflowStyle: 'auto',
          padding: '1rem',
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          minHeight: '0',
          position: 'relative',
          width: '100%', // Use full width
          whiteSpace: 'pre-wrap', // Allow wrapping while preserving spacing
          overflowWrap: 'break-word'
        }}>
          <style>{`
            .sequence-container::-webkit-scrollbar {
              width: 8px;
              height: 8px;
            }
            .sequence-container::-webkit-scrollbar-track {
              background: rgba(255, 255, 255, 0.1);
              border-radius: 4px;
            }
            .sequence-container::-webkit-scrollbar-thumb {
              background: rgba(255, 255, 255, 0.3);
              border-radius: 4px;
            }
            .sequence-container::-webkit-scrollbar-thumb:hover {
              background: rgba(255, 255, 255, 0.5);
            }
          `}</style>
          {sequenceSegments.map((segment, segmentIndex) => (
            <div key={segmentIndex} className="sequence-line" style={{ 
              marginBottom: '0',
              display: 'block',
              width: '100%',
              lineHeight: '1.8'
            }}>
              <span className="sequence-text" style={{
                display: 'block',
                width: '100%',
                fontFamily: "'Courier New', 'Consolas', 'Monaco', monospace",
                fontSize: 'clamp(12px, 1.8vw, 16px)',
                letterSpacing: '0.5px',
                whiteSpace: 'pre-wrap',
                overflowWrap: 'break-word',
                wordBreak: 'break-all',
                lineHeight: '1.8'
              }}>
                                {segment.split('').map((letter, letterIndex) => {
                  const globalIndex = letterIndex;
                  const isHighlighted = isLetterHighlighted(globalIndex);
                  const isHovered = isLetterHovered(globalIndex);
                  const isInWindow = isInSlidingWindow(globalIndex);
                  const isSelected = isSelectedPhenotype(globalIndex);
                  
                  // Check if this letter is being corrected during CRISPR
                  const isBeingCorrected = isCRISPRActive && 
                    highlightedGene && 
                    globalIndex >= highlightedGene.start && 
                    globalIndex < highlightedGene.end &&
                    correctedSequence;
                  
                  const correctedLetter = isBeingCorrected ? 
                    correctedSequence[globalIndex - highlightedGene.start] : 
                    letter;
                  
                  return (
                    <span
                      key={letterIndex}
                      data-index={globalIndex}
                      onClick={() => handleLetterClick(globalIndex)}
                      style={{
                        cursor: 'pointer',
                        padding: '1px',
                        display: 'inline',
                        textAlign: 'center',
                        backgroundColor: isSelected 
                          ? (selectedPhenotype === 'All Phenotypes' 
                              ? 'rgba(144, 238, 144, 0.3)' // Light green shade for all phenotypes
                              : (selectedPhenotype === 'SICKLECELLAEMIA' 
                                  ? '#FF4444' // Vibrant red for disease only
                                  : '#90EE90')) // Light green for other phenotypes
                          : isInWindow 
                            ? '#90EE90' // Light green for sliding window
                          : isHovered 
                            ? 'rgba(255, 165, 0, 0.8)' // Orange for hovered gene
                            : isHighlighted 
                                ? '#90EE90' // Light green for highlighted gene
                              : 'transparent',
                        color: isSelected || isInWindow || isHovered || isHighlighted ? '#000' : '#fff',
                        borderRadius: '2px',
                        transition: 'all 0.2s ease',
                        fontSize: 'clamp(10px, 1.4vw, 14px)',
                        border: 'none',
                        boxShadow: isBeingCorrected ? '0 0 8px rgba(144, 238, 144, 0.8)' : 'none',
                        position: 'relative',
                        zIndex: isBeingCorrected ? 10 : 1,
                        margin: '0',
                        transform: isBeingCorrected ? 'scale(1.1)' : 'scale(1)',
                        animation: isBeingCorrected ? 'magicalGlow 0.5s ease-in-out infinite alternate' : 'none'
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
                      {correctedLetter}
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
        <div 
          ref={geneAnalysisRef}
          className="highlighted-gene-phenotype" 
                    style={{ 
            marginTop: '1rem',
            animation: 'fadeIn 0.3s ease-in-out'
          }}
        >
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '0.5rem'
          }}>
            <h3 style={{ fontFamily: "'Lato', sans-serif", fontSize: 'clamp(1.25rem, 3vw, 1.5rem)' }}>
              Gene Analysis Results
            </h3>
            <button
              onClick={hideGeneAnalysis}
              style={{
                background: 'rgba(255, 68, 68, 0.8)',
                border: 'none',
                color: 'white',
                padding: '0.25rem 0.5rem',
                borderRadius: '0.25rem',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: '600',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 68, 68, 1)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255, 68, 68, 0.8)';
              }}
            >
              ✕ Hide
            </button>
          </div>
          <div className="gene-info" style={{ 
            padding: '1rem', 
            backgroundColor: highlightedGene.phenotype === 'SICKLECELLAEMIA' ? '#FFE6E6' : '#90EE90', 
            color: '#000', 
            borderRadius: '8px',
            fontSize: 'clamp(0.875rem, 2vw, 1rem)',
            border: highlightedGene.phenotype === 'SICKLECELLAEMIA' ? '2px solid #FF4444' : 'none'
          }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Gene Sequence:</strong> 
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <span style={{ 
                  fontFamily: "'Courier New', monospace", 
                  padding: '0.2rem',
                  borderRadius: '4px',
                  color: '#FF4444',
                  opacity: isCRISPRActive ? 0.3 : 1
                }}>
                  {highlightedGene.sequence}
                </span>
                {isCRISPRActive && correctedSequence && (
                  <span style={{ 
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    fontFamily: "'Courier New', monospace", 
                    background: 'rgba(144, 238, 144, 0.9)',
                    padding: '0.2rem',
                    borderRadius: '4px',
                    color: '#006400',
                    fontWeight: 'bold',
                    boxShadow: '0 0 15px rgba(144, 238, 144, 0.8), 0 0 30px rgba(144, 238, 144, 0.4)',
                    animation: 'magicalGlow 1s ease-in-out infinite alternate',
                    zIndex: 10
                  }}>
                    {correctedSequence}
                  </span>
                )}
              </div>
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Position:</strong> {highlightedGene.start + 1} - {highlightedGene.end} (of {sequenceLength})
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Predicted Phenotype:</strong> 
              <span style={{ 
                color: highlightedGene.phenotype === 'SICKLECELLAEMIA' ? '#FF4444' : '#000',
                fontWeight: 'bold'
              }}>
                {highlightedGene.phenotype}
              </span>
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Confidence:</strong> {highlightedGene.confidence}
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <strong>GC Content:</strong> {highlightedGene.gcContent}
            </div>
            
            {/* CRISPR Section for Disease Genes */}
            {highlightedGene.phenotype === 'SICKLECELLAEMIA' && (
              <div style={{ 
                borderTop: '2px solid #FF4444', 
                paddingTop: '1rem',
                marginTop: '1rem'
              }}>
                <h4 style={{ 
                  fontFamily: "'Lato', sans-serif", 
                  fontSize: 'clamp(1rem, 2.5vw, 1.25rem)', 
                  marginBottom: '0.75rem',
                  color: '#FF4444'
                }}>
                  🧬 CRISPR Gene Editing
                </h4>
                
                {gRNASuggestion && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <strong>Suggested gRNA:</strong>
                    <div style={{ 
                      fontFamily: "'Courier New', monospace", 
                      background: 'rgba(255, 68, 68, 0.1)', 
                      padding: '0.5rem', 
                      borderRadius: '4px',
                      marginTop: '0.25rem'
                    }}>
                      {gRNASuggestion}
                    </div>
                  </div>
                )}
                
                {templateDNASuggestion && (
                  <div style={{ marginBottom: '1rem' }}>
                    <strong>Template DNA for Replacement:</strong>
                    <div style={{ 
                      fontFamily: "'Courier New', monospace", 
                      background: 'rgba(144, 238, 144, 0.2)', 
                      padding: '0.5rem', 
                      borderRadius: '4px',
                      marginTop: '0.25rem'
                    }}>
                      {templateDNASuggestion}
                    </div>
                  </div>
                )}
                
                <button
                  onClick={handleCRISPRCorrection}
                  disabled={isCRISPRActive}
                  style={{
                    background: isCRISPRActive 
                      ? 'rgba(255, 68, 68, 0.3)' 
                      : 'linear-gradient(135deg, #FF4444, #FF6666)',
                    border: 'none',
                    color: 'white',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '0.5rem',
                    cursor: isCRISPRActive ? 'not-allowed' : 'pointer',
                    fontSize: 'clamp(0.875rem, 2vw, 1rem)',
                    fontWeight: '600',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                  onMouseEnter={(e) => {
                    if (!isCRISPRActive) {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 0.5rem 1rem rgba(255, 68, 68, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <span>{isCRISPRActive ? '⏳' : '🧬'}</span>
                  <span>
                    {isCRISPRActive 
                      ? `Correcting... ${correctedSequence ? Math.round((correctedSequence.length / highlightedGene.sequence.length) * 100) : 0}%` 
                      : 'Apply CRISPR Correction'
                    }
                  </span>
                </button>
              </div>
            )}
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
        
        @keyframes magicalGlow {
          0% {
            box-shadow: 0 0 15px rgba(144, 238, 144, 0.8), 0 0 30px rgba(144, 238, 144, 0.4);
            transform: scale(1);
          }
          100% {
            box-shadow: 0 0 25px rgba(144, 238, 144, 1), 0 0 50px rgba(144, 238, 144, 0.6);
            transform: scale(1.02);
          }
        }
        
        @media (max-width: 768px) {
          .cut-simulation {
            padding: 0.5rem;
          }
          
          .header-section {
            flex-direction: column;
            gap: 1rem;
            alignItems: flex-start;
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