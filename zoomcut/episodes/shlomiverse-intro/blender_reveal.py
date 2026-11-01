# EXPERIMENT, set aside (Seedance on the real logo won, v1/v2 use comp_sd.py). Still renders the empty sky
# behind the logo (out/bg/0420.png, used by make_frames.py).
# Shlomiverse studio-logo reveal - the 3D part (space, the planet and its ring, the sunrise, the camera sweep).
# Everything is built from code; the 2D logo, flashes, bloom, flares and text are added by comp.py.
#
#   blender -b -P blender_reveal.py -- --beats beats-A4.json --res 1080 1920 --frames 0 539 --samples 24 --out out/frames
#   (--still F renders a single frame; meta.json next to the frames has the sun's / planet's screen position per frame)
import bpy, bmesh, math, json, os, sys, random
from mathutils import Vector, Quaternion, Matrix
from bpy_extras.object_utils import world_to_camera_view

HERE = os.path.dirname(os.path.abspath(__file__))
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, n=1, default=None):
    if name in argv:
        i = argv.index(name)
        v = argv[i + 1:i + 1 + n]
        return v if n > 1 else v[0]
    return default

beats = json.load(open(os.path.join(HERE, arg('--beats', default='beats-A4.json')), encoding='utf-8'))
W, H = [int(v) for v in arg('--res', 2, ['1080', '1920'])]
FPS = beats['fps']
NF = int(round(beats['duration'] * FPS))
f0, f1 = [int(v) for v in arg('--frames', 2, ['0', str(NF - 1)])]
STILL = arg('--still')
SAMPLES = int(arg('--samples', default='24'))
OUT = os.path.join(HERE, arg('--out', default='out/frames'))
os.makedirs(OUT, exist_ok=True)
T_HIT, T_LOGO, T_DRUMS = beats['hit1'], beats['logo'], beats['drums_end']

# ---------------------------------------------------------------- scene
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
    try:
        sc.render.engine = eng
        break
    except TypeError:
        pass
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = W, H, 100
sc.render.fps = FPS
sc.frame_start, sc.frame_end = 0, NF - 1
sc.eevee.taa_render_samples = SAMPLES
sc.render.use_motion_blur = True
sc.render.motion_blur_shutter = 0.5
try:
    sc.eevee.motion_blur_steps = 1
except AttributeError:
    pass
sc.view_settings.view_transform = 'AgX'
try:
    sc.view_settings.look = 'AgX - Punchy'
except TypeError:
    pass
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_depth = '16'
sc.render.image_settings.color_mode = 'RGB'
bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'
random.seed(7)

ORANGE = (1.0, 0.30, 0.06, 1)      # #ff6a1f in linear-ish
DEEP = (0.012, 0.010, 0.014, 1)    # #0b0b0e

def lerp(a, b, t): return a + (b - a) * t
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def smooth(t): t = clamp(t); return t * t * (3 - 2 * t)
def ease_out(t, p=3): t = clamp(t); return 1 - (1 - t) ** p
def ease_in(t, p=2): t = clamp(t); return t ** p
def hermite(t, keys):
    """keys: [(t, value, slope)] - piecewise cubic Hermite, clamped outside."""
    if t <= keys[0][0]: return keys[0][1]
    if t >= keys[-1][0]: return keys[-1][1]
    for (ta, va, ma), (tb, vb, mb) in zip(keys, keys[1:]):
        if ta <= t <= tb:
            h = tb - ta; s = (t - ta) / h
            return ((2*s**3 - 3*s**2 + 1) * va + (s**3 - 2*s**2 + s) * h * ma
                    + (-2*s**3 + 3*s**2) * vb + (s**3 - s**2) * h * mb)

def nodes_of(mat_or_world):
    try:
        mat_or_world.use_nodes = True
    except Exception:
        pass
    nt = mat_or_world.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    return nt, nt.nodes, nt.links

def ramp(nodes, stops, interp='LINEAR'):
    r = nodes.new('ShaderNodeValToRGB')
    r.color_ramp.interpolation = interp
    els = r.color_ramp.elements
    while len(els) > 2:
        els.remove(els[-1])
    for i, (pos, col) in enumerate(stops):
        e = els[i] if i < 2 else els.new(pos)
        e.position = pos
        e.color = col
    return r

def math_node(nodes, op, a=None, b=None):
    m = nodes.new('ShaderNodeMath'); m.operation = op
    if a is not None: m.inputs[0].default_value = a
    if b is not None: m.inputs[1].default_value = b
    return m

# ---------------------------------------------------------------- world: stars + nebula
world = bpy.data.worlds.new('Space'); sc.world = world
nt, N, L = nodes_of(world)
out = N.new('ShaderNodeOutputWorld')
bg = N.new('ShaderNodeBackground')
tc = N.new('ShaderNodeTexCoord')
L.new(bg.outputs[0], out.inputs[0])

def star_layer(scale, size, density_cut, gain):
    v = N.new('ShaderNodeTexVoronoi'); v.inputs['Scale'].default_value = scale
    try: v.inputs['Randomness'].default_value = 1.0
    except KeyError: pass
    L.new(tc.outputs['Generated'], v.inputs['Vector'])
    # point: 1 - dist/size, sharpened
    d = math_node(N, 'DIVIDE', None, size); L.new(v.outputs['Distance'], d.inputs[0])
    inv = math_node(N, 'SUBTRACT', 1.0); L.new(d.outputs[0], inv.inputs[1])
    cl = math_node(N, 'MAXIMUM', None, 0.0); L.new(inv.outputs[0], cl.inputs[0])
    pw = math_node(N, 'POWER', None, 3.0); L.new(cl.outputs[0], pw.inputs[0])
    # only some cells carry a star, with random brightness
    sep = N.new('ShaderNodeSeparateColor'); L.new(v.outputs['Color'], sep.inputs[0])
    keep = math_node(N, 'GREATER_THAN', None, density_cut); L.new(sep.outputs[0], keep.inputs[0])
    br = math_node(N, 'MULTIPLY'); L.new(keep.outputs[0], br.inputs[0]); L.new(sep.outputs[1], br.inputs[1])
    m = math_node(N, 'MULTIPLY'); L.new(pw.outputs[0], m.inputs[0]); L.new(br.outputs[0], m.inputs[1])
    g = math_node(N, 'MULTIPLY', None, gain); L.new(m.outputs[0], g.inputs[0])
    return g

s1 = star_layer(260.0, 0.10, 0.55, 6.0)    # dense, faint
s2 = star_layer(90.0, 0.07, 0.85, 40.0)    # sparse, bright
stars = math_node(N, 'ADD'); L.new(s1.outputs[0], stars.inputs[0]); L.new(s2.outputs[0], stars.inputs[1])
# star tint (slightly warm/cool)
star_col = N.new('ShaderNodeMix'); star_col.data_type = 'RGBA'
star_col.inputs['A'].default_value = (0.75, 0.82, 1.0, 1); star_col.inputs['B'].default_value = (1.0, 0.85, 0.7, 1)
nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 30
L.new(tc.outputs['Generated'], nz.inputs['Vector']); L.new(nz.outputs['Fac'], star_col.inputs['Factor'])
star_rgb = N.new('ShaderNodeVectorMath'); star_rgb.operation = 'SCALE'
L.new(star_col.outputs['Result'], star_rgb.inputs[0]); L.new(stars.outputs[0], star_rgb.inputs['Scale'])

# nebula: two noise fields, warm orange core + violet/teal edges, patchy
neb = N.new('ShaderNodeTexNoise'); neb.inputs['Scale'].default_value = 1.6; neb.inputs['Detail'].default_value = 10
neb.inputs['Roughness'].default_value = 0.62; neb.inputs['Distortion'].default_value = 0.6
L.new(tc.outputs['Generated'], neb.inputs['Vector'])
neb_ramp = ramp(N, [(0.40, (0, 0, 0, 1)), (0.55, (0.05, 0.012, 0.03, 1)), (0.66, (0.25, 0.06, 0.012, 1)),
                    (0.76, (0.55, 0.17, 0.03, 1)), (0.86, (0.9, 0.5, 0.25, 1))])
L.new(neb.outputs['Fac'], neb_ramp.inputs[0])
mask = N.new('ShaderNodeTexNoise'); mask.inputs['Scale'].default_value = 0.7; mask.inputs['Detail'].default_value = 3
L.new(tc.outputs['Generated'], mask.inputs['Vector'])
mask_r = ramp(N, [(0.45, (0, 0, 0, 1)), (0.68, (1, 1, 1, 1))])
L.new(mask.outputs['Fac'], mask_r.inputs[0])
neb_m = N.new('ShaderNodeMix'); neb_m.data_type = 'RGBA'; neb_m.blend_type = 'MULTIPLY'; neb_m.inputs['Factor'].default_value = 1
L.new(neb_ramp.outputs[0], neb_m.inputs['A']); L.new(mask_r.outputs[0], neb_m.inputs['B'])
violet = N.new('ShaderNodeTexNoise'); violet.inputs['Scale'].default_value = 2.4; violet.inputs['Detail'].default_value = 8
L.new(tc.outputs['Generated'], violet.inputs['Vector'])
vio_r = ramp(N, [(0.5, (0, 0, 0, 1)), (0.72, (0.05, 0.02, 0.10, 1)), (0.85, (0.02, 0.08, 0.12, 1))])
L.new(violet.outputs['Fac'], vio_r.inputs[0])
neb_sum = N.new('ShaderNodeVectorMath'); neb_sum.operation = 'ADD'
L.new(neb_m.outputs['Result'], neb_sum.inputs[0]); L.new(vio_r.outputs[0], neb_sum.inputs[1])
neb_gain = N.new('ShaderNodeVectorMath'); neb_gain.operation = 'SCALE'; neb_gain.inputs['Scale'].default_value = 0.35
L.new(neb_sum.outputs[0], neb_gain.inputs[0])
sky = N.new('ShaderNodeVectorMath'); sky.operation = 'ADD'
L.new(star_rgb.outputs[0], sky.inputs[0]); L.new(neb_gain.outputs[0], sky.inputs[1])
L.new(sky.outputs[0], bg.inputs['Color'])
bg.inputs['Strength'].default_value = 1.0
WORLD_STRENGTH = bg.inputs['Strength']
NEB_GAIN = neb_gain.inputs['Scale']

# ---------------------------------------------------------------- the planet system
system = bpy.data.objects.new('System', None); sc.collection.objects.link(system)
system.rotation_mode = 'XYZ'
system.rotation_euler = (0, math.radians(-14), 0)   # the ring's tilt in the logo (rises to the right)

def link(obj, parent=system):
    sc.collection.objects.link(obj); obj.parent = parent; return obj

# planet mesh
me = bpy.data.meshes.new('Planet'); bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=160, v_segments=80, radius=1.0)
for f in bm.faces: f.smooth = True
bm.to_mesh(me); bm.free()
planet = link(bpy.data.objects.new('Planet', me))
mat = bpy.data.materials.new('PlanetMat'); planet.data.materials.append(mat)
nt, N, L = nodes_of(mat)
o = N.new('ShaderNodeOutputMaterial'); p = N.new('ShaderNodeBsdfPrincipled')
tco = N.new('ShaderNodeTexCoord')
band_v = N.new('ShaderNodeVectorMath'); band_v.operation = 'MULTIPLY'; band_v.inputs[1].default_value = (1.0, 1.0, 7.0)
L.new(tco.outputs['Object'], band_v.inputs[0])
bands = N.new('ShaderNodeTexNoise'); bands.inputs['Scale'].default_value = 1.4; bands.inputs['Detail'].default_value = 12
bands.inputs['Distortion'].default_value = 1.2; bands.inputs['Roughness'].default_value = 0.6
L.new(band_v.outputs[0], bands.inputs['Vector'])
band_col = ramp(N, [(0.25, (0.010, 0.008, 0.010, 1)), (0.45, (0.06, 0.025, 0.012, 1)), (0.58, (0.20, 0.08, 0.025, 1)),
                    (0.70, (0.05, 0.02, 0.012, 1)), (0.85, (0.30, 0.13, 0.05, 1))])
L.new(bands.outputs['Fac'], band_col.inputs[0])
L.new(band_col.outputs[0], p.inputs['Base Color'])
p.inputs['Roughness'].default_value = 0.55
# glowing veins (read as the world turning even on its night side)
vor = N.new('ShaderNodeTexVoronoi'); vor.feature = 'DISTANCE_TO_EDGE'; vor.inputs['Scale'].default_value = 5.0
L.new(tco.outputs['Object'], vor.inputs['Vector'])
vein = ramp(N, [(0.0, (1, 1, 1, 1)), (0.035, (0, 0, 0, 1))])
L.new(vor.outputs['Distance'], vein.inputs[0])
vein_n = N.new('ShaderNodeTexNoise'); vein_n.inputs['Scale'].default_value = 3.0
L.new(tco.outputs['Object'], vein_n.inputs['Vector'])
vein_m = ramp(N, [(0.45, (0, 0, 0, 1)), (0.65, (1, 1, 1, 1))])
L.new(vein_n.outputs['Fac'], vein_m.inputs[0])
vein_x = math_node(N, 'MULTIPLY'); L.new(vein.outputs[0], vein_x.inputs[0]); L.new(vein_m.outputs[0], vein_x.inputs[1])
# rim glow like the logo: dark core, orange towards the edge, hot at the very edge
lw = N.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.5
rim = ramp(N, [(0.0, (0, 0, 0, 1)), (0.55, (0.02, 0.004, 0.0, 1)), (0.80, (0.6, 0.12, 0.01, 1)),
               (0.93, (1.0, 0.32, 0.05, 1)), (1.0, (1.0, 0.75, 0.45, 1))])
L.new(lw.outputs['Facing'], rim.inputs[0])
rim_s = N.new('ShaderNodeVectorMath'); rim_s.operation = 'SCALE'; rim_s.inputs['Scale'].default_value = 3.0
L.new(rim.outputs[0], rim_s.inputs[0])
vein_c = N.new('ShaderNodeVectorMath'); vein_c.operation = 'SCALE'
vein_c.inputs[0].default_value = (1.0, 0.28, 0.05)
L.new(vein_x.outputs[0], vein_c.inputs['Scale'])
vein_g = N.new('ShaderNodeVectorMath'); vein_g.operation = 'SCALE'; vein_g.inputs['Scale'].default_value = 0.8
L.new(vein_c.outputs[0], vein_g.inputs[0])
emis = N.new('ShaderNodeVectorMath'); emis.operation = 'ADD'
L.new(rim_s.outputs[0], emis.inputs[0]); L.new(vein_g.outputs[0], emis.inputs[1])
L.new(emis.outputs[0], p.inputs['Emission Color']); p.inputs['Emission Strength'].default_value = 1.0
L.new(p.outputs[0], o.inputs[0])
RIM_GAIN = rim_s.inputs['Scale']; VEIN_GAIN = vein_g.inputs['Scale']

# atmosphere shell (additive glow at the silhouette)
me = bpy.data.meshes.new('Atmos'); bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=128, v_segments=64, radius=1.045)
for f in bm.faces: f.smooth = True
bm.to_mesh(me); bm.free()
atmos = link(bpy.data.objects.new('Atmos', me))
amat = bpy.data.materials.new('AtmosMat'); atmos.data.materials.append(amat)
amat.surface_render_method = 'BLENDED'; amat.use_backface_culling = True
nt, N, L = nodes_of(amat)
o = N.new('ShaderNodeOutputMaterial'); tr = N.new('ShaderNodeBsdfTransparent'); em = N.new('ShaderNodeEmission')
add = N.new('ShaderNodeAddShader')
lw = N.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.5
ar = ramp(N, [(0.55, (0, 0, 0, 1)), (0.86, (0.9, 0.22, 0.03, 1)), (0.97, (1.0, 0.45, 0.12, 1)), (1.0, (0, 0, 0, 1))])
L.new(lw.outputs['Facing'], ar.inputs[0]); L.new(ar.outputs[0], em.inputs['Color'])
em.inputs['Strength'].default_value = 2.0
L.new(tr.outputs[0], add.inputs[0]); L.new(em.outputs[0], add.inputs[1]); L.new(add.outputs[0], o.inputs[0])
ATM_GAIN = em.inputs['Strength']

# ring (annulus, concentric bands, a travelling glint)
R_IN, R_OUT = 1.22, 1.62
me = bpy.data.meshes.new('Ring'); bm = bmesh.new()
SEG = 384
inner = [bm.verts.new((R_IN * math.cos(2*math.pi*i/SEG), R_IN * math.sin(2*math.pi*i/SEG), 0)) for i in range(SEG)]
outer = [bm.verts.new((R_OUT * math.cos(2*math.pi*i/SEG), R_OUT * math.sin(2*math.pi*i/SEG), 0)) for i in range(SEG)]
for i in range(SEG):
    j = (i + 1) % SEG
    bm.faces.new((inner[i], outer[i], outer[j], inner[j]))
bm.to_mesh(me); bm.free()
ring = link(bpy.data.objects.new('Ring', me))
rmat = bpy.data.materials.new('RingMat'); ring.data.materials.append(rmat)
rmat.surface_render_method = 'BLENDED'; rmat.use_backface_culling = False
nt, N, L = nodes_of(rmat)
o = N.new('ShaderNodeOutputMaterial'); tr = N.new('ShaderNodeBsdfTransparent'); em = N.new('ShaderNodeEmission')
add = N.new('ShaderNodeAddShader')
tco = N.new('ShaderNodeTexCoord')
ln = N.new('ShaderNodeVectorMath'); ln.operation = 'LENGTH'; L.new(tco.outputs['Object'], ln.inputs[0])
rr = N.new('ShaderNodeMapRange'); rr.inputs['From Min'].default_value = R_IN; rr.inputs['From Max'].default_value = R_OUT
L.new(ln.outputs['Value'], rr.inputs['Value'])
# bands: 1D noise across the radius
bandn = N.new('ShaderNodeTexNoise'); bandn.noise_dimensions = '1D'; bandn.inputs['Scale'].default_value = 18
bandn.inputs['Detail'].default_value = 6
L.new(rr.outputs['Result'], bandn.inputs['W'])
bandr = ramp(N, [(0.3, (0.15, 0.15, 0.15, 1)), (0.55, (0.7, 0.7, 0.7, 1)), (0.7, (1, 1, 1, 1))])
L.new(bandn.outputs['Fac'], bandr.inputs[0])
edge = ramp(N, [(0.0, (0, 0, 0, 1)), (0.06, (1, 1, 1, 1)), (0.88, (1, 1, 1, 1)), (1.0, (0, 0, 0, 1))])
L.new(rr.outputs['Result'], edge.inputs[0])
colr = ramp(N, [(0.0, (1.0, 0.55, 0.18, 1)), (0.5, (1.0, 0.30, 0.05, 1)), (1.0, (0.7, 0.14, 0.02, 1))])
L.new(rr.outputs['Result'], colr.inputs[0])
# glint: angle around the ring vs a moving phase
sxyz = N.new('ShaderNodeSeparateXYZ'); L.new(tco.outputs['Object'], sxyz.inputs[0])
ang = math_node(N, 'ARCTAN2'); L.new(sxyz.outputs['Y'], ang.inputs[0]); L.new(sxyz.outputs['X'], ang.inputs[1])
ph = math_node(N, 'SUBTRACT'); L.new(ang.outputs[0], ph.inputs[0]); ph.inputs[1].default_value = 0.0
GLINT_PHASE = ph.inputs[1]
cs = math_node(N, 'COSINE'); L.new(ph.outputs[0], cs.inputs[0])
cmax = math_node(N, 'MAXIMUM', None, 0.0); L.new(cs.outputs[0], cmax.inputs[0])
gp = math_node(N, 'POWER', None, 24.0); L.new(cmax.outputs[0], gp.inputs[0])
gg = math_node(N, 'MULTIPLY', None, 0.0); L.new(gp.outputs[0], gg.inputs[0]); GLINT_GAIN = gg.inputs[1]
g1 = math_node(N, 'ADD', None, 1.0); L.new(gg.outputs[0], g1.inputs[0])
a1 = math_node(N, 'MULTIPLY'); L.new(bandr.outputs[0], a1.inputs[0]); L.new(edge.outputs[0], a1.inputs[1])
a2 = math_node(N, 'MULTIPLY'); L.new(a1.outputs[0], a2.inputs[0]); L.new(g1.outputs[0], a2.inputs[1])
L.new(colr.outputs[0], em.inputs['Color'])
rs = math_node(N, 'MULTIPLY', None, 0.3); L.new(a2.outputs[0], rs.inputs[0]); RING_GAIN = rs.inputs[1]
L.new(rs.outputs[0], em.inputs['Strength'])
L.new(tr.outputs[0], add.inputs[0]); L.new(em.outputs[0], add.inputs[1]); L.new(add.outputs[0], o.inputs[0])

# ---------------------------------------------------------------- the camera path
cam_data = bpy.data.cameras.new('Cam'); cam_data.lens = 50; cam_data.sensor_fit = 'HORIZONTAL'; cam_data.sensor_width = 36
cam_data.clip_start = 0.05; cam_data.clip_end = 2000
cam_data.shift_y = -0.08          # planet sits at ~42% height at the end, room for the text below
cam = bpy.data.objects.new('Cam', cam_data); sc.collection.objects.link(cam); sc.camera = cam
cam.rotation_mode = 'QUATERNION'

def sph(az, el):
    az, el = math.radians(az), math.radians(el)
    return Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))

D_FINAL = sph(0, 17)                 # where the camera ends (logo framing, before the system tilt)
D_SUN = sph(-35, 25); D_SUN.y = -D_SUN.y; D_SUN.normalize()   # behind the planet, up-left
tilt = system.matrix_world.to_3x3()
D_FINAL = (tilt @ D_FINAL).normalized()
D_SUN = (tilt @ D_SUN).normalized()
A0 = (-D_SUN).normalized()           # straight behind the planet from the sun = total eclipse
axis = A0.cross(D_FINAL).normalized()
ALPHA_FINAL = math.degrees(A0.angle(D_FINAL))

def dist_at(t):
    return hermite(t, [(0.0, 10.5, -0.35), (T_HIT, 4.1, -0.45), (T_LOGO, 5.45, 0.0), (beats['duration'], 5.0, 0.0)])
LIMB = math.degrees(math.asin(1.06 / dist_at(T_HIT)))
def alpha_at(t):   # angle of the camera away from the eclipse line; crosses the limb exactly on the hit
    return hermite(t, [(0.0, -2.0, 0.9), (T_HIT, LIMB, 2.2), (T_HIT + 3.2, LIMB + 22, 9.0),
                       (T_LOGO, ALPHA_FINAL, 0.0), (beats['duration'], ALPHA_FINAL, 0.0)])
def cam_pos(t):
    q = Quaternion(axis, math.radians(alpha_at(t)))
    return (q @ A0) * dist_at(t)

# the sun sits on the line from the camera (at the hit) that just grazes the planet's limb, so it rises exactly then
cp = cam_pos(T_HIT)
to_c = (-cp).normalized()
ang_r = math.asin(1.03 / cp.length)
perp = (D_SUN - D_SUN.dot(to_c) * to_c).normalized()           # the sun's side of the planet as seen from the camera
dir_sun = (to_c * math.cos(ang_r * 1.08) + perp * math.sin(ang_r * 1.08)).normalized()
sun_pos = cp + dir_sun * 300.0

sun_obj_me = bpy.data.meshes.new('SunM'); bm = bmesh.new()
bmesh.ops.create_icosphere(bm, subdivisions=3, radius=2.6); bm.to_mesh(sun_obj_me); bm.free()
sun_obj = bpy.data.objects.new('SunBall', sun_obj_me); sc.collection.objects.link(sun_obj); sun_obj.location = sun_pos
smat = bpy.data.materials.new('SunMat'); sun_obj.data.materials.append(smat)
nt, N, L = nodes_of(smat)
o = N.new('ShaderNodeOutputMaterial'); em = N.new('ShaderNodeEmission'); em.inputs['Color'].default_value = (1.0, 0.82, 0.6, 1)
em.inputs['Strength'].default_value = 0.0; L.new(em.outputs[0], o.inputs[0]); SUN_GAIN = em.inputs['Strength']

lamp_d = bpy.data.lights.new('Sun', 'SUN'); lamp_d.color = (1.0, 0.78, 0.55); lamp_d.angle = math.radians(1.5)
lamp = bpy.data.objects.new('Sun', lamp_d); sc.collection.objects.link(lamp)
lamp.rotation_mode = 'QUATERNION'
lamp.rotation_quaternion = (-(sun_pos.normalized())).to_track_quat('-Z', 'Y')
LAMP = lamp_d

# a faint orange fill from the camera side so the night side is not dead black
fill_d = bpy.data.lights.new('Fill', 'SUN'); fill_d.color = (1.0, 0.45, 0.2); fill_d.energy = 0.02
fill = bpy.data.objects.new('Fill', fill_d); sc.collection.objects.link(fill)
fill.rotation_mode = 'QUATERNION'; fill.rotation_quaternion = (-D_FINAL).to_track_quat('-Z', 'Y')

# ---------------------------------------------------------------- dust (near stars for parallax)
me = bpy.data.meshes.new('Dust'); bm = bmesh.new()
cols = []
for i in range(2600):
    while True:
        pnt = Vector((random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1)))
        if 0.05 < pnt.length <= 1: break
    r = lerp(2.2, 22.0, random.random() ** 0.7)
    pnt = pnt.normalized() * r
    rad = random.uniform(0.004, 0.012) * (r / 6) ** 0.6
    res = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=rad)
    bmesh.ops.translate(bm, verts=res['verts'], vec=pnt)
    b = random.random() ** 2.5 * 6 + 0.3
    tint = (1.0, 0.8, 0.6) if random.random() < 0.35 else (0.85, 0.9, 1.0)
    cols.append((len(res['verts']), (tint[0] * b, tint[1] * b, tint[2] * b, 1)))
bm.to_mesh(me); bm.free()
ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
k = 0
for n, c in cols:
    for _ in range(n):
        ca.data[k].color = c; k += 1
dust = bpy.data.objects.new('Dust', me); sc.collection.objects.link(dust)
dmat = bpy.data.materials.new('DustMat'); dust.data.materials.append(dmat)
nt, N, L = nodes_of(dmat)
o = N.new('ShaderNodeOutputMaterial'); em = N.new('ShaderNodeEmission'); at = N.new('ShaderNodeAttribute'); at.attribute_name = 'Col'
L.new(at.outputs['Color'], em.inputs['Color']); em.inputs['Strength'].default_value = 1.0; L.new(em.outputs[0], o.inputs[0])
DUST_GAIN = em.inputs['Strength']

# ---------------------------------------------------------------- animate (a key on every frame, our own curves)
meta = {'fps': FPS, 'w': W, 'h': H, 'frames': []}
prev_q = None
for f in range(NF):
    t = f / FPS
    pos = cam_pos(t)
    cam.location = pos
    look = Vector((0, 0, 0))
    q = (look - pos).to_track_quat('-Z', 'Y')
    # tiny handheld-free drift: a slow roll that settles to 0 at the logo
    roll = math.radians(6.0) * (1 - smooth((t - 0.5) / (T_LOGO - 0.5)))
    q = q @ Quaternion((0, 0, 1), roll)
    if prev_q is not None and q.dot(prev_q) < 0: q.negate()
    prev_q = q.copy()
    cam.rotation_quaternion = q
    cam.keyframe_insert('location', frame=f); cam.keyframe_insert('rotation_quaternion', frame=f)
    # the world turns: slow spin, a push of speed after the hit
    spin = 18 * t / beats['duration'] + 26 * smooth((t - T_HIT + 0.3) / 5.0)
    planet.rotation_euler = (0, 0, math.radians(-spin)); planet.keyframe_insert('rotation_euler', frame=f)
    ring.rotation_euler = (0, 0, math.radians(-spin * 0.4)); ring.keyframe_insert('rotation_euler', frame=f)
    # light: an eclipse during the drums (only the rim breathes with the roll), the sunrise on the hit
    pre = smooth(t / T_DRUMS) * 0.5 + 0.5 * smooth((t - T_DRUMS) / (T_HIT - T_DRUMS))
    burst = math.exp(-max(0.0, t - T_HIT) * 2.2) if t >= T_HIT else 0.0
    lit = smooth((t - T_HIT + 0.08) / 0.25)
    RIM_GAIN.default_value = 0.6 + 2.6 * pre + 3.0 * burst
    RIM_GAIN.keyframe_insert('default_value', frame=f)
    ATM_GAIN.default_value = 0.6 + 2.2 * pre + 4.0 * burst
    ATM_GAIN.keyframe_insert('default_value', frame=f)
    VEIN_GAIN.default_value = 0.25 + 0.9 * pre
    VEIN_GAIN.keyframe_insert('default_value', frame=f)
    SUN_GAIN.default_value = 60 * smooth((t - T_HIT + 1.2) / 1.2) + 900 * lit * (0.35 + 0.65 * burst)
    SUN_GAIN.default_value *= 1 - smooth((t - T_LOGO + 0.2) / 0.6)
    SUN_GAIN.keyframe_insert('default_value', frame=f)
    LAMP.energy = 0.05 + 4.5 * lit
    LAMP.keyframe_insert('energy', frame=f)
    RING_GAIN.default_value = 0.35 + 0.9 * pre + 2.6 * lit + 4.0 * burst
    RING_GAIN.keyframe_insert('default_value', frame=f)
    GLINT_PHASE.default_value = -2.6 + 4.2 * smooth((t - T_HIT) / (T_LOGO - T_HIT))
    GLINT_PHASE.keyframe_insert('default_value', frame=f)
    GLINT_GAIN.default_value = 5.0 * lit
    GLINT_GAIN.keyframe_insert('default_value', frame=f)
    NEB_GAIN.default_value = 0.22 + 0.25 * smooth(t / T_HIT) + 0.25 * burst
    NEB_GAIN.keyframe_insert('default_value', frame=f)
    # the 2D logo takes over on the logo hit: the 3D planet goes away under the flash
    gone = t >= T_LOGO
    for ob in (planet, atmos, ring):
        ob.hide_render = gone; ob.keyframe_insert('hide_render', frame=f)

# per-frame screen positions for comp.py (sun flare, planet centre)
for f in range(NF):
    sc.frame_set(f)
    s = world_to_camera_view(sc, cam, sun_pos)
    pc = world_to_camera_view(sc, cam, Vector((0, 0, 0)))
    d = (cam.matrix_world.translation).length
    rpx = (cam_data.lens / cam_data.sensor_width) * W * math.tan(math.asin(min(0.999, 1.0 / d)))
    meta['frames'].append({'sun': [s.x * W, (1 - s.y) * H, s.z], 'sun_gain': SUN_GAIN.default_value,
                           'planet': [pc.x * W, (1 - pc.y) * H], 'planet_r': rpx})
json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'))
print('ALPHA_FINAL', round(ALPHA_FINAL, 1), 'LIMB', round(LIMB, 1), 'final planet', meta['frames'][int(T_LOGO * FPS) - 1])

if arg('--save'):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, arg('--save')))

# ---------------------------------------------------------------- render
import time
frames = [int(x) for x in STILL.split(',')] if STILL else range(f0, f1 + 1)
for f in frames:
    sc.frame_set(f)
    sc.render.filepath = os.path.join(OUT, f'{f:04d}.png')
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    print(f'FRAME {f} {time.time() - t0:.2f}s', flush=True)
