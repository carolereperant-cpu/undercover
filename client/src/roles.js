// Description des rôles, utilisée par la carte secrète, les règles et les écrans de résultat.
export const ROLE_INFO = {
  civil: {
    name: 'Civil',
    plural: 'civils',
    emoji: '🙂',
    camp: 'civils',
    power: 'Décris ton mot sans le dire, et repère ceux dont le mot sonne faux.',
  },
  undercover: {
    name: 'Undercover',
    plural: 'undercovers',
    emoji: '🕵️',
    camp: 'infiltres',
    power: 'Ton mot est très proche de celui des civils, mais tu ne le sais pas.',
  },
  mrwhite: {
    name: 'Mr White',
    plural: 'Mr White',
    emoji: '🎭',
    camp: 'infiltres',
    power: 'Tu n’as aucun mot. Écoute les indices, bluffe, et devine le mot des civils si on te démasque.',
  },
  bouclier: {
    name: 'Le Bouclier',
    plural: 'boucliers',
    emoji: '🛡️',
    camp: 'civils',
    power: 'Tu as le mot des civils. Le premier vote contre toi est annulé, mais ton rôle est alors révélé.',
  },
  detective: {
    name: 'Le Détective',
    plural: 'détectives',
    emoji: '🔎',
    camp: 'civils',
    power: 'Tu as le mot des civils. Une fois par partie, tu peux savoir si un joueur a le même mot que toi.',
  },
};

export const CAMP_NAME = { civils: 'les civils', infiltres: 'les infiltrés' };
