#include <algorithm>
#include <cmath>
#include <fstream>
#include <iostream>
#include <vector>
int main(int argc,char**argv){
 if(argc<5)return 2;int w=std::stoi(argv[3]),h=std::stoi(argv[4]);
 std::ifstream in(argv[1],std::ios::binary);std::vector<float>d;float v;while(in.read((char*)&v,4))d.push_back(v);
 std::vector<unsigned char>rgb(w*h*3);std::vector<float>z(w*h,2);for(int i=0;i<w*h;i++){rgb[i*3]=12;rgb[i*3+1]=24;rgb[i*3+2]=23;}
 for(size_t i=0;i+11<d.size();i+=12){float x[3],y[3];for(int k=0;k<3;k++){x[k]=(d[i+k*3]+1)*.5f*w;y[k]=(1-d[i+k*3+1])*.5f*h;}
  float den=(y[1]-y[2])*(x[0]-x[2])+(x[2]-x[1])*(y[0]-y[2]);if(std::abs(den)<.00001)continue;
  int l=std::max(0,(int)std::floor(std::min({x[0],x[1],x[2]}))),r=std::min(w-1,(int)std::ceil(std::max({x[0],x[1],x[2]})));
  int t=std::max(0,(int)std::floor(std::min({y[0],y[1],y[2]}))),b=std::min(h-1,(int)std::ceil(std::max({y[0],y[1],y[2]})));
  for(int py=t;py<=b;py++)for(int px=l;px<=r;px++){float a=((y[1]-y[2])*(px+.5f-x[2])+(x[2]-x[1])*(py+.5f-y[2]))/den,beta=((y[2]-y[0])*(px+.5f-x[2])+(x[0]-x[2])*(py+.5f-y[2]))/den,c=1-a-beta;if(a<0||beta<0||c<0)continue;float zz=a*d[i+2]+beta*d[i+5]+c*d[i+8];int p=py*w+px;if(zz>=z[p])continue;z[p]=zz;for(int k=0;k<3;k++)rgb[p*3+k]=std::clamp((int)d[i+9+k],0,255);}
 }
 std::ofstream out(argv[2],std::ios::binary);out<<"P6\n"<<w<<" "<<h<<"\n255\n";out.write((char*)rgb.data(),rgb.size());
}
