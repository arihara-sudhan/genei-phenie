import torch
import torch.nn as nn
import torch.nn.functional as F
import math
import numpy as np
from collections import Counter
from typing import List, Dict, Tuple, Optional
import re

class BiologicalSequenceUtils:
    """Utility class for biological sequence analysis"""
    
    @staticmethod
    def calculate_gc_content(sequence: str) -> float:
        """Calculate the GC content of a DNA sequence"""
        sequence = sequence.upper()
        gc_count = sequence.count('G') + sequence.count('C')
        total_length = len(sequence.replace('N', ''))  # Exclude ambiguous bases
        return gc_count / total_length if total_length > 0 else 0.0

class KMerTokenizer:
    """Advanced k-mer based tokenizer with biological context"""
    
    def __init__(self, k: int = 3, text: str = None, include_reverse_complement: bool = True):
        self.k = k
        self.include_reverse_complement = include_reverse_complement
        
        if text is not None:
            self.build_vocab(text)
    
    def reverse_complement(self, sequence: str) -> str:
        """Generate reverse complement of DNA sequence"""
        complement = {'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G', 'N': 'N'}
        return ''.join(complement[base] for base in sequence[::-1])
    
    def generate_kmers(self, sequence: str) -> List[str]:
        """Generate all k-mers from sequence"""
        kmers = []
        for i in range(len(sequence) - self.k + 1):
            kmer = sequence[i:i + self.k]
            kmers.append(kmer)
            if self.include_reverse_complement:
                kmers.append(self.reverse_complement(kmer))
        return kmers
    
    def build_vocab(self, text: str):
        """Build vocabulary from text using k-mers"""
        text = re.sub(r'[^ATCGN]', 'N', text.upper())
        
        all_kmers = []
        for i in range(0, len(text) - self.k + 1, self.k // 2):
            kmer = text[i:i + self.k]
            if len(kmer) == self.k:
                all_kmers.append(kmer)
        
        kmer_counts = Counter(all_kmers)
        
        self.special_tokens = {
            '<PAD>': 0,
            '<UNK>': 1,
            '<START>': 2,
            '<END>': 3,
            '<MASK>': 4
        }
        
        self.token_to_id = {**self.special_tokens}
        self.id_to_token = {v: k for k, v in self.special_tokens.items()}
        
        for kmer, count in kmer_counts.most_common(1000):
            if kmer not in self.token_to_id:
                token_id = len(self.token_to_id)
                self.token_to_id[kmer] = token_id
                self.id_to_token[token_id] = kmer
    
    def encode(self, text: str) -> List[int]:
        """Encode text to token IDs"""
        text = re.sub(r'[^ATCGN]', 'N', text.upper())
        tokens = []
        
        for i in range(0, len(text) - self.k + 1, 1):
            kmer = text[i:i + self.k]
            if len(kmer) == self.k:
                tokens.append(self.token_to_id.get(kmer, self.token_to_id['<UNK>']))
        
        return tokens if tokens else [self.token_to_id['<PAD>']]
    
    def decode(self, ids: List[int]) -> str:
        """Decode token IDs back to sequence"""
        return ''.join([self.id_to_token.get(i, '<UNK>') for i in ids])

class DNAStructureAttention(nn.Module):
    """Attention mechanism that considers DNA base-pairing patterns"""
    
    def __init__(self, dim: int, heads: int, max_len: int = 1024):
        super().__init__()
        self.heads = heads
        self.dim = dim
        self.head_dim = dim // heads
        
        self.qkv = nn.Linear(dim, dim * 3)
        self.out = nn.Linear(dim, dim)
        
        self.dna_bias = nn.Parameter(torch.randn(max_len, max_len))
        
    def forward(self, x, mask=None):
        B, T, C = x.size()
        qkv = self.qkv(x).reshape(B, T, 3, self.heads, self.head_dim)
        q, k, v = qkv[:, :, 0], qkv[:, :, 1], qkv[:, :, 2]
        q = q.transpose(1, 2)
        k = k.transpose(1, 2)
        v = v.transpose(1, 2)
        
        scores = (q @ k.transpose(-2, -1)) / math.sqrt(self.head_dim)
        
        dna_bias = self.dna_bias[:T, :T].unsqueeze(0).unsqueeze(0)
        scores = scores + dna_bias
        
        causal_mask = torch.tril(torch.ones(T, T, device=x.device)).bool()
        scores = scores.masked_fill(~causal_mask, float('-inf'))
        
        if mask is not None:
            scores = scores.masked_fill(~mask, float('-inf'))
        
        attn = F.softmax(scores, dim=-1)
        out = (attn @ v).transpose(1, 2).contiguous().reshape(B, T, C)
        return self.out(out)

class MotifAwareAttention(nn.Module):
    """Attention that specifically looks for biological motifs"""
    
    def __init__(self, dim: int, heads: int, motif_patterns: List[str] = None):
        super().__init__()
        self.heads = heads
        self.dim = dim
        self.head_dim = dim // heads
        
        self.qkv = nn.Linear(dim, dim * 3)
        self.out = nn.Linear(dim, dim)
        
        self.motif_heads = nn.ModuleList([
            nn.Conv1d(dim, 1, kernel_size=len(pattern), padding='same')
            for pattern in (motif_patterns or ['TATA', 'GCGC', 'ATAT'])
        ])
        
    def forward(self, x):
        B, T, C = x.size()
        
        qkv = self.qkv(x).reshape(B, T, 3, self.heads, self.head_dim)
        q, k, v = qkv[:, :, 0], qkv[:, :, 1], qkv[:, :, 2]
        q = q.transpose(1, 2)
        k = k.transpose(1, 2)
        v = v.transpose(1, 2)
        
        scores = (q @ k.transpose(-2, -1)) / math.sqrt(self.head_dim)
        
        motif_scores = []
        x_conv = x.transpose(1, 2)
        for motif_head in self.motif_heads:
            motif_score = motif_head(x_conv).transpose(1, 2)
            motif_scores.append(motif_score)
        
        motif_bias = torch.cat(motif_scores, dim=-1).mean(dim=-1, keepdim=True)
        motif_bias = motif_bias.unsqueeze(1)
        
        scores = scores + motif_bias
        
        causal_mask = torch.tril(torch.ones(T, T, device=x.device)).bool()
        scores = scores.masked_fill(~causal_mask, float('-inf'))
        
        attn = F.softmax(scores, dim=-1)
        out = (attn @ v).transpose(1, 2).contiguous().reshape(B, T, C)
        return self.out(out)

class MultiTaskHead(nn.Module):
    """Multi-task learning head for various biological predictions"""
    
    def __init__(self, dim: int, tasks: Dict[str, int]):
        super().__init__()
        self.tasks = tasks
        self.heads = nn.ModuleDict({
            task: nn.Linear(dim, output_size)
            for task, output_size in tasks.items()
        })
        
    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        x_pooled = x.mean(dim=1)
        outputs = {task: head(x_pooled) for task, head in self.heads.items()}
        return outputs

class BiologicalTransformerBlock(nn.Module):
    """Transformer block with biological enhancements"""
    
    def __init__(self, dim: int, heads: int, use_dna_attention: bool = True):
        super().__init__()
        self.use_dna_attention = use_dna_attention
        
        if use_dna_attention:
            self.attn = DNAStructureAttention(dim, heads)
        else:
            self.attn = MotifAwareAttention(dim, heads)
            
        self.ff = nn.Sequential(
            nn.Linear(dim, 4 * dim),
            nn.GELU(),
            nn.Dropout(0.1),
            nn.Linear(4 * dim, dim),
            nn.Dropout(0.1)
        )
        
        self.ln1 = nn.LayerNorm(dim)
        self.ln2 = nn.LayerNorm(dim)
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x + self.attn(self.ln1(x))
        x = x + self.ff(self.ln2(x))
        return x

class BiologicalGPT(nn.Module):
    """Enhanced GPT model with biological innovations"""
    
    def __init__(self, vocab_size: int, dim: int = 256, depth: int = 6, 
                 heads: int = 8, max_len: int = 1024, 
                 tasks: Dict[str, int] = None):
        super().__init__()
        
        self.token_emb = nn.Embedding(vocab_size, dim)
        self.pos_emb = nn.Embedding(max_len, dim)
        
        self.helical_pos_emb = nn.Parameter(torch.randn(max_len, dim))
        
        self.blocks = nn.ModuleList([
            BiologicalTransformerBlock(dim, heads, use_dna_attention=(i % 2 == 0))
            for i in range(depth)
        ])
        
        self.ln_f = nn.LayerNorm(dim)
        
        self.lm_head = nn.Linear(dim, vocab_size)
        
        if tasks:
            self.multi_task_head = MultiTaskHead(dim, tasks)
        else:
            self.multi_task_head = None
        
        self.max_len = max_len
        
    def forward(self, x: torch.Tensor, targets: torch.Tensor = None,
                task_targets: Dict[str, torch.Tensor] = None,
                conservation_mask: torch.Tensor = None) -> Dict[str, torch.Tensor]:
        
        B, T = x.size()
        pos = torch.arange(0, T, device=x.device).unsqueeze(0)
        
        tok_emb = self.token_emb(x)
        pos_emb = self.pos_emb(pos)
        helical_emb = self.helical_pos_emb[:T].unsqueeze(0)
        
        x = tok_emb + pos_emb + helical_emb
        
        for block in self.blocks:
            x = block(x)
        
        x = self.ln_f(x)
        
        lm_logits = self.lm_head(x)
        
        task_logits = {}
        if self.multi_task_head:
            task_logits = self.multi_task_head(x)
        
        losses = {}
        
        if targets is not None:
            lm_loss = F.cross_entropy(
                lm_logits.view(-1, lm_logits.size(-1)), 
                targets.view(-1)
            )
            losses['lm_loss'] = lm_loss
        
        if task_targets and self.multi_task_head:
            for task, target in task_targets.items():
                if task in task_logits:
                    if task_logits[task].size(-1) == 1:
                        task_loss = F.mse_loss(task_logits[task].squeeze(-1), target)
                    else:
                        task_loss = F.cross_entropy(task_logits[task], target)
                    losses[f'{task}_loss'] = task_loss
        
        return {
            'logits': lm_logits,
            'task_logits': task_logits,
            'losses': losses
        }
