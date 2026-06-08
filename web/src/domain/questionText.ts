// Natural-language phrasing for each OEJTS item, keyed by item id (1..32).
// `question` reads as a single "Are you more X, or more Y?"-style prompt; `left`
// and `right` are the short pole labels shown at the ends of the lean bar.
//
// CONVENTION (matches domain/oejts.ts): `left` is the item's value-1 pole and is
// always named FIRST in the question; `right` is the value-5 pole, named second.
// So presentation order never affects scoring — only how the choice reads.

export interface QuestionCopy {
  question: string
  left: string
  right: string
}

export const QUESTION_COPY: Record<number, QuestionCopy> = {
  1:  { question: 'Do you make lists, or rely on memory?', left: 'Make lists', right: 'Rely on memory' },
  2:  { question: 'Do you question new claims until they’re proven, or readily embrace new ideas?', left: 'Question claims', right: 'Embrace ideas' },
  3:  { question: 'Are you bored by time alone, or do you need it?', left: 'Bored alone', right: 'Need alone time' },
  4:  { question: 'Do you accept things as they are, or wish they were different?', left: 'Accept things', right: 'Want change' },
  5:  { question: 'Do you keep a clean room, or just put stuff wherever?', left: 'Clean room', right: 'Stuff wherever' },
  6:  { question: 'Is “robotic” an insult to you, or do you strive for a mechanical mind?', left: '“Robotic” = insult', right: 'Mechanical mind' },
  7:  { question: 'Are you more energetic, or more mellow?', left: 'Energetic', right: 'Mellow' },
  8:  { question: 'Do you prefer multiple-choice tests, or essay answers?', left: 'Multiple-choice', right: 'Essays' },
  9:  { question: 'Are you more chaotic, or more organized?', left: 'Chaotic', right: 'Organized' },
  10: { question: 'Are you more easily hurt, or more thick-skinned?', left: 'Easily hurt', right: 'Thick-skinned' },
  11: { question: 'Do you work best in groups, or alone?', left: 'In groups', right: 'Alone' },
  12: { question: 'Are you more focused on the present, or the future?', left: 'The present', right: 'The future' },
  13: { question: 'Do you plan far ahead, or at the last minute?', left: 'Plan ahead', right: 'Last minute' },
  14: { question: 'Do you want people’s respect, or their love?', left: 'Respect', right: 'Love' },
  15: { question: 'Do parties wear you out, or fire you up?', left: 'Worn out', right: 'Fired up' },
  16: { question: 'Do you tend to fit in, or stand out?', left: 'Fit in', right: 'Stand out' },
  17: { question: 'Do you keep your options open, or commit?', left: 'Keep options open', right: 'Commit' },
  18: { question: 'Would you rather be good at fixing things, or fixing people?', left: 'Fixing things', right: 'Fixing people' },
  19: { question: 'Do you talk more, or listen more?', left: 'Talk more', right: 'Listen more' },
  20: { question: 'Describing an event, do you tell what happened, or what it meant?', left: 'What happened', right: 'What it meant' },
  21: { question: 'Do you get work done right away, or procrastinate?', left: 'Right away', right: 'Procrastinate' },
  22: { question: 'Do you decide with your feelings, or with logic?', left: 'Feelings', right: 'Logic' },
  23: { question: 'Would you rather stay home, or go out on the town?', left: 'Stay home', right: 'Go out' },
  24: { question: 'Do you want the big picture, or the details?', left: 'Big picture', right: 'Details' },
  25: { question: 'Do you improvise, or prepare?', left: 'Improvise', right: 'Prepare' },
  26: { question: 'Do you weigh choices by logic and consistency, or by values and harmony?', left: 'Logic', right: 'Values' },
  27: { question: 'Is it hard for you to yell loudly, or does it come naturally?', left: 'Hard to yell', right: 'Comes naturally' },
  28: { question: 'Are you more theoretical, or more empirical?', left: 'Theoretical', right: 'Empirical' },
  29: { question: 'Do you work hard, or play hard?', left: 'Work hard', right: 'Play hard' },
  30: { question: 'Are you uncomfortable with emotions, or do you value them?', left: 'Uncomfortable', right: 'Value emotions' },
  31: { question: 'Do you like to perform for others, or avoid public speaking?', left: 'Like performing', right: 'Avoid it' },
  32: { question: 'Do you like to know who, what, and when — or why?', left: 'Who, what, when', right: 'Why' },
}
