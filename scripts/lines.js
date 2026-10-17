// Flavour lines shown above the sigils. One is picked at random per request.
export const LINES = {
  easy: [
    "Steady hands. Fate is feeling generous.",
    "A small step. The road is kind today.",
    "Breathe easy. The odds lean your way.",
    "Keep it high, keep it simple.",
    "Fortune hums a gentle tune.",
    "Nothing to fear. Just let it roll.",
    "The stars barely need to look.",
    "A light wager with a friendly fate.",
    "You have done harder things before breakfast.",
    "Trust your training. The dice will follow."
  ],
  medium: [
    "The scales hang even. Tip them.",
    "Fate is watching, and it has not decided.",
    "Skill opens the door. Luck must walk through.",
    "Not every road is safe. This one might be.",
    "Hold your nerve. The moment is listening.",
    "A fair wager. A real price.",
    "The thread is taut, but it holds. For now.",
    "Doubt has taken a seat at the table. Roll past it.",
    "Fortune favours the ready. Are you?",
    "Somewhere between glory and regret, a die turns."
  ],
  hard: [
    "Death is close enough to hear you breathe.",
    "The thread of fate frays between your fingers.",
    "One wrong number, and the dark keeps what it takes.",
    "Pray, if you still remember how.",
    "The abyss leans in to watch.",
    "Everything you are hangs on this.",
    "Fate has sharpened its knife. Roll.",
    "No second chance waits beyond this moment.",
    "The gods have gone quiet. So should you.",
    "Life and ruin, a single breath apart."
  ]
};

export const TIER_DC = { easy: 10, medium: 15, hard: 20 };

export function pickLine(tier) {
  const pool = LINES[tier] ?? LINES.medium;
  return pool[Math.floor(Math.random() * pool.length)];
}
