import bpy,sys
a=sys.argv[sys.argv.index('--')+1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a[0])
for o in bpy.context.scene.objects:
    if o.type=='MESH':
        n=len(o.data.polygons); bpy.context.view_layer.objects.active=o
        m=o.modifiers.new('dec','DECIMATE'); m.ratio=min(1,float(a[2])/max(1,n)); bpy.ops.object.modifier_apply(modifier='dec'); print(o.name,n,'->',len(o.data.polygons))
for im in bpy.data.images:
    if im.size[0]>2048: im.scale(2048,2048); print('img',im.name,'-> 2048')
bpy.ops.export_scene.gltf(filepath=a[1],export_format='GLB',export_image_format='WEBP',export_image_quality=82,export_animations=False)
