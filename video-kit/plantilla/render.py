import sys, subprocess, os, io
from playwright.sync_api import sync_playwright
DUR=30.0  # ← cambiar en cada video: duración total en segundos (igual que en audio.py)
html=open('scene.html').read().replace('DURV',str(DUR)); open('scene_built.html','w').write(html)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--allow-file-access-from-files']); pg=b.new_page(viewport={'width':1080,'height':1920})
    pg.goto('file://'+os.path.abspath('scene_built.html')); pg.evaluate('window.ready')
    if sys.argv[1]=='peek':
        from PIL import Image
        ts=[float(x) for x in sys.argv[2:]]; o=Image.new('RGB',(270*len(ts),480))
        for i,t in enumerate(ts): pg.evaluate(f'render({t})'); o.paste(Image.open(io.BytesIO(pg.screenshot(type='jpeg',quality=80))).resize((270,480)),(i*270,0))
        o.save('peek.jpg')
    else:
        ff=subprocess.Popen(['ffmpeg','-v','error','-y','-f','image2pipe','-framerate','30','-c:v','mjpeg','-i','-','-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','video_tmp.mp4'],stdin=subprocess.PIPE)
        for f in range(int(DUR*30)): pg.evaluate(f'render({f/30})'); ff.stdin.write(pg.screenshot(type='jpeg',quality=92))
        ff.stdin.close(); print('rc',ff.wait())
    b.close()
