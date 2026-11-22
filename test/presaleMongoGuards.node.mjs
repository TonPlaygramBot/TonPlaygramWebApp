import test from 'node:test';
import assert from 'node:assert/strict';
import {openIsolatedPresaleOrders as open} from '../bot/presale/isolatedMongoOrders.mjs';
test('production database rejected before contacting client',async()=>{await assert.rejects(open({client:{db(){throw Error('contacted');}},databaseName:'production',purpose:'isolated-presale-preparation'}),/isolated database/);});
test('standalone Mongo refused before writes',async()=>{await assert.rejects(open({client:{db(){return {command:async()=>({logicalSessionTimeoutMinutes:30})};}},databaseName:'tpg_presale_isolated_test',purpose:'isolated-presale-preparation'}),/replica set/);});
