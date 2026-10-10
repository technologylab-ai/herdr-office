"""Original meter-scale, stylized office assets, modeled and exported with Blender.
Run npm run models. No external assets, services, or AI-generated characters.
Blender coordinates are Z-up; glTF exports Y-up for Three.js.
"""
import bpy, math, os, json
from mathutils import Vector

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'public','models')
os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for m in list(bpy.data.materials): bpy.data.materials.remove(m)

def mat(name,color,rough=.65,metal=0,emission=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    if emission:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
    return m

oak=mat('Warm ash wood',(.63,.40,.22));darkwood=mat('Walnut accents',(.21,.12,.075))
ivory=mat('Warm porcelain',(.86,.85,.77));metal=mat('Graphite powder coat',(.07,.09,.085),.35,.4)
screen=mat('Screen',(.025,.085,.073),.3,0,.3);key=mat('Keyboard',(.17,.19,.17))
green=mat('Sage upholstery',(.22,.34,.27));leaf=mat('Plant leaves',(.16,.34,.19))
leaf2=mat('Light leaves',(.29,.48,.25));soil=mat('Potting soil',(.1,.07,.04))
terracotta=mat('Terracotta',(.63,.31,.20));copper=mat('Brushed brass',(.65,.48,.25),.35,.6)
water=mat('Water bottle',(.37,.66,.70),.25);blue=mat('Cold tap',(.17,.38,.66));red=mat('Hot tap',(.70,.20,.14))
skin=mat('Skin',(.90,.72,.61));hair=mat('Hair',(.30,.16,.08));shirt=mat('Shirt',(.39,.51,.41))
pants=mat('Trousers',(.16,.20,.23));shoe=mat('Shoes',(.06,.055,.05));eyes=mat('Eyes',(.035,.027,.023))
lips=mat('Lips',(.44,.23,.20));iris=mat('Iris',(.24,.39,.45));eye_white=mat('Eye whites',(.94,.92,.85),.38);book_red=mat('Book coral',(.60,.25,.18))
paper=mat('Book pages',(.82,.79,.68));lamp=mat('Lamp linen',(.92,.82,.62),.8,0,.35)

def use(o,name,m):
    o.name=name;o.data.materials.append(m)
    return o
def box(name,loc,size,m,bevel=.02,segments=2):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=use(bpy.context.object,name,m)
    o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        b=o.modifiers.new('Soft crafted edges','BEVEL');b.width=bevel;b.segments=segments
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=b.name)
    return o
def sphere(name,loc,size,m,segments=12,rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1,location=loc)
    o=use(bpy.context.object,name,m);o.scale=size
    for p in o.data.polygons:p.use_smooth=True
    return o
def cyl(name,loc,r,depth,m,verts=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=depth,location=loc)
    o=use(bpy.context.object,name,m)
    return o
def limb(name,a,b,r,m):
    v=Vector(b)-Vector(a);o=cyl(name,(Vector(a)+Vector(b))/2,r,v.length,m)
    for p in o.data.polygons:
        if len(p.vertices)==4:p.use_smooth=True
    o.rotation_euler=v.to_track_quat('Z','Y').to_euler();return o

def join_parts(objects,name,pivot):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
    o=bpy.context.object;o.name=name
    bpy.context.scene.cursor.location=pivot;bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    return o

def desk():
    box('Ash desktop',(0,0,.77),(1.8,.86,.075),oak,.045)
    for x in [-.73,.73]:
        for y in [-.29,.29]:box('Desk leg',(x,y,.36),(.055,.055,.72),metal,.012)
        box('Foot rail',(x,0,.13),(.06,.64,.04),metal)
    box('Cable tray',(0,.23,.63),(1.3,.15,.10),metal)
    box('Monitor base',(0,.16,.82),(.32,.22,.035),metal)
    box('Monitor stand',(0,.22,1.02),(.055,.055,.36),metal)
    box('Monitor bezel',(0,.20,1.22),(.78,.048,.46),metal,.035)
    box('Screen',(0,.172,1.22),(.735,.005,.411),screen,.004)
    sphere('Monitor power LED',(.34,.172,1.011),(.003,.002,.003),leaf2,8)
    box('Webcam',(0,.20,1.465),(.075,.042,.028),metal,.009)
    sphere('Webcam lens',(0,.174,1.465),(.009,.004,.009),eyes,8)
    box('Desk drawer',(-.59,.01,.67),(.40,.54,.11),oak,.018)
    box('Drawer handle',(-.59,-.27,.67),(.12,.026,.014),copper,.005)
    box('Desk mat',(0,-.24,.812),(.73,.31,.004),darkwood,.012)
    box('Keyboard',(0,-.25,.827),(.49,.17,.028),key,.015)
    for row in range(3):
        for col in range(11):box('Key',(-.21+col*.041,-.30+row*.042,.847),(.033,.027,.008),ivory,.003)
    box('Mousepad',(.48,-.21,.813),(.22,.26,.005),green,.01)
    sphere('Mouse',(.48,-.20,.835),(.043,.06,.025),ivory)
    box('Closed notebook',(-.59,-.17,.819),(.20,.27,.025),green)
    box('Notebook band',(-.53,-.17,.835),(.01,.27,.009),copper,.001)
    cyl('Coffee mug',(.68,.08,.87),.043,.105,ivory)
    cyl('Coffee',(.68,.08,.924),.034,.002,darkwood)
    sphere('Mug handle',(.725,.08,.87),(.025,.014,.04),ivory)

def chair():
    cyl('Chair stem',(0,0,.26),.035,.30,metal)
    for i in range(5):
        a=i*math.tau/5
        limb('Chair spoke',(0,0,.12),(.28*math.cos(a),.28*math.sin(a),.08),.022,metal)
        sphere('Caster',(.29*math.cos(a),.29*math.sin(a),.065),(.04,.04,.04),metal)
    box('Seat',(0,0,.51),(.53,.48,.09),green,.065)
    box('Chair back',(0,-.23,.83),(.51,.10,.61),green,.065)
    for x in [-.29,.29]:
        box('Armrest post',(x,0,.61),(.025,.025,.24),metal)
        box('Armrest',(x,0,.735),(.065,.31,.045),metal)

def soft(name,loc,size,m):
    return sphere(name,loc,size,m,24,16)

def rounded(name,loc,size,m,bevel=.04):
    o=box(name,loc,size,m,bevel,5)
    # Smooth only the bevel bands, retaining clean planar faces on the toy-like
    # rounded boxes. This preserves the deliberately chunky silhouette.
    for face in o.data.polygons:face.use_smooth=len(face.vertices)==4 and face.area<bevel*bevel*3
    return o

def tailored_trousers(hip):
    # One continuous, gently tapered silhouette avoids a spherical pelvis and
    # separate thigh caps reading as a bulge or producing a deep crotch crease.
    from mathutils.geometry import tessellate_polygon
    outline=[(-.155,hip+.08),(-.145,.475),(-.140,.10),(-.035,.10),
             (-.024,.58),(.024,.58),(.035,.10),(.140,.10),(.145,.475),(.155,hip+.08)]
    flat=[Vector((x,0,z)) for x,z in outline];indices={tuple(v):i for i,v in enumerate(flat)}
    caps=[[v if isinstance(v,int) else indices[tuple(v)] for v in tri] for tri in tessellate_polygon([flat])]
    half_depth=lambda z:.065+.04*min(1,max(0,(z-.10)/.50))
    count=len(outline)
    verts=[(x,sign*half_depth(z),z) for sign in [1,-1] for x,z in outline]
    faces=caps+[[i+count for i in reversed(tri)] for tri in caps]
    faces += [(i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count)]
    mesh=bpy.data.meshes.new('Tailored trousers');mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new('Tailored trousers',mesh);bpy.context.collection.objects.link(o);use(o,'Tailored trousers',pants)
    bevel=o.modifiers.new('Soft trouser edges','BEVEL');bevel.width=.015;bevel.segments=3
    bevel.limit_method='ANGLE';bevel.angle_limit=.20
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=bevel.name)
    return o

def shaped_torso(hip,style=0):
    female=style in (2,3)
    body=rounded('Sweater body',(0,0,hip+.25),(.325,.235,.38) if female else (.35,.25,.39),shirt,.065)
    if female:
        for v in body.data.vertices:
            if v.co.z<-.05:v.co.x*=1-.08*min(1,(-v.co.z-.05)/.14)
    rounded('Sweater hem',(0,0,hip+.085),(.315,.238,.045) if female else (.335,.253,.045),shirt,.016)
    if style==2:
        rounded('Cardigan inner top',(0,.124,hip+.30),(.105,.012,.25),ivory,.007)
        for sign in [-1,1]:
            edge=rounded('Cardigan front edge',(sign*.062,.126,hip+.30),(.022,.016,.27),shirt,.007)
            edge.rotation_euler[1]=-sign*.18

def hair_cap(head,style):
    rounded('Hair cap',(0,-.017,head+.205),(.50,.41,.15) if style==2 else (.486,.405,.15),hair,.06)
    rounded('Hair back',(0,-.173,head+.065),(.455,.10,.31),hair,.037)
    if style in [0,1]:
        for i in range(2):
            o=rounded('Side swept fringe',(-.072+i*.13,.153,head+.175),(.225,.092,.10),hair,.032)
            o.rotation_euler[1]=-.14 if style==0 else .14
    if style==1:
        o=rounded('Raised quiff',(.028,.035,head+.273),(.365,.265,.090),hair,.036)
        o.rotation_euler[1]=-.08
    if style==2:
        for x in [-.226,.226]:
            side=rounded('Bob side',(x,-.03,head-.06),(.060,.36,.40),hair,.028)
            side.rotation_euler[0]=-.10
        rounded('Bob nape',(0,-.175,head-.09),(.43,.095,.31),hair,.037)
        fringe=rounded('Bob side swept fringe',(-.05,.158,head+.195),(.30,.085,.11),hair,.032)
        fringe.rotation_euler[1]=.18
    if style==3:
        rounded('Swept back hairline',(0,.15,head+.205),(.44,.07,.085),hair,.030)
        rounded('High bun',(0,-.165,head+.29),(.17,.15,.15),hair,.06)
        tie=rounded('Hair tie',(0,-.135,head+.235),(.12,.035,.03),metal,.01)
        tie.rotation_euler[0]=-.6
        for x in [-.222,.222]:rounded('Face framing strand',(x,.085,head+.03),(.032,.040,.16),hair,.014)


def person(seated,style=0):
    female=style in (2,3)
    hip=.69 if seated else (.76 if female else .78);head=1.37 if seated else (1.45 if female else 1.48)
    torso=hip+.32
    if style==2 and not seated:tailored_trousers(hip)
    else:soft('Pelvis',(0,0,hip),(.205,.135,.145) if style==2 else ((.17,.13,.145) if style==3 else (.19,.13,.145)),pants)
    shaped_torso(hip,style)
    rounded('Neck',(0,0,head-.25),(.085,.082,.085) if female else (.095,.09,.085),skin,.018)
    before_head=set(bpy.data.objects)
    face=rounded('Face',(0,0,head),(.455,.395,.455) if female else (.47,.40,.47),skin,.090 if female else .077)
    if female:
        for v in face.data.vertices:
            if v.co.z<-.05:v.co.x*=1-.06*min(1,(-v.co.z-.05)/.1775)
    hair_cap(head,style)
    for x in [-.230,.230] if female else [-.237,.237]:
        soft('Ear',(x,-.010,head-.010),(.028,.030,.046),skin)
    for x in [-.080,.080]:
        soft('Eye white',(x,.204,head+.024),(.039,.011,.052 if female else .048),eye_white)
        soft('Iris',(x,.214,head+.023),(.022,.006,.033 if female else .030),iris)
        soft('Pupil',(x,.219,head+.023),(.013,.004,.024 if female else .022),eyes)
        soft('Eye sparkle',(x-.008,.223,head+(.041 if female else .039)),(.006,.002,.008),ivory)
        if female:
            sign=1 if x>0 else -1
            brow=[(x-sign*.038,.206,head+.110),(x+sign*.012,.208,head+.121),(x+sign*.042,.206,head+.109)]
            for a,b in zip(brow,brow[1:]):limb('Arched eyebrow',a,b,.0072,hair)
            lash=[(x-.037,.213,head+.064),(x,.214,head+.078),(x+.037,.213,head+.064)]
            for a,b in zip(lash,lash[1:]):limb('Upper lash',a,b,.006,eyes)
            limb('Outer lash',(x+sign*.037,.213,head+.064),(x+sign*.050,.212,head+.075),.0045,eyes)
        else:rounded('Eyebrow',(x,.203,head+.105),(.087,.016,.020),hair,.008)
    rounded('Nose bridge',(0,.203,head-(.008 if female else .013)),(.022,.022,.055) if female else (.026,.024,.065),skin,.012)
    soft('Nose tip',(0,.222,head-(.034 if female else .036)),(.025,.023,.019) if female else (.029,.026,.022),skin)
    smile_width=.036 if female else .041;smile_curve=.010 if female else .012
    for i in range(4):
        x=-smile_width+i*smile_width/2;x2=x+smile_width/2
        z=head-.102+smile_curve*(x/smile_width)**2;z2=head-.102+smile_curve*(x2/smile_width)**2
        limb('Smile',(x,.203,z),(x2,.203,z2),.0055 if female else .005,lips)
    if female:rounded('Lower lip',(0,.202,head-.111),(.040,.012,.014),lips,.006)
    if style==0:
        rounded('Short beard',(0,.191,head-.158),(.23,.029,.10),hair,.033)
    if style==1:
        # Distinct rectangular glasses in addition to the short quiff silhouette.
        for x in [-.080,.080]:
            for z in [head-.025,head+.078]:
                rounded('Glasses rim',(x,.229,z),(.114,.013,.011),metal,.004)
            for side in [-1,1]:
                rounded('Glasses side',(x+side*.055,.229,head+.026),(.010,.014,.10),metal,.004)
        limb('Glasses bridge',(-.026,.23,head+.038),(.026,.23,head+.038),.004,metal)
    # Small modern headset; the face and hairstyle remain visible.
    hs=.022 if style==2 else 0
    for sign in [-1,1]:
        soft('Headphone cushion',(sign*(.248+hs),-.018,head-.008),(.022,.059,.078),shoe)
        soft('Headphone shell',(sign*(.270+hs),-.018,head-.008),(.016,.053,.067),metal)
        soft('Headphone inset',(sign*(.286+hs),-.018,head-.008),(.005,.038,.050),green)
    for i in range(16):
        a=math.pi*i/16;b=math.pi*(i+1)/16
        limb('Headband',((.272+hs)*math.cos(a),-.023,head+.012+(.282+hs)*math.sin(a)),
             ((.272+hs)*math.cos(b),-.023,head+.012+(.282+hs)*math.sin(b)),.010,metal)
    # Route the boom outside the cheek, then turn inward in front of the face.
    # A direct ear-to-mouth diagonal cuts through the chunky head (and bob hair).
    boom=[(.286+hs,.012,head-.038),(.296+hs,.080,head-.060),
          (.278+hs,.263,head-.081),(.135+hs,.280,head-.081)]
    for a,b in zip(boom,boom[1:]):limb('Headset microphone',a,b,.005,metal)
    for p in boom[1:-1]:sphere('Microphone joint',p,(.005,.005,.005),metal)
    soft('Microphone tip',boom[-1],(.014,.010,.010),shoe)
    join_parts([o for o in bpy.data.objects if o not in before_head],'Head',(0,0,head-.18))
    if style==3:
        if seated:
            skirt=rounded('Skirt lap',(0,.165,.675),(.38,.42,.18),pants,.05);skirt.rotation_euler[0]=-.28
        else:
            skirt=rounded('Skirt',(0,0,.62),(.37,.27,.34),pants,.05)
            for v in skirt.data.vertices:
                if v.co.z>0:v.co.x*=.95
    leg_x=(.095 if seated else .085) if style==2 else (.085 if style==3 else .105)
    leg_material=shoe if style==3 else pants
    for x in [-leg_x,leg_x]:
        if seated:
            limb('Thigh',(x,0,hip),(x,.35,.59),.074 if style==2 else (.070 if style==3 else .079),leg_material)
            limb('Shin',(x,.35,.59),(x,.37,.13),.056 if style==2 else (.052 if style==3 else .060),leg_material)
            soft('Knee',(x,.35,.59),(.066,.066,.066) if style==3 else (.080,.077,.077),leg_material)
        elif style!=2:
            knee=.475 if female else .49;ankle=.10 if female else .13
            limb('Thigh',(x,0,hip),(x,.015,knee),.070 if female else .080,leg_material)
            limb('Shin',(x,.015,knee),(x,0,ankle),.052 if female else .062,leg_material)
            soft('Knee',(x,.015,knee),(.066,.066,.066) if female else (.074,.072,.077),leg_material)
        box('Shoe',(x,.43 if seated else .06,.060 if female else (.085 if seated else .075)),(.115,.225,.075) if female else (.14,.265 if seated else .255,.105),shoe,.025 if female else .032)
        box('Sole',(x,.43 if seated else .06,.018 if female else .032),(.118,.23,.016) if female else (.145,.265,.022),ivory,.007 if female else .010)
        box('Loafer strap' if female else 'Shoe lace',(x,.48 if seated else .11,.100 if female else (.137 if seated else .127)),(.070,.018,.006) if female else (.080,.026,.005),ivory,.002)
    for sign in [-1,1]:
        shoulder=(sign*(.160 if female else .173),0,hip+(.365 if female else .37))
        elbow=(sign*(.222 if female else .235),.20,torso-.095) if seated else (sign*(.222 if style==3 else .225),0,torso-.15)
        hand=(sign*.17,.49,.855) if seated else (sign*(.232 if style==3 else .225),.03 if style==3 else .02,torso-.40)
        limb('UpperArmL' if sign<0 else 'UpperArmR',shoulder,elbow,.058 if female else .065,shirt)
        soft('Sleeve shoulder',shoulder,(.060,.062,.070) if female else (.066,.067,.075),shirt)
        soft('Sleeve cuff',elbow,(.063,.060,.062),shirt)
        before_arm=set(bpy.data.objects)
        limb('Forearm',elbow,hand,.037 if female else .041,skin)
        soft('Palm',hand,(.043,.058,.027) if female else (.047,.063,.029),skin)
        digit=.92 if female else 1
        soft('Thumb',(hand[0]-sign*.036*digit,hand[1]+.020,hand[2]-.003),(.018*digit,.030*digit,.018*digit),skin)
        for finger in range(3):
            soft('Finger',(hand[0]+(finger-1)*.021*digit,hand[1]+.049,hand[2]-.006),(.012*digit,.031*digit,.016*digit),skin)
        join_parts([o for o in bpy.data.objects if o not in before_arm],
                   'ForearmL' if sign<0 else 'ForearmR',elbow)
    # A simple office sweater with a collar and identity badge.
    if style==3:
        for x in [-.04,.04]:
            collar=rounded('Blouse collar',(x,.115,hip+.415),(.075,.030,.035),ivory,.01);collar.rotation_euler[1]=.35 if x>0 else -.35
    elif not female:
        for x in [-.037,.037]:limb('Collar',(x,.082,hip+.43),(x*.40,.121,hip+.38),.011,ivory)
    badge_x=-.105 if style==2 else -.09
    box('Badge',(badge_x,.132,torso+.055),(.047,.008,.065),ivory,.005)
    box('Badge stripe',(badge_x,.138,torso+.065),(.031,.003,.008),green,.002)

def plant():
    cyl('Clay planter',(0,0,.18),.22,.35,terracotta)
    cyl('Soil',(0,0,.359),.19,.012,soil)
    for i in range(9):
        a=i*2.4;h=.55+(i%3)*.16;x=math.cos(a)*.18;y=math.sin(a)*.18
        limb('Plant stem',(0,0,.32),(x,y,h),.01,leaf)
        o=sphere('Leaf',(x*1.3,y*1.3,h),(.10,.045,.24),leaf if i%2 else leaf2)
        o.rotation_euler=(math.sin(a)*.55,math.cos(a)*.55,a)

def coffee():
    box('Coffee cabinet',(0,0,.45),(1.85,.65,.9),ivory,.025)
    box('Walnut counter',(0,0,.94),(1.95,.75,.085),darkwood,.03)
    for x in [-.6,0,.6]:
        box('Cupboard door',(x,-.337,.46),(.55,.018,.76),oak,.012)
        box('Door pull',(x,-.36,.66),(.15,.025,.015),copper,.006)
    box('Coffee machine',(-.38,0,1.22),(.56,.42,.51),metal,.04)
    box('Coffee face',(-.38,-.224,1.24),(.48,.015,.40),ivory,.025)
    box('Coffee display',(-.38,-.237,1.36),(.20,.01,.095),screen,.008)
    box('Coffee drip tray',(-.38,-.25,1.006),(.41,.23,.025),metal)
    for x in [-.47,-.29]:
        cyl('Coffee nozzle',(x,-.22,1.18),.015,.08,copper)
        cyl('Cup',(x,-.29,1.06),.035,.075,ivory)
    cyl('Bean hopper',(-.38,.015,1.56),.16,.17,darkwood)
    for i in range(4):cyl('Stacked cup',(.33+i*.09,-.1,1.01),.036,.075,ivory)
    box('Tea tray',(.60,.07,1.01),(.29,.24,.045),oak)
    for i in range(3):box('Tea tin',(.51+i*.08,.08,1.10),(.06,.08,.15),green)

def cooler():
    box('Cooler body',(0,0,.59),(.42,.40,.98),ivory,.06)
    box('Cooler foot',(0,0,.085),(.43,.41,.13),metal,.02)
    box('Cooler recess',(0,-.205,.75),(.31,.01,.23),metal)
    for x,m in [(-.085,blue),(.085,red)]:
        box('Tap',(x,-.235,.82),(.052,.062,.04),m,.01)
    box('Drip tray',(0,-.25,.635),(.30,.12,.03),metal,.01)
    cyl('Water bottle',(0,0,1.31),.185,.40,water)
    cyl('Bottle neck',(0,0,1.095),.065,.08,blue)
    for h in [1.16,1.26,1.40,1.48]:cyl('Bottle ridge',(0,0,h),.19,.02,water)

def bookshelf():
    box('Bookcase back',(0,.16,.94),(1.22,.04,1.88),darkwood,.012)
    for x in [-.61,.61]:box('Bookcase side',(x,0,.94),(.055,.39,1.88),oak,.016)
    for z in [.06,.48,.91,1.34,1.88]:box('Shelf',(0,0,z),(1.25,.39,.045),oak,.012)
    colors=[green,book_red,ivory,blue,darkwood]
    for shelf in range(4):
        for i in range(9):
            x=-.50+i*.115;h=.23+((i*7+shelf*3)%5)*.026;z=[.06,.48,.91,1.34][shelf]+.03
            box('Book cover',(x,.008,z+h/2),(.075,.23,h),colors[(i+shelf)%len(colors)],.004)
            box('Book pages',(x,-.025,z+h/2),(.056,.198,h-.024),paper,.002)
            box('Book spine',(x,-.113,z+h/2),(.078,.024,h),colors[(i+shelf)%len(colors)],.004)
            for dz in [-.07,.065]:box('Spine gilt',(x,-.127,z+h/2+dz),(.051,.003,.008),copper,.001)

def sofa():
    for x in [-.79,.79]:
        for y in [-.24,.24]:cyl('Sofa foot',(x,y,.10),.035,.20,darkwood)
    box('Sofa frame',(0,0,.30),(1.94,.73,.30),metal,.065)
    box('Sofa back',(0,.27,.64),(1.87,.22,.63),green,.08)
    for x in [-.91,.91]:box('Sofa arm',(x,-.04,.48),(.20,.72,.39),green,.07)
    for x in [-.49,0,.49]:
        box('Seat cushion',(x,-.075,.48),(.48,.53,.17),green,.06)
        o=box('Back cushion',(x,.145,.72),(.47,.18,.41),green,.055);o.rotation_euler[0]=-.12
    o=box('Coral pillow',(-.65,.00,.71),(.33,.14,.32),book_red,.065);o.rotation_euler[1]=.17
    o=box('Linen pillow',(.65,.00,.71),(.33,.14,.32),ivory,.065);o.rotation_euler[1]=-.17

def floor_lamp():
    cyl('Lamp base',(0,0,.035),.22,.07,metal,24)
    cyl('Lamp stem',(0,0,.84),.018,1.62,copper,16)
    # Open shade: layered rings and tapered thin walls rather than a solid cap.
    bpy.ops.mesh.primitive_cone_add(vertices=32,radius1=.27,radius2=.19,depth=.31,location=(0,0,1.65))
    o=use(bpy.context.object,'Linen shade',lamp)
    cyl('Shade lower trim',(0,0,1.493),.271,.012,ivory,32)
    cyl('Shade upper trim',(0,0,1.806),.193,.012,ivory,32)
    sphere('Lamp diffuser',(0,0,1.48),(.15,.15,.013),lamp,16)

def meeting_table():
    box('Meeting tabletop',(0,0,.77),(2.7,1.24,.07),oak,.16)
    for x in [-.86,.86]:
        box('Table pedestal',(x,0,.375),(.10,.42,.72),metal,.025)
        box('Table foot',(x,0,.06),(.56,.70,.07),metal,.025)
    box('Cable access',(0,0,.809),(.32,.12,.008),metal,.015)
    box('Meeting notebook',(-.65,-.33,.82),(.27,.22,.024),green,.01)
    box('Meeting pen',(-.39,-.33,.824),(.012,.17,.012),copper,.005)
    for x in [-.89,.85]:
        cyl('Glass coaster',(x,.25,.813),.07,.008,darkwood,16)
        cyl('Meeting glass',(x,.25,.868),.04,.104,water,16)

def wall_clock():
    o=cyl('Clock brass rim',(0,0,0),.26,.038,copper,48);o.rotation_euler[0]=math.pi/2
    o=cyl('Clock face',(0,-.022,0),.243,.012,ivory,48);o.rotation_euler[0]=math.pi/2
    for i in range(12):
        a=i*math.tau/12
        o=box('Hour mark',(.207*math.sin(a),-.032,.207*math.cos(a)),(.015,.006,.032),metal,.002)
        o.rotation_euler[1]=a
    limb('Minute hand',(0,-.039,0),(.132,-.039,.092),.007,metal)
    limb('Hour hand',(0,-.039,0),(-.08,-.039,.09),.010,metal)
    sphere('Clock hub',(0,-.044,0),(.017,.008,.017),copper)

assets=[('desk',desk),('chair',chair),('person-seated',lambda:person(True)),
    ('person-standing',lambda:person(False)),
    *[(f'person-{pose}-{style}',lambda seated=pose=='seated',style=style:person(seated,style))
      for style in range(1,4) for pose in ['seated','standing']],('plant',plant),('coffee-station',coffee),('water-cooler',cooler),
    ('bookshelf',bookshelf),('sofa',sofa),('floor-lamp',floor_lamp),('meeting-table',meeting_table),('wall-clock',wall_clock)]
manifest={}
for name,build in assets:
    before=set(bpy.data.objects);build();created=[o for o in bpy.data.objects if o not in before]
    # Consolidate static pieces by material so a large live floor remains inexpensive
    # to draw. Keep screens and character animation parts independently addressable.
    batches={}
    for o in created:
        if o.name=='Screen' or (name.startswith('person') and (o.name.startswith('Head') or o.name.startswith('Forearm'))):continue
        batches.setdefault(o.data.materials[0].name,[]).append(o)
    for material_name,objects in batches.items():
        if len(objects)<2:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        bpy.ops.object.join();bpy.context.object.name=name+' '+material_name
    created=[o for o in bpy.data.objects if o not in before]
    collection=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(collection)
    for o in created:
        for c in list(o.users_collection):c.objects.unlink(o)
        collection.objects.link(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in created:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'),export_format='GLB',
        use_selection=True,export_yup=True,export_materials='EXPORT',export_animations=False)
    manifest[name]={'objects':len(created),'file':name+'.glb'}
# Preserve the original editable kit in separated named collections.
os.makedirs(os.path.join(ROOT,'assets'),exist_ok=True)
bpy.context.preferences.filepaths.save_version=0
# Saved workspace UI can remember the modeler's home directory. Keep the
# editable asset portable and free of local file-browser history.
for workspace_screen in bpy.data.screens:
    for area in workspace_screen.areas:
        for space in area.spaces:
            if space.type == 'FILE_BROWSER' and space.params:
                space.params.directory=b'//'
                space.params.filename=''
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'assets','office-kit.blend'))
with open(os.path.join(OUT,'manifest.json'),'w') as f:json.dump(manifest,f,indent=2)
print('EXPORTED_OFFICE_KIT',json.dumps(manifest))
