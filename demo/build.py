"""Bygger en fristående demo (en enda HTML-fil) av gränssnittet.
Servern ersätts av en låtsasserver i webbläsaren (demo/mock.js).
Kör:  python demo/build.py   ->  demo/dist/arendehantering-demo.html
"""
import os, sys
HERE=os.path.dirname(os.path.abspath(__file__))
base=os.path.join(HERE,'..','static')+os.sep
css=open(base+'app.css',encoding='utf-8').read()
js=open(base+'app.js',encoding='utf-8').read()
mock=open(os.path.join(HERE,'mock.js'),encoding='utf-8').read()
extra_css='''
.demo-pill{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:40;display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  background:#fff;color:var(--ink);border:1px solid var(--line);border-radius:12px;padding:8px 12px;font-size:.85rem;box-shadow:0 8px 24px rgb(0 0 0 / .18);max-width:calc(100% - 32px)}
.demo-pill b{color:var(--violet-ink)}
.demo-pill button{background:none;border:0;color:var(--violet-ink);cursor:pointer;padding:0;font:inherit;text-decoration:underline}
.demo-pill button.armed{color:var(--high)}
'''
html=f'''<title>Ärendehantering</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&display=swap">
<style>
{css}
{extra_css}
</style>
<div id="root"></div>
<div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
<div class="demo-pill" id="demo-pill"><span><b>Demo</b> · inloggning: admin@demo.se / demo1234</span><button type="button" id="demo-reset">Återställ demodata</button></div>
<script>
{mock}
</script>
<script>
{js}
</script>
<script>
(function(){{const b=document.getElementById("demo-reset");let armed=false;
b.addEventListener("click",()=>{{if(!armed){{armed=true;b.classList.add("armed");b.textContent="Bekräfta: radera ändringar";setTimeout(()=>{{armed=false;b.classList.remove("armed");b.textContent="Återställ demodata"}},4000);return}}window.__demoReset()}})}})();
</script>
'''
assert '</script' not in js.replace('</script>','') 
os.makedirs(os.path.join(HERE,'dist'),exist_ok=True)
out=os.path.join(HERE,'dist','arendehantering-demo.html')
# fristående sida: lägg till doctype/head så att den kan öppnas direkt i webbläsaren
open(out,'w',encoding='utf-8').write('<!DOCTYPE html>\n<html lang="sv">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n</head>\n<body>\n'+html+'</body>\n</html>\n')
print('Skapade', out)
