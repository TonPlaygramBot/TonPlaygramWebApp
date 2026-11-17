import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import EcosystemTopic from './EcosystemTopic.jsx';
import EcosystemGuide from './EcosystemGuide.jsx';
import ProjectAchievementsCard from '../components/ProjectAchievementsCard.jsx';
import { achievements, roadmap } from '../config/ecosystemContent.js';

const show = (element) => renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);
describe('evidence-based delivery snapshot', () => {
  it('links every merged achievement and explains release limitations', () => {
    window.scrollTo = () => {};
    const html = show(<EcosystemTopic topic="achievements" />);
    expect(html.match(/View merged change/g)).toHaveLength(achievements.length);
    expect(html).toContain('Merged does not mean device-tested');
    for (const item of achievements) expect(item.source).toMatch(/^https:\/\/github.com\/TonPlaygramBot\/TonPlaygramWebApp\/pull\/\d+$/);
  });
  it('renders roadmap statuses rather than unmeasured percentages', () => {
    const html = show(<EcosystemTopic topic="roadmap" />);
    expect(html).not.toMatch(/\d+%/);
    expect(html).toContain('Android and iOS beta');
    expect(html).toContain('TON ecosystem');
    expect(roadmap.find(item => item.title === 'TON ecosystem')).toMatchObject({ phase: 'Now', status: 'In progress' });
    expect(html).toContain('mainnet minting remain planned and unapproved');
    expect(html).toContain('not part of the initial TON launch');
    expect(roadmap.every(item => !('progress' in item) && item.status && item.deliverables.length)).toBe(true);
  });
  it('does not label an unverified track release-ready in the printable guide', () => {
    const html = show(<EcosystemGuide />);
    expect(html).not.toContain('release-ready tracks');
    expect(html).toContain('native release validation');
    expect(html).toContain('2026-11-17');
    expect(html.match(/View merged change/g)).toHaveLength(achievements.length);
    for (const item of achievements) expect(html).toContain(item.source);
  });
  it('keeps home navigation without fake progress bars', () => {
    const html = show(<ProjectAchievementsCard />);
    expect(html).toContain('href="/achievements"');
    expect(html).toContain('href="/roadmap"');
    expect(html).not.toMatch(/width:\d+%/);
  });
});
