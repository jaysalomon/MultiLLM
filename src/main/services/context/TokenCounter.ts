export class TokenCounter {
  // Enhanced token counting implementation
  // Approximates GPT-style tokenization without external dependencies
  
  private readonly CHARS_PER_TOKEN = 4; // Average characters per token
  private readonly commonTokens: Map<string, number>;
  
  constructor() {
    // Common tokens that are typically single tokens in most tokenizers
    this.commonTokens = new Map([
      ['the', 1], ['and', 1], ['for', 1], ['are', 1], ['but', 1], ['not', 1],
      ['you', 1], ['all', 1], ['can', 1], ['had', 1], ['her', 1], ['was', 1],
      ['one', 1], ['our', 1], ['out', 1], ['day', 1], ['get', 1], ['has', 1],
      ['him', 1], ['his', 1], ['how', 1], ['man', 1], ['new', 1], ['now', 1],
      ['old', 1], ['see', 1], ['two', 1], ['way', 1], ['who', 1], ['boy', 1],
      ['did', 1], ['its', 1], ['let', 1], ['put', 1], ['say', 1], ['she', 1],
      ['too', 1], ['use', 1]
    ]);
  }
  
  count(text: string): number {
    if (!text || text.trim().length === 0) return 0;
    
    // Handle different types of content
    if (this.isCode(text)) {
      return this.countCodeTokens(text);
    } else if (this.isStructuredData(text)) {
      return this.countStructuredTokens(text);
    } else {
      return this.countTextTokens(text);
    }
  }
  
  private countTextTokens(text: string): number {
    // Split into words and punctuation
    const tokens = text.match(/\w+|[^\w\s]/g) || [];
    let tokenCount = 0;
    
    tokens.forEach(token => {
      const lowerToken = token.toLowerCase();
      
      if (this.commonTokens.has(lowerToken)) {
        tokenCount += this.commonTokens.get(lowerToken)!;
      } else if (/^\w+$/.test(token)) {
        // Word token
        if (token.length <= 4) {
          tokenCount += 1;
        } else if (token.length <= 8) {
          tokenCount += 1.5;
        } else {
          tokenCount += Math.ceil(token.length / 5);
        }
      } else {
        // Punctuation or special character
        tokenCount += 0.5;
      }
    });
    
    return Math.ceil(tokenCount);
  }
  
  private countCodeTokens(text: string): number {
    // Code typically has more tokens due to symbols and keywords
    const lines = text.split('\n');
    let totalTokens = 0;
    
    lines.forEach(line => {
      if (line.trim().length === 0) {
        totalTokens += 1; // Newline token
        return;
      }
      
      // Split by code-relevant delimiters
      const tokens = line.match(/\w+|[^\w\s]/g) || [];
      let lineTokens = 0;
      
      tokens.forEach(token => {
        if (/^\w+$/.test(token)) {
          // Identifier or keyword
          lineTokens += Math.max(1, Math.ceil(token.length / 4));
        } else {
          // Operator, punctuation, etc.
          lineTokens += 1;
        }
      });
      
      totalTokens += Math.max(1, lineTokens);
    });
    
    return totalTokens;
  }
  
  private countStructuredTokens(text: string): number {
    // JSON, XML, etc. - count based on structure
    const structuralChars = text.match(/[{}[\]<>,:;"']/g) || [];
    const words = text.match(/\w+/g) || [];
    
    return structuralChars.length + Math.ceil(words.length * 1.2);
  }
  
  private isCode(text: string): boolean {
    // Heuristics to detect code
    const codeIndicators = [
      /\b(function|class|interface|import|export|const|let|var|return|if|else|for|while)\b/,
      /[{}();]/,
      /\/\/|\/\*|\*\//,
      /\b(public|private|protected|static|async|await)\b/
    ];
    
    return codeIndicators.some(pattern => pattern.test(text));
  }
  
  private isStructuredData(text: string): boolean {
    // Detect JSON, XML, etc.
    const trimmed = text.trim();
    return (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('<') && trimmed.endsWith('>'))
    );
  }

  remaining(text: string, maxTokens: number): number {
    return Math.max(0, maxTokens - this.count(text));
  }

  canFit(text: string, maxTokens: number): boolean {
    return this.count(text) <= maxTokens;
  }

  truncateToTokens(text: string, maxTokens: number): string {
    const currentTokens = this.count(text);
    
    if (currentTokens <= maxTokens) {
      return text;
    }
    
    // Binary search for the right truncation point
    let left = 0;
    let right = text.length;
    let bestFit = '';
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const truncated = text.slice(0, mid);
      const tokens = this.count(truncated);
      
      if (tokens <= maxTokens) {
        bestFit = truncated;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    
    // Try to end at a natural boundary
    return this.findNaturalBreakpoint(bestFit, text);
  }
  
  private findNaturalBreakpoint(truncated: string, original: string): string {
    if (truncated.length >= original.length) {
      return truncated;
    }
    
    // Try to end at sentence boundary
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('?')
    );
    
    if (lastSentenceEnd > truncated.length * 0.8) {
      return truncated.slice(0, lastSentenceEnd + 1);
    }
    
    // Try to end at line boundary
    const lastNewline = truncated.lastIndexOf('\n');
    if (lastNewline > truncated.length * 0.8) {
      return truncated.slice(0, lastNewline);
    }
    
    // Try to end at word boundary
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > truncated.length * 0.9) {
      return truncated.slice(0, lastSpace);
    }
    
    return truncated;
  }
  
  estimateTokensFromChars(charCount: number): number {
    return Math.ceil(charCount / this.CHARS_PER_TOKEN);
  }
  
  estimateCharsFromTokens(tokenCount: number): number {
    return tokenCount * this.CHARS_PER_TOKEN;
  }
}