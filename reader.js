(() => {
  const reader=document.querySelector('#reader');
  const inner=document.querySelector('#reader-inner');
  const rig=document.querySelector('#book-rig');
  const previous=document.querySelector('#previous');
  const next=document.querySelector('#next');
  const label=document.querySelector('#page-status');
  const modeButton=document.querySelector('#view-mode');
  let album=null, book=null, flip=null, current=0, simple=false, turning=false, rotated=false, resizeFrame=0, down=null;
  const twoFrames=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));

  function layout(){
    cancelDrag();
    const width=Math.round(window.visualViewport?.width || window.innerWidth);
    const height=Math.round(window.visualViewport?.height || window.innerHeight);
    rotated=height>width;
    const logicalWidth=rotated?height:width;
    const logicalHeight=rotated?width:height;
    inner.style.width=logicalWidth+'px';
    inner.style.height=logicalHeight+'px';
    inner.classList.toggle('rotated',rotated);
    const pageHeight=Math.max(100,Math.min(logicalHeight-104,(logicalWidth-144)/1.5,900));
    rig.style.width=(pageHeight*1.5)+'px';
    rig.style.height=pageHeight+'px';
    inner.style.setProperty('--sticker-rail',Math.max(32,(logicalWidth-24-pageHeight*1.5)/4)+'px');
    if(flip&&!reader.hidden){
      try{flip.update()}catch{setMode(true)}
    }
  }

  function visibleIndices(){
    if(current===0||current===15)return [current];
    return [current,current+1];
  }

  function update(){
    if(!book)return;
    const visible=visibleIndices();
    book.dataset.edge=current===0?'front':current===15?'back':'inside';
    for(const leaf of book.querySelectorAll('.book-page')){
      const show=visible.includes(Number(leaf.dataset.index));
      leaf.classList.toggle('is-visible-page',show);
      if(simple)leaf.hidden=!show;
    }
    previous.disabled=current===0||turning;
    next.disabled=current===15||turning;
    modeButton.disabled=turning;
    label.textContent=current===0?'封面':current===15?'封底':String(current+1).padStart(2,'0')+' / 16';
    modeButton.textContent=simple?'翻页版':'简洁版';
    modeButton.setAttribute('aria-pressed',String(simple));
    document.querySelector('#reader-status').textContent=simple?'简洁双页 · 点箭头翻阅':'横屏双页 · 拖动书页翻阅';
  }

  function decoration(item){
    const node=document.createElement('span');
    const types=['flower','star','heart','bubble','sparkle','tear'];
    if(!types.includes(item.type))return null;
    node.className='page-decoration page-decoration--'+item.type;
    node.setAttribute('aria-hidden','true');
    node.style.left=item.x+'%';node.style.top=item.y+'%';
    const size=Math.min(item.size*1.5,16);
    node.style.width=size+'%';node.style.height=(size*.75)+'%';
    node.style.animationDelay=(-item.delay)+'s';
    if(item.type==='heart')node.innerHTML=window.albumStickers.heartMarkup;
    if(item.type==='flower'||item.type==='star'){
      const image=document.createElement('img');
      image.src='stickers/'+item.type+'.png?v=20261018e';image.alt='';image.draggable=false;
      node.appendChild(image);
    }
    return node;
  }

  function createBook(){
    rig.textContent='';
    book=document.createElement('div');
    book.id='book';book.className='pagebook '+(simple?'simple-view':'flip-view');
    book.setAttribute('aria-label',album.title);
    album.pages.forEach((page,index)=>{
      const leaf=document.createElement('article');
      leaf.className='book-page';leaf.dataset.index=String(index);
      leaf.setAttribute('aria-label','第'+(index+1)+'页：'+page.alt);
      if(index===0||index===15)leaf.dataset.density='hard';
      const image=document.createElement('img');
      image.className='book-artwork';image.alt=page.alt;image.draggable=false;
      image.src='data:'+page.mime+';base64,'+page.image;
      leaf.appendChild(image);
      for(const item of page.decorations||[]){
        const node=decoration(item);if(node)leaf.appendChild(node);
      }
      // Extra motion lives along the paper margins, leaving the photo and title readable.
      const accents=[
        {type:index%2?'heart':'flower',x:8,y:14,size:8,delay:index*.3},
        {type:'sparkle',x:89,y:44,size:6,delay:1+index*.2},
        {type:index%3?'bubble':'star',x:12,y:88,size:7,delay:2+index*.2}
      ];
      for(const item of accents)leaf.appendChild(decoration(item));
      book.appendChild(leaf);
    });
    rig.appendChild(book);
  }

  function disposeFlip(){
    releaseDrag();
    if(flip){const old=flip;flip=null;try{old.destroy()}catch{}}
    turning=false;
  }

  function createFlip(){
    if(!window.St?.PageFlip)throw new Error('FLIP_UNAVAILABLE');
    flip=new St.PageFlip(book,{
      width:384,height:512,size:'stretch',minWidth:60,maxWidth:768,minHeight:80,maxHeight:1024,
      drawShadow:true,flippingTime:620,usePortrait:false,autoSize:false,startZIndex:10,
      maxShadowOpacity:.3,showCover:true,startPage:current,mobileScrollSupport:false,
      useMouseEvents:false,clickEventForward:false,showPageCorners:false,disableFlipByClick:true
    });
    flip.on('flip',event=>{
      const value=Number(event.data);
      if(!Number.isInteger(value)||value<0||value>15)return;
      const changed=value!==current;
      current=value;update();
      if(changed)window.albumMusic?.playTurn(current);
    });
    flip.on('changeState',event=>{turning=event.data!=='read';update()});
    flip.loadFromHTML(book.querySelectorAll('.book-page'));
    update();
  }

  function setMode(useSimple){
    if(!album)return;
    disposeFlip();simple=useSimple;
    createBook();
    if(!simple){
      try{createFlip()}catch{disposeFlip();simple=true;createBook()}
    }
    update();
  }

  function turn(direction){
    if(!album||turning)return;
    const target=direction>0?(current===0?1:Math.min(15,current+2)):(current<=1?0:current-2);
    if(target===current)return;
    if(flip){
      try{direction>0?flip.flipNext('bottom'):flip.flipPrev('bottom');return}
      catch{setMode(true)}
    }
    current=target;update();window.albumMusic?.playTurn(current);
  }

  function point(event){
    const touch=event.changedTouches?Array.from(event.changedTouches).find(t=>!down||t.identifier===down.id):null;
    if(event.changedTouches&&!touch)return null;
    return {x:touch?touch.clientX:event.clientX,y:touch?touch.clientY:event.clientY};
  }
  // PageFlip expects unrotated coordinates relative to its drawing surface.
  // Use the actual surface (including the centered cover offset), not the rig.
  function localPoint(point,plane){
    return plane.rotated?
      {x:(point.y-plane.top)*plane.width/plane.screenHeight,y:(plane.right-point.x)*plane.height/plane.screenWidth}:
      {x:(point.x-plane.left)*plane.width/plane.screenWidth,y:(point.y-plane.top)*plane.height/plane.screenHeight};
  }
  function releaseDrag(){
    const gesture=down;down=null;
    rig.classList.remove('is-dragging');
    if(gesture?.pointer&&rig.hasPointerCapture?.(gesture.id))rig.releasePointerCapture(gesture.id);
    return gesture;
  }
  function cancelDrag(){
    const gesture=releaseDrag();
    if(!gesture||!flip)return;
    if(gesture.dragging){
      const home={x:gesture.direction>0?gesture.plane.width-1:1,y:gesture.start.y};
      flip.userMove(home,true);flip.userStop(home);
    }else flip.userStop(gesture.start,true);
  }
  function start(event){
    if(!album||turning||down||event.isPrimary===false||(event.button!==undefined&&event.button!==0))return;
    if(event.touches&&event.touches.length!==1)return;
    const screen=point(event);if(!screen)return;
    const surface=flip?flip.getUI().getDistElement():book;
    const bounds=surface.getBoundingClientRect();
    const plane={left:bounds.left,top:bounds.top,right:bounds.right,screenWidth:bounds.width,screenHeight:bounds.height,width:surface.offsetWidth,height:surface.offsetHeight,rotated};
    const local=localPoint(screen,plane);
    if(local.x<0||local.x>plane.width||local.y<0||local.y>plane.height)return;
    const direction=local.x>=plane.width/2?1:-1;
    if((direction<0&&current===0)||(direction>0&&current===15))return;
    down={id:event.pointerId??event.changedTouches[0].identifier,pointer:event.pointerId!==undefined,start:local,plane,direction,dragging:false};
    if(flip)flip.startUserTouch(local);
    if(down.pointer)rig.setPointerCapture?.(down.id);
    if(event.cancelable)event.preventDefault();
  }
  function move(event){
    if(!down||(down.pointer&&event.pointerId!==down.id))return;
    const screen=point(event);if(!screen)return;
    if(event.cancelable)event.preventDefault();
    const local=localPoint(screen,down.plane);
    if(!down.dragging&&Math.hypot(local.x-down.start.x,local.y-down.start.y)>5){
      down.dragging=true;rig.classList.add('is-dragging');
      // Seed direction at the original touch, even if a fast move crosses the spine.
      if(flip)flip.getFlipController().fold(down.start);
    }
    if(down.dragging&&flip)flip.userMove(local,true);
  }
  function end(event){
    if(!down||(down.pointer&&event.pointerId!==down.id))return;
    const screen=point(event);if(!screen)return;
    if(event.cancelable)event.preventDefault();
    move(event);
    const local=localPoint(screen,down.plane);
    const gesture=releaseDrag();
    if(flip){
      flip.userStop(local,!gesture.dragging);
      if(!gesture.dragging)turn(gesture.direction);
    }else if(gesture.dragging){
      const delta=local.x-gesture.start.x;
      if(Math.abs(delta)>26)turn(delta<0?1:-1);
    }else turn(gesture.direction);
  }
  rig.style.touchAction='none';
  if(window.PointerEvent){
    rig.addEventListener('pointerdown',start);
    rig.addEventListener('pointermove',move);
    rig.addEventListener('pointerup',end);
    rig.addEventListener('pointercancel',event=>{if(down?.id===event.pointerId)cancelDrag()});
    rig.addEventListener('lostpointercapture',event=>{if(down?.id===event.pointerId)cancelDrag()});
  }else{
    rig.addEventListener('touchstart',start,{passive:false});
    rig.addEventListener('touchmove',move,{passive:false});
    rig.addEventListener('touchend',end,{passive:false});
    rig.addEventListener('touchcancel',cancelDrag);
  }

  previous.addEventListener('click',()=>turn(-1));
  next.addEventListener('click',()=>turn(1));
  modeButton.addEventListener('click',()=>setMode(!simple));
  window.addEventListener('keydown',event=>{
    if(reader.hidden||event.altKey||event.ctrlKey||event.metaKey)return;
    if(event.key==='ArrowLeft'){event.preventDefault();turn(-1)}
    if(event.key==='ArrowRight'||event.key===' '){event.preventDefault();turn(1)}
  });
  function resize(){
    cancelAnimationFrame(resizeFrame);
    resizeFrame=requestAnimationFrame(layout);
  }
  window.addEventListener('resize',resize);
  window.visualViewport?.addEventListener('resize',resize);
  window.addEventListener('orientationchange',resize);

  window.albumReader={
    async mount(data){
      if(data?.version!==2||!Array.isArray(data.pages)||data.pages.length!==16)throw new Error('FORMAT');
      if(data.pages.some(p=>p.mime!=='image/jpeg'||typeof p.image!=='string'||typeof p.alt!=='string'))throw new Error('FORMAT');
      album=data;current=0;simple=false;turning=false;layout();
      await twoFrames();
      setMode(false);
      await Promise.all(Array.from(book.querySelectorAll('.book-artwork')).map(image=>{
        if(image.complete)return image.naturalWidth?Promise.resolve():Promise.reject(new Error('IMAGE'));
        return new Promise((resolve,reject)=>{
          image.onload=resolve;image.onerror=()=>reject(new Error('IMAGE'));
        });
      }));
      await twoFrames();
      const bounds=book.getBoundingClientRect();
      if(bounds.width<50||bounds.height<80)setMode(true);
      rig.dataset.ready='true';update();
      window.albumStickers.mount();
    },
    destroy(){
      window.albumStickers.destroy();
      disposeFlip();album=null;book=null;current=0;down=null;
      rig.textContent='';delete rig.dataset.ready;
    },
    isSimple:()=>simple,
    currentPage:()=>current
  };
})();
