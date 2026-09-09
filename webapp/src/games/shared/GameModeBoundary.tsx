import {Component,type ReactNode} from 'react';
/** A failed optional game chunk must not turn the entire Games route blank. */
export class GameModeBoundary extends Component<{children:ReactNode;onBack:()=>void}, {error:string}> {
  state={error:''};
  static getDerivedStateFromError(error:unknown){return {error:error instanceof Error?error.message:'The game could not load.'};}
  render(){
    if(!this.state.error)return this.props.children;
    return <section role="alert" style={{padding:24,background:'#102b35',color:'#fff4dd',minHeight:'100vh'}}>
      <h1>This game mode could not open</h1><p>{this.state.error}</p>
      <button onClick={this.props.onBack}>Back to game menu</button>{' '}
      <button onClick={()=>window.location.reload()}>Reload game files</button>
    </section>;
  }
}
