import cv2,numpy as np,glob,os,sys,json
P=sys.argv[1]
fr=cv2.imread(P+'/assets-src/game-frame.jpg')
KX,KY,KW,KH=784,143.5,1261.5,985
res={}
for f in sorted(glob.glob(P+'/assets-src/items/*.png')):
    im=cv2.imread(f,cv2.IMREAD_UNCHANGED);rgb=im[:,:,:3];a=im[:,:,3]
    best=None
    for s in np.arange(0.43,0.515,0.005):
        t=cv2.resize(rgb,None,fx=s,fy=s,interpolation=cv2.INTER_AREA);m=cv2.resize(a,None,fx=s,fy=s,interpolation=cv2.INTER_AREA)
        m=(m>245).astype(np.uint8)*255
        r=cv2.matchTemplate(fr,t,cv2.TM_SQDIFF,mask=m);r=r/ (m>0).sum()
        v,_,loc,_=cv2.minMaxLoc(r)
        if best is None or v<best[0]:best=(v,s,loc)
    v,s,(x,y)=best;h,w=int(round(a.shape[0]*s)),int(round(a.shape[1]*s))
    res[os.path.basename(f)]=dict(x=(x-KX)/KW*100,y=(y-KY)/KH*100,w=w/KW*100,h=h/KH*100,fx=x,fy=y,fw=w,fh=h,s=s,err=v)
    print(os.path.basename(f),'err %.1f s %.3f frame %d,%d %dx%d'%(v,s,x,y,w,h),flush=True)
json.dump(res,open(P+'/assets-src/items/positions.json','w'),indent=1)
