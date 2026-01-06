/**
 * Utilities for selecting relevant context from a large PSM document
 * and extracting keywords from diffs or change objects.
 */

export function extractKeywordsFromDiff(diff: string): string[] {
  const candidates = new Set<string>();
  const propertyRegex = /\"([A-Za-z0-9_\-]+)\"\s*:/g;
  let match: RegExpExecArray | null;
  while ((match = propertyRegex.exec(diff)) !== null) {
    const token = match[1];
    if (token.length > 2) candidates.add(token.toLowerCase());
    if (candidates.size > 50) break;
  }
  // Seed with general tokens often present in paths
  ['id','email','price','date','created','name','username','user','order','product']
    .forEach(k => candidates.add(k));
  return Array.from(candidates);
}

export interface ChangeLike {
  path?: string;
  type?: string[] | string;
  description?: string;
}

export function extractKeywordsFromChanges(changes: ChangeLike[]): string[] {
  const set = new Set<string>();
  for (const ch of changes || []) {
    if (ch.path) {
      ch.path.split(/[\./\[/\]:]+/).forEach(t => {
        const token = (t || '').toLowerCase();
        if (token && token.length > 2 && token !== 'properties') set.add(token);
      });
    }
    if (Array.isArray(ch.type)) {
      for (const t of ch.type as string[]) set.add(String(t).toLowerCase());
    } else if (typeof ch.type === 'string') {
      set.add(ch.type.toLowerCase());
    }
    if (ch.description) {
      ch.description.split(/[^a-zA-Z0-9_]+/).forEach(w => {
        const token = w.toLowerCase();
        if (token && token.length > 3) set.add(token);
      });
    }
  }
  ['id','email','price','date','created','name','username','user','order','product']
    .forEach(k => set.add(k));
  return Array.from(set).slice(0, 60);
}

export function selectRelevantPsmContext(psm: string, keywords: string[], maxChars: number): string {
  if (!psm) return '';
  const lines = psm.split(/\r?\n/);
  const windowSize = 40;
  type Chunk = { start: number; end: number; score: number; text: string };
  const chunks: Chunk[] = [];
  for (let i = 0; i < lines.length; i += Math.max(1, Math.floor(windowSize / 2))) {
    const start = i;
    const end = Math.min(i + windowSize, lines.length);
    const text = lines.slice(start, end).join('\n');
    const lower = text.toLowerCase();
    let score = 0;
    for (const k of keywords) {
      if (lower.includes(`\"${k}\"`) || lower.includes(`/${k}`) || lower.includes(`${k}`)) score += 1;
    }
    if (score > 0) chunks.push({ start, end, score, text });
  }
  chunks.sort((a, b) => b.score - a.score);
  const selected: string[] = [];
  let used = 0;
  for (const c of chunks) {
    if (used + c.text.length > maxChars) break;
    selected.push(c.text);
    used += c.text.length + 2;
    if (selected.length >= 8) break;
  }
  if (selected.length === 0) {
    return lines.slice(0, Math.min(lines.length, Math.ceil(maxChars / 80))).join('\n');
  }
  return selected.join('\n---\n');
}

/**
 * Selects relevant RDF/OWL context given an ontology text (Turtle / JSON-LD / RDF/XML as text).
 * Uses the same sliding window, keyword-based selection to avoid adding heavy RDF parsers here.
 */
export function selectRelevantRdfContext(ontology: string, keywords: string[], maxChars: number): string {
  if (!ontology) return '';
  // Favor smaller windows because TTL and JSON-LD often have dense info
  const lines = ontology.split(/\r?\n/);
  const windowSize = 30;
  type Chunk = { start: number; end: number; score: number; text: string };
  const chunks: Chunk[] = [];
  for (let i = 0; i < lines.length; i += Math.max(1, Math.floor(windowSize / 2))) {
    const start = i;
    const end = Math.min(i + windowSize, lines.length);
    const text = lines.slice(start, end).join('\n');
    const lower = text.toLowerCase();
    let score = 0;
    for (const k of keywords) {
      if (lower.includes(`:${k}`) || lower.includes(`#${k}`) || lower.includes(`/${k}`) || lower.includes(`${k}`)) score += 1;
    }
    // Slightly boost occurrences of common OWL/RDFS terms
    ['rdfs:domain','rdfs:range','rdfs:subclassof','owl:class','owl:restriction','owl:onproperty','owl:cardinality','owl:minqualifiedcardinality','owl:maxqualifiedcardinality','owl:functionalproperty']
      .forEach(t => { if (lower.includes(t)) score += 0.25; });
    if (score > 0) chunks.push({ start, end, score, text });
  }
  chunks.sort((a, b) => b.score - a.score);
  const selected: string[] = [];
  let used = 0;
  for (const c of chunks) {
    if (used + c.text.length > maxChars) break;
    selected.push(c.text);
    used += c.text.length + 2;
    if (selected.length >= 10) break;
  }
  if (selected.length === 0) {
    return lines.slice(0, Math.min(lines.length, Math.ceil(maxChars / 80))).join('\n');
  }
  return selected.join('\n---\n');
}


