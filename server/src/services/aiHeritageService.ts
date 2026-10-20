import { GoogleGenAI } from '@google/genai';
import { insightsService } from './insightsService.ts';

export interface HeritageAiSummaryResponse {
  summary: string;
  isAiGenerated: boolean;
  label: string;
  badge: string;
  disclaimer: string;
  keyHighlights: string[];
}

let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!geminiClient) {
    try {
      geminiClient = new GoogleGenAI({ apiKey });
    } catch {
      geminiClient = null;
    }
  }
  return geminiClient;
}

export class AiHeritageService {
  /**
   * Generates a safe, non-invasive heritage synthesis narrative
   * strictly from already-verified family data.
   *
   * SAFEGUARD RULES:
   * 1. Never invents relatives
   * 2. Never invents dates
   * 3. Never invents relationships
   * 4. Never modifies family records
   * 5. Never exposes private data or bypasses RBAC
   * 6. Strictly labeled as [AI Suggested / Generated]
   */
  async generateHeritageSummary(
    familyId: string,
    actorUserId: string
  ): Promise<HeritageAiSummaryResponse> {
    // 1. Fetch authorized insights (respects full RBAC and family isolation)
    const insights = await insightsService.getFamilyInsights(familyId, actorUserId);

    const familyName = insights.familyName;
    const totalGens = insights.generationDepth.totalGenerations;
    const oldest = insights.oldestAncestor;
    const largestBranch = insights.largestBranch;
    const topPlaces = insights.connectedPlaces.slice(0, 3).map((p) => p.place).join(', ');
    const memoryCount = insights.statistics.memoriesCount;
    const peakDecade = insights.peakMemoryDecade;
    const relativesCount = insights.statistics.totalRelatives;

    const keyHighlights = [
      `${relativesCount} relatives mapped across ${totalGens} distinct generations.`,
      largestBranch ? `Largest lineage branch is ${largestBranch.name} with ${largestBranch.memberCount} kin.` : 'Lineages linked in family chronicle.',
      peakDecade ? `Peak archival era captured in the ${peakDecade} with ${memoryCount} preserved memories.` : `${memoryCount} memories safely preserved.`,
      topPlaces ? `Ancestral roots spanning ${topPlaces}.` : 'Rooted in enduring heritage.',
    ];

    // Fallback deterministic summary
    const deterministicSummary = `The ${familyName} heritage archive spans ${totalGens} generations, lovingly preserving the journeys of ${relativesCount} relatives${topPlaces ? ` across ${topPlaces}` : ''}. With ${memoryCount} treasured memories${peakDecade ? ` peaking in the vibrant ${peakDecade}` : ''}, and strong branch lineages led by ${largestBranch?.name || 'founding ancestors'}, this chronicle stands as a lasting tribute to family bonds and shared memories.`;

    const client = getGeminiClient();
    if (!client) {
      return {
        summary: deterministicSummary,
        isAiGenerated: false,
        label: 'Verified Heritage Overview',
        badge: 'Verified Family Records (Rule-Based Synthesis)',
        disclaimer: 'Generated from family records. AI cannot create or alter family data.',
        keyHighlights,
      };
    }

    try {
      const prompt = `You are a respectful family heritage historian. Synthesize the following VERIFIED facts into a heartwarming 2-to-3 sentence family chronicle overview.
RULES:
- Do NOT invent any names, dates, places, or relatives.
- Only use the facts provided below:
Family Name: ${familyName}
Relatives Count: ${relativesCount}
Generations Count: ${totalGens}
Earliest Recorded Ancestor: ${oldest ? `${oldest.name} (born circa ${oldest.birthYear || 'early era'})` : 'Founding ancestors'}
Largest Branch: ${largestBranch ? `${largestBranch.name} (${largestBranch.memberCount} members)` : 'United family tree'}
Top Places: ${topPlaces || 'recorded family homelands'}
Total Memories: ${memoryCount}
Peak Memory Era: ${peakDecade || 'modern decades'}

Provide a warm, celebratory, and concise narrative.`;

      const response = await client.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });

      const generatedText = response.text?.trim();

      if (generatedText && generatedText.length > 20) {
        return {
          summary: generatedText,
          isAiGenerated: true,
          label: 'AI-Assisted Heritage Overview',
          badge: 'AI Suggested (Based strictly on verified family records)',
          disclaimer: 'Synthesized via Gemini AI from verified family data only. AI cannot invent, modify, or add relatives.',
          keyHighlights,
        };
      }
    } catch {
      // Graceful fallback if AI call fails or throttles
    }

    return {
      summary: deterministicSummary,
      isAiGenerated: false,
      label: 'Verified Heritage Overview',
      badge: 'Verified Family Records (Rule-Based Synthesis)',
      disclaimer: 'Generated from family records. AI cannot create or alter family data.',
      keyHighlights,
    };
  }
}

export const aiHeritageService = new AiHeritageService();
