import {beforeEach,describe,expect,it,vi} from 'vitest';
vi.mock('../../utils/api.js',()=>({get:vi.fn()}));
import {get} from '../../utils/api.js';
import {loadPlatformTpgBalance,PlatformBalanceChanged,loadWeaponStoreAccount,purchaseWeapon} from './weaponStoreApi';
describe('Tirana Streets shared wallet visibility',()=>{
 let account:string|null;
 beforeEach(()=>{
  account='test-account';vi.resetAllMocks();
  vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>k==='accountId'?account:null}});
 });
 it('shows the same balance as Wallet including zero without creating a second balance',async()=>{
  vi.mocked(get).mockResolvedValueOnce({balance:4200.5}).mockResolvedValueOnce({balance:0});
  await expect(loadPlatformTpgBalance()).resolves.toBe(4200.5);
  await expect(loadPlatformTpgBalance()).resolves.toBe(0);
  expect(get).toHaveBeenCalledWith('/api/account/self-tpg-balance');
 });
 it('does not fabricate balance on missing account or API failure',async()=>{
  account=null;vi.mocked(get).mockResolvedValueOnce({error:'reauthentication_required'});await expect(loadPlatformTpgBalance()).rejects.toThrow('Sign in');
  expect(get).toHaveBeenCalledWith('/api/account/self-tpg-balance');
  account='test-account';vi.mocked(get).mockResolvedValue({error:'forbidden',balance:5});
  await expect(loadPlatformTpgBalance()).rejects.toThrow('unavailable');
 });
 it('does not show an old balance after account change',async()=>{
  vi.mocked(get).mockImplementation(async()=>{account='new-account';return {balance:50};});
  await expect(loadPlatformTpgBalance()).rejects.toBeInstanceOf(PlatformBalanceChanged);
 });
 it('does not activate a debit or grant as a side effect of showing the wallet',async()=>{
  await expect(loadWeaponStoreAccount()).rejects.toThrow('unavailable');
  await expect(purchaseWeapon('virtual-sample')).rejects.toThrow('unavailable');
  expect(get).not.toHaveBeenCalled();
 });
});
