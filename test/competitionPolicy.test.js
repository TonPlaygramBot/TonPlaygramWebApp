import fs from 'node:fs';

describe('competition policy disclosure', () => {
  const legalPage = fs.readFileSync('webapp/src/pages/LegalPage.jsx', 'utf8');
  const app = fs.readFileSync('webapp/src/App.jsx', 'utf8');
  const footer = fs.readFileSync('webapp/src/components/Footer.jsx', 'utf8');

  test('is publicly routed and linked from the legal footer', () => {
    expect(app).toContain('path="/competition-policy"');
    expect(footer).toContain('to="/competition-policy"');
  });

  test('does not claim that documentation creates a gambling-law exemption', () => {
    expect(legalPage).toContain('Calling a product a skill game or service does not determine its legal status.');
    expect(legalPage).toContain('it is not a claim that every competition is legally exempt from gambling regulation');
  });

  test('discloses the player-result and standard fee model', () => {
    expect(legalPage).toContain('does not use an algorithm to decide who should win');
    expect(legalPage).toContain('winner receives 90% of the combined entries');
    expect(legalPage).toContain('retains 10% as the disclosed service fee');
  });
});
