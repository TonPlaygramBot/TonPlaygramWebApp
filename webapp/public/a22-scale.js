(function(){
  const BASE_W = 360; // Galaxy A22 width in Telegram
  const BASE_H = 720; // Galaxy A22 height in Telegram
  function wrapAndScale(){
    let wrap = document.getElementById('a22-wrap');
    if(!wrap){
      wrap = document.createElement('div');
      wrap.id = 'a22-wrap';
      while(document.body.firstChild){
        wrap.appendChild(document.body.firstChild);
      }
      document.body.appendChild(wrap);
      Object.assign(document.body.style,{margin:'0',overflow:'hidden'});
    }
    const scale = Math.min(window.innerWidth/BASE_W, window.innerHeight/BASE_H);
    wrap.style.width = BASE_W+'px';
    wrap.style.height = BASE_H+'px';
    wrap.style.transformOrigin = 'top left';
    wrap.style.transform = 'scale('+scale+')';
  }
  window.addEventListener('resize', wrapAndScale);
  document.addEventListener('DOMContentLoaded', wrapAndScale);
})();
