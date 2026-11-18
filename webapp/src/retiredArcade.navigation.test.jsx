import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
const app = readFileSync('src/App.jsx','utf8');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
test.each(['2048royale','hextrisbattle','underrunarena'].flatMap(slug=>[slug,`${slug}/lobby`,`${slug}/old-link`]))('retired link %s navigates to Games, never blank game',async(path)=>{
  const slug=path.split('/')[0];
  // Verify the exact production route declaration before exercising Router matching.
  expect(app).toContain(`<Route path="/games/${slug}/*" element={<Navigate to="/games" replace />} />`);
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try {
    await act(async()=>root.render(<MemoryRouter initialEntries={[`/games/${path}`]}><Routes><Route path={`/games/${slug}/*`} element={<Navigate to="/games" replace/>}/><Route path="/games" element={<h1>Games catalogue</h1>}/></Routes></MemoryRouter>));
    expect(host.textContent).toBe('Games catalogue');
  } finally { await act(async()=>root.unmount()); host.remove(); }
});
