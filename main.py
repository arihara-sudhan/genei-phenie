from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
import torch
import torch.nn.functional as F
import numpy as np
import re
from typing import List, Dict, Tuple, Optional
import os
from pathlib import Path
import google.generativeai as genai
from dotenv import load_dotenv

# Import the Biological GPT model classes
from models.biological_gpt import BiologicalGPT, KMerTokenizer, BiologicalSequenceUtils

# Load environment variables
load_dotenv()

# Configure Gemini API
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

app = FastAPI(title="Biological GPT - Gene Sequence Phenotype Predictor")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files (only if directory exists)
if os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")

# Templates
templates = Jinja2Templates(directory="templates")

# Global variables for model and tokenizer
model = None
tokenizer = None
phenotype_mapping = None
device = None

def load_model():
    """Load the trained Biological GPT model"""
    global model, tokenizer, phenotype_mapping, device
    
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f"Using device: {device}")
    
    # Load the trained model
    checkpoint_path = "model/biological_gpt.pth"
    if not os.path.exists(checkpoint_path):
        raise FileNotFoundError(f"Model checkpoint not found at {checkpoint_path}")
    
    checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)
    
    # Extract configuration
    config = checkpoint['config']
    phenotype_mapping = checkpoint['phenotype_mapping']
    tokenizer = checkpoint['tokenizer']
    
    # Initialize model
    model = BiologicalGPT(
        vocab_size=config['vocab_size'],
        dim=config['dim'],
        depth=config['depth'],
        heads=config['heads'],
        max_len=config['max_len'],
        tasks=config['tasks']
    )
    
    # Load model weights
    model.load_state_dict(checkpoint['model_state'])
    model.to(device)
    model.eval()
    
    print(f"Model loaded successfully!")
    print(f"Vocabulary size: {config['vocab_size']}")
    print(f"Available phenotypes: {list(phenotype_mapping['id_to_phenotype'].values())}")

def predict_phenotype(sequence: str) -> Dict:
    """Predict phenotype for a given DNA sequence"""
    global model, tokenizer, phenotype_mapping, device
    
    if model is None:
        return {"error": "Model not loaded"}
    
    try:
        sequence = re.sub(r'[^ATCGN]', 'N', sequence.upper())
        if len(sequence) < 3:
            return {"error": "Sequence too short (minimum 3 bases)"}
        tokens = tokenizer.encode(sequence)
        if not tokens:
            return {"error": "Failed to tokenize sequence"}
        max_len = model.max_len
        if len(tokens) > max_len:
            tokens = tokens[:max_len]
        else:
            tokens = tokens + [tokenizer.token_to_id['<PAD>']] * (max_len - len(tokens))
        x = torch.tensor([tokens], dtype=torch.long).to(device)
        with torch.no_grad():
            outputs = model(x)
            if 'phenotype_classification' in outputs['task_logits']:
                phenotype_logits = outputs['task_logits']['phenotype_classification']
                phenotype_probs = F.softmax(phenotype_logits, dim=-1)
                predicted_phenotype_id = torch.argmax(phenotype_probs, dim=-1).item()
                predicted_phenotype = phenotype_mapping['id_to_phenotype'][predicted_phenotype_id]
                confidence = phenotype_probs[0][predicted_phenotype_id].item()
            else:
                predicted_phenotype = "Unknown"
                confidence = 0.0
            
            if 'gc_content' in outputs['task_logits']:
                predicted_gc = outputs['task_logits']['gc_content'].item()
            else:
                predicted_gc = BiologicalSequenceUtils.calculate_gc_content(sequence)
            
            if 'sequence_length' in outputs['task_logits']:
                predicted_length = outputs['task_logits']['sequence_length'].item()
            else:
                predicted_length = len(sequence)
        
        actual_gc = BiologicalSequenceUtils.calculate_gc_content(sequence)
        actual_length = len(sequence)
        
        return {
            "sequence": sequence,
            "predicted_phenotype": predicted_phenotype,
            "confidence": confidence,
            "predicted_gc_content": predicted_gc,
            "actual_gc_content": actual_gc,
            "predicted_length": predicted_length,
            "actual_length": actual_length,
            "all_phenotypes": list(phenotype_mapping['id_to_phenotype'].values())
        }
        
    except Exception as e:
        return {"error": f"Prediction failed: {str(e)}"}

@app.on_event("startup")
async def startup_event():
    """Load model on startup"""
    try:
        load_model()
    except Exception as e:
        print(f"Failed to load model: {e}")

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Serve the main page"""
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/predict")
async def predict(request: Request, sequence: str = Form(...)):
    """Predict phenotype for submitted sequence"""
    result = predict_phenotype(sequence)
    return templates.TemplateResponse("index.html", {
        "request": request, 
        "result": result,
        "input_sequence": sequence
    })

@app.post("/api/predict")
async def predict_api(sequence: str = Form(...)):
    """JSON API endpoint for phenotype prediction"""
    result = predict_phenotype(sequence)
    return result

@app.get("/api/system-info")
async def get_system_info():
    """Get system information using Gemini API"""
    try:
        # Initialize Gemini model
        model = genai.GenerativeModel("gemini-2.5-flash")
        
        # Create a comprehensive system description
        system_description = """
        This is a Biological GPT system for gene sequence phenotype prediction. 
        
        System Overview:
        - Backend: FastAPI with Python
        - ML Framework: PyTorch
        - Model: Custom Biological GPT for DNA sequence analysis
        - Frontend: React with Vite
        - Purpose: Predict phenotypes from DNA sequences using deep learning
        
        Key Features:
        - DNA sequence phenotype prediction
        - GC content analysis
        - Sequence length prediction
        - Confidence scoring
        - Support for multiple phenotype classifications
        
        Technical Stack:
        - FastAPI for REST API
        - PyTorch for deep learning
        - CUDA support for GPU acceleration
        - K-mer tokenization for DNA sequences
        - Multi-task learning architecture
        
        The system processes DNA sequences (ATCG) and predicts biological phenotypes
        with confidence scores, making it useful for genetic research and analysis.
        """
        
        # Generate response using Gemini
        response = model.generate_content(
            f"Please provide a comprehensive overview of this biological research system: {system_description}"
        )
        
        return {
            "success": True,
            "system_info": response.text,
            "model_used": "gemini-2.5-flash",
            "system_type": "Biological GPT - Gene Sequence Phenotype Predictor"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to generate system information: {str(e)}",
            "system_type": "Biological GPT - Gene Sequence Phenotype Predictor"
        }

@app.post("/api/chat-action")
async def chat_action(request: Request):
    """Agentic chat endpoint that can perform actions based on user requests"""
    try:
        print("Chat action endpoint called")
        data = await request.json()
        user_message = data.get("message", "").lower()
        print(f"User message: {user_message}")
        
        # Initialize Gemini model for intelligent responses
        model = genai.GenerativeModel("gemini-2.5-flash")
        
        # Define available actions
        actions = {
            "find_sickle_cell": {
                "trigger_keywords": ["sickle cell", "sickle cell anemia", "find sickle", "search sickle", "locate sickle", "genotypes that exhibits sickle cell anemia"],
                "description": "Find and highlight all sickle cell anemia cases in the DNA sequence",
                "action": "start_sliding_window_analysis"
            },
            "run_analysis": {
                "trigger_keywords": ["run analysis", "start analysis", "analyze", "scan", "check", "examine"],
                "description": "Run sliding window analysis on the entire DNA sequence",
                "action": "start_sliding_window_analysis"
            },
            "find_diseases": {
                "trigger_keywords": ["find diseases", "disease", "sick", "mutation", "abnormal"],
                "description": "Find all disease-causing mutations in the sequence",
                "action": "find_disease_mutations"
            },
            "find_healthy": {
                "trigger_keywords": ["find healthy", "healthy", "normal", "good genes"],
                "description": "Find all healthy gene sequences",
                "action": "find_healthy_genes"
            },
            "crispr_suggestions": {
                "trigger_keywords": ["crispr", "gene editing", "correction", "fix", "repair"],
                "description": "Provide CRISPR gene editing suggestions for disease genes",
                "action": "provide_crispr_suggestions"
            },
            "sequence_info": {
                "trigger_keywords": ["sequence info", "dna info", "sequence length", "gc content"],
                "description": "Provide information about the DNA sequence",
                "action": "get_sequence_info"
            }
        }
        
        # Determine which action to take
        selected_action = None
        for action_name, action_data in actions.items():
            if any(keyword in user_message for keyword in action_data["trigger_keywords"]):
                selected_action = action_name
                print(f"Selected action: {selected_action}")
                break
        
        if selected_action:
            # Generate intelligent response using Gemini
            action_description = actions[selected_action]["description"]
            prompt = f"""
            A user wants to {action_description}. The user said: "{user_message}"
            
            Please provide a helpful, informative response that:
            1. Acknowledges their request
            2. Explains what action will be taken
            3. Provides context about why this is useful
            4. Uses a friendly, helpful tone
            
            Keep the response concise but informative (2-3 sentences).
            """
            
            response = model.generate_content(prompt)
            
            return {
                "success": True,
                "action": selected_action,
                "action_type": actions[selected_action]["action"],
                "message": response.text,
                "requires_frontend_action": True,
                "action_data": {
                    "phenotype_filter": "SICKLECELLAEMIA" if "sickle" in user_message else None,
                    "analysis_type": "full" if "analysis" in user_message else "targeted"
                }
            }
        else:
            # Generate general helpful response
            prompt = f"""
            A user asked: "{user_message}"
            
            This is a Biological GPT system for DNA analysis. Available actions include:
            - Finding sickle cell anemia cases
            - Running DNA sequence analysis
            - Finding disease mutations
            - Finding healthy genes
            - Providing CRISPR suggestions
            - Getting sequence information
            
            Please provide a helpful response that guides them to use these features.
            Keep it friendly and informative (2-3 sentences).
            """
            
            response = model.generate_content(prompt)
            
            return {
                "success": True,
                "action": "general_help",
                "action_type": "provide_guidance",
                "message": response.text,
                "requires_frontend_action": False
            }
            
    except Exception as e:
        print(f"Error in chat action: {str(e)}")
        return {
            "success": False,
            "error": f"Failed to process chat action: {str(e)}",
            "message": "I encountered an error while processing your request. Please try again."
        }

@app.get("/api/test")
async def test_endpoint():
    """Test endpoint to verify server is working"""
    return {"message": "Server is working!", "status": "ok"}

@app.get("/api/sequence-info")
async def get_sequence_info():
    """Get information about the loaded DNA sequence"""
    try:
        # Load sequence from data file
        sequence_path = "data/sample"
        if os.path.exists(sequence_path):
            with open(sequence_path, 'r') as f:
                sequence_data = f.read()
                cleaned_sequence = sequence_data.replace('_', '').trim()
                
                # Calculate sequence statistics
                gc_count = cleaned_sequence.count('G') + cleaned_sequence.count('C')
                gc_content = (gc_count / len(cleaned_sequence)) * 100 if len(cleaned_sequence) > 0 else 0
                
                return {
                    "success": True,
                    "sequence_length": len(cleaned_sequence),
                    "gc_content": round(gc_content, 2),
                    "at_content": round(100 - gc_content, 2),
                    "nucleotides": {
                        "A": cleaned_sequence.count('A'),
                        "T": cleaned_sequence.count('T'),
                        "G": cleaned_sequence.count('G'),
                        "C": cleaned_sequence.count('C'),
                        "N": cleaned_sequence.count('N')
                    }
                }
        else:
            return {
                "success": False,
                "error": "Sequence file not found"
            }
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to get sequence info: {str(e)}"
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
