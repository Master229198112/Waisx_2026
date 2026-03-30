export type SkillCategory = 'AI & Technical' | 'Cognitive & Behavioral' | 'Governance & Ethics';
export type Industry = 'IT & AI' | 'BFSI' | 'Healthcare' | 'Manufacturing' | 'Education' | 'Aviation & Smart Cities';
export type ExperienceLevel = 'Entry' | 'Mid' | 'Senior';
export type TimePeriod = 'Q1 2025' | 'Q2 2025' | 'Q3 2025' | 'Q4 2025' | 'Q1 2026' | 'FY 2025' | 'All Time';
export type QuadrantLabel = 'Sought & Rewarded' | 'Scarce & Undervalued' | 'Abundant & Rewarded' | 'Low Priority';

export interface SkillData {
  id: string;
  skillName: string;
  category: SkillCategory;
  industry: Industry;
  experienceLevel: ExperienceLevel;
  demandScore: number; // 1-5
  supplyScore: number; // 1-5
  gap: number; // demand - supply
  waisxWeight: number; // 0-1
  premiumScore: number; // 0-100 (Salary premium)
  timePeriod: TimePeriod;
  quadrantLabel: QuadrantLabel;
  movementFlag?: string; // e.g., 'Upward', 'Stable', 'Declining'
  timestamp: string;
}

const skillsByCategory: Record<SkillCategory, string[]> = {
  'AI & Technical': ['Machine Learning', 'Deep Learning', 'NLP', 'Computer Vision', 'Data Engineering', 'MLOps', 'Prompt Engineering', 'Cloud Architecture'],
  'Cognitive & Behavioral': ['Critical Thinking', 'Adaptability', 'Complex Problem Solving', 'Emotional Intelligence', 'Creativity', 'Leadership', 'Communication'],
  'Governance & Ethics': ['AI Ethics', 'Data Privacy', 'Regulatory Compliance', 'Bias Mitigation', 'Explainable AI', 'Risk Management', 'Cybersecurity']
};

const industries: Industry[] = ['IT & AI', 'BFSI', 'Healthcare', 'Manufacturing', 'Education', 'Aviation & Smart Cities'];
const experienceLevels: ExperienceLevel[] = ['Entry', 'Mid', 'Senior'];
const timePeriods: TimePeriod[] = ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025', 'Q1 2026'];

const getQuadrant = (demand: number, supply: number): QuadrantLabel => {
  if (demand > 3 && supply > 3) return 'Sought & Rewarded';
  if (demand > 3 && supply <= 3) return 'Scarce & Undervalued';
  if (demand <= 3 && supply > 3) return 'Abundant & Rewarded';
  return 'Low Priority';
};

export const generateSyntheticData = (): SkillData[] => {
  const data: SkillData[] = [];
  let idCounter = 1;

  // Base skill profiles to ensure consistency across time
  const baseProfiles = new Map<string, { demand: number, supply: number, premium: number }>();
  
  (Object.keys(skillsByCategory) as SkillCategory[]).forEach(category => {
    skillsByCategory[category].forEach(skill => {
      let d = Math.random() * 2 + 2;
      let s = Math.random() * 2 + 2;
      let p = Math.random() * 40 + 10;
      
      if (skill === 'Prompt Engineering' || skill === 'MLOps') { d += 1.5; s -= 1; p += 40; }
      if (skill === 'AI Ethics') { d += 1; s -= 0.5; p += 20; }
      if (skill === 'Communication') { s += 1.5; p -= 10; }
      
      baseProfiles.set(skill, { demand: d, supply: s, premium: p });
    });
  });

  timePeriods.forEach((period, pIdx) => {
    industries.forEach(industry => {
      experienceLevels.forEach(exp => {
        (Object.keys(skillsByCategory) as SkillCategory[]).forEach(category => {
          skillsByCategory[category].forEach(skill => {
            const base = baseProfiles.get(skill)!;
            
            // Evolution over time
            let timeModifierD = pIdx * 0.15; // Demand generally grows
            let timeModifierS = pIdx * 0.1;  // Supply grows slower
            
            if (skill === 'Prompt Engineering') timeModifierD *= 2; // Fast growth
            
            let indModifierD = industry === 'IT & AI' && category === 'AI & Technical' ? 0.8 : 0;
            indModifierD += industry === 'Healthcare' && category === 'Governance & Ethics' ? 0.6 : 0;
            
            const demandScore = Math.min(5, Math.max(1, base.demand + timeModifierD + indModifierD + (Math.random() * 0.4 - 0.2)));
            const supplyScore = Math.min(5, Math.max(1, base.supply + timeModifierS + (Math.random() * 0.4 - 0.2)));
            const premiumScore = Math.min(100, Math.max(0, base.premium + (demandScore - supplyScore) * 10 + (Math.random() * 10 - 5)));
            
            data.push({
              id: `sk-${idCounter++}`,
              skillName: skill,
              category,
              industry,
              experienceLevel: exp,
              demandScore: Number(demandScore.toFixed(2)),
              supplyScore: Number(supplyScore.toFixed(2)),
              gap: Number((demandScore - supplyScore).toFixed(2)),
              waisxWeight: Number((Math.random() * 0.5 + 0.5).toFixed(2)),
              premiumScore: Number(premiumScore.toFixed(1)),
              timePeriod: period,
              quadrantLabel: getQuadrant(demandScore, supplyScore),
              timestamp: new Date().toISOString()
            });
          });
        });
      });
    });
  });

  return data;
};

export const syntheticData = generateSyntheticData();
