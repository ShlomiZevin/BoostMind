import bpy,sys
a=sys.argv[sys.argv.index('--')+1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a[0])
for o in bpy.context.scene.objects:
    if o.type=='MESH':
        n=len(o.data.polygons); r=float(a[2])
        m=o.modifiers.new('dec','DECIMATE'); m.ratio=r
        # keep armature modifier after decimate
        bpy.context.view_layer.objects.active=o
        while o.modifiers[0].name!='dec': bpy.ops.object.modifier_move_up(modifier='dec')
        bpy.ops.object.modifier_apply(modifier='dec'); print(o.name,n,'->',len(o.data.polygons))
bpy.ops.export_scene.gltf(filepath=a[1],export_format='GLB',export_animation_mode='ACTIONS',export_image_format='WEBP',export_yup=True)
