import json
N="Génesis Éxodo Levítico Números Deuteronomio Josué Jueces Rut 1_Samuel 2_Samuel 1_Reyes 2_Reyes 1_Crónicas 2_Crónicas Esdras Nehemías Ester Job Salmos Proverbios Eclesiastés Cantares Isaías Jeremías Lamentaciones Ezequiel Daniel Oseas Joel Amós Abdías Jonás Miqueas Nahúm Habacuc Sofonías Hageo Zacarías Malaquías Mateo Marcos Lucas Juan Hechos Romanos 1_Corintios 2_Corintios Gálatas Efesios Filipenses Colosenses 1_Tesalonicenses 2_Tesalonicenses 1_Timoteo 2_Timoteo Tito Filemón Hebreos Santiago 1_Pedro 2_Pedro 1_Juan 2_Juan 3_Juan Judas Apocalipsis".split()
C=[50,40,27,36,34,24,21,4,31,24,22,25,29,36,10,13,10,42,150,31,12,8,66,52,5,48,12,14,3,9,1,4,7,3,3,3,2,14,4,28,16,24,21,28,16,16,13,6,6,4,4,5,3,6,4,3,1,13,5,5,3,5,1,1,1,22]
BOOKS=[{"bookid":i+1,"chronorder":i+1,"name":n.replace('_',' '),"chapters":c} for i,(n,c) in enumerate(zip(N,C))]
J3=["Había un hombre de los fariseos que se llamaba Nicodemo, un principal entre los judíos.","Este vino a Jesús de noche, y le dijo: Rabí, sabemos que has venido de Dios como maestro.","Respondió Jesús y le dijo: De cierto, de cierto te digo, que el que no naciere de nuevo, no puede ver el reino de Dios."]+["…"]*12+["Para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.","Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.","Porque no envió Dios a su Hijo al mundo para condenar al mundo, sino para que el mundo sea salvo por él."]
def chapter(b,c):
    if b==43 and c==3: return [{"pk":i+1,"verse":i+1,"text":t} for i,t in enumerate(J3)]
    return [{"pk":i+1,"verse":i+1,"text":"Texto de ejemplo del versículo."} for i in range(20)]
def route(r):
    u=r.request.url
    h={'access-control-allow-origin':'*','content-type':'application/json'}
    if '/get-books/' in u or 'books.json' in u: return r.fulfill(status=200,headers=h,body=json.dumps(BOOKS))
    if '/get-chapter/' in u:
        p=[x for x in u.split('/') if x]; b,c=int(p[-2]),int(p[-1]); return r.fulfill(status=200,headers=h,body=json.dumps(chapter(b,c)))
    if '/v2/find/' in u: return r.fulfill(status=200,headers=h,body=json.dumps({'results':[{'pk':1,'translation':'RV1960','book':43,'chapter':3,'verse':16,'text':J3[16]}],'exact_matches':1,'total':1}))
    return r.fulfill(status=200,headers=h,body='[]')
