import json, time, os, shutil
from playwright.sync_api import sync_playwright
D='https://worshipflow-pearl.vercel.app'
import bible
def router(r):
    u=r.request.url
    if 'bolls.life' in u or 'getbible.net' in u: return bible.route(r)
    if u.startswith(D): return r.fulfill(response=r.fetch(url=u.replace(D,'http://localhost:5199')))
    if u.startswith('http://localhost'): return r.continue_()
    return r.abort()
FS="Element.prototype.requestFullscreen=function(){Object.defineProperty(document,'fullscreenElement',{get:()=>document.documentElement,configurable:true});setTimeout(()=>document.dispatchEvent(new Event('fullscreenchange')),0);return Promise.resolve();};"
def nueva(p, w=1280, h=800, dsf=1.5, mobile=False):
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':w,'height':h}, device_scale_factor=dsf, service_workers='block', is_mobile=mobile, has_touch=mobile)
    ctx.route('**/*', router); ctx.add_init_script(FS)
    pg=ctx.new_page(); pg.on('pageerror', lambda e: print('ERR', str(e)[:200]))
    pg.goto(D+'/?reset'); pg.wait_for_timeout(2000)
    pg.evaluate("localStorage.setItem('wf_push_aviso_oculto_hasta', String(Date.now()+9e9))"); pg.reload(); pg.wait_for_timeout(2500)
    return b, ctx, pg
class Rec:
    """Graba estados: cada 'shot' guarda una imagen; 'tap' guarda el objetivo del clic."""
    def __init__(s, pg, out):
        s.pg=pg; s.out=out; shutil.rmtree(out, ignore_errors=True); os.makedirs(out); s.steps=[]
    def shot(s, name, hold=1.0, zoom=None):
        i=len(s.steps); s.pg.screenshot(path=f'{s.out}/{i:03d}.jpg', type='jpeg', quality=92)
        s.steps.append({'i':i,'name':name,'hold':hold,'zoom':zoom}); return i
    def box(s, loc):
        bb=loc.bounding_box(); return [bb['x'],bb['y'],bb['width'],bb['height']]
    def tap(s, loc, name, wait=700, zoom=None, hold=1.0, click=True):
        loc.scroll_into_view_if_needed(); b=s.box(loc)
        i=s.shot(name+'_antes', hold=0.6, zoom=zoom); s.steps[i]['tap']=b
        if click: loc.click()
        s.pg.wait_for_timeout(wait); return s.shot(name, hold=hold, zoom=zoom)
    def save(s): json.dump(s.steps, open(f'{s.out}/steps.json','w'), indent=1)
