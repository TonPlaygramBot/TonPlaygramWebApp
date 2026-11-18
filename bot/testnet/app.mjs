import express from 'express';
import {TESTNET_CAPABILITIES} from '../../shared/ton/capabilities.mjs';
import rateLimit from 'express-rate-limit';
import {createTestnetReader} from './reader.mjs';
import {canonicalRawAddress,requireTestnet} from '../../shared/ton/network.mjs';
export function createTestnetApp({readBalance=createTestnetReader()}={}){
 const app=express();app.disable('x-powered-by');
 app.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
 app.use('/api/testnet',rateLimit({windowMs:60000,limit:30,standardHeaders:'draft-7',legacyHeaders:false}));
 app.get('/api/testnet/status',(_req,res)=>res.json({network:'testnet',chain:'-3',mode:'read-only',transactionsEnabled:false,presale:{status:'not-deployed-or-verified',purchasesEnabled:false},gameBalancesUnchanged:true,capabilities:TESTNET_CAPABILITIES}));
 app.get('/api/testnet/balance',async(req,res)=>{
  try{requireTestnet(req.query.chain);canonicalRawAddress(req.query.address);}catch(error){return res.status(400).json({error:error.message});}
  try{return res.json(await readBalance({chain:req.query.chain,address:req.query.address}));}
  catch{return res.status(502).json({error:'Unable to read testnet. No balance or payment has been credited.'});}
 });
 app.use((_req,res)=>res.status(404).json({error:'No such read-only testnet endpoint'}));
 return app;
}
