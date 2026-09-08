/** Keeps an outstanding browser permission request exclusive even after cancel.
 * Late capture results are stopped before they can be published or negotiated. */
export function createCaptureGuard(){
  let generation=0,busy=false;
  return {
    begin(){if(busy)return null;busy=true;const ticket=++generation;return ticket;},
    current(ticket){return ticket===generation;},
    cancel(){generation++;},
    finish(){busy=false;},
    adopt(ticket,stream){if(ticket!==generation){stream.getTracks().forEach(t=>t.stop());return false;}return true;},
    get busy(){return busy;}
  };
}
