import React, { useState } from 'react';
import DNADoubleHelix from './components/DoubleHelix';
import CutSimulation from './components/CutSimulation';
import GenomeChat from './components/GenomeChat';
import './App.css';

function App() {
  const [highlightedGene, setHighlightedGene] = useState(null);
  const [slidingWindowData, setSlidingWindowData] = useState({
    isAnalyzing: false,
    currentWindowPosition: 0,
    windowSize: 10,
    isPaused: false
  });
  const [crisprData, setCrisprData] = useState({
    isCRISPRActive: false,
    correctedSequence: ''
  });
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatAction, setChatAction] = useState(null);

  const handleGeneHighlight = (geneData) => {
    setHighlightedGene(geneData);
  };

  const handleSlidingWindowUpdate = (data) => {
    setSlidingWindowData(data);
  };

  const handleCrisprUpdate = (data) => {
    setCrisprData(data);
  };

  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  const handleChatAction = (actionData) => {
    console.log('Chat action triggered:', actionData);
    setChatAction(actionData);
    
    // Auto-close chat after action is triggered
    setTimeout(() => {
      setIsChatOpen(false);
    }, 1000);
  };

  return (
    <div className="app">
      <DNADoubleHelix 
        highlightedGene={highlightedGene} 
        isAnalyzing={slidingWindowData.isAnalyzing}
        currentWindowPosition={slidingWindowData.currentWindowPosition}
        windowSize={slidingWindowData.windowSize}
        isPaused={slidingWindowData.isPaused}
        isCRISPRActive={crisprData.isCRISPRActive}
        correctedSequence={crisprData.correctedSequence}
      />
      <div className="content-area">
        <CutSimulation 
          onGeneHighlight={handleGeneHighlight} 
          onSlidingWindowUpdate={handleSlidingWindowUpdate}
          onCrisprUpdate={handleCrisprUpdate}
          onChatToggle={toggleChat}
          chatAction={chatAction}
          onChatActionComplete={() => setChatAction(null)}
        />
      </div>
      <GenomeChat 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)}
        onActionTrigger={handleChatAction}
      />
    </div>
  );
}

export default App;