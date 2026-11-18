import React from 'react';import {createRoot} from 'react-dom/client';
import TonConnect from '@tonconnect/sdk';import {TonConnectUIProvider} from '@tonconnect/ui-react';
import {scopedTonStorage} from '../../../shared/ton/network.mjs';
import TestnetLab from './TestnetLab.jsx';import './testnet.css';
const manifest=import.meta.env.VITE_TON_TESTNET_MANIFEST_URL;
const root=createRoot(document.getElementById('root'));
let valid=false;try{const url=new URL(manifest);valid=url.protocol==='https:'&&url.pathname.endsWith('/ton-testnet-manifest.json');}catch{}
if(!valid){root.render(<main><h1>TON TESTNET lab</h1><p>Wallet connection is disabled. Configure a separate public HTTPS ton-testnet-manifest.json for this testnet lab. No transaction or deposit is available.</p></main>);}
else{const connector=new TonConnect({manifestUrl:manifest,storage:scopedTonStorage(window.localStorage,'testnet')});connector.setConnectionNetwork('-3');root.render(<TonConnectUIProvider connector={connector} restoreConnection={false}><TestnetLab/></TonConnectUIProvider>);}
