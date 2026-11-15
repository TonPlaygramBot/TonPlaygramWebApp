import {afterEach,expect,it,vi} from 'vitest';
import {VehicleRadio} from './VehicleRadio';
const radios:VehicleRadio[]=[];
function fixture(){
  const audios:any[]=[];
  const radio=new VehicleRadio(undefined,()=>{
    const audio:any={src:'',volume:0,preload:'',pause:vi.fn(),load:vi.fn(),removeAttribute(){this.src='';},play(){return new Promise<void>((resolve,reject)=>{this.resolve=resolve;this.reject=reject;});}};
    audios.push(audio);return audio;
  });radios.push(radio);return {radio,audios};
}
afterEach(()=>{for(const radio of radios.splice(0))radio.dispose();vi.useRealTimers();});
it('creates no stream before a tap and stops a live stream for calls, pause and disposal',()=>{
  const {radio,audios}=fixture();radio.setContext(true);expect(audios).toHaveLength(0);
  radio.toggle();expect(audios).toHaveLength(1);audios[0].onplaying();expect(radio.snapshot().status).toBe('playing');
  radio.setContext(false);expect(audios[0].src).toBe('');expect(audios[0].pause).toHaveBeenCalled();expect(radio.snapshot().status).toBe('paused');
  radio.setContext(true);expect(audios).toHaveLength(2);radio.dispose();expect(audios[1].src).toBe('');
});
it('late events from a previous station cannot affect the current live station',async()=>{
  const {radio,audios}=fixture();radio.setContext(true);radio.toggle();const oldPlaying=audios[0].onplaying;
  radio.next();audios[1].onplaying();oldPlaying();audios[0].reject({name:'NotAllowedError'});await Promise.resolve();
  expect(radio.snapshot().station).toBe('club-fm');expect(radio.snapshot().status).toBe('playing');expect(audios[0].src).toBe('');
});
it('autoplay/network failures allow explicit retry without retry loops',async()=>{
  vi.useFakeTimers();const {radio,audios}=fixture();radio.setContext(true);radio.toggle();audios[0].reject({name:'NotAllowedError'});await Promise.resolve();
  expect(radio.snapshot().status).toBe('blocked');radio.toggle();expect(audios).toHaveLength(2);
  vi.advanceTimersByTime(12000);expect(radio.snapshot().status).toBe('unavailable');expect(audios[1].src).toBe('');
  for(let i=0;i<20;i++)radio.setContext(true);expect(audios).toHaveLength(2);
});
