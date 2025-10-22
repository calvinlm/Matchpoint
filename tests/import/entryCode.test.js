const {
  assignEntryCodes,
  buildEntryCodePrefix,
  normalizeAgeGroup,
  normalizeDivisionName,
  normalizeLevel,
  parseExistingSequence,
} = require('../../src/import/entryCode');

describe('entry code helpers', () => {
  test('normalizes age group', () => {
    expect(normalizeAgeGroup('A18')).toBe('18');
    expect(normalizeAgeGroup('JUNIOR')).toBe('JR');
    expect(normalizeAgeGroup('A35')).toBe('35');
    expect(normalizeAgeGroup('OPEN')).toBe('OPEN');
  });

  test('normalizes division name', () => {
    expect(normalizeDivisionName("Men's Doubles")).toBe('MD');
    expect(normalizeDivisionName('Mixed Doubles')).toBe('MD');
    expect(normalizeDivisionName('Singles')).toBe('S');
  });

  test('normalizes level', () => {
    expect(normalizeLevel('INT')).toBe('Int');
    expect(normalizeLevel('ADV')).toBe('Adv');
    expect(normalizeLevel('opn')).toBe('Opn');
  });

  test('builds entry code prefix', () => {
    const prefix = buildEntryCodePrefix({
      ageGroup: 'A18',
      name: "Men's Doubles",
      level: 'INT',
    });
    expect(prefix).toBe('18MDInt');
  });

  test('parses existing sequences', () => {
    expect(parseExistingSequence('18MDInt_001')).toBe(1);
    expect(parseExistingSequence('18MDInt_009')).toBe(9);
    expect(parseExistingSequence('18MDInt_bad')).toBe(0);
    expect(parseExistingSequence(null)).toBe(0);
  });

  test('assigns entry codes with per-division counters', () => {
    const registrations = [
      { id: 'reg1', divisionId: 'div1', teamId: 'team1' },
      { id: 'reg2', divisionId: 'div1', teamId: 'team2' },
      { id: 'reg3', divisionId: 'div2', teamId: 'team3' },
    ];

    const divisions = new Map([
      [
        'div1',
        {
          id: 'div1',
          ageGroup: 'A18',
          name: "Men's Doubles",
          level: 'INT',
        },
      ],
      [
        'div2',
        {
          id: 'div2',
          ageGroup: 'A35',
          name: 'Mixed Doubles',
          level: 'ADV',
        },
      ],
    ]);

    const existingSequence = new Map([
      ['div1', 3], // next should be 3
      ['div2', 1],
    ]);

    const result = assignEntryCodes(registrations, divisions, existingSequence);
    expect(result.map((r) => r.entryCode)).toEqual(['18MDInt_003', '18MDInt_004', '35MDAdv_001']);
  });
});
