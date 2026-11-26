import {Component,lazy,Suspense,type ComponentProps} from 'react';
type Props=ComponentProps<typeof import('./CityMap').CityMap>;
const load=()=>import('./CityMap').then(module=>({default:module.CityMap}));

/** Map controls and guide UI load only when opened. The playable city data is
 * still shared with the renderer and simulation, without a duplicate snapshot. */
export class CityMap extends Component<Props,{failed:boolean}>{
  state={failed:false};
  private View=lazy(load);
  static getDerivedStateFromError(){return {failed:true};}
  private retry=()=>{this.View=lazy(load);this.setState({failed:false});};
  render(){
    if(this.state.failed)return <div role="alert"><p>The city map could not load. Check your connection and try again.</p><button onClick={this.retry}>Retry map</button></div>;
    const View=this.View;
    return <Suspense fallback={<p role="status">Loading city map…</p>}><View {...this.props}/></Suspense>;
  }
}
