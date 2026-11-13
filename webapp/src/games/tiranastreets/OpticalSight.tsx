import './optical-sight.css';
export function OpticalSight({zoom}:{zoom:number}){
 return <div className="optical-sight" aria-label="Optical scope"><div className="optical-sight-lens"><i/><b/></div><span>{zoom}×</span></div>;
}
