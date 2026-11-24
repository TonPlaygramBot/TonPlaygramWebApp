import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route,Link,Navigate} from 'react-router-dom';
import games from '../src/config/gamesCatalog.js';
const TiranaStreets=React.lazy(()=>import('../src/pages/Games/TiranaStreets.jsx'));
const item=games.find(x=>x.slug==='tiranastreets');
createRoot(document.getElementById('root')).render(<BrowserRouter><React.Suspense fallback="Loading QA…"><Routes>
  <Route path="/games" element={<main><h1>Games integration preview</h1><Link to={item.route}><img alt="" width="240" src={item.image}/>{item.name}</Link></main>}/>
  <Route path="/games/tiranastreets/lobby" element={<TiranaStreets/>}/>
  <Route path="/games/tiranastreets" element={<TiranaStreets/>}/>
  <Route path="*" element={<Navigate to="/games" replace/>}/>
</Routes></React.Suspense></BrowserRouter>);
