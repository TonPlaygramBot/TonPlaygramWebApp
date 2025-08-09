import React from 'react';
export default class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(e,i){ if(process.env.NODE_ENV!=='production') console.error('EB',e,i); }
  render(){
    if (this.state.hasError)
      return <div className="p-4 text-center text-text/80">Something went wrong loading this section.</div>;
    return this.props.children;
  }
}
