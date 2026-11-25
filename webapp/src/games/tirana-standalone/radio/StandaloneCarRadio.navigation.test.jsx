import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {StandaloneCarRadio} from './StandaloneCarRadio';

let host,root;
function render(element){
  if(!root){host=document.createElement('div');document.body.append(host);root=createRoot(host);}
  act(()=>root.render(element));
}
function unmount(){if(root)act(()=>root.unmount());root=null;host?.remove();}
function clickPlay(){act(()=>host.querySelector('button[aria-label="Play radio"]').click());}
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
afterEach(()=>{unmount();vi.unstubAllGlobals();vi.restoreAllMocks();window.localStorage.clear();});
function fixture(){
  const audio=[];
  vi.stubGlobal('Audio',class {
    constructor(){this.pause=vi.fn();this.load=vi.fn();this.play=vi.fn(()=>Promise.resolve());audio.push(this);}
    removeAttribute(){this.src='';}
  });
  return audio;
}
it('keeps the radio silent before a tap and releases the media source immediately on leaving the car or pausing',()=>{
  const audio=fixture();render(<StandaloneCarRadio active={false}/>);
  expect(host.querySelector('section[aria-label="Live radio"]')).toBeNull();
  render(<StandaloneCarRadio active/>);
  expect(audio).toHaveLength(0);
  clickPlay();
  expect(audio).toHaveLength(1);
  expect(audio[0].src).toBe('https://live.top-media.al/tar');
  render(<StandaloneCarRadio active={false}/>);
  expect(audio[0].src).toBe('');
  expect(audio[0].pause).toHaveBeenCalledOnce();
  render(<StandaloneCarRadio active/>);
  expect(audio).toHaveLength(2);
  unmount();
  expect(audio[1].src).toBe('');
});
it('stops native media when the document becomes hidden, without a render from the game',()=>{
  vi.spyOn(document,'hidden','get').mockReturnValue(false);
  const audio=fixture();
  render(<StandaloneCarRadio active/>);
  clickPlay();
  vi.spyOn(document,'hidden','get').mockReturnValue(true);
  act(()=>document.dispatchEvent(new Event('visibilitychange')));
  expect(audio[0].src).toBe('');
});
