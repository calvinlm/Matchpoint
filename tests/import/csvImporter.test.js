const { parseConsolidatedCsv } = require('../../src/import/csvImporter');

const SAMPLE_CSV = `divisionName,divisionFormat,divisionLevel,divisionAgeGroup,teamName,player1First,player1Last,player1DOB,player2First,player2Last,player2DOB,seedNote
Men's Doubles,DOUBLE,INT,A18,Smash Bros,Mario,Bros,1985-01-01,Luigi,Bros,1987-02-02,Top seed
Men's Doubles,DOUBLE,INT,A18,Smash Bros,Mario,Bros,1985-01-01,Luigi,Bros,1987-02-02,
Mixed Doubles,DOUBLE,ADV,A18,Power Duo,Peach,Toadstool,1990-03-03,Mario,Bros,1985-01-01,
Mixed Doubles,DOUBLE,ADV,A18,,Peach,Toadstool,1990-03-03,Mario,Bros,1985-01-01,
Women's Doubles,DOUBLE,ADV,A35,Queens,Samus,Aran,1986-01-01,Zero,Suit,1986-01-01,New pairing
Women's Doubles,DOUBLE,ADV,A35,Queens,Samus,Aran,1986-01-01,Zero,Suit,invalid date,Duplicate row
Singles,RR,INT,A18,Rising Star,Link,Hyrule,1991-05-05,,,,
Singles,RR,INT,A18,Rising Star,Link,Hyrule,1991-05-05,,,,
Singles,RR,INT,A18,,Link,Hyrule,1991-05-05,,,,
`;

describe('parseConsolidatedCsv', () => {
  test('deduplicates players, teams, divisions, and registrations', () => {
    const result = parseConsolidatedCsv(SAMPLE_CSV);

    expect(result.players).toHaveLength(7);
    const playerNames = result.players.map((player) => `${player.firstName} ${player.lastName}`);
    expect(playerNames).toEqual(
      expect.arrayContaining(['Mario Bros', 'Luigi Bros', 'Peach Toadstool', 'Samus Aran', 'Link Hyrule']),
    );

    expect(result.teams).toHaveLength(5);
    const teamNameCounts = result.teams.reduce((acc, team) => {
      acc[team.name] = (acc[team.name] || 0) + 1;
      return acc;
    }, {});
    expect(teamNameCounts).toMatchObject({
      'Smash Bros': 1,
      'Power Duo': 1,
      Queens: 2,
      'Rising Star': 1,
    });

    expect(result.divisions).toHaveLength(4);
    const divisionNames = result.divisions.map((division) => division.name);
    expect(divisionNames).toEqual(
      expect.arrayContaining(["Men's Doubles", 'Mixed Doubles', "Women's Doubles", 'Singles']),
    );

    expect(result.registrations).toHaveLength(5);
  });

  test('throws when required columns are missing', () => {
    const badCsv = 'divisionName,teamName\nExample,Team';
    expect(() => parseConsolidatedCsv(badCsv)).toThrow(/Missing required CSV columns/);
  });

  test('generates a team name from player last names when missing', () => {
    const generatedCsv = `divisionName,divisionFormat,divisionLevel,divisionAgeGroup,teamName,player1First,player1Last,player1DOB,player2First,player2Last,player2DOB,seedNote
Open Doubles,DOUBLE,ADV,A18,,Alice,Anderson,2000-01-01,Bob,Baker,2000-02-02,
Open Singles,SINGLE,ADV,A18,,Charlie,Chaplin,2001-03-03,,,,
`;

    const result = parseConsolidatedCsv(generatedCsv);

    expect(result.teams).toHaveLength(2);
    const [doublesTeam, singlesTeam] = result.teams;
    expect(doublesTeam.name).toBe('Anderson / Baker');
    expect(singlesTeam.name).toBe('Chaplin');
  });
});
