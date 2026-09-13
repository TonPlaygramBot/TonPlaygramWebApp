import json, sys
import numpy as np
import shapely
from shapely.geometry import Polygon
from shapely.ops import unary_union
from scipy.spatial import cKDTree
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection

data=json.load(sys.stdin)
fig,axes=plt.subplots(1,3,figsize=(14,5),layout='constrained')
results=[]
for ax,d in zip(axes,data):
    surface=unary_union([Polygon(p[0],p[1:]) for p in d['polygons']])
    water=unary_union([Polygon(p['outer'],p.get('holes',[])) for p in d['water']])
    buildings=unary_union([Polygon(p) for p in d['buildings'] if len(p)>2])
    xy=np.array([[p['x'],p['z']] for p in d['tyres']]);points=shapely.points(xy)
    result={'id':d['id'],'tyres':len(xy),'asphaltInWaterM2':round(surface.intersection(water).area,4),
            'asphaltInBuildingsM2':round(surface.intersection(buildings).area,4),
            'tyresInAsphalt':int(np.sum(shapely.distance(points,surface)<.57)),
            'tyresInBuildings':int(np.sum(shapely.distance(points,buildings)<.57)),
            'tyresInWater':int(np.sum(shapely.distance(points,water)<.57)),
            'closestTyreCentersM':round(float(cKDTree(xy).query(xy,k=2)[0][:,1].min()),4)}
    results.append(result)
    ax.set_facecolor('#e5ece0')
    ax.add_collection(LineCollection([[r['a'],r['b']] for r in d['roads']],colors='#b5bdba',linewidths=.65))
    for p in d['water']:ax.fill(*np.array(p['outer']).T,color='#a0c6d2')
    for p in d['buildings']:ax.fill(*np.array(p).T,color='#c7b8ac')
    for polygon in d['polygons']:
        ax.fill(*np.array(polygon[0]).T,color='#bd9b68',alpha=.9)
        for hole in polygon[1:]:ax.fill(*np.array(hole).T,color='#e5ece0')
    ax.scatter(xy[:,0],xy[:,1],s=.9,color='#33444b')
    for ramp in d['ramps']:ax.scatter(ramp['x'],ramp['z'],marker='^',s=44,color='#0086ae',edgecolors='white',linewidth=.6,zorder=5)
    p=d['track']['points'][0];ax.scatter(p['x'],p['z'],marker='s',s=35,color='#fff',edgecolors='#152d34',zorder=5)
    x0,z0,x1,z1=d['track']['bounds'];ax.set_xlim(x0-60,x1+60);ax.set_ylim(z1+60,z0-60);ax.set_aspect('equal');ax.set_xticks([]);ax.set_yticks([])
    ax.set_title(d['name']+'\n'+str(round(d['track']['length']/1000,2))+' km · '+str(len(d['ramps']))+' jump ramps',fontsize=11)
    for spine in ax.spines.values():spine.set_visible(False)
fig.suptitle('Racing Royal · new circuits on the stored Tirana map',fontsize=15)
fig.savefig(sys.argv[1],dpi=160)
print(json.dumps(results))
assert all(r['tyresInAsphalt']==r['tyresInBuildings']==r['tyresInWater']==0 and r['closestTyreCentersM']>=1.15 for r in results)
assert all(r['asphaltInWaterM2']==r['asphaltInBuildingsM2']==0 for r in results)
