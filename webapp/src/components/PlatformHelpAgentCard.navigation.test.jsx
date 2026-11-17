import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import PlatformHelpAgentCard from './PlatformHelpAgentCard.jsx';

describe('Home FAQ launch guidance', () => {
  it('does not promise an unapproved minting or on-chain launch date', () => {
    const html = renderToStaticMarkup(<MemoryRouter><PlatformHelpAgentCard /></MemoryRouter>);
    const page = document.createElement('div');
    page.innerHTML = html;
    expect(page.querySelector('[aria-label="Important TPG launch status"]').textContent)
      .toContain('No date has been committed for token minting or the official on-chain launch.');
    const answers = [...page.querySelectorAll('details')];
    const answer = (question) => answers.find(item => item.querySelector('summary').textContent.includes(question)).querySelector('p').textContent;
    expect(answer('Is TPG live on-chain?')).toContain('No date has been committed');
    expect(answer('When will TPG be minted?')).toContain('No minting date has been committed.');
    expect(answer('When will TPG be minted?')).toContain('planned for TON');
    expect(answer('When will TPG be minted?')).toContain('security, legal, and economic review');
    expect(html).not.toContain('coming weeks');
    expect(html).toContain('TPG is not live on-chain yet');
    expect(html).toContain('not an on-chain token balance');
    expect(html).toContain('Trust only contract details published through official TonPlayGram channels.');
  });
});
