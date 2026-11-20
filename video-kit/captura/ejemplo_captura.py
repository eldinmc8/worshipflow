from lib import *
import os
with sync_playwright() as p:
    b,ctx,pg=nueva(p)
    os.makedirs('tv',exist_ok=True)
    pg.evaluate("()=>{const k='wf_demo_db_v1';const d=JSON.parse(localStorage.getItem(k));const u=d.usuarios.find(x=>x.id==='u-carlos');if(u){u.rol='admin';u.estado='activo';u.perfil_completo=true;u.tutoriales_vistos=['bienvenida_v2','eventos','evento','canciones','editor_cancion','envivo_v3'];}d.asignaciones_vistas.push({evento_id:'evt-demo',usuario_id:'u-carlos',iglesia_id:'igl-demo',visto_at:'2026-11-12T10:00:00'});localStorage.setItem(k,JSON.stringify(d));}")
    pg.goto(D+'/'); pg.wait_for_timeout(2500)
    try:
        pg.get_by_text('Eventos', exact=True).first.click(); pg.wait_for_timeout(900)
        pg.get_by_text('Culto dominical').first.click(); pg.wait_for_timeout(1500)
        pg.get_by_text('Iniciar evento').first.click(); pg.wait_for_timeout(2500)
        for sel in ['[role=status] button','button[aria-label="Cerrar"]']:
            for btn in pg.locator(sel).all():
                try: btn.click(timeout=300)
                except: pass
        t=pg.get_by_text('No se pudo detectar', exact=False)
        if t.count():
            try: t.first.locator('xpath=ancestor::div[.//button][1]').locator('button').last.click(timeout=1000)
            except: pass
        pg.locator('text="Fiel en la tormenta" >> visible=true').first.click(); pg.wait_for_timeout(900)
        pg.locator('text=/Aunque ruja el mar/ >> visible=true').first.click(); pg.wait_for_timeout(900)
        pr=ctx.new_page(); pr.set_viewport_size({'width':1920,'height':1080}); pr.goto(D+'/p/demo'); pr.wait_for_timeout(2500)
        pr.screenshot(path='tv/0.jpg', type='jpeg', quality=90); pg.screenshot(path='tv/pc0.jpg', type='jpeg', quality=90)
        ph=ctx.new_page(); ph.set_viewport_size({'width':390,'height':844}); 
        mob=b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2.5, is_mobile=True, has_touch=True)
        ph.close()
        # mismo contexto para compartir localStorage/BroadcastChannel: usar página con viewport de celular
        ph=ctx.new_page(); ph.add_init_script("sessionStorage.setItem('wf_as','u-carlos')"); ph.set_viewport_size({'width':390,'height':844}); ph.goto(D+'/'); ph.wait_for_timeout(3000)
        r=Rec(ph,'m')
        r.shot('inicio', hold=1.5)
        print('BTN',[x for x in ph.locator('button:visible').all_inner_texts() if x.strip()][:12])
        r.tap(ph.locator('button[aria-label="Controlar las diapositivas desde este teléfono"]').first, 'control', wait=1500, hold=1.5)
        for i in range(3):
            r.tap(ph.locator('button:visible', has_text='Siguiente').first, f'sig{i}', wait=1500, hold=1.2)
            pr.screenshot(path=f'tv/{i+1}.jpg', type='jpeg', quality=90)
        r.tap(ph.locator('button:visible', has_text='Pantalla en negro').first, 'negro', wait=1500, hold=1.2)
        pr.screenshot(path='tv/negro.jpg', type='jpeg', quality=90); pg.screenshot(path='tv/pc1.jpg', type='jpeg', quality=90)
        r.save()
    finally:
        b.close()
