(() => {
  'use strict';
  const stage = document.querySelector('.neighborhood-stage');
  const canvas = document.getElementById('neighborhood-canvas');
  if (!stage || !canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const hitCanvas=document.createElement('canvas');hitCanvas.width=1000;hitCanvas.height=640;
  const hitCtx=hitCanvas.getContext('2d',{willReadFrequently:true});
  let hitShop=-1;
  const signs = Array.from(stage.querySelectorAll('[data-place]'));
  const buildingSize = 1.02;
  const proportions = {
    miniatures: { width: 1.18, height: .68 }, printing: { width: 1.17, height: .67 },
    web3: { width: 1.2, height: .62 }, mini_projects: { width: 1.18, height: .68 },
    ai: { width: 1.18, height: .66 }, games: { width: 1.1, height: .86 }
  };
  const roofs = ['#7c9b76', '#a7896c', '#758da6', '#a2956e', '#829c9a', '#a18a9e'];
  // Fixed plots: adding a module fills a vacant lot instead of moving its neighbors.
  const initialOrder = Array.from({ length: 12 }, (_, i) => i);
  // Start with one compact block; later modules occupy the surrounding vacant lots.
  const centralPlots = [
    [210,60], [350,60], [690,305], [485,450], [355,450], [155,305],
    [160,210], [660,210], [160,420], [660,420], [545,60], [650,60]
  ];
  function plotPosition(plot) {
    const [x, baseY] = centralPlots[plot] || [160 + ((plot - 12) % 5) * 120, 590 + Math.floor((plot - 12) / 5) * 120];
    return { x, baseY };
  }
  // Keep the asphalt in front of the shops so roofs cannot hide it.
  const streetY = 500;
  const doorOffsets = { miniatures: 14.5, printing: 68.5, web3: 60.5, mini_projects: 12.5, ai: 64.5, games: 66.5 };
  const usedPlots = new Set();
  const shops = signs.map((sign, i) => {
    const configured = sign.dataset.plot === undefined || sign.dataset.plot === '' ? NaN : Number(sign.dataset.plot);
    let plot = Number.isInteger(configured) && configured >= 0 && !usedPlots.has(configured) ? configured : initialOrder.find(n => !usedPlots.has(n));
    if (plot === undefined) { plot = 12; while (usedPlots.has(plot)) plot++; }
    usedPlots.add(plot);
    const { x, baseY } = plotPosition(plot);
    const originalProportions = proportions[sign.dataset.place] || { width: 1.12, height: .75 };
    const proportionsForShop = { width: originalProportions.width * buildingSize, height: originalProportions.height * buildingSize };
    const entryX = x + ((doorOffsets[sign.dataset.place] || 60) - 39) * proportionsForShop.width;
    // Rear shops reach the avenue through the gaps between the front shops.
    const corridorX = plot===2 ? 757 : plot===5 ? 85 : entryX;
    return { id: sign.dataset.place, plot, x, entryX, corridorX, y: baseY - 60,
      baseY, proportions: proportionsForShop, roof: roofs[i % roofs.length], scale: 0.52, entrance: baseY + 12 };
  });
  // The CBD curb meets the inner ring; the two rings share a left/right axis.
  const cbdBlock={left:292,right:550,top:241,bottom:284};
  const roadAxis=(cbdBlock.left+cbdBlock.right)/2;
  const roadLeft=85,roadRight=2*roadAxis-roadLeft,roadTop=105;
  const innerRing={left:cbdBlock.left-15,right:cbdBlock.right+15,top:cbdBlock.top-15,bottom:cbdBlock.bottom+15,width:24};
  const rings=[{left:roadLeft,right:roadRight,top:roadTop,bottom:streetY,width:28,radius:32},innerRing];
  const roadBends=[];
  const roads=[];
  rings.forEach(r=>{
    const radius=r.radius||0;
    roads.push(
      {x1:r.left+radius,y1:r.top,x2:r.right-radius,y2:r.top,width:r.width},
      {x1:r.left+radius,y1:r.bottom,x2:r.right-radius,y2:r.bottom,width:r.width},
      {x1:r.left,y1:r.top+radius,x2:r.left,y2:r.bottom-radius,width:r.width},
      {x1:r.right,y1:r.top+radius,x2:r.right,y2:r.bottom-radius,width:r.width}
    );
    if(radius) [[r.left+radius,r.top+radius,Math.PI],[r.right-radius,r.top+radius,-Math.PI/2],[r.right-radius,r.bottom-radius,0],[r.left+radius,r.bottom-radius,Math.PI/2]].forEach(([x,y,start])=>roadBends.push({x,y,start,radius,width:r.width}));
  });
  roads.push(
    {x1:roadAxis,y1:roadTop,x2:roadAxis,y2:innerRing.top,width:22},
    {x1:roadAxis,y1:innerRing.bottom,x2:roadAxis,y2:streetY,width:22},
    {x1:roadLeft,y1:innerRing.top,x2:innerRing.left,y2:innerRing.top,width:22},
    {x1:innerRing.right,y1:innerRing.top,x2:roadRight,y2:innerRing.top,width:22}
  );
  // Continuous paved shopfronts turn separate plots into walkable street segments.
  const promenades=[
    {x1:165,y1:79,x2:399,y2:79,width:24},
    {x1:366,y1:474,x2:593,y2:474,width:24},
    {x1:729,y1:260,x2:729,y2:365,width:28},
    {x1:113,y1:265,x2:113,y2:350,width:28}
  ];
  function onRoad(x,y) {
    return roadBends.some(b=>{const angle=Math.atan2(y-b.y,x-b.x),t=(angle-b.start+Math.PI*4)%(Math.PI*2);return t<=Math.PI/2&&Math.abs(Math.hypot(x-b.x,y-b.y)-b.radius)<=b.width/2;})||[...roads,...promenades].some(r=>x>=Math.min(r.x1,r.x2)-r.width/2 && x<=Math.max(r.x1,r.x2)+r.width/2 && y>=Math.min(r.y1,r.y2)-r.width/2 && y<=Math.max(r.y1,r.y2)+r.width/2);
  }
  // Extra foreground land leaves space in front of the southern shopfronts.
  const foregroundExtension=80;
  const baseWorldHeight=640+foregroundExtension;
  const worldHeight = Math.max(baseWorldHeight, ...shops.map(s => s.baseY + 160));
  const viewScale = Math.min(1, baseWorldHeight / worldHeight);
  const viewLeft = (1000 - 1000 * viewScale) / 2;
  // The chosen 27-degree view is fixed for the finished homepage.
  const camera={a:.68,b:-.68,c:.34,d:.34};
  const determinant=()=>camera.a*camera.d-camera.b*camera.c;
  const project=(x,y,z=0)=>({x:500+(x-400)*camera.a+(y-260)*camera.b,y:280+(x-400)*camera.c+(y-260)*camera.d-z});
  const unproject=(x,y)=>({x:400+((x-500)*camera.d-(y-280)*camera.b)/determinant(),y:260+((y-280)*camera.a-(x-500)*camera.c)/determinant()});
  const depth=(x,y)=>x*camera.c+y*camera.d;
  function positionSigns() { shops.forEach((s,i)=>{
    const half=43*s.proportions.width, back=s.baseY-61*buildingSize, front=s.baseY+6;
    const height=({miniatures:78,printing:74,web3:84,mini_projects:70,ai:84,games:64}[s.id]||65)*s.proportions.height;
    const corners=[project(s.x-half,back,height),project(s.x+half,back,height),project(s.x+half,back),project(s.x+half,front),project(s.x-half,front),project(s.x-half,front,height)];
    const left=Math.min(...corners.map(p=>p.x)),top=Math.min(...corners.map(p=>p.y));
    const width=Math.max(...corners.map(p=>p.x))-left,heightPx=Math.max(...corners.map(p=>p.y))-top;
    Object.assign(signs[i].style,{
      left:`${(viewLeft+left*viewScale)/1000*100}%`,top:`${top*viewScale/640*100}%`,
      width:`${width*viewScale/1000*100}%`,height:`${heightPx*viewScale/640*100}%`,
      clipPath:`polygon(${corners.map(p=>`${(p.x-left)/width*100}% ${(p.y-top)/heightPx*100}%`).join(',')})`,
      zIndex:String(Math.round(depth(s.x,s.baseY)*10))
    });
  }); }
  positionSigns();
  const expansion=Math.max(0,worldHeight-baseWorldHeight);
  const land=[[100,-40],[260,-40],[260,-52],[510,-52],[510,-36],[680,-36],[680,-14],[760,-14],[760,28],[790,28],[790,440],[772,440],[772,505],[730,505],[730,550],[580,550],[580,570],[365,570],[365,554],[190,554],[190,530],[92,530],[92,502],[45,502],[45,425],[25,425],[25,220],[38,220],[38,30],[70,30],[70,-12],[100,-12]].map(([x,y])=>[x,y+(y>=502?foregroundExtension:0)+(y>=425?expansion:0)]);
  function onLand(x, y) {
    let inside = false;
    for (let i = 0, j = land.length - 1; i < land.length; j = i++) {
      const [xi, yi] = land[i], [xj, yj] = land[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function inBuilding(x,y,margin=0) {
    return shops.some(s=>x>s.x-43*s.proportions.width-margin && x<s.x+43*s.proportions.width+margin && y>s.baseY-64*buildingSize-margin && y<s.baseY+3+margin);
  }
  shops.forEach(s=>{
    const targetY=s.plot<2?roadTop:streetY;
    const points=[{x:s.entryX,y:s.entrance},{x:s.corridorX,y:s.entrance},{x:s.corridorX,y:(s.plot===2||s.plot===5)?s.entrance:targetY}];
    const ideal=points.slice(1).map((p,i)=>({x1:points[i].x,y1:points[i].y,x2:p.x,y2:p.y,width:20}));
    const clear=ideal.every(r=>{
      const length=Math.hypot(r.x2-r.x1,r.y2-r.y1),steps=Math.max(1,Math.ceil(length/3));
      for(let i=0;i<=steps;i++) {const x=r.x1+(r.x2-r.x1)*i/steps,y=r.y1+(r.y2-r.y1)*i/steps;if(!onLand(x,y)||inBuilding(x,y,5)) return false;}
      return true;
    });
    let connection=ideal;
    if(!clear) {
      // Future shops get a road around existing buildings rather than through them.
      const w=160,h=Math.ceil(worldHeight/5),start=Math.floor(s.entrance/5)*w+Math.floor(s.entryX/5);
      const previous=new Map([[start,null]]),queue=[start];let goal=null;
      for(let i=0;i<queue.length;i++) {
        const cell=queue[i],cx=cell%w,cy=Math.floor(cell/w),x=cx*5+2.5,y=cy*5+2.5;
        if(onRoad(x,y)) {goal=cell;break;}
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx=cx+dx,ny=cy+dy,next=ny*w+nx,px=nx*5+2.5,py=ny*5+2.5;
          if(nx<0||nx>=w||ny<0||ny>=h||previous.has(next)||!onLand(px,py)||inBuilding(px,py,5)) continue;
          previous.set(next,cell);queue.push(next);
        }
      }
      if(goal!==null) {
        const route=[];for(let cell=goal;cell!==null;cell=previous.get(cell)) route.push({x:(cell%w)*5+2.5,y:Math.floor(cell/w)*5+2.5});
        route.reverse();route.unshift(points[0]);connection=[];
        for(let i=1;i<route.length;i++) connection.push({x1:route[i-1].x,y1:route[i-1].y,x2:route[i].x,y2:route[i].y,width:20});
      }
    }
    roads.push({x1:s.entryX,y1:s.baseY+1,x2:s.entryX,y2:s.entrance,width:20},...connection);
  });
  const player = { x: 300, y: streetY, facing:'front',angle:Math.PI/2,targetAngle:Math.PI/2,walkDistance:0 };
  const detail = document.getElementById('neighborhood-detail');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let path = [], visiting = null, selected = null, animation = null, previousTime = 0;
  let dark = false;
  let autoEnabled=!reducedMotion.matches, automatic=false, idleTimer=null, lastPaint=0, lastWander=-1;
  let lastInteraction=performance.now();
  const idleRemaining=()=>Math.max(0,10000-(performance.now()-lastInteraction));
  function cancelIdle() {if(idleTimer!==null) {clearTimeout(idleTimer);idleTimer=null;}}
  function scheduleWander(delay=2200) {
    cancelIdle();
    if(!autoEnabled||document.hidden||typeof setTimeout!=='function') return;
    idleTimer=setTimeout(wander,Math.max(delay,idleRemaining()));
  }
  function wander() {
    idleTimer=null;
    if(!autoEnabled||document.hidden) return;
    if(path.length) {scheduleWander(500);return;}
    const lawns=[[200,180],[220,350],[620,400],[650,180],[590,380],[185,420],[240,220],[610,340]].filter(([x,y])=>!blocked(x,y)&&!onRoad(x,y));
    const destinations=Math.random()<.7&&lawns.length?lawns:[
      [150,streetY],[610,streetY],[roadLeft,205],[roadRight,390],
      [roadLeft,streetY],[roadRight,roadTop],
      ...shops.map(s=>[s.entryX,s.entrance])
    ];
    const candidates=destinations.map((p,i)=>({p,i})).filter(({p,i})=>i!==lastWander&&Math.hypot(player.x-p[0],player.y-p[1])>100);
    while(candidates.length) {
      const index=Math.floor(Math.random()*candidates.length),candidate=candidates.splice(index,1)[0];
      if(!candidate) break;
      const next=route(...candidate.p);
      if(next.length) {lastWander=candidate.i;go(...candidate.p,null,true);return;}
    }
    scheduleWander(3000);
  }
  function manualControl() {
    lastInteraction=performance.now();
    cancelIdle();
    if(automatic) {path=[];visiting=null;if(animation) cancelAnimationFrame(animation);animation=null;automatic=false;}
    stage.dataset.walkMode='manual';
    scheduleWander(10000);
  }
  const rect = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  function polygon(points, color) {
    ctx.fillStyle = color; ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(Math.round(p.x), Math.round(p.y)) : ctx.moveTo(Math.round(p.x), Math.round(p.y)));
    ctx.closePath(); ctx.fill();
    if(hitCtx&&hitShop>=0) {
      hitCtx.fillStyle=`rgb(${hitShop+1},0,0)`;hitCtx.beginPath();
      points.forEach((p,i)=>i?hitCtx.lineTo(Math.round(p.x),Math.round(p.y)):hitCtx.moveTo(Math.round(p.x),Math.round(p.y)));
      hitCtx.closePath();hitCtx.fill();
    }
  }
  function ground(points, color, z = 0) { polygon(points.map(([x,y]) => project(x,y,z)),color); }
  // Every block has a lit top, a warm front and a shaded right side.
  function block(x, y, w, d, h, colors, z = 0) {
    const a=project(x,y,z), b=project(x+w,y,z), c=project(x+w,y+d,z), e=project(x,y+d,z);
    const A=project(x,y,z+h), B=project(x+w,y,z+h), C=project(x+w,y+d,z+h), E=project(x,y+d,z+h);
    polygon([e,c,C,E],colors[1]); polygon([b,c,C,B],colors[2]); polygon([A,B,C,E],colors[0]);
    if(h<8 && w>20 && d>12) {
      ctx.strokeStyle='#f3f3df65';ctx.lineWidth=1;ctx.beginPath();
      ctx.moveTo(Math.round(E.x),Math.round(E.y));ctx.lineTo(Math.round(A.x),Math.round(A.y));ctx.lineTo(Math.round(B.x),Math.round(B.y));ctx.stroke();
    }
  }
  function tree(x,y,kind='pine') {
    const trunk=['#9a8970','#7b6c56','#5c5848'];
    block(x-3,y-3,6,6,22,trunk);
    if(kind==='ginkgo') {
      const gold=['#edce62','#ceaa43','#ab8c36'];
      block(x-20,y-13,36,28,14,gold,23);
      block(x-12,y-18,26,34,15,['#f3d77b','#ddbd59','#b79c43'],34);
      block(x-23,y-7,15,19,11,gold,32);
      block(x+8,y-7,15,18,10,gold,30);
    } else {
      [[37,19,16],[29,30,16],[19,42,14],[9,53,10]].forEach(([w,z,h])=>block(x-w/2,y-w/2,w,w,h,['#73927a','#4d735c','#355641'],z));
    }
  }
  function landmark(x,y,kind) {
    const steel=['#d1e5ed','#79a9bf','#426c89'];
    const origin=project(x,y),scale=kind==='zun'?.76:kind==='guomao'?.64:.65;
    ctx.save();ctx.translate(origin.x,origin.y);ctx.scale(scale,scale);ctx.translate(-origin.x,-origin.y);
    if(kind==='cctv') {
      // Reference: OMA project photographs and the Arup / CTBUH exterior view.
      // An asymmetric spatial loop, including the low podium, not a planar arch.
      const facade=['#c0deeb','#6eabc4','#356680'];
      function diagrid(q,columns,rows) {
        const point=(u,v)=>({x:(q[0].x*(1-u)+q[1].x*u)*(1-v)+(q[3].x*(1-u)+q[2].x*u)*v,y:(q[0].y*(1-u)+q[1].y*u)*(1-v)+(q[3].y*(1-u)+q[2].y*u)*v});
        const segment=(a,b)=>{ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();};
        ctx.strokeStyle='#28536fa6';ctx.lineWidth=.9;
        for(let row=0;row<rows;row++) for(let col=0;col<columns;col++) {
          segment(point(col/columns,row/rows),point((col+1)/columns,(row+1)/rows));
          segment(point((col+1)/columns,row/rows),point(col/columns,(row+1)/rows));
        }
      }
      function tower(bx,by,tx,ty,w,d,h) {
        const base=[[bx,by],[bx+w,by],[bx+w,by+d],[bx,by+d]].map(([u,v])=>project(x+u,y+v));
        const top=[[tx,ty],[tx+w,ty],[tx+w,ty+d],[tx,ty+d]].map(([u,v])=>project(x+u,y+v,h));
        const side=[base[1],base[2],top[2],top[1]],front=[base[3],base[2],top[2],top[3]];
        polygon(side,facade[2]);polygon(front,facade[1]);polygon(top,facade[0]);
        diagrid(side,2,7);diagrid(front,2,7);
      }
      // The base closes the loop behind the opening; each tower occupies a different depth.
      block(x-8,y-9,91,29,10,facade);
      block(x+8,y+1,56,21,4,facade,10);
      tower(64,-12,45,1,24,22,75);
      tower(-12,14,8,-3,24,24,92);
      // The high tower continues into an unequal, folded overhead volume.
      const plan=[[8,-3],[45,-3],[45,1],[69,1],[69,29],[8,29]];
      const topZ=u=>93-(u-8)*18/61;
      const bottomZ=u=>59-(u-8)*6/61;
      const lower=plan.map(([u,v])=>project(x+u,y+v,bottomZ(u)));
      const upper=plan.map(([u,v])=>project(x+u,y+v,topZ(u)));
      polygon(lower,'#2b5269');
      for(let i=0;i<plan.length;i++) {
        const j=(i+1)%plan.length;
        if(plan[j][0]<plan[i][0] || plan[j][1]>plan[i][1]) {
          const wall=[lower[i],lower[j],upper[j],upper[i]];
          polygon(wall,i%2?'#39738f':'#78b3ca');diagrid(wall,Math.max(1,Math.ceil(Math.hypot(plan[j][0]-plan[i][0],plan[j][1]-plan[i][1])/15)),2);
        }
      }
      polygon(upper,'#bfdde6');
    } else if(kind==='guomao') {
      // A stepped Guomao tower group, kept lower than the slender China Zun.
      block(x-15,y-12,30,27,66,steel);
      block(x-12,y-9,24,21,9,steel,66);
      block(x-9,y-6,18,15,4,['#e5e9df','#abc0c1','#7895a1'],75);
      block(x+17,y+5,17,19,43,steel);
      for(let z=8;z<66;z+=7) {
        block(x-15,y+15,30,1,1,['#dbe5e1','#b2c8ca','#849eaa'],z);
        block(x+15,y-10,1,23,1,['#dbe5e1','#b2c8ca','#849eaa'],z);
      }
    } else {
      // China Zun: wider foot and crown, a narrower middle.
      for(let n=0;n<12;n++) {
        const w=22+Math.abs(n-5.5)*1.8;
        block(x-w/2,y-w/2,w,w,10,steel,n*9);
        if(n%2===0) block(x-w/2,y+w/2, w,1,1,['#dde7df','#afc2c3','#809ca5'],n*9+7);
      }
      block(x-15,y-15,30,30,3,['#e0e7dd','#aec1c0','#839da5'],108);
    }
    ctx.restore();
  }
  // A shallow skyline ribbon, rather than several deep rows of towers.
  // Beijing panorama reference: China Zun, CCTV's loop and stepped Guomao silhouettes.
  const cbdBuildings=[
    {x:305,y:260,w:16,d:10,h:25,tone:2},
    {x:329,y:260,w:15,d:10,h:39,tone:0},
    {x:358,y:260,kind:'zun'},
    {x:386,y:260,w:14,d:10,h:46,tone:1},
    {x:408,y:252,kind:'cctv'},
    {x:470,y:260,w:13,d:10,h:43,tone:2},
    {x:497,y:260,kind:'guomao'},
    {x:534,y:260,w:16,d:10,h:52,tone:0}
  ];
  function cbdTower(t) {
    if(t.kind) {landmark(t.x,t.y,t.kind);return;}
    const colors=[['#c3e3ee','#78b1ca','#406e90'],['#d9e7ed','#a0bfce','#648aa3'],['#bed6df','#82a6b8','#52778f']][t.tone];
    const x=t.x-t.w/2,y=t.y-t.d/2;
    block(x-3,y-3,t.w+6,t.d+6,4,['#dbe9ec','#a5bcc5','#7f9eac']);
    block(x,y,t.w,t.d,t.h,colors,4);
    block(x+2,y+2,t.w-4,t.d-4,5,colors,t.h+4);
    block(x+4,y+4,t.w-8,t.d-8,2,['#e8f3f4','#bad2dc','#8bafc0'],t.h+9);
    for(let z=10;z<t.h;z+=7) {
      block(x,y+t.d,t.w,1,1,['#e6f3f4','#bedbe5','#8ab3c8'],z);
      block(x+t.w,y,1,t.d,1,['#c4e3ec','#8db5c9','#648ea6'],z);
    }
    for(let n=5;n<t.w;n+=6) block(x+n,y+t.d+1,1,1,t.h-7,['#d3e9ed','#a4cddc','#739fb6'],8);
  }
  function shop(s,index) {
    const {width:wide,height:low}=s.proportions;
    const x=s.x-39*wide,y=s.baseY-58*buildingSize;
    const identities={
      miniatures:{wall:['#fff1d9','#e6ceb0','#bda58d'],trim:['#b7cab8','#809f8b','#567865'],metal:['#a0ab99','#657c6d','#42594e'],glass:['#e2f0df','#a5c8bd','#729c94'],accent:['#e8a28d','#c97562','#9b514c'],sign:['#fff3de','#f4dfbd','#c0a17e'],ink:'#664c43'},
      printing:{wall:['#d8e2e7','#afc0cb','#7c929f'],trim:['#667d8c','#455d70','#2e4255'],metal:['#718797','#354d60','#243749'],glass:['#d5eff2','#90c4cf','#5e99ab'],accent:['#ffc180','#ed9551','#ba663a'],sign:['#ffd49a','#ffb965','#c97d3e'],ink:'#293e50'},
      web3:{wall:['#dce1f5','#abb7d8','#778bb4'],trim:['#9bace0','#677fb9','#455c96'],metal:['#7584bd','#46578d','#303d6e'],glass:['#bdeef0','#68cbd2','#3598ac'],accent:['#aaa6ef','#7974c6','#57559c'],sign:['#6d79bd','#354574','#26345c'],ink:'#a3f4e9'},
      mini_projects:{wall:['#f0eddb','#d5d7bc','#a1b49b'],trim:['#95ad91','#5d856d','#416653'],metal:['#7b9685','#466956','#304b40'],glass:['#dcebe0','#9abfb5','#67928a'],accent:['#bacb87','#8fa65d','#627e47'],sign:['#f4f2de','#e7ebcc','#b3c59c'],ink:'#365d48'},
      ai:{wall:['#edf0fc','#cdd1ed','#a1abc9'],trim:['#a9acdf','#8488bd','#606b9b'],metal:['#9ca5cb','#66759e','#46577e'],glass:['#e6f9f5','#a4d9d5','#71b8be'],accent:['#b7b3ed','#9390d0','#706eaa'],sign:['#f2f0ff','#e2dff8','#aaa6d5'],ink:'#56528c'},
      games:{wall:['#e8ddea','#c8aecb','#977d9f'],trim:['#c3a6cd','#9275a7','#6c527e'],metal:['#8a7b9e','#554461','#3c334c'],glass:['#e4ddf6','#b0a2da','#8175b8'],accent:['#f4a4bf','#d8759d','#ab4f80'],sign:['#8c709b','#4a385e','#352943'],ink:'#ffe3a0'}
    };
    const identity=identities[s.id]||identities.games;
    const stone=identity.wall,brick=identity.trim,darkMetal=identity.metal,glass=identity.glass,accent=identity.accent;
    const B=(a,b,w,d,h,c,z=4)=>block(x+a*wide,y+b*buildingSize,w*wide,d*buildingSize,h*low,c,z*low);
    const glazing=(a,b,w,h,z=8)=>{
      B(a-1,b,w+2,1,h+2,darkMetal,z-1);
      B(a,b+1,w,1,h,glass,z);B(a,b+2,w,1,1,['#e5e9d9','#ccdad0','#a8beb5'],z+h-1);
      B(a+2,b+2,2,1,h-4,['#e5ede0','#bdd6cc','#93b8b2'],z+2);
      for(let n=12;n<w;n+=15) B(a+n,b+1,1.5,1,h,darkMetal,z);
    };
    const door=(a,b,h=27)=>{
      B(a-1,b,17,3,h+2,stone);B(a,b+1,15,2,h,darkMetal);glazing(a+3,b+3,9,h-8,10);
      B(a+10,b+5,1.5,1,6,['#deccaa','#c3ae88','#9f8c68'],9);
      B(a-2,b+1,19,7,2,['#e1e3d2','#bcc6b5','#97aa99'],1);
    };
    B(-4,-3,87,65,3,['#d2d6c8','#abb6a7','#869a88'],0);
    function cap(a,b,w,d,z) {
      B(a,b,w,d,4,accent,z);
      B(a,b,w,2,4,stone,z+4);B(a+w-2,b,2,d,4,stone,z+4);
      // Raised roof seams, louvered plant equipment and a planted parapet.
      const unitW=Math.min(18,w-12),unitD=Math.min(12,d-14);
      B(a+6,b+7,unitW,unitD,4,darkMetal,z+4);
      B(a+7,b+8,unitW-2,unitD-2,1,stone,z+8);
      for(let k=3;k<unitW-2;k+=4) B(a+6+k,b+8,1,unitD-2,1,darkMetal,z+9);
      for(let k=26;k<w-4;k+=10) B(a+k,b+4,1,d-8,1,stone,z+4);
      if(w>40) {
        B(a+w-18,b+5,12,7,3,brick,z+4);
        B(a+w-17,b+6,10,5,3,['#a2b99b','#77996e','#52794e'],z+7);
      }
    }
    const P=(a,b,z)=>project(x+a*wide,y+b*buildingSize,z*low);
    function sculptedRoof(plan,z,h,colors) {
      for(let n=0;n<plan.length;n++) {
        const a=plan[n],b=plan[(n+1)%plan.length];
        if(b[0]<a[0]||b[1]>a[1]) polygon([P(...a,z),P(...b,z),P(...b,z+h),P(...a,z+h)],b[1]>a[1]?colors[2]:colors[1]);
      }
      polygon(plan.map(([a,b])=>P(a,b,z+h)),colors[0]);
    }
    function coin(a,b,z,r) {
      const ring=(radius,offset)=>Array.from({length:16},(_,n)=>P(a+Math.cos(n*Math.PI/8)*radius,b+offset,z+Math.sin(n*Math.PI/8)*radius*1.2));
      polygon(ring(r,-5),'#b67426');
      const front=ring(r,0),rear=ring(r,-5);
      for(let n=0;n<8;n++) polygon([rear[n],rear[n+1],front[n+1],front[n]],'#c58a35');
      polygon(front,'#f4c15d');polygon(ring(r-2.5,0),'#ffe0a0');polygon(ring(r-4,0),'#eeb04e');
      const at=P(a,b+.5,z-r*.47);
      ctx.save();ctx.translate(at.x,at.y);ctx.transform(1,.5,0,1,0,0);ctx.font='800 28px monospace';ctx.textAlign='center';ctx.fillStyle='#fff1c7';ctx.fillText('₿',0,0,r*wide);ctx.restore();
    }
    let f={x:0,y:60,w:78,z:24};
    if(s.id==='miniatures') {
      // A miniature exhibition pavilion, with a rooftop diorama on its low wing.
      B(0,0,25,58,43,stone);B(25,23,53,35,26,stone);
      cap(-2,-2,29,62,47);cap(23,21,57,39,30);
      glazing(30,59,43,19);door(7,60);
      B(33,28,38,22,3,brick,38);B(35,30,34,18,1,['#a5c29b','#87aa7a','#62875d'],41);
      B(39,34,9,9,11,stone,42);B(38,33,11,11,3,accent,53);
      B(53,33,7,8,17,glass,42);B(61,37,5,6,7,stone,42);
      B(34,44,34,2,7,glass,42);f.z=22;
    } else if(s.id==='printing') {
      // The workshop itself is a giant open-frame 3D printer.
      B(0,0,82,58,29,brick);glazing(4,59,47,20);door(62,60,26);
      B(-3,-3,88,64,4,darkMetal,33);
      B(9,5,64,42,3,stone,37);B(15,10,52,31,2,glass,40);
      for(const a of [11,67]) for(const b of [7,41]) B(a,b,4,4,43,darkMetal,41);
      B(10,6,62,5,5,accent,84);B(10,40,62,5,5,accent,84);
      B(10,7,5,37,4,darkMetal,84);B(67,7,5,37,4,darkMetal,84);
      B(14,25,53,3,3,stone,74);B(37,22,9,8,11,accent,65);B(40,25,3,3,6,darkMetal,59);
      [24,18,12].forEach((w,n)=>B(41-w/2,27-w/2,w,w,5,accent,43+n*5));
      B(73,15,5,17,19,accent,48);B(74,18,3,11,11,darkMetal,52);f.z=22;f.w=82;
    } else if(s.id==='web3') {
      // A blockchain exchange pavilion: coin monument, linked cubes and faceted ETH prism.
      B(0,0,78,58,25,stone);B(0,0,26,40,18,brick,29);B(54,2,24,38,12,stone,29);
      cap(-2,-2,30,44,47);cap(52,0,28,42,45);
      glazing(4,59,40,18);door(54,60,24);
      B(28,12,23,25,6,darkMetal,30);B(32,16,15,17,12,accent,36);
      coin(39,25,89,26);
      polygon([P(66,20,76),P(55,20,58),P(66,28,49),P(77,20,58)],'#78d9d1');
      polygon([P(66,20,76),P(66,28,49),P(66,12,58)],'#b8eee7');
      polygon([P(55,20,55),P(66,28,40),P(77,20,55),P(66,28,47)],'#657fb9');
      [0,1,2].forEach(n=>{B(5+n*12,43,8,8,8,accent,32);if(n<2) B(13+n*12,46,4,2,2,glass,35);});f.z=21;
    } else if(s.id==='mini_projects') {
      // A phone-shaped app studio with a tall recessed screen and app tiles.
      B(0,0,78,58,25,stone);glazing(28,59,43,18);door(5,60,22);
      B(23,2,33,35,54,darkMetal,29);B(26,0,27,39,48,darkMetal,32);
      B(26,38,27,1,40,glass,36);B(30,40,19,1,3,stone,39);
      B(36,40,7,1,2,stone,76);
      for(let row=0;row<3;row++) for(let col=0;col<3;col++) B(29+col*8,40,5,1,5,(row+col)%2?accent:stone,48+row*8);
      B(34,7,12,18,3,accent,83);B(35,10,10,10,2,stone,86);
      B(35,19,3,4,2,stone,86);f.z=19;
    } else if(s.id==='ai') {
      // The upper floor is a friendly robot head, with headphones and an antenna.
      B(0,0,78,58,25,stone);glazing(3,59,48,18);door(57,60,24);
      B(23,10,30,25,19,darkMetal,28);B(12,3,52,37,34,stone,47);B(16,1,44,41,4,accent,81);
      B(17,41,42,2,21,darkMetal,54);B(20,44,36,1,17,glass,56);
      B(24,46,10,1,7,stone,65);B(44,46,10,1,7,stone,65);
      B(32,46,14,1,2,darkMetal,58);
      B(4,11,8,23,22,accent,54);B(64,11,8,23,22,accent,54);
      B(35,16,4,4,12,darkMetal,85);B(32,13,10,10,5,glass,97);f.z=20;
    } else {
      // A sculpted gamepad roof, with real grip silhouettes and coloured buttons.
      B(4,3,46,45,27,stone);B(49,0,34,34,27,stone);door(59,35,26);
      sculptedRoof([[9,0],[28,0],[35,8],[49,8],[56,0],[74,0],[83,10],[83,40],[75,53],[60,45],[51,30],[32,30],[23,45],[8,53],[0,40],[0,10]],31,18,accent);
      B(10,14,23,8,3,darkMetal,49);B(18,7,8,23,3,darkMetal,49);
      [[62,11],[71,18],[62,25],[53,18]].forEach(([a,b],n)=>B(a,b,7,7,3,[glass,stone,brick,['#ffe3a0','#e6c479','#c49c51']][n],49));
      B(35,15,6,3,1,stone,49);B(44,15,6,3,1,stone,49);
      [0,1].forEach(n=>{B(6+n*23,49,18,3,22,darkMetal);B(9+n*23,52,12,1,12,glass,11);B(9+n*23,53,6,1,2,accent,7);});
      f={x:-2,y:52,w:76,z:20};
    }
    // Recessed side glazing, a projecting canopy and a planted stone sill.
    const side=s.id==='printing'?82:s.id==='games'?83:78;
    B(side,31,1,18,13,glass,10);
    [32,40,48].forEach(b=>B(side+1,b,1,1,13,darkMetal,10));
    B(-3,57,7,8,6,darkMetal,2);B(-4,56,9,9,5,['#94aa7b','#759660','#587c4e'],8);
    // Architectural trim and window transoms keep each building detailed at street level.
    B(side+1,30,1,20,1,stone,24);
    B(side+1,30,1,20,1,stone,10);
    for(let a=4;a<side-3;a+=12) B(a,59,1,1,4,brick,4);
    B(3,60,Math.min(44,f.w-8),3,2,stone,5);
    // A thin architectural fascia sits within the ground-floor frontage.
    const label=signs[index].querySelector('.shop-name').textContent.trim();
    const signDesign={
      miniatures:{width:92,center:39,font:23,height:20},
      printing:{width:36,center:63,font:25,height:21},
      web3:{width:60,center:35,font:25,height:21},
      mini_projects:{width:90,center:39,font:23,height:20},
      ai:{width:32,center:64,font:25,height:21},
      games:{width:68,center:40,font:24,height:21}
    }[s.id]||{width:90,center:39,font:25,height:35};
    const lines=[label],fontSize=signDesign.font,lineHeight=fontSize+2;
    const signLeft=signDesign.center-signDesign.width/2;
    const fasciaHeight=signDesign.height;
    const fasciaWidth=signDesign.width*wide,fasciaZ=7;
    const sx=x+signLeft*wide,sy=y+(f.y+1)*buildingSize;
    // No oversized hood or hanging frame: only a slim cap and a recessed name strip.
    block(sx-1,sy-2,fasciaWidth+2,5,1.5,accent,fasciaZ+fasciaHeight);
    block(sx,sy,fasciaWidth,1.5,fasciaHeight,[identity.wall[0],identity.sign[1],identity.sign[2]],fasciaZ);
    block(sx,sy+1.5,fasciaWidth,1,1,stone,fasciaZ);
    const at=project(sx+fasciaWidth/2,sy+1.5,fasciaZ+2.5);
    ctx.save();ctx.translate(at.x,at.y);ctx.transform(1,.5,0,1,0,0);
    ctx.font=`800 ${fontSize}px "JetBrains Mono", "PingFang SC", monospace`;
    ctx.textAlign='center';ctx.fillStyle=identity.ink;
    lines.forEach((line,i)=>ctx.fillText(line,0,-(lines.length-1-i)*lineHeight,fasciaWidth*.68-2));
    ctx.restore();
  }

  function streetLight(x,y) {
    const metal=['#a2b7c3','#647d90','#40596e'];
    block(x-2,y-2,4,4,3,metal);
    block(x-.8,y-.8,1.6,1.6,26,metal);
    block(x-1,y-1,8,2,2,metal,26);
    block(x+4,y-1,4,3,1,['#e5f7f4','#ccebef','#a3cbd9'],25);
  }
  function streetBench(x,y) {
    const frame=['#8fa6b3','#5b7688','#3c566b'];
    block(x,y,3,7,7,frame);block(x+17,y,3,7,7,frame);
    for(let n=0;n<3;n++) block(x-1,y+n*3,22,2,2,['#b4b6ad','#929f9d','#6f878c'],7);
    block(x-1,y,22,2,7,frame,9);
  }
  const facingDirections=['right','front-right','front','front-left','left','back-left','back','back-right'];
  function faceMovement(dx,dy) {
    if(Math.hypot(dx,dy)<.001) return;
    const sx=dx*camera.a+dy*camera.b,sy=dx*camera.c+dy*camera.d;
    player.targetAngle=Math.atan2(sy,sx);
    if(reducedMotion.matches) player.angle=player.targetAngle;
  }
  function turnTowardsMovement(dt) {
    const delta=Math.atan2(Math.sin(player.targetAngle-player.angle),Math.cos(player.targetAngle-player.angle));
    player.angle+=Math.sign(delta)*Math.min(Math.abs(delta),dt*10);
    player.angle=Math.atan2(Math.sin(player.angle),Math.cos(player.angle));
    player.facing=facingDirections[(Math.round(player.angle/(Math.PI/4))+8)%8];
  }
  function avatar() {
    const p=project(player.x,player.y),facing=player.facing;
    const back=facing.startsWith('back'),side=facing==='left'||facing==='right',left=facing.includes('left');
    const moving=path.length>0,phase=player.walkDistance/9;
    const swing=moving?Math.sin(phase):0;
    const bob=moving?-Math.abs(Math.sin(phase*2))*.8:0;
    const turn=Math.sin(player.targetAngle-player.angle)*(moving?.7:0);
    ctx.save();ctx.translate(Math.round(p.x),Math.round(p.y));ctx.scale(1.5,1.5);
    polygon([{x:-3,y:-37},{x:3,y:-37},{x:0,y:-34}],'#f59332');
    polygon([{x:-8,y:0},{x:2,y:-3},{x:10,y:0},{x:0,y:4}],'#25382d35');
    if(left) ctx.scale(-1,1);
    // Articulated legs: the foot lifts on its return stroke, the planted foot trails.
    function leg(near,cycle) {
      const stride=side?4:2.5,advance=cycle*stride,lift=Math.max(0,cycle)*(side?2.5:2);
      const hip=near?-3:2,knee=hip+advance*.5,foot=hip+advance;
      polygon([{x:hip-1.5,y:-8},{x:hip+1.5,y:-8},{x:knee+1.5,y:-4-lift*.4},{x:knee-1.5,y:-4-lift*.4}],near?'#30333e':'#282c36');
      polygon([{x:knee-1.5,y:-4-lift*.4},{x:knee+1.5,y:-4-lift*.4},{x:foot+1.5,y:-lift},{x:foot-1.5,y:-lift}],near?'#30333e':'#282c36');
      rect(Math.round(foot-2),Math.round(-lift),5,2,near?'#e1dece':'#b6bfc0');
    }
    function arm(near,cycle) {
      const shoulder=near?-5:(side?3:5),reach=cycle*(side?3.5:2.5);
      const elbow=shoulder+reach*.5,hand=shoulder+reach;
      polygon([{x:shoulder-1,y:-19},{x:shoulder+2,y:-19},{x:elbow+2,y:-13},{x:elbow-1,y:-12}],near?'#444550':'#30333e');
      polygon([{x:elbow-1,y:-13},{x:elbow+2,y:-14},{x:hand+2,y:-9-Math.abs(cycle)},{x:hand-1,y:-9-Math.abs(cycle)}],near?'#444550':'#30333e');
      rect(Math.round(hand),Math.round(-10-Math.abs(cycle)),2,2,'#e4b89a');
      if(near) {rect(Math.round(hand-4),Math.round(-13-Math.abs(cycle)),3,9,'#a5b9c2');rect(Math.round(hand-3),Math.round(-12-Math.abs(cycle)),1,7,'#d5e2e5');}
    }
    leg(false,-swing);leg(true,swing);
    ctx.save();ctx.translate(turn,bob);
    arm(false,swing);
    const width=side?8:11;
    rect(-5,-20,width,13,'#3b3b48');
    if(back) {
      rect(-4,-20,width-2,3,'#444550');rect(0,-15,1,7,'#343641');rect(-5,-19,2,10,'#697d81');
    } else if(side) {
      rect(1,-19,2,10,'#969b9b');rect(2,-17,3,9,'#444550');
    } else {
      rect(facing==='front'?-1:1,-18,3,9,'#aaa9a3');rect(-4,-18,2,2,'#7fa7a7');
    }
    arm(true,-swing);
    rect(-5,-29,10,10,'#302d38');
    if(back) {
      rect(-5,-24,10,8,'#302d38');rect(-3,-27,6,7,'#393640');
      if(facing!=='back') rect(4,-24,1,4,'#c69b81');
    } else if(side) {
      rect(1,-26,5,7,'#e4b89a');rect(5,-24,2,3,'#e4b89a');rect(4,-25,1,1,'#30333e');rect(-5,-28,7,9,'#302d38');
    } else {
      const shift=facing==='front'?0:2;
      rect(-2+shift,-26,6,6,'#e4b89a');rect(2+shift,-24,1,1,'#30333e');rect(-5,-28,4,9,'#302d38');
    }
    ctx.restore();ctx.restore();
  }
  function draw() {
    dark=['midnight','black'].includes(document.documentElement.dataset.theme);
    hitShop=-1;
    if(hitCtx) {hitCtx.setTransform(1,0,0,1,0,0);hitCtx.clearRect(0,0,1000,640);hitCtx.setTransform(viewScale,0,0,viewScale,viewLeft,0);}
    ctx.clearRect(0,0,1000,640); ctx.save(); ctx.translate(viewLeft,0); ctx.scale(viewScale,viewScale);
    ctx.fillStyle=dark?'#00000025':'#44583413'; ctx.beginPath(); ctx.ellipse(500,Math.max(...land.map(([x,y])=>project(x,y).y))+9,365,27,0,0,Math.PI*2); ctx.fill();
    // Vertical earth faces follow the irregular land perimeter.
    for(let i=0;i<land.length;i++) {
      const a=land[i], b=land[(i+1)%land.length];
      if(b[0]>a[0] || b[1]<a[1]) continue;
      polygon([project(...a),project(...b),project(b[0],b[1],-13),project(a[0],a[1],-13)],a[0]===b[0]?'#6f8390':'#9eb1b8');
    }
    ground(land,dark?'#46665b':'#a7c6ab');
    for(let x=50;x<760;x+=26) for(let y=40;y<worldHeight-20;y+=26) {
      if(onLand(x,y) && ((x*7+y*3)%11)<2) ground([[x,y],[x+5,y],[x+5,y+4],[x,y+4]],dark?'#527363':'#b4d0b4');
    }
    function roadSurface(r,extra,color,z) {
      const half=r.width/2+extra;
      ground([[Math.min(r.x1,r.x2)-half,Math.min(r.y1,r.y2)-half],[Math.max(r.x1,r.x2)+half,Math.min(r.y1,r.y2)-half],[Math.max(r.x1,r.x2)+half,Math.max(r.y1,r.y2)+half],[Math.min(r.x1,r.x2)-half,Math.max(r.y1,r.y2)+half]],color,z);
    }
    // Shared pale stone sidewalks, aligned with the shopfronts and outer avenue.
    promenades.forEach(r=>{
      roadSurface(r,2,dark?'#829daa':'#bacfd8',1);
      roadSurface(r,0,dark?'#acc0c8':'#e0edf1',2);
      const horizontal=r.y1===r.y2;
      for(let n=horizontal?r.x1:r.y1;n<(horizontal?r.x2:r.y2);n+=24) {
        if(horizontal) ground([[n,r.y1-r.width/2],[n+1,r.y1-r.width/2],[n+1,r.y1+r.width/2],[n,r.y1+r.width/2]],dark?'#91aab7':'#c7dce4',3);
        else ground([[r.x1-r.width/2,n],[r.x1+r.width/2,n],[r.x1+r.width/2,n+1],[r.x1-r.width/2,n+1]],dark?'#91aab7':'#c7dce4',3);
      }
    });
    // Each frontage has its own little court, rather than six identical strips.
    shops.forEach(s=>{
      const half=48*s.proportions.width,front=s.baseY+7;
      const paving={miniatures:'#dccdb6',printing:'#b9c8cf',web3:'#b9c5df',mini_projects:'#c8d5bd',ai:'#d2d1e6',games:'#d5bfd5'}[s.id]||'#d8e4e7';
      ground([[s.x-half,front],[s.x+half,front],[s.x+half+5,front+19],[s.x+half-2,front+27],[s.x-half+2,front+27],[s.x-half-5,front+19]],paving,1);
      for(let x=s.x-half+8;x<s.x+half-3;x+=12) ground([[x,front+4],[x+1,front+4],[x+1,front+23],[x,front+23]],'#f1f4eb',2);
      if(s.id==='games') for(let n=0;n<5;n++) ground([[s.x-21+n*9,front+8],[s.x-15+n*9,front+8],[s.x-15+n*9,front+14],[s.x-21+n*9,front+14]],n%2?'#eee4ad':'#9b88b6',2);
    });
    function bendSurface(b,extra,color,z) {
      const half=b.width/2+extra,points=[];
      for(let n=0;n<=10;n++){const t=b.start+n*Math.PI/20;points.push([b.x+Math.cos(t)*(b.radius+half),b.y+Math.sin(t)*(b.radius+half)]);}
      for(let n=10;n>=0;n--){const t=b.start+n*Math.PI/20;points.push([b.x+Math.cos(t)*(b.radius-half),b.y+Math.sin(t)*(b.radius-half)]);}
      ground(points,color,z);
    }
    // Paint all curbs first, then asphalt, so intersections stay open.
    roads.forEach(r=>roadSurface(r,3,dark?'#8dabb8':'#d4e2e7',1));
    roadBends.forEach(b=>bendSurface(b,3,dark?'#8dabb8':'#d4e2e7',1));
    roads.forEach(r=>roadSurface(r,0,dark?'#263648':'#425369',2));
    roadBends.forEach(b=>bendSurface(b,0,dark?'#263648':'#425369',2));
    rings.forEach(r=>{
      for(const y of [r.top,r.bottom]) for(let x=r.left+(r.radius||18);x<r.right-(r.radius||12);x+=27) ground([[x,y-1],[x+11,y-1],[x+11,y+1],[x,y+1]],'#edf5fa',3);
      for(const x of [r.left,r.right]) for(let y=r.top+(r.radius||18);y<r.bottom-(r.radius||12);y+=27) ground([[x-1,y],[x+1,y],[x+1,y+11],[x-1,y+11]],'#edf5fa',3);
    });
    for(const cy of [roadTop,streetY]) for(let y=cy-12;y<cy+12;y+=5) ground([[roadAxis-8,y],[roadAxis+8,y],[roadAxis+8,y+2],[roadAxis-8,y+2]],'#f5f9fc',3);
    // Follow the street grid: a long east-west frontage with a shallow footprint.
    ground([[cbdBlock.left,cbdBlock.top],[cbdBlock.right,cbdBlock.top],[cbdBlock.right,cbdBlock.bottom],[cbdBlock.left,cbdBlock.bottom]],dark?'#6f8c98':'#c6d9df',1);
    ground([[298,247],[544,247],[544,278],[298,278]],dark?'#91aab5':'#e4eef2',2);
    // Consistent small contact shadows, kept below every building and plant.
    shops.forEach(s=>{
      const w=46*s.proportions.width;
      ground([[s.x-w+8,s.baseY-40],[s.x+w+13,s.baseY-40],[s.x+w+13,s.baseY+11],[s.x-w+8,s.baseY+11]],dark?'#17292132':'#3d51402b');
    });
    const objects=shops.map((s,i)=>({depth:depth(s.x,s.baseY),paint:()=>{hitShop=i;shop(s,i);hitShop=-1;}}));
    const planting=[[120,20,'ginkgo'],[450,-5,'pine'],[710,25,'ginkgo'],[46,300,'pine'],[770,420,'ginkgo'],[190,510,'ginkgo'],[690,620,'pine'],[220,225,'ginkgo'],[610,210,'pine']];
    planting.forEach(([x,y,kind])=>objects.push({depth:depth(x,y+16),paint:()=>tree(x,y,kind)}));
    [[160,90],[450,130],[365,488],[595,488],[738,353],[105,352]].forEach(([x,y])=>objects.push({depth:depth(x,y),paint:()=>streetLight(x,y)}));
    [[166,60],[345,483],[742,348]].forEach(([x,y])=>objects.push({depth:depth(x+10,y+8),paint:()=>streetBench(x,y)}));
    cbdBuildings.forEach(t=>objects.push({depth:depth(t.x+(t.kind==='cctv'?18:0),t.y+(t.kind?20:t.d/2)),paint:()=>cbdTower(t)}));
    objects.push({depth:depth(player.x,player.y),paint:avatar});
    objects.sort((a,b)=>a.depth-b.depth).forEach(o=>o.paint());
    ctx.restore(); stage.dataset.playerX=String(Math.round(player.x)); stage.dataset.playerY=String(Math.round(player.y));stage.dataset.facing=player.facing;
  }
  // Grid pathfinding keeps the player out of shop walls and inside the map.
  function blocked(x,y,roadsOnly=false) {
    if(!onLand(x,y)||inBuilding(x,y,3)||(roadsOnly&&!onRoad(x,y))) return true;
    // Keep the miniature skyline solid while allowing the surrounding plaza and lawns.
    return cbdBuildings.some(t=>{
      let left,right,top,bottom;
      if(t.kind==='cctv') {left=t.x-12;right=t.x+60;top=t.y-12;bottom=t.y+25;}
      else if(t.kind==='guomao') {left=t.x-14;right=t.x+25;top=t.y-13;bottom=t.y+18;}
      else if(t.kind==='zun') {left=t.x-16;right=t.x+16;top=t.y-16;bottom=t.y+16;}
      else {left=t.x-t.w/2-4;right=t.x+t.w/2+4;top=t.y-t.d/2-4;bottom=t.y+t.d/2+4;}
      return x>left-3&&x<right+3&&y>top-3&&y<bottom+3;
    });
  }
  function destination(x,y) {
    if(!onLand(x,y)) return null;
    if(!blocked(x,y)) return {x,y};
    for(let radius=5;radius<=120;radius+=5) {
      const candidates=[];
      for(let dx=-radius;dx<=radius;dx+=5) for(const dy of [-radius,radius]) if(!blocked(x+dx,y+dy)) candidates.push({x:x+dx,y:y+dy});
      for(let dy=-radius+5;dy<radius;dy+=5) for(const dx of [-radius,radius]) if(!blocked(x+dx,y+dy)) candidates.push({x:x+dx,y:y+dy});
      if(candidates.length) return candidates.sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];
    }
    return null;
  }
  function route(x, y, roadsOnly=false, origin=player) {
    if(roadsOnly&&!onRoad(origin.x,origin.y)) {
      const entries=[...roads,...promenades].map(r=>{
        const t=r.x1===r.x2?Math.max(0,Math.min(1,(origin.y-r.y1)/(r.y2-r.y1||1))):Math.max(0,Math.min(1,(origin.x-r.x1)/(r.x2-r.x1||1)));
        return {x:r.x1+(r.x2-r.x1)*t,y:r.y1+(r.y2-r.y1)*t};
      }).filter(p=>!blocked(p.x,p.y,true)).sort((a,b)=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y));
      for(const entry of entries.slice(0,8)) {
        const toRoad=route(entry.x,entry.y,false,origin),alongRoad=route(x,y,true,entry);
        if(toRoad.length&&alongRoad.length) return [...toRoad,...alongRoad];
      }
      return [];
    }
    if(blocked(x,y,roadsOnly)) return [];
    const size=5, w=160, h=Math.ceil(worldHeight/size);
    const sx=Math.floor(origin.x/size),sy=Math.floor(origin.y/size);
    // Pick a nearby road cell rather than rounding a narrow entrance onto grass.
    let goal=null, nearest=Infinity;
    for(let gy=Math.floor(y/size)-1;gy<=Math.floor(y/size)+1;gy++) for(let gx=Math.floor(x/size)-1;gx<=Math.floor(x/size)+1;gx++) {
      const px=gx*size+size/2,py=gy*size+size/2,d=Math.hypot(px-x,py-y);
      if(gx>=0&&gx<w&&gy>=0&&gy<h&&!blocked(px,py,roadsOnly)&&d<nearest) {goal=gy*w+gx;nearest=d;}
    }
    if(goal===null) return [];
    const start=sy*w+sx, previous=new Map([[start,null]]),queue=[start];
    for(let i=0;i<queue.length;i++) {
      const cell=queue[i]; if(cell===goal) break;
      const cx=cell%w,cy=Math.floor(cell/w);
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx=cx+dx,ny=cy+dy,next=ny*w+nx;
        if(nx<0||ny<0||nx>=w||ny>=h||previous.has(next)||blocked(nx*size+size/2,ny*size+size/2,roadsOnly)) continue;
        previous.set(next,cell);queue.push(next);
      }
    }
    if(!previous.has(goal)) return [];
    const result=[];let cell=goal;
    while(cell!==start) {result.push({x:(cell%w)*size+size/2,y:Math.floor(cell/w)*size+size/2});cell=previous.get(cell);}
    result.reverse();result.push({x,y});
    // Remove redundant grid corners only when the whole segment clears every solid.
    // Sampling is denser than the path grid, so smoothing cannot cut through a wall.
    const clearSegment=(a,b)=>{
      const steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/2);
      for(let i=1;i<=steps;i++) {
        const x=a.x+(b.x-a.x)*i/steps,y=a.y+(b.y-a.y)*i/steps;
        if([[0,0],[-1,-1],[-1,1],[1,-1],[1,1]].some(([dx,dy])=>blocked(x+dx,y+dy,roadsOnly))) return false;
      }
      return true;
    };
    const smooth=[];let anchor=origin,index=0;
    while(index<result.length) {
      let next=index;
      while(next+1<result.length&&clearSegment(anchor,result[next+1])) next++;
      smooth.push(result[next]);anchor=result[next];index=next+1;
    }
    return smooth;
  }
  function showPlace(id) {
    selected = id; stage.dataset.location = id;
    signs.forEach(sign => sign.setAttribute('aria-expanded', String(sign.dataset.place === id)));
    detail.hidden = false;
    detail.querySelectorAll('[data-story]').forEach(story => { story.hidden = story.dataset.story !== id; });
  }
  function tick(time) {
    const dt=Math.min((time-previousTime)/1000,.04);
    let remaining=dt*(automatic?60:180);
    previousTime=time;
    // Carry leftover frame distance across waypoints instead of pausing at each cell.
    while(path.length&&remaining>0) {
      const goal=path[0],dx=goal.x-player.x,dy=goal.y-player.y,length=Math.hypot(dx,dy);
      if(length<.001) {path.shift();continue;}
      if(path.length>1||length>4) faceMovement(dx,dy);
      const step=Math.min(length,remaining);
      player.walkDistance+=step;
      player.x+=dx/length*step;player.y+=dy/length*step;remaining-=step;
      if(length<=step) path.shift();
    }
    turnTowardsMovement(dt);
    if(!automatic||time-lastPaint>=32) {draw();lastPaint=time;}
    if (path.length) animation = requestAnimationFrame(tick);
    else { animation = null; draw();if (visiting) { showPlace(visiting); visiting = null; } scheduleWander(automatic?1800+Math.random()*1700:idleRemaining()); }
  }
  function go(x, y, place = null, auto = false) {
    if(!auto) manualControl();
    const next = route(x, y); if (!next.length) { if (place && Math.hypot(player.x - x, player.y - y) < 16) showPlace(place);scheduleWander(idleRemaining()); return; }
    automatic=auto;stage.dataset.walkMode=auto?'auto':'manual';
    path = next; visiting = place;
    if (reducedMotion.matches) {
      const end=path[path.length-1],from=path.length>1?path[path.length-2]:player;
      faceMovement(end.x-from.x,end.y-from.y);turnTowardsMovement(1);
      Object.assign(player, end); path = []; draw(); if (visiting) showPlace(visiting); visiting = null;scheduleWander(idleRemaining()); return; }
    if (!animation) { previousTime = performance.now(); animation = requestAnimationFrame(tick); }
  }
  signs.forEach(sign => sign.addEventListener('click', () => {
    const s = shops.find(shop => shop.id === sign.dataset.place);
    go(s.entryX, s.entrance, s.id);
  }));
  function pointer(event) {
    const box=canvas.getBoundingClientRect();
    return {px:(event.clientX-box.left)/box.width*1000,py:(event.clientY-box.top)/box.height*640};
  }
  function pointedShop(p) {
    if(!hitCtx||p.px<0||p.py<0||p.px>=1000||p.py>=640) return null;
    const index=hitCtx.getImageData(Math.floor(p.px),Math.floor(p.py),1,1).data[0]-1;
    return shops[index]||null;
  }
  canvas.addEventListener('pointermove',event=>stage.classList.toggle('is-over-shop',Boolean(pointedShop(pointer(event)))));
  canvas.addEventListener('pointerleave',()=>stage.classList.remove('is-over-shop'));
  canvas.addEventListener('click',event=>{
    const p=pointer(event),shop=pointedShop(p);
    stage.focus({preventScroll:true});
    if(shop) {go(shop.entryX,shop.entrance,shop.id);return;}
    const world=unproject((p.px-viewLeft)/viewScale,p.py/viewScale),target=destination(world.x,world.y);
    if(target) go(target.x,target.y);
  });
  const directions = { left: [-20, 0], right: [20, 0], up: [0, -20], down: [0, 20] };
  function walk(direction) { const [dx, dy] = directions[direction]; go(player.x + dx, player.y + dy); }
  stage.addEventListener('keydown', event => {
    if (event.target !== stage) return;
    const direction = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down' }[event.key];
    if (direction) { event.preventDefault(); walk(direction); }
  });
  document.querySelectorAll('[data-walk]').forEach(button => button.addEventListener('click', () => walk(button.dataset.walk)));
  detail.querySelector('.close-place').addEventListener('click', () => { detail.hidden = true; signs.forEach(sign => sign.setAttribute('aria-expanded', 'false')); if (selected) signs.find(sign => sign.dataset.place === selected).focus();scheduleWander(idleRemaining()); });
  document.addEventListener('click',manualControl,true);
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  reducedMotion.addEventListener?.('change',()=>{
    autoEnabled=!reducedMotion.matches;manualControl();scheduleWander(1000);draw();
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden) {cancelIdle();if(animation) cancelAnimationFrame(animation);animation=null;}
    else if(path.length) {previousTime=performance.now();animation=requestAnimationFrame(tick);}
    else scheduleWander(1000);
  });
  window.addEventListener('pagehide',()=>{cancelIdle();if(animation) cancelAnimationFrame(animation);});
  window.addEventListener('pageshow',()=>{if(!document.hidden&&!path.length) scheduleWander(1000);});
  // Added rows may occupy the old spawn point: find the nearest open tile.
  if (blocked(player.x, player.y)) {
    let nearest = null, distance = Infinity;
    for (let y = 25; y < worldHeight - 15; y += 10) for (let x = 15; x < 785; x += 10) {
      const nextDistance = Math.hypot(x - player.x, y - player.y);
      if (!blocked(x, y) && nextDistance < distance) { nearest = { x, y }; distance = nextDistance; }
    }
    if (nearest) Object.assign(player, nearest);
  }
  // Repaint after layout/font loading and browser canvas restoration as well.
  window.addEventListener('load',draw,{once:true});
  canvas.addEventListener('contextrestored',draw);
  if(typeof ResizeObserver!=='undefined') new ResizeObserver(draw).observe(stage);
  if(document.fonts) document.fonts.ready.then(draw);
  draw();
  scheduleWander(10000);
})();
