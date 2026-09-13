"""Independent Shapely footprint audit and before/after corner diagrams.
python tools/render-racing-corners.py GEOMETRY.json OUTPUT.png
The input is emitted by tools/verify-racing-barriers.mjs.
"""
import sys, json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, Polygon as Patch
from shapely.geometry import Polygon, Point
from shapely.ops import unary_union
from shapely import points, distance
from scipy.spatial import cKDTree
import numpy as np

data=json.load(open(sys.argv[1]));fig,axes=plt.subplots(6,2,figsize=(11,23),constrained_layout=True)
fig.patch.set_facecolor('#f4f5f5')
for row,t in enumerate(data['tracks']):
    road=unary_union([Polygon(p[0],p[1:]) for p in t['polygons']])
    after=np.array([[p['x'],p['z']] for p in t['after']])
    distances=distance(points(after),road)
    assert np.min(distances)>.57, (t['id'],'tyre footprint enters asphalt')
    nearest=cKDTree(after).query(after,k=2)[0][:,1]
    assert np.min(nearest)>1.14, (t['id'],'overlapping tyres')
    issue=t['issues'][0];cx,cz=issue['x'],issue['z'];span=23
    for col,version in enumerate(['before','after']):
        ax=axes[row,col];ax.set_facecolor('#dcded4')
        for poly in t['polygons']:
            ax.add_patch(Patch(poly[0],color='#69737a',zorder=1))
            for hole in poly[1:]:ax.add_patch(Patch(hole,color='#dcded4',zorder=2))
        for b in data['buildings']:
            if any(abs(p[0]-cx)<span+10 and abs(p[1]-cz)<span+10 for p in b['p']):ax.add_patch(Patch(b['p'],facecolor='#b6ada7',edgecolor='#8a807a',lw=.5,zorder=3))
        for i,p in enumerate(t[version]):
            if abs(p['x']-cx)>span+1 or abs(p['z']-cz)>span+1:continue
            ax.add_patch(Circle((p['x'],p['z']),.57,facecolor='#b23d36' if i//4%2 else '#f2ebdf',edgecolor='#383e42',lw=.4,zorder=5))
        trace=np.array(t['trace']);ax.plot(trace[:,0],trace[:,1],color='#3ecbd8',lw=1,alpha=.8,zorder=4)
        ax.set_xlim(cx-span,cx+span);ax.set_ylim(cz-span,cz+span);ax.set_aspect('equal');ax.set_xticks([]);ax.set_yticks([])
        ax.set_title(t['id']+' · '+version,fontsize=11,loc='left')
    print(t['id'], 'Shapely asphalt clearance:',round(float(np.min(distances)),3),'m; nearest tyres:',round(float(np.min(nearest)),3),'m')
fig.savefig(sys.argv[2],dpi=130);print(sys.argv[2])
