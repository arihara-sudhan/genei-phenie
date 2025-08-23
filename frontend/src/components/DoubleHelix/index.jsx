import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import './styles.css';

const DNADoubleHelix = ({ highlightedGene, isAnalyzing, currentWindowPosition, windowSize, isPaused, isCRISPRActive, correctedSequence }) => {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const [showGeneAnalysis, setShowGeneAnalysis] = useState(true);
  const basePairGroupRef = useRef(null);
  const dnaHolderRef = useRef(null);
  const cameraRef = useRef(null);
  const containerRef = useRef(null);
  const [fullSequence, setFullSequence] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [crisprAnimationState, setCrisprAnimationState] = useState('idle'); // 'idle', 'approaching', 'cutting', 'inserting', 'complete'
  const crisprGlobeRef = useRef(null);
  const cutSegmentsRef = useRef(null);
  const templateSegmentRef = useRef(null);
  const isAnimationRunningRef = useRef(false); // Prevent multiple animations from running
  const animationFrameIdRef = useRef(null); // Track animation frame for cleanup

  // Complementary base mapping
  const complement = { 'A': 'T', 'T': 'A', 'C': 'G', 'G': 'C' };

  // Check if a base pair is in the current sliding window
  const isInSlidingWindow = (basePairIndex) => {
    if (!isAnalyzing) return false;
    return basePairIndex >= currentWindowPosition && basePairIndex < currentWindowPosition + windowSize;
  };

  // Check if a base pair is being corrected during CRISPR
  const isBeingCorrected = (basePairIndex) => {
    if (!isCRISPRActive || !highlightedGene || !correctedSequence) return false;
    return basePairIndex >= highlightedGene.start && basePairIndex < highlightedGene.end;
  };

  // Create CRISPR globe (jelly-like sphere)
  const createCrisprGlobe = (scene) => {
    // Clean up any existing globe
    if (crisprGlobeRef.current) {
      scene.remove(crisprGlobeRef.current);
      crisprGlobeRef.current = null;
    }

    const globeGeometry = new THREE.SphereGeometry(1.5, 32, 32); // Made even larger for visibility
    const globeMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff00, // Bright green
      transparent: true,
      opacity: 0.9, // More opaque for better visibility
      roughness: 0.1,
      metalness: 0.9,
      emissive: 0x00ff00,
      emissiveIntensity: 1.0 // Maximum glow
    });

    const globe = new THREE.Mesh(globeGeometry, globeMaterial);
    globe.castShadow = true;
    globe.receiveShadow = true;
    
    // Add inner glow
    const innerGlowGeometry = new THREE.SphereGeometry(1.0, 32, 32);
    const innerGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.8 // More visible inner glow
    });
    const innerGlow = new THREE.Mesh(innerGlowGeometry, innerGlowMaterial);
    globe.add(innerGlow);

    // Ensure the globe is visible by setting a clear initial position
    globe.position.set(-10, 0, 0); // Start further left and at center height
    
    crisprGlobeRef.current = globe;
    scene.add(globe);
    
    console.log('CRISPR globe created and added to scene at position:', globe.position);
    return globe;
  };

  // Handle CRISPR animation sequence
  const startCrisprAnimation = async (scene, targetPosition, basePairGroup, highlightedGene, fullSequence) => {
    console.log('startCrisprAnimation called with scene and targetPosition:', targetPosition);
    
    if (!scene || !targetPosition || !highlightedGene || !basePairGroup || !fullSequence) {
      console.error('Missing dependencies for CRISPR animation');
      setCrisprAnimationState('idle');
      return;
    }

    console.log('Setting animation state to approaching...');
    setCrisprAnimationState('approaching');
    
    // Create and position CRISPR globe
    console.log('Creating CRISPR globe...');
    const globe = createCrisprGlobe(scene);
    globe.position.set(-5, 0, 0); // Start from left side, at center height
    console.log('Globe positioned at:', globe.position);
    
    // Phase 1: Globe approaches the red highlighted DNA region
    await new Promise(resolve => {
      const animateApproach = () => {
        globe.position.x += 0.1; // Slightly faster approach
        if (globe.position.x >= targetPosition.x) { // Move to the DNA position
          globe.position.x = targetPosition.x;
          console.log('Globe reached DNA target:', globe.position);
          resolve();
        } else {
          requestAnimationFrame(animateApproach);
        }
      };
      animateApproach();
    });

    // Pause at the DNA region before starting cutting
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second pause

    setCrisprAnimationState('cutting');
    
    // Phase 2: Globe moves to exact DNA position and starts cutting
    await new Promise(resolve => {
      const animateCutting = () => {
        // Move to exact DNA position
        globe.position.x += 0.05;
        if (globe.position.x >= targetPosition.x) {
          globe.position.x = targetPosition.x;
          
          // Start pulsing for cutting effect
          let pulseCount = 0;
          const maxPulses = 15;
          
          const pulseAnimation = () => {
            globe.scale.setScalar(1 + Math.sin(pulseCount * 0.8) * 0.3);
            pulseCount++;
            
            if (pulseCount >= maxPulses) {
              globe.scale.setScalar(1);
              resolve();
            } else {
              requestAnimationFrame(pulseAnimation);
            }
          };
          pulseAnimation();
        } else {
          requestAnimationFrame(animateCutting);
        }
      };
      animateCutting();
    });

    setCrisprAnimationState('inserting');
    
    // Phase 3: Template DNA insertion
    await new Promise(resolve => {
      const animateInsertion = () => {
        // Globe shrinks as it "injects" the template
        globe.scale.setScalar(Math.max(0.1, globe.scale.x - 0.015));
        
        if (globe.scale.x <= 0.1) {
          resolve();
        } else {
          requestAnimationFrame(animateInsertion);
        }
      };
      animateInsertion();
    });

    // Phase 4: Visual DNA cutting when globe disappears
    setCrisprAnimationState('cutting_dna');
    console.log('Cutting DNA...');
    
    // Create visual cutting effect on the DNA
    if (basePairGroup) {
      const startIndex = highlightedGene.start;
      const endIndex = highlightedGene.end;
      
      // Create cut material (darker/transparent to show "cut" effect)
      const cutMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333, // Dark color to show "cut"
        roughness: 0.8,
        metalness: 0.1,
        transparent: true,
        opacity: 0.3, // Semi-transparent to show damage
        emissive: 0x111111,
        emissiveIntensity: 0.1,
      });
      
      // Apply cut effect to base pairs in the highlighted region
      basePairGroup.children.forEach((child) => {
        if (child.userData.index !== undefined) {
          const index = child.userData.index;
          if (index >= startIndex && index < endIndex) {
            // Store original material for restoration
            if (!child.userData.originalMaterial) {
              child.userData.originalMaterial = child.material.clone();
            }
            child.material = cutMaterial;
          }
        }
      });
    }

    // Remove globe
    scene.remove(globe);
    crisprGlobeRef.current = null;
    
    // Wait for healing/repair process
    setCrisprAnimationState('healing');
    console.log('Waiting for DNA healing...');
    
    // Wait 3 seconds for healing effect
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Phase 5: DNA healing/repair
    setCrisprAnimationState('repairing');
    console.log('Repairing DNA...');
    
    // Restore DNA to healthy state
    if (basePairGroup) {
      const startIndex = highlightedGene.start;
      const endIndex = highlightedGene.end;
      
      // Create healthy material (green glow for repaired DNA)
      const healthyMaterial = new THREE.MeshStandardMaterial({
        color: 0x90EE90, // Light green for healthy DNA
        roughness: 0.2,
        metalness: 0.8,
        transparent: false,
        opacity: 1.0,
        emissive: 0x90EE90,
        emissiveIntensity: 0.5,
      });
      
      // Apply healthy material to repaired base pairs
      basePairGroup.children.forEach((child) => {
        if (child.userData.index !== undefined) {
          const index = child.userData.index;
          if (index >= startIndex && index < endIndex) {
            child.material = healthyMaterial;
          } else if (child.userData.originalMaterial) {
            child.material = child.userData.originalMaterial;
          }
        }
      });
    }
    
    // Wait 2 seconds to show the healed DNA
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setCrisprAnimationState('complete');
    console.log('CRISPR repair sequence completed');
    
    // Signal completion to parent component if defined
    // Note: onCrisprUpdate was not defined in props, assuming it's a prop or remove if not
    // if (onCrisprUpdate) {
    //   onCrisprUpdate({
    //     isCRISPRActive: false,
    //     correctedSequence: 'completed'
    //   });
    // }
  };

  // Fetch sequence from data file
  useEffect(() => {
    const fetchSequence = async () => {
      try {
        const response = await fetch('/data/sample');
        if (!response.ok) {
          throw new Error(`Failed to fetch sequence data: ${response.status} ${response.statusText}`);
        }
        if (!response.headers.get('content-type')?.includes('text/')) {
          throw new Error('Response is not text data');
        }
        const sequenceData = await response.text();
        console.log('DoubleHelix: Raw sequence data:', sequenceData.substring(0, 100) + '...');
        // Remove underscores and clean the sequence
        const cleanSequence = sequenceData.replace(/_/g, '').trim();
        console.log('DoubleHelix: Cleaned sequence length:', cleanSequence.length);
        setFullSequence(cleanSequence);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching sequence:', error);
        // Fallback to a default sequence if fetch fails
        setFullSequence('ATGCGTACGCGATCCGTAGCACGTGTGCAACGTAGCTAGCGATCAGTCGTGTGCGTACGTTAGCGATCGCCCGAATCGTAGTGATCGTAGATCGTAGCGAGATCTAGCGTGTGCGTAGCACGATCGTAGCCCGATCGATGGTGTAGCGTAAGCATCGCGGATCGTAGCTGTGCATAGCGATCGCGTAGCCCGACGTATGGTGCGATCGTTCGTAGCGATCGATCAGCGTAAGGTGTACGATGATAGCGCGATGCCGATGATCGGTGCGAATCGAATCGTAGCGAGATCCGATGTGTGTAGCATGCGCGTAGCATCCGAGATCGTGTGATCGCGAATCGCGATGTGATCTACGCGGTGCATGCTACGTAGATCGCCCGATAGCGTGTGCGTATCGTAGCATGCGCGATCCGTATGGTGTACGCTACGCGTAGCGACCGATGCGTAGTGATCGTAGATCGTAGCGTGATCGATCGCGTGCGACTAGCGTAGCGATGCCGATCGTAGGTGCGTAGCTTAGCGATCGTGATCCGATGCGTGTACGCGAATCGCGTAGACCGATGATCGGTGCGATCGCCGATCGTAGTGATCTAGCGCGTGTAGCGATTAGCGCGATCCCGACGTATGGTGCGTAGCAATCGTAGCGAGATCGTAGCTGTGCATCGTACGTAGATCGCCCGATGCGTAGTGATCGTAGTCATGCGCGATCCGTAGCGTTGTACGATGATCGCGTAGCCCGATAGCGTGTGCGTAGCTCGTAGCGATGGATCGATCGCGTGCGAATCGTAGCGATCGTCCGATGATCGGTGTAGCGTAATCGTAGCGAGATCCGATGTGTGCGATCGCCGCGTAGCATCCGAGATCGTGTGTACGCTAATCGCGATGTGATCTACGCGGTGCGTAGCACGTAGATCGCCCGATAGCGTGTGATCGTAGTAGCATGCGCGATCCGTATGGTGCGACTAGCGCGTAGCGACCGATGCGTAGTGATCGTAGTCGTAGCGTGATCGATCGCGTGTACGCGACGTAGCGATGCCGATGATCGGTGCGATCGTAGCGATCGTGATCCGATGTGTGTAGCGATATCGCGTAGACCGATAGCGTGTGCGTAGCACGATCGTAGTGATCGTAGCTGTGCATCGTATAGCGCGATCCGATGCGTAGTGATCGTAGTCGTAGCGAGATCTAGCGCGTGTACGATGCGTAGATCGCCCGACGTATGGTGCGTAGCTTAGCATCGCGGATCCGTAGCGTGCGAATCGAATCGCGTAGCCCGATGATCGGTGTAGCGTAACGTAGCGATGGATCGATCGCGTGCGATCGTAGCGATCGT');
        setIsLoading(false);
      }
    };

    fetchSequence();
  }, []);

  // Helper function to get base material based on base type
  const getBaseMaterial = (base) => {
    const baseMaterials = {
      'A': new THREE.MeshStandardMaterial({ 
        color: 0xff6b6b, // Red for Adenine
        roughness: 0.3, 
        metalness: 0.1, 
        transparent: false, 
        opacity: 1.0,
        emissive: 0x222222,
        emissiveIntensity: 0.2
      }),
      'T': new THREE.MeshStandardMaterial({ 
        color: 0x4ecdc4, // Teal for Thymine
        roughness: 0.3, 
        metalness: 0.1, 
        transparent: false, 
        opacity: 1.0,
        emissive: 0x222222,
        emissiveIntensity: 0.2
      }),
      'C': new THREE.MeshStandardMaterial({ 
        color: 0xffe66d, // Yellow for Cytosine
        roughness: 0.3, 
        metalness: 0.1, 
        transparent: false, 
        opacity: 1.0,
        emissive: 0x222222,
        emissiveIntensity: 0.2
      }),
      'G': new THREE.MeshStandardMaterial({ 
        color: 0x45b7d1, // Blue for Guanine
        roughness: 0.3, 
        metalness: 0.1, 
        transparent: false, 
        opacity: 1.0,
        emissive: 0x222222,
        emissiveIntensity: 0.2
      })
    };
    
    return baseMaterials[base] || baseMaterials['A'];
  };

  useEffect(() => {
    if (!canvasRef.current || !fullSequence || isLoading) return;

    try {
      const scene = new THREE.Scene();
      sceneRef.current = scene;
      scene.background = new THREE.Color(0x0a0a0a);
      const camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
      );
      cameraRef.current = camera;
      camera.position.set(0, 0, 15);
      camera.lookAt(0, 0, 0);

      const renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.current,
        antialias: true,
        alpha: true
      });
      
      // Initial size will be set after CSS is applied
      const canvas = canvasRef.current;
      // Small delay to ensure CSS is applied
      setTimeout(() => {
        const rect = canvas.getBoundingClientRect();
        renderer.setSize(rect.width || 642, rect.height || 946);
      }, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
      directionalLight.position.set(10, 10, 5);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.set(2048, 2048);
      scene.add(directionalLight);

      const pointLight = new THREE.PointLight(0xffffff, 0.6, 50);
      pointLight.position.set(0, 0, 20);
      scene.add(pointLight);

      // DNA parameters - scientifically accurate B-DNA
      const sequenceLength = fullSequence.length;
      const turns = sequenceLength / 10.5; // ~10.5 base pairs per helical turn
      const radius = 1.6; // Reduced from 2.0 for smaller DNA structure
      const basePairSpacing = 0.5; // Reduced from 0.6 for tighter spacing
      const totalHeight = sequenceLength * basePairSpacing;
      const basePairCount = sequenceLength;

      const dnaHolder = new THREE.Object3D();
      dnaHolderRef.current = dnaHolder;
      dnaHolder.position.x = -1; // Move DNA 2 units to the left
      scene.add(dnaHolder);

      // Create sugar-phosphate backbones
      const backboneMaterial = new THREE.MeshStandardMaterial({
        color: 0x8bc34a, // Green for sugar-phosphate backbone
        roughness: 0.4,
        metalness: 0.1,
        transparent: false,
        opacity: 1.0,
        emissive: 0x222222,
        emissiveIntensity: 0.2
      });

      // Create helical backbone curves with symmetric radii
      const backbone1Points = [];
      const backbone2Points = [];
      
      for (let i = 0; i <= sequenceLength; i++) {
        const y = i * basePairSpacing - totalHeight / 2;
        const angle = (i / sequenceLength) * turns * Math.PI * 2;
        
        // Both backbones use the same radius for symmetry
        backbone1Points.push(new THREE.Vector3(
          radius * Math.cos(angle),
          y,
          radius * Math.sin(angle)
        ));
        
        backbone2Points.push(new THREE.Vector3(
          radius * Math.cos(angle + Math.PI),
          y,
          radius * Math.sin(angle + Math.PI)
        ));
      }

      const curve1 = new THREE.CatmullRomCurve3(backbone1Points);
      const curve2 = new THREE.CatmullRomCurve3(backbone2Points);

      // Create backbone tubes
      const tubeGeometry1 = new THREE.TubeGeometry(curve1, sequenceLength, 0.12, 8, false); // Reduced thickness
      const tubeGeometry2 = new THREE.TubeGeometry(curve2, sequenceLength, 0.12, 8, false); // Reduced thickness
      
      const backbone1 = new THREE.Mesh(tubeGeometry1, backboneMaterial);
      const backbone2 = new THREE.Mesh(tubeGeometry2, backboneMaterial);
      
      backbone1.castShadow = true;
      backbone2.castShadow = true;
      dnaHolder.add(backbone1, backbone2);

      // Create base pairs with complementary pairing
      const basePairGroup = new THREE.Group();
      basePairGroupRef.current = basePairGroup;
      
      // Neutral material for base pair connections (hydrogen bonds)
      const basePairMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xcccccc, 
        roughness: 0.3, 
        metalness: 0.1, 
        transparent: false, 
        opacity: 1.0,
        emissive: 0x222222,
        emissiveIntensity: 0.2
      });
      
      for (let i = 0; i < basePairCount; i++) {
        const y = i * basePairSpacing - totalHeight / 2;
        const angle = (i / basePairCount) * turns * Math.PI * 2;
        
        // Calculate positions for the two strands
        const pos1 = new THREE.Vector3(
          radius * Math.cos(angle),
          y,
          radius * Math.sin(angle)
        );
        
        const pos2 = new THREE.Vector3(
          radius * Math.cos(angle + Math.PI),
          y,
          radius * Math.sin(angle + Math.PI)
        );

        // Get complementary bases
        const base1 = fullSequence[i];
        const base2 = complement[base1] || 'A';
        
        // Create base pair connection (hydrogen bonds)
        const direction = new THREE.Vector3().subVectors(pos2, pos1);
        const length = direction.length();
        
        const basePairGeometry = new THREE.CylinderGeometry(0.1, 0.1, length, 6); // Reduced thickness
        const basePair = new THREE.Mesh(basePairGeometry, basePairMaterial);
        
        basePair.position.copy(pos1).lerp(pos2, 0.5);
        basePair.lookAt(pos2);
        basePair.rotateX(Math.PI / 2);
        basePair.castShadow = true;
        
        basePair.userData = { 
          index: i, 
          originalMaterial: basePairMaterial,
          base1: base1,
          base2: base2,
          position: i
        };
        basePairGroup.add(basePair);

        // Add nucleotides as spherical bases
        const nucleotideGeometry = new THREE.SphereGeometry(0.22, 12, 12); // Slightly reduced size
        
        // First nucleotide with base1 color
        const material1 = getBaseMaterial(base1);
        const nucleotide1 = new THREE.Mesh(nucleotideGeometry, material1);
        nucleotide1.position.copy(pos1);
        nucleotide1.castShadow = true;
        nucleotide1.userData = { 
          index: i, 
          originalMaterial: material1,
          base: base1,
          position: i
        };
        
        // Second nucleotide with base2 color (complementary)
        const material2 = getBaseMaterial(base2);
        const nucleotide2 = new THREE.Mesh(nucleotideGeometry, material2);
        nucleotide2.position.copy(pos2);
        nucleotide2.castShadow = true;
        nucleotide2.userData = { 
          index: i, 
          originalMaterial: material2,
          base: base2,
          position: i
        };
        
        basePairGroup.add(nucleotide1, nucleotide2);
      }
      
      dnaHolder.add(basePairGroup);

      const animate = () => {
        animationFrameIdRef.current = requestAnimationFrame(animate);
        dnaHolder.rotation.y += 0.005; // Slower rotation for better viewing with more turns
        renderer.render(scene, camera);
      };

      animate();

      const handleResize = () => {
        if (renderer && canvasRef.current) {
          const canvas = canvasRef.current;
          const rect = canvas.getBoundingClientRect();
          const width = rect.width;
          const height = rect.height;
          
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height);
        }
      };

      window.addEventListener('resize', handleResize);

      return () => {
        if (animationFrameIdRef.current) {
          cancelAnimationFrame(animationFrameIdRef.current);
        }
        window.removeEventListener('resize', handleResize);
      };
    } catch (error) {
      console.error('DNADoubleHelix initialization error:', error);
    }
  }, [fullSequence, isLoading]);

  // Effect to handle gene highlighting
  useEffect(() => {
    console.log('DoubleHelix highlighting effect triggered:', { 
      hasBasePairGroup: !!basePairGroupRef.current, 
      highlightedGene, 
      hasFullSequence: !!fullSequence,
      sequenceLength: fullSequence?.length 
    });
    
    if (!basePairGroupRef.current || !highlightedGene || !fullSequence) {
      console.log('DoubleHelix highlighting skipped - missing dependencies');
      return;
    }

    const basePairGroup = basePairGroupRef.current;
    const sequenceLength = fullSequence.length;
    const basePairSpacing = 0.5; // Consistent with helix creation
    const totalHeight = sequenceLength * basePairSpacing;

    // Create highlight material based on phenotype
    const isDiseaseCausing = highlightedGene.phenotype === 'SICKLECELLAEMIA';
    const highlightMaterial = new THREE.MeshStandardMaterial({
      color: isDiseaseCausing ? 0xFF4444 : 0x90EE90, // Red for disease, light green for normal
      roughness: 0.2,
      metalness: 0.8,
      transparent: false,
      opacity: 1.0,
      emissive: isDiseaseCausing ? 0xFF4444 : 0x90EE90,
      emissiveIntensity: 0.3,
    });

    // Direct mapping: use actual sequence positions
    const startIndex = highlightedGene.start;
    const endIndex = highlightedGene.end;
    
    console.log('Direct mapping gene highlighting:', { 
      startIndex,
      endIndex,
      highlightedGene,
      startPosition: highlightedGene.start,
      endPosition: highlightedGene.end,
      sequence: highlightedGene.sequence,
      sequenceLength: highlightedGene.sequence.length,
      totalSequenceLength: sequenceLength,
      basePairsToHighlight: endIndex - startIndex
    });

    // Reset all base pairs to original materials
    basePairGroup.children.forEach((child) => {
      if (child.userData.index !== undefined && child.userData.originalMaterial) {
        child.material = child.userData.originalMaterial;
      }
    });

    // Highlight all base pairs that correspond to the selected gene
    basePairGroup.children.forEach((child) => {
      if (child.userData.index !== undefined) {
        const index = child.userData.index;
        // Highlight all base pairs in the gene range
        if (index >= startIndex && index < endIndex) {
          child.material = highlightMaterial;
          console.log('Highlighted base pair:', index, 'base:', child.userData.base, 'for gene:', highlightedGene.sequence);
        }
      }
    });

    // Center the highlighted region in the viewport
    if (dnaHolderRef.current && containerRef.current) {
      const containerHeight = containerRef.current.clientHeight;
      const middleIndex = (startIndex + endIndex) / 2; // Center of the highlighted region
      // Position the DNA so that the middle of the highlighted region is at the center of the viewport
      const targetY = totalHeight / 2 - middleIndex * basePairSpacing;

      // Clamp the Y position to keep the DNA within reasonable bounds
      const maxY = totalHeight / 2;
      const minY = -totalHeight / 2;
      const clampedY = Math.max(minY, Math.min(maxY, targetY));

      // Update DNA holder position
      dnaHolderRef.current.position.y = clampedY;
      dnaHolderRef.current.position.x = -1; // Maintain left offset during highlighting

      // Calculate scroll position to center the highlighted region
      const canvasHeight = containerRef.current.querySelector('canvas').clientHeight;
      // Calculate the proportional position of the middle of the highlighted region
      const scrollTarget = (middleIndex / sequenceLength) * canvasHeight - containerHeight / 2;

      // Clamp scroll to prevent scrolling out of bounds
      const maxScroll = canvasHeight - containerHeight;
      const clampedScroll = Math.max(0, Math.min(maxScroll, scrollTarget));
      // Smoothly scroll to the target position
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTo({
            top: clampedScroll,
            behavior: 'smooth'
          });
          console.log('Scrolled to position:', clampedScroll, 'for gene middle index:', middleIndex);
        }
      }, 100);
    }

  }, [highlightedGene, fullSequence]);

  // Effect to handle sliding window highlighting and scrolling
  useEffect(() => {
    if (!basePairGroupRef.current || !fullSequence || !isAnalyzing || isPaused) return;
    
    const basePairGroup = basePairGroupRef.current;
    const sequenceLength = fullSequence.length;
    const basePairSpacing = 0.5; // Consistent with helix creation
    const totalHeight = sequenceLength * basePairSpacing;

    // Create sliding window highlight material
    const slidingWindowMaterial = new THREE.MeshStandardMaterial({
      color: 0x90EE90, // Light green for sliding window
      roughness: 0.2,
      metalness: 0.8,
      transparent: false,
      opacity: 1.0,
      emissive: 0x90EE90,
      emissiveIntensity: 0.5,
    });

    // Reset all base pairs to original materials first
    basePairGroup.children.forEach((child) => {
      if (child.userData.index !== undefined && child.userData.originalMaterial) {
        child.material = child.userData.originalMaterial;
      }
    });

    // Highlight base pairs in the current sliding window
    basePairGroup.children.forEach((child) => {
      if (child.userData.index !== undefined) {
        const index = child.userData.index;
        if (isInSlidingWindow(index)) {
          child.material = slidingWindowMaterial;
        }
      }
    });

    // Auto-scroll to the current sliding window position
    if (dnaHolderRef.current && containerRef.current) {
      const containerHeight = containerRef.current.clientHeight;
      const middleIndex = currentWindowPosition + (windowSize / 2); // Center of the sliding window
      
      // Position the DNA so that the middle of the sliding window is at the center of the viewport
      const targetY = totalHeight / 2 - middleIndex * basePairSpacing;

      // Clamp the Y position to keep the DNA within reasonable bounds
      const maxY = totalHeight / 2;
      const minY = -totalHeight / 2;
      const clampedY = Math.max(minY, Math.min(maxY, targetY));

      // Update DNA holder position
      dnaHolderRef.current.position.y = clampedY;
      dnaHolderRef.current.position.x = -1; // Maintain left offset

      // Calculate scroll position to center the sliding window
      const canvasHeight = containerRef.current.querySelector('canvas').clientHeight;
      const scrollTarget = (middleIndex / sequenceLength) * canvasHeight - containerHeight / 2;

      // Clamp scroll to prevent scrolling out of bounds
      const maxScroll = canvasHeight - containerHeight;
      const clampedScroll = Math.max(0, Math.min(maxScroll, scrollTarget));
      
      // DNA is now fixed - no scrolling needed
      console.log('DNA position updated for sliding window');
    }

  }, [isAnalyzing, currentWindowPosition, windowSize, fullSequence]);

  // Effect to clear highlights when highlightedGene is null
  useEffect(() => {
    if (!basePairGroupRef.current || highlightedGene !== null || !fullSequence) return;
    
    console.log('DoubleHelix clearing highlights');
    const basePairGroup = basePairGroupRef.current;
    
    // Reset all base pairs to original materials
    basePairGroup.children.forEach((child) => {
      if (child.userData.index !== undefined && child.userData.originalMaterial) {
        child.material = child.userData.originalMaterial;
      }
    });
    
    // Reset DNA position
    if (dnaHolderRef.current) {
      dnaHolderRef.current.position.y = 0;
      dnaHolderRef.current.position.x = -1; // Maintain left offset when clearing highlights
    }
    
    // Reset scroll position to top
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }, [highlightedGene, fullSequence]);

  // Effect to monitor scroll position and hide gene analysis overlay at end
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !highlightedGene) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
      
      // Hide gene analysis overlay when user scrolls to the last 20% of the sequence
      if (scrollPercentage > 0.8) {
        setShowGeneAnalysis(false);
      } else {
        setShowGeneAnalysis(true);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [highlightedGene]);

  // Effect to handle CRISPR correction highlighting
  useEffect(() => {
    if (!basePairGroupRef.current || !isCRISPRActive || !highlightedGene) return;
    
    const basePairGroup = basePairGroupRef.current;
    
    // Create magical green correction material
    const correctionMaterial = new THREE.MeshStandardMaterial({
      color: 0x90EE90, // Light green
      roughness: 0.2,
      metalness: 0.8,
      transparent: false,
      opacity: 1.0,
      emissive: 0x90EE90,
      emissiveIntensity: 0.8,
    });

    // Apply correction effect to base pairs in the highlighted region
    basePairGroup.children.forEach((child) => {
      if (child.userData.index !== undefined) {
        const index = child.userData.index;
        if (isBeingCorrected(index)) {
          child.material = correctionMaterial;
        }
      }
    });

    // Cleanup function to restore original materials when correction ends
    return () => {
      if (basePairGroupRef.current) {
        basePairGroupRef.current.children.forEach((child) => {
          if (child.userData.index !== undefined && child.userData.originalMaterial) {
            child.material = child.userData.originalMaterial;
          }
        });
      }
    };
  }, [isCRISPRActive]); // Only depend on isCRISPRActive to prevent infinite loops

  // Cleanup effect to remove any remaining globes when CRISPR is not active
  useEffect(() => {
    if (!isCRISPRActive && sceneRef.current && crisprGlobeRef.current) {
      sceneRef.current.remove(crisprGlobeRef.current);
      crisprGlobeRef.current = null;
      console.log('Cleaned up CRISPR globe - CRISPR not active');
    }
  }, [isCRISPRActive]);

  // Effect to trigger CRISPR animation
  useEffect(() => {
    console.log('CRISPR effect triggered:', { isCRISPRActive, highlightedGene: !!highlightedGene, scene: !!sceneRef.current, basePairGroup: !!basePairGroupRef.current, isAnimationRunning: isAnimationRunningRef.current });
    
    if (isCRISPRActive && highlightedGene && sceneRef.current && basePairGroupRef.current && !isAnimationRunningRef.current) {
      console.log('Starting CRISPR animation for gene:', highlightedGene);
      
      isAnimationRunningRef.current = true; // Prevent multiple animations
      
      const scene = sceneRef.current;
      const basePairGroup = basePairGroupRef.current;
      
      // Calculate target position (center of the highlighted region)
      const startIndex = highlightedGene.start;
      const endIndex = highlightedGene.end;
      const middleIndex = Math.floor((startIndex + endIndex) / 2);
      
      // Find the middle base pair connection (cylinder)
      const middleChild = basePairGroup.children.find(child => 
        child.userData.index === middleIndex && child.geometry.type === 'CylinderGeometry'
      );
      
      let targetPosition;
      if (middleChild) {
        targetPosition = new THREE.Vector3();
        middleChild.getWorldPosition(targetPosition);
      } else {
        targetPosition = new THREE.Vector3(-1, 0, 0); // Fallback
      }
      
      console.log('Target position calculated:', targetPosition);
      
      // Keep camera and DNA in original positions to maintain visibility
      if (cameraRef.current) {
        cameraRef.current.position.set(0, 0, 15); // Keep camera in original position
        cameraRef.current.lookAt(0, 0, 0);
        cameraRef.current.updateProjectionMatrix();
        console.log('Camera kept in original position for DNA visibility');
      }
      
      // Ensure DNA holder stays in visible position
      if (dnaHolderRef.current) {
        dnaHolderRef.current.position.y = 0; // Keep DNA centered
        dnaHolderRef.current.position.x = -1; // Maintain left offset
        console.log('DNA holder kept in visible position');
      }

      // Start the CRISPR animation and reset flag when complete
      startCrisprAnimation(scene, targetPosition, basePairGroup, highlightedGene, fullSequence).then(() => {
        isAnimationRunningRef.current = false;
        console.log('CRISPR animation completed, resetting flag');
      }).catch((error) => {
        console.error('CRISPR animation failed:', error);
        isAnimationRunningRef.current = false;
      });
    }
  }, [isCRISPRActive, highlightedGene, fullSequence]); // Include necessary dependencies

  if (isLoading) {
    return (
      <div 
        ref={containerRef}
        style={{
          width: '50%',
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          color: '#e0e7ff',
          fontSize: '1.2rem'
        }}
      >
        Loading DNA sequence...
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      style={{
        width: '45%', // Increased from 50% to 70% for better DNA visibility
        height: '100vh',
        overflowY: 'auto', // Allow DNA content to scroll
        overflowX: 'hidden', // Prevent horizontal scrolling
        scrollbarWidth: 'none', /* Firefox */
        msOverflowStyle: 'none', /* Internet Explorer 10+ */
        position: 'relative',
        flexShrink: 0, // Prevent shrinking
        margin: '0', // Remove all margins
        padding: '0' // Remove all padding
      }}
    >
      <style>{`
        /* Hide scrollbar for Chrome, Safari and Opera */
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    <canvas
      className="dnaCanvas"
      ref={canvasRef}
        style={{
          width: '100%',
          height: '250vh', /* Make canvas taller than viewport */
          display: 'block'
        }}
      />
      
      {/* Status Bar - Bottom Left */}
      {(highlightedGene || crisprAnimationState !== 'idle') && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            background: 'rgba(0, 0, 0, 0.9)',
            border: '1px solid #00ff88',
            borderRadius: '8px',
            padding: '0.4rem 0.8rem',
            color: '#ffffff',
            fontFamily: "'Josefin Sans', 'Lato', sans-serif",
            fontSize: '0.75rem',
            zIndex: 1000,
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
            textAlign: 'left',
            minWidth: '200px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.15rem'
          }}
        >
          {/* Phenotype Display */}
          {highlightedGene && (
            <div style={{ 
              fontSize: '0.8rem', 
              fontWeight: 'bold',
              color: highlightedGene.phenotype === 'SICKLECELLAEMIA' ? '#FF4444' : '#00ff88'
            }}>
              🧬 {highlightedGene.phenotype}
            </div>
          )}
          
          {/* CRISPR Stage Display */}
          {crisprAnimationState !== 'idle' && (
            <div style={{ 
              fontSize: '0.7rem', 
              color: '#00ff88',
              fontWeight: '600'
            }}>
                          {crisprAnimationState === 'approaching' && '🔍 Approaching...'}
            {crisprAnimationState === 'cutting' && '✂️ Cutting...'}
            {crisprAnimationState === 'inserting' && '🔧 Inserting...'}
            {crisprAnimationState === 'cutting_dna' && '🔪 Cutting DNA...'}
            {crisprAnimationState === 'healing' && '⏳ Healing...'}
            {crisprAnimationState === 'repairing' && '🩹 Repairing...'}
            {crisprAnimationState === 'complete' && '✅ Complete!'}
            </div>
          )}
        </div>
      )}


      
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-50%) translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateY(-50%) translateX(0);
          }
        }
      `}</style>
    </div>
  );
};

export default DNADoubleHelix;